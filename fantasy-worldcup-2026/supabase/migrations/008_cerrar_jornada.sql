-- ══════════════════════════════════════════════════════════════════
-- Migración 008: Cierre de jornada
--
-- Nuevos objetos:
--   • jornadas_procesadas        — registro de jornadas ya cerradas (idempotencia)
--   • obtener_jornada_a_cerrar() — detecta la jornada lista para cerrar
--   • cerrar_jornada(jornada)    — orquesta todo el cierre:
--       1. Valida que no se haya procesado ya
--       2. Calcula y acumula puntos de cada usuario
--       3. Llama a actualizar_precios_jornada()
--       4. Marca la jornada como procesada
--       5. Devuelve ranking de la jornada
-- ══════════════════════════════════════════════════════════════════

-- ── Tabla de control de idempotencia ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.jornadas_procesadas (
  jornada        SMALLINT     PRIMARY KEY,
  procesada_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  usuarios_actualizados INTEGER NOT NULL DEFAULT 0,
  jugadores_con_cambio_precio INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.jornadas_procesadas ENABLE ROW LEVEL SECURITY;

-- Solo service_role escribe; cualquier usuario autenticado puede leer
CREATE POLICY "jp_select_auth"
  ON public.jornadas_procesadas FOR SELECT TO authenticated USING (true);

CREATE POLICY "jp_insert_service"
  ON public.jornadas_procesadas FOR INSERT TO service_role WITH CHECK (true);

COMMENT ON TABLE public.jornadas_procesadas IS
  'Registro de jornadas ya procesadas. Evita doble ejecución de cerrar_jornada().';


-- ══════════════════════════════════════════════════════════════════
-- Función: obtener_jornada_a_cerrar()
--
-- Detecta automáticamente la siguiente jornada que cumple:
--   a) Todos sus partidos están marcados completado = true
--   b) El último partido terminó hace más de p_horas_espera horas
--   c) No ha sido procesada aún en jornadas_procesadas
--
-- Devuelve NULL si no hay ninguna jornada lista.
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.obtener_jornada_a_cerrar(
  p_horas_espera INTEGER DEFAULT 2
)
RETURNS TABLE (
  jornada            SMALLINT,
  total_partidos     BIGINT,
  ultimo_partido_en  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stats_jornada AS (
    SELECT
      p.jornada,
      COUNT(*)                              AS total_partidos,
      COUNT(*) FILTER (WHERE p.completado) AS partidos_completos,
      MAX(p.fecha)                          AS ultimo_partido_en
    FROM public.partidos p
    GROUP BY p.jornada
  )
  SELECT
    sj.jornada,
    sj.total_partidos,
    sj.ultimo_partido_en
  FROM stats_jornada sj
  WHERE sj.total_partidos = sj.partidos_completos          -- todos completos
    AND sj.ultimo_partido_en < NOW() - (p_horas_espera || ' hours')::INTERVAL
    AND NOT EXISTS (                                       -- no procesada aún
      SELECT 1 FROM public.jornadas_procesadas jp
      WHERE jp.jornada = sj.jornada
    )
  ORDER BY sj.jornada
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.obtener_jornada_a_cerrar(INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.obtener_jornada_a_cerrar(INTEGER) TO service_role;
-- También al rol autenticado para que n8n pueda consultarla con la anon key si se configura así
GRANT  EXECUTE ON FUNCTION public.obtener_jornada_a_cerrar(INTEGER) TO authenticated;


-- ══════════════════════════════════════════════════════════════════
-- Función: cerrar_jornada(p_jornada)
--
-- Orquesta el cierre de una jornada. Idempotente: lanza error si
-- la jornada ya fue procesada.
--
-- Pasos:
--   1. Valida que la jornada exista y todos sus partidos estén completos
--   2. Valida idempotencia (jornadas_procesadas)
--   3. Acumula puntos de la jornada en perfiles.puntos_totales
--   4. Llama a actualizar_precios_jornada() (también resetea puntos_jornada en jugadores)
--   5. Registra en jornadas_procesadas
--   6. Devuelve el ranking de la jornada (ordenado por puntos)
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.cerrar_jornada(p_jornada SMALLINT)
RETURNS TABLE (
  posicion          INTEGER,
  usuario_id        UUID,
  username          TEXT,
  nombre_equipo     TEXT,
  puntos_jornada    INTEGER,
  puntos_acumulados INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_partidos        BIGINT;
  v_partidos_completos    BIGINT;
  v_usuarios_actualizados INTEGER;
  v_cambios_precio        INTEGER;
BEGIN
  -- ── Validar que la jornada existe ───────────────────────────────
  SELECT COUNT(*), COUNT(*) FILTER (WHERE completado)
  INTO v_total_partidos, v_partidos_completos
  FROM public.partidos
  WHERE jornada = p_jornada;

  IF v_total_partidos = 0 THEN
    RAISE EXCEPTION 'jornada_no_encontrada: No existen partidos para la jornada %.', p_jornada
      USING ERRCODE = 'P0001';
  END IF;

  IF v_total_partidos <> v_partidos_completos THEN
    RAISE EXCEPTION 'jornada_incompleta: La jornada % tiene % partido(s) sin completar.',
      p_jornada, v_total_partidos - v_partidos_completos
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Idempotencia ────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM public.jornadas_procesadas WHERE jornada = p_jornada) THEN
    RAISE EXCEPTION 'jornada_ya_procesada: La jornada % ya fue cerrada el %.',
      p_jornada,
      (SELECT procesada_en FROM public.jornadas_procesadas WHERE jornada = p_jornada)
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Acumular puntos por usuario ─────────────────────────────────
  -- Suma los puntos de TODOS los jugadores del equipo del usuario
  -- que jugaron en esta jornada (independientemente de es_titular).
  -- Cuando se implemente selección de equipo por jornada, filtrar aquí.
  WITH puntos_por_usuario AS (
    SELECT
      eu.usuario_id,
      COALESCE(SUM(pj.puntos), 0)::INTEGER AS pts
    FROM public.equipos_usuarios eu
    JOIN public.puntos_jornada pj
      ON pj.jugador_id = eu.jugador_id
     AND pj.jornada    = p_jornada
    GROUP BY eu.usuario_id
  )
  UPDATE public.perfiles p
  SET    puntos_totales = p.puntos_totales + ppu.pts
  FROM   puntos_por_usuario ppu
  WHERE  p.id = ppu.usuario_id
    AND  ppu.pts > 0;

  GET DIAGNOSTICS v_usuarios_actualizados = ROW_COUNT;

  -- ── Actualizar precios dinámicos ─────────────────────────────────
  -- Internamente también resetea jugadores.puntos_jornada = 0.
  SELECT COUNT(*)
  INTO v_cambios_precio
  FROM public.actualizar_precios_jornada();

  -- ── Registrar cierre ────────────────────────────────────────────
  INSERT INTO public.jornadas_procesadas (jornada, usuarios_actualizados, jugadores_con_cambio_precio)
  VALUES (p_jornada, v_usuarios_actualizados, v_cambios_precio);

  -- ── Devolver ranking de la jornada ──────────────────────────────
  RETURN QUERY
  WITH pts_jornada AS (
    SELECT
      eu.usuario_id,
      COALESCE(SUM(pj.puntos), 0)::INTEGER AS pts
    FROM public.equipos_usuarios eu
    LEFT JOIN public.puntos_jornada pj
      ON pj.jugador_id = eu.jugador_id
     AND pj.jornada    = p_jornada
    GROUP BY eu.usuario_id
  )
  SELECT
    DENSE_RANK() OVER (ORDER BY COALESCE(pj.pts, 0) DESC)::INTEGER AS posicion,
    p.id,
    p.username,
    COALESCE(p.nombre_equipo, p.username),
    COALESCE(pj.pts, 0),
    p.puntos_totales
  FROM public.perfiles p
  LEFT JOIN pts_jornada pj ON pj.usuario_id = p.id
  ORDER BY posicion, p.username;
END;
$$;

REVOKE ALL ON FUNCTION public.cerrar_jornada(SMALLINT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cerrar_jornada(SMALLINT) TO service_role;

COMMENT ON FUNCTION public.cerrar_jornada IS
  'Cierra una jornada: acumula puntos en perfiles, actualiza precios y registra el cierre. '
  'Idempotente — lanza error si la jornada ya fue procesada. '
  'Llamar desde el script 4-cerrar-jornada.mjs o desde n8n con service_role key.';


-- ── Opcional: pg_cron (requiere extensión habilitada en Supabase) ─
-- Para habilitarla: Dashboard → Database → Extensions → pg_cron
--
-- El job se registra en cron.job y puede editarse desde ahí.
-- Corre todos los días a las 00:30 UTC. Si no hay jornada lista,
-- la función retorna sin hacer nada (la condición de idempotencia
-- está en obtener_jornada_a_cerrar).
--
-- DESCOMENTA SOLO SI TIENES pg_cron HABILITADO:
-- ─────────────────────────────────────────────────────────────────
-- SELECT cron.schedule(
--   'cerrar-jornada-diario',
--   '30 0 * * *',   -- 00:30 UTC cada día
--   $$
--     DO $$
--     DECLARE v_jornada SMALLINT;
--     BEGIN
--       SELECT jornada INTO v_jornada FROM public.obtener_jornada_a_cerrar(2) LIMIT 1;
--       IF v_jornada IS NOT NULL THEN
--         PERFORM public.cerrar_jornada(v_jornada);
--         RAISE NOTICE 'Jornada % cerrada exitosamente.', v_jornada;
--       END IF;
--     END;
--     $$
--   $$
-- );
