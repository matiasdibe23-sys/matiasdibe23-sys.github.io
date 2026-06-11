-- ══════════════════════════════════════════════════════════════════
-- Migración 009: Motor de puntuación en tiempo real
--
-- Flujo completo de una jornada:
--   1. Antes de la jornada → congelar_alineacion(p_jornada)
--      Copia el XI actual de cada usuario en `alineaciones`.
--   2. Durante la jornada → registrar_partido(...) [ya existía]
--      Inserta/actualiza `puntos_jornada`.
--      El trigger trg_distribuir_puntos_jornada distribuye en tiempo
--      real los puntos a `clasificacion_jornada` para cada usuario
--      que tenga al jugador en su alineación congelada.
--   3. Cierre → cerrar_jornada(p_jornada) [actualizada]
--      Lee de `clasificacion_jornada` si hay alineaciones congeladas,
--      o cae a `equipos_usuarios.es_titular` como compatibilidad.
--
-- Nuevos objetos:
--   • alineaciones                  — XI titular congelada por usuario×jornada
--   • clasificacion_jornada         — puntos en tiempo real por usuario×jornada
--   • calcular_puntos_jugador()     — ACTUALIZACIÓN: añade bonus por minutos
--   • distribuir_puntos_tras_registro() — trigger function
--   • trg_distribuir_puntos_jornada — trigger AFTER INSERT OR UPDATE
--   • congelar_alineacion(jornada)  — congela el XI actual de todos los usuarios
--   • cerrar_jornada()              — ACTUALIZACIÓN: usa clasificacion_jornada
-- ══════════════════════════════════════════════════════════════════


-- ── Tabla: alineaciones ───────────────────────────────────────────
-- Una fila por (usuario × jugador × jornada).
-- Se crea llamando a congelar_alineacion() antes del primer partido.
-- Los puntos del trigger SOLO se acreditan a usuarios con fila aquí.
CREATE TABLE public.alineaciones (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id  UUID         NOT NULL REFERENCES public.perfiles(id)  ON DELETE CASCADE,
  jugador_id  UUID         NOT NULL REFERENCES public.jugadores(id) ON DELETE CASCADE,
  jornada     SMALLINT     NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_alineacion UNIQUE (usuario_id, jugador_id, jornada)
);

CREATE INDEX idx_alineaciones_jornada ON public.alineaciones(jornada);
CREATE INDEX idx_alineaciones_jugador ON public.alineaciones(jugador_id, jornada);

COMMENT ON TABLE public.alineaciones IS
  'Foto fija del XI titular de cada usuario para una jornada. '
  'Debe congelarse con congelar_alineacion() antes del inicio de la jornada.';


-- ── Tabla: clasificacion_jornada ──────────────────────────────────
-- Puntos acumulados de cada usuario en cada jornada.
-- Actualizada automáticamente por el trigger cada vez que se
-- registran estadísticas en puntos_jornada.
CREATE TABLE public.clasificacion_jornada (
  usuario_id  UUID         NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  jornada     SMALLINT     NOT NULL,
  puntos      INTEGER      NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  PRIMARY KEY (usuario_id, jornada)
);

CREATE INDEX idx_cj_jornada ON public.clasificacion_jornada(jornada, puntos DESC);

COMMENT ON TABLE public.clasificacion_jornada IS
  'Ranking en tiempo real por jornada. '
  'Mantenido por trg_distribuir_puntos_jornada. '
  'Requiere alineaciones congeladas para reflejar resultados.';


-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.alineaciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clasificacion_jornada ENABLE ROW LEVEL SECURITY;

-- alineaciones: cada usuario ve solo la suya; solo service_role escribe
CREATE POLICY "alin_select_own"
  ON public.alineaciones FOR SELECT TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY "alin_insert_service"
  ON public.alineaciones FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "alin_delete_service"
  ON public.alineaciones FOR DELETE TO service_role USING (true);

-- clasificacion_jornada: todos pueden leer (ranking público); service_role escribe
CREATE POLICY "cj_select_auth"
  ON public.clasificacion_jornada FOR SELECT TO authenticated USING (true);

