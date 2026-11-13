-- ══════════════════════════════════════════════════════════════════
-- Migración 006: Partidos, puntos por jornada y endpoint de resultados
-- ══════════════════════════════════════════════════════════════════

-- ── Tabla: partidos ──────────────────────────────────────────────
CREATE TABLE public.partidos (
  id                     UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  jornada                SMALLINT     NOT NULL,
  fase                   TEXT         NOT NULL DEFAULT 'grupos',
  seleccion_local_id     UUID         NOT NULL REFERENCES public.selecciones_nacionales(id),
  seleccion_visitante_id UUID         NOT NULL REFERENCES public.selecciones_nacionales(id),
  goles_local            SMALLINT     NOT NULL DEFAULT 0,
  goles_visitante        SMALLINT     NOT NULL DEFAULT 0,
  fecha                  TIMESTAMPTZ  NOT NULL,
  completado             BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT equipos_distintos CHECK (seleccion_local_id <> seleccion_visitante_id),
  CONSTRAINT goles_no_negativos CHECK (goles_local >= 0 AND goles_visitante >= 0),
  CONSTRAINT fase_valida CHECK (fase IN ('grupos', 'octavos', 'cuartos', 'semis', 'final')),
  -- Impide duplicar el mismo enfrentamiento en la misma jornada
  CONSTRAINT uq_partido_jornada UNIQUE (seleccion_local_id, seleccion_visitante_id, jornada)
);

CREATE INDEX idx_partidos_jornada  ON public.partidos(jornada);
CREATE INDEX idx_partidos_fecha    ON public.partidos(fecha);
CREATE INDEX idx_partidos_fase     ON public.partidos(fase);

-- ── Tabla: puntos_jornada ─────────────────────────────────────────
-- Una fila por (partido × jugador) con todas las stats y puntos.
CREATE TABLE public.puntos_jornada (
  id                UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  partido_id        UUID         NOT NULL REFERENCES public.partidos(id)  ON DELETE CASCADE,
  jugador_id        UUID         NOT NULL REFERENCES public.jugadores(id) ON DELETE RESTRICT,
  jornada           SMALLINT     NOT NULL,
  minutos_jugados   SMALLINT     NOT NULL DEFAULT 0,
  goles             SMALLINT     NOT NULL DEFAULT 0,
  asistencias       SMALLINT     NOT NULL DEFAULT 0,
  tarjeta_amarilla  BOOLEAN      NOT NULL DEFAULT FALSE,
  tarjeta_roja      BOOLEAN      NOT NULL DEFAULT FALSE,
  porteria_a_cero   BOOLEAN      NOT NULL DEFAULT FALSE,
  errores_gol       SMALLINT     NOT NULL DEFAULT 0,
  puntos            SMALLINT     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_stat_partido_jugador UNIQUE (partido_id, jugador_id),
  CONSTRAINT minutos_validos  CHECK (minutos_jugados BETWEEN 0 AND 120),
  CONSTRAINT stats_positivas  CHECK (goles >= 0 AND asistencias >= 0 AND errores_gol >= 0)
);

CREATE INDEX idx_pj_jugador  ON public.puntos_jornada(jugador_id);
CREATE INDEX idx_pj_jornada  ON public.puntos_jornada(jornada);
CREATE INDEX idx_pj_partido  ON public.puntos_jornada(partido_id);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.partidos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puntos_jornada ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer partidos y estadísticas
CREATE POLICY "partidos_select_auth"
  ON public.partidos FOR SELECT TO authenticated USING (true);

CREATE POLICY "puntos_jornada_select_auth"
  ON public.puntos_jornada FOR SELECT TO authenticated USING (true);

-- Solo service_role escribe (n8n / admin)
CREATE POLICY "partidos_insert_service"
  ON public.partidos FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "partidos_update_service"
  ON public.partidos FOR UPDATE TO service_role USING (true);

CREATE POLICY "puntos_jornada_insert_service"
  ON public.puntos_jornada FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "puntos_jornada_update_service"
  ON public.puntos_jornada FOR UPDATE TO service_role USING (true);