CREATE POLICY "cj_insert_service"
  ON public.clasificacion_jornada FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "cj_update_service"
  ON public.clasificacion_jornada FOR UPDATE TO service_role USING (true);


-- ══════════════════════════════════════════════════════════════════
-- Función: calcular_puntos_jugador()  — v2 (bonus de minutos añadido)
--
-- Reglas completas:
--   Minutos >= 60  → +2     Minutos 1–59  → +1     Minutos = 0 → 0
--   Gol DEL → +4   Gol MED → +5   Gol DEF/POR → +6
--   Asistencia → +3 (todas las posiciones)
--   Portería a cero (POR/DEF, ≥ 60 min) → +4
--   Tarjeta amarilla → -1   Tarjeta roja → -3
--   Error que cuesta gol → -2
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.calcular_puntos_jugador(
  p_posicion       posicion_jugador,
  p_minutos        SMALLINT,
  p_goles          SMALLINT,
  p_asistencias    SMALLINT,
  p_porteria_cero  BOOLEAN,
  p_amarilla       BOOLEAN,
  p_roja           BOOLEAN,
  p_errores_gol    SMALLINT
)
RETURNS SMALLINT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (
    -- Bonus por participación (minutos jugados)
    CASE
      WHEN p_minutos >= 60 THEN 2
      WHEN p_minutos  > 0  THEN 1
      ELSE 0
    END
    -- Goles (valor diferente según posición)
    + p_goles * CASE p_posicion
        WHEN 'POR' THEN 6
        WHEN 'DEF' THEN 6
        WHEN 'MED' THEN 5
        WHEN 'DEL' THEN 4
      END
    -- Asistencias
    + p_asistencias * 3
    -- Portería a cero: solo POR/DEF que jugaron ≥ 60 min
    + CASE
        WHEN p_porteria_cero
          AND p_posicion IN ('POR', 'DEF')
          AND p_minutos  >= 60
        THEN 4
        ELSE 0
      END
    -- Tarjetas (roja no acumula la amarilla)
    - CASE WHEN p_amarilla AND NOT p_roja THEN 1 ELSE 0 END
    - CASE WHEN p_roja THEN 3 ELSE 0 END
    -- Errores que cuestan gol
    - p_errores_gol * 2
  )::SMALLINT
$$;

COMMENT ON FUNCTION public.calcular_puntos_jugador IS
  'v2 — Calcula los puntos de un jugador para un partido. '
  'Añade bonus de participación: ≥60 min → +2, 1-59 min → +1.';


-- ══════════════════════════════════════════════════════════════════
-- Trigger function: distribuir_puntos_tras_registro()
--
-- Ejecutada AFTER INSERT OR UPDATE OF puntos ON puntos_jornada.
-- Localiza a todos los usuarios que tienen a NEW.jugador_id
-- como titular congelado en alineaciones para NEW.jornada y les
-- acredita el delta de puntos en clasificacion_jornada.
--
-- Soporta re-envíos (registrar_partido usa ON CONFLICT DO UPDATE):
--   INSERT → acredita NEW.puntos
--   UPDATE → acredita NEW.puntos - OLD.puntos  (delta, puede ser negativo)
--
-- Si nadie congeló alineación para esta jornada (alineaciones vacía),
-- no hace nada; el cierre usará el fallback de equipos_usuarios.
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.distribuir_puntos_tras_registro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta SMALLINT;
BEGIN
  v_delta := CASE TG_OP
    WHEN 'INSERT' THEN NEW.puntos
    WHEN 'UPDATE' THEN NEW.puntos - OLD.puntos
    ELSE 0
  END;

  IF v_delta = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.clasificacion_jornada (usuario_id, jornada, puntos, updated_at)
  SELECT
    a.usuario_id,
    NEW.jornada,
    v_delta,
    NOW()
  FROM public.alineaciones a
  WHERE a.jugador_id = NEW.jugador_id
    AND a.jornada    = NEW.jornada
  ON CONFLICT (usuario_id, jornada)
    DO UPDATE SET
      puntos     = clasificacion_jornada.puntos + EXCLUDED.puntos,
      updated_at = NOW();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.distribuir_puntos_tras_registro() FROM PUBLIC;

COMMENT ON FUNCTION public.distribuir_puntos_tras_registro IS
  'Trigger: distribuye en tiempo real los puntos de un jugador a los usuarios '
  'que lo tienen titular en su alineación congelada para esa jornada.';


-- ── Trigger ───────────────────────────────────────────────────────
-- Se dispara por cambios en la columna `puntos` para no reaccionar
-- a actualizaciones administrativas de otras columnas.
CREATE TRIGGER trg_distribuir_puntos_jornada
  AFTER INSERT OR UPDATE OF puntos
  ON public.puntos_jornada
  FOR EACH ROW
  EXECUTE FUNCTION public.distribuir_puntos_tras_registro();

COMMENT ON TRIGGER trg_distribuir_puntos_jornada ON public.puntos_jornada IS
  'Actualiza clasificacion_jornada en tiempo real al insertar/recalcular puntos de un jugador.';


-- ══════════════════════════════════════════════════════════════════
-- Función: congelar_alineacion(p_jornada)
--
-- Copia el XI titular actual de TODOS los usuarios
-- (equipos_usuarios.es_titular = TRUE) en alineaciones para p_jornada.
-- Usar ON CONFLICT DO NOTHING para ser idempotente (se puede llamar
-- varias veces sin duplicar filas).
--
-- Llamar desde n8n o admin CON service_role key, ANTES de que
-- empiecen los primeros partidos de la jornada.
--
-- Retorna el número de usuarios distintos cuya XI fue congelada.
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.congelar_alineacion(p_jornada SMALLINT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuarios INTEGER;
BEGIN
  INSERT INTO public.alineaciones (usuario_id, jugador_id, jornada)
  SELECT eu.usuario_id, eu.jugador_id, p_jornada
  FROM   public.equipos_usuarios eu
  WHERE  eu.es_titular = TRUE
  ON CONFLICT (usuario_id, jugador_id, jornada) DO NOTHING;

  SELECT COUNT(DISTINCT usuario_id)
  INTO   v_usuarios
  FROM   public.alineaciones
  WHERE  jornada = p_jornada;

  RETURN v_usuarios;
END;
$$;

REVOKE ALL ON FUNCTION public.congelar_alineacion(SMALLINT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.congelar_alineacion(SMALLINT) TO service_role;

COMMENT ON FUNCTION public.congelar_alineacion IS
  'Congela el XI actual de todos los usuarios en alineaciones para la jornada indicada. '
  'Idempotente. Debe llamarse ANTES del primer partido de la jornada. '
  'Requiere service_role key.';


-- ══════════════════════════════════════════════════════════════════
-- Función: cerrar_jornada()  — ACTUALIZACIÓN
--
-- Cambios respecto a la versión anterior:
--   • Si hay alineaciones congeladas → lee de clasificacion_jornada
--     (mantenida en tiempo real por el trigger). Más rápido y usa
--     la alineación de la jornada específica (regla de seguridad).
--   • Si NO hay alineaciones → fallback a equipos_usuarios.es_titular
--     para compatibilidad con jornadas sin snapshot.
--   • El ranking final también proviene de clasificacion_jornada
--     cuando está disponible.
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
  v_usuarios_actualizados INTEGER := 0;
  v_cambios_precio        INTEGER;
  v_alineaciones_frozen   BOOLEAN;
BEGIN
  -- ── 1. Validar que la jornada existe y está completa ─────────────
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

  -- ── 2. Idempotencia ─────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM public.jornadas_procesadas WHERE jornada = p_jornada) THEN
    RAISE EXCEPTION 'jornada_ya_procesada: La jornada % ya fue cerrada el %.',
      p_jornada,
      (SELECT procesada_en FROM public.jornadas_procesadas WHERE jornada = p_jornada)
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 3. ¿Hay alineaciones congeladas para esta jornada? ───────────
  SELECT EXISTS(
    SELECT 1 FROM public.alineaciones WHERE jornada = p_jornada
  ) INTO v_alineaciones_frozen;

  -- ── 4. Acumular puntos en perfiles.puntos_totales ─────────────────
  IF v_alineaciones_frozen THEN
    -- Ruta principal: fuente de verdad = clasificacion_jornada
    -- (mantenida en tiempo real por el trigger al registrar_partido)
    WITH puntos_por_usuario AS (
      SELECT usuario_id, puntos AS pts
      FROM   public.clasificacion_jornada
      WHERE  jornada = p_jornada AND puntos > 0
    )
    UPDATE public.perfiles p
    SET    puntos_totales = p.puntos_totales + ppu.pts
    FROM   puntos_por_usuario ppu
    WHERE  p.id = ppu.usuario_id;

    GET DIAGNOSTICS v_usuarios_actualizados = ROW_COUNT;

  ELSE
    -- Fallback: compatibilidad con jornadas sin snapshot de alineación.
    -- Suma los titulares actuales (es_titular = TRUE).
    WITH puntos_por_usuario AS (
      SELECT
        eu.usuario_id,
        COALESCE(SUM(pj.puntos), 0)::INTEGER AS pts
      FROM public.equipos_usuarios eu
      JOIN public.puntos_jornada pj
        ON pj.jugador_id = eu.jugador_id
       AND pj.jornada    = p_jornada
      WHERE eu.es_titular = TRUE
      GROUP BY eu.usuario_id
    )
    UPDATE public.perfiles p
    SET    puntos_totales = p.puntos_totales + ppu.pts
    FROM   puntos_por_usuario ppu
    WHERE  p.id = ppu.usuario_id
      AND  ppu.pts > 0;

    GET DIAGNOSTICS v_usuarios_actualizados = ROW_COUNT;
  END IF;

  -- ── 5. Actualizar precios dinámicos (también resetea puntos_jornada) ─
  SELECT COUNT(*)
  INTO v_cambios_precio
  FROM public.actualizar_precios_jornada();

  -- ── 6. Registrar cierre ─────────────────────────────────────────
  INSERT INTO public.jornadas_procesadas (
    jornada, usuarios_actualizados, jugadores_con_cambio_precio
  )
  VALUES (p_jornada, v_usuarios_actualizados, v_cambios_precio);

  -- ── 7. Devolver ranking de la jornada ────────────────────────────
  RETURN QUERY
  WITH pts_jornada AS (
    -- Fuente preferida: clasificacion_jornada (trigger-based)
    SELECT cj.usuario_id, cj.puntos AS pts
    FROM   public.clasificacion_jornada cj
    WHERE  cj.jornada = p_jornada AND v_alineaciones_frozen

    UNION ALL

    -- Fallback: recalcula si no hubo congelamiento
    SELECT
      eu.usuario_id,
      COALESCE(SUM(pj.puntos), 0)::INTEGER AS pts
    FROM public.equipos_usuarios eu
    LEFT JOIN public.puntos_jornada pj
      ON pj.jugador_id = eu.jugador_id
     AND pj.jornada    = p_jornada
    WHERE NOT v_alineaciones_frozen
    GROUP BY eu.usuario_id
  )
  SELECT
    DENSE_RANK() OVER (ORDER BY COALESCE(pj.pts, 0) DESC)::INTEGER,
    p.id,
    p.username,
    COALESCE(p.nombre_equipo, p.username),
    COALESCE(pj.pts, 0),
    p.puntos_totales
  FROM public.perfiles p
  LEFT JOIN pts_jornada pj ON pj.usuario_id = p.id
  ORDER BY 1, p.username;
END;
$$;

REVOKE ALL ON FUNCTION public.cerrar_jornada(SMALLINT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cerrar_jornada(SMALLINT) TO service_role;

COMMENT ON FUNCTION public.cerrar_jornada IS
  'v2 — Cierra la jornada: acumula puntos, actualiza precios y registra el cierre. '
  'Usa clasificacion_jornada (trigger) cuando hay alineaciones congeladas; '
  'si no, cae al cálculo desde equipos_usuarios.es_titular. '
  'Idempotente. Requiere service_role key.';