-- ══════════════════════════════════════════════════════════════════
-- Función: calcular_puntos_jugador()
-- Lógica de scoring pura e inmutable (testeable de forma independiente).
--
-- Reglas:
--   Gol DEF/POR: +6 | Gol MED: +5 | Gol DEL: +4
--   Asistencia:  +3 (todas las posiciones)
--   Portería a cero (POR/DEF, ≥ 60 min): +4
--   Tarjeta amarilla: -1
--   Tarjeta roja:     -3
--   Error que cuesta gol: -2 por error
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
    -- Goles: puntos según posición
    p_goles * CASE p_posicion
      WHEN 'POR' THEN 6
      WHEN 'DEF' THEN 6
      WHEN 'MED' THEN 5
      WHEN 'DEL' THEN 4
    END
    -- Asistencias
    + p_asistencias * 3
    -- Portería a cero: solo POR/DEF que jugaron ≥ 60 minutos
    + CASE
        WHEN p_porteria_cero
          AND p_posicion IN ('POR', 'DEF')
          AND p_minutos >= 60
        THEN 4
        ELSE 0
      END
    -- Tarjetas (la roja ya contiene su propia penalización, no acumula la amarilla)
    - CASE WHEN p_amarilla AND NOT p_roja THEN 1 ELSE 0 END
    - CASE WHEN p_roja THEN 3 ELSE 0 END
    -- Errores que cuestan gol
    - p_errores_gol * 2
  )::SMALLINT
$$;

COMMENT ON FUNCTION public.calcular_puntos_jugador IS
  'Calcula puntos de un jugador para un partido según la rúbrica del fantasy.';


-- ══════════════════════════════════════════════════════════════════
-- RPC: registrar_partido()
--
-- Endpoint principal para subir resultados (manual o n8n).
-- Inserta el partido, calcula y guarda los puntos de cada jugador,
-- y actualiza puntos_jornada + puntos_torneo en jugadores.
-- Soporta re-envío: aplica solo el DELTA para no duplicar puntos.
--
-- Parámetros:
--   p_jornada               — número de jornada (1, 2, 3…)
--   p_fase                  — 'grupos' | 'octavos' | 'cuartos' | 'semis' | 'final'
--   p_seleccion_local_id    — UUID de la selección local
--   p_seleccion_visitante_id — UUID de la selección visitante
--   p_goles_local           — goles del equipo local
--   p_goles_visitante       — goles del equipo visitante
--   p_fecha                 — fecha y hora del partido (ISO 8601)
--   p_estadisticas          — JSON array con stats de cada jugador (ver ejemplo abajo)
--
-- Ejemplo de p_estadisticas:
-- [
--   {
--     "jugador_id": "uuid-del-jugador",
--     "minutos_jugados": 90,
--     "goles": 1,
--     "asistencias": 1,
--     "tarjeta_amarilla": false,
--     "tarjeta_roja": false,
--     "porteria_a_cero": false,
--     "errores_gol": 0
--   }
-- ]
--
-- Retorna: UUID del partido creado / actualizado
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.registrar_partido(
  p_jornada                SMALLINT,
  p_fase                   TEXT,
  p_seleccion_local_id     UUID,
  p_seleccion_visitante_id UUID,
  p_goles_local            SMALLINT,
  p_goles_visitante        SMALLINT,
  p_fecha                  TIMESTAMPTZ,
  p_estadisticas           JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partido_id      UUID;
  v_stat            JSONB;
  v_jugador_id      UUID;
  v_posicion        posicion_jugador;
  v_minutos         SMALLINT;
  v_goles           SMALLINT;
  v_asistencias     SMALLINT;
  v_amarilla        BOOLEAN;
  v_roja            BOOLEAN;
  v_porteria_cero   BOOLEAN;
  v_errores         SMALLINT;
  v_puntos_nuevos   SMALLINT;
  v_puntos_previos  SMALLINT;
  v_delta           SMALLINT;
BEGIN
  -- ── Validaciones básicas ────────────────────────────────────────
  IF p_fase NOT IN ('grupos', 'octavos', 'cuartos', 'semis', 'final') THEN
    RAISE EXCEPTION 'fase_invalida: La fase "%" no es válida.', p_fase
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(p_estadisticas) <> 'array' THEN
    RAISE EXCEPTION 'formato_invalido: p_estadisticas debe ser un array JSON.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Crear o actualizar el partido (upsert por jornada + equipos) ─
  INSERT INTO public.partidos (
    jornada, fase,
    seleccion_local_id, seleccion_visitante_id,
    goles_local, goles_visitante,
    fecha, completado
  )
  VALUES (
    p_jornada, p_fase,
    p_seleccion_local_id, p_seleccion_visitante_id,
    p_goles_local, p_goles_visitante,
    p_fecha, TRUE
  )
  ON CONFLICT (seleccion_local_id, seleccion_visitante_id, jornada)
  DO UPDATE SET
    goles_local     = EXCLUDED.goles_local,
    goles_visitante = EXCLUDED.goles_visitante,
    fecha           = EXCLUDED.fecha,
    fase            = EXCLUDED.fase,
    completado      = TRUE
  RETURNING id INTO v_partido_id;

  -- ── Procesar cada jugador ────────────────────────────────────────
  FOR v_stat IN SELECT value FROM jsonb_array_elements(p_estadisticas)
  LOOP
    v_jugador_id    := (v_stat->>'jugador_id')::UUID;
    v_minutos       := COALESCE((v_stat->>'minutos_jugados')::SMALLINT,  0);
    v_goles         := COALESCE((v_stat->>'goles')::SMALLINT,            0);
    v_asistencias   := COALESCE((v_stat->>'asistencias')::SMALLINT,      0);
    v_amarilla      := COALESCE((v_stat->>'tarjeta_amarilla')::BOOLEAN,  FALSE);
    v_roja          := COALESCE((v_stat->>'tarjeta_roja')::BOOLEAN,      FALSE);
    v_porteria_cero := COALESCE((v_stat->>'porteria_a_cero')::BOOLEAN,   FALSE);
    v_errores       := COALESCE((v_stat->>'errores_gol')::SMALLINT,      0);

    -- Obtener posición del jugador
    SELECT posicion INTO v_posicion
    FROM public.jugadores WHERE id = v_jugador_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'jugador_no_encontrado: El jugador % no existe en la BD.', v_jugador_id
        USING ERRCODE = 'P0001';
    END IF;

    -- Calcular puntos con la fórmula oficial
    v_puntos_nuevos := public.calcular_puntos_jugador(
      v_posicion, v_minutos, v_goles, v_asistencias,
      v_porteria_cero, v_amarilla, v_roja, v_errores
    );

    -- Puntos previos de este jugador en este partido (para calcular delta en re-envíos)
    SELECT puntos INTO v_puntos_previos
    FROM public.puntos_jornada
    WHERE partido_id = v_partido_id AND jugador_id = v_jugador_id;

    v_puntos_previos := COALESCE(v_puntos_previos, 0);
    v_delta          := v_puntos_nuevos - v_puntos_previos;

    -- Insertar o actualizar stats del jugador en este partido
    INSERT INTO public.puntos_jornada (
      partido_id, jugador_id, jornada,
      minutos_jugados, goles, asistencias,
      tarjeta_amarilla, tarjeta_roja, porteria_a_cero, errores_gol,
      puntos
    )
    VALUES (
      v_partido_id, v_jugador_id, p_jornada,
      v_minutos, v_goles, v_asistencias,
      v_amarilla, v_roja, v_porteria_cero, v_errores,
      v_puntos_nuevos
    )
    ON CONFLICT (partido_id, jugador_id) DO UPDATE SET
      minutos_jugados  = EXCLUDED.minutos_jugados,
      goles            = EXCLUDED.goles,
      asistencias      = EXCLUDED.asistencias,
      tarjeta_amarilla = EXCLUDED.tarjeta_amarilla,
      tarjeta_roja     = EXCLUDED.tarjeta_roja,
      porteria_a_cero  = EXCLUDED.porteria_a_cero,
      errores_gol      = EXCLUDED.errores_gol,
      puntos           = EXCLUDED.puntos;

    -- Aplicar solo el DELTA para no duplicar puntos en re-envíos
    IF v_delta <> 0 THEN
      UPDATE public.jugadores
      SET
        puntos_jornada = puntos_jornada + v_delta,
        puntos_torneo  = puntos_torneo  + v_delta
      WHERE id = v_jugador_id;
    END IF;

  END LOOP;

  RETURN v_partido_id;
END;
$$;

-- Solo service_role puede registrar resultados
REVOKE ALL ON FUNCTION public.registrar_partido(SMALLINT, TEXT, UUID, UUID, SMALLINT, SMALLINT, TIMESTAMPTZ, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.registrar_partido(SMALLINT, TEXT, UUID, UUID, SMALLINT, SMALLINT, TIMESTAMPTZ, JSONB) TO service_role;

COMMENT ON FUNCTION public.registrar_partido IS
  'Endpoint principal para subir resultados de partidos. '
  'Soporta re-envío: aplica solo el delta de puntos para no duplicar. '
  'Llamar con service_role key desde n8n o el panel de admin.';
