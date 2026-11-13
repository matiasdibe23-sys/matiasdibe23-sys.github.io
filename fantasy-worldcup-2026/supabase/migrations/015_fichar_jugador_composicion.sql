-- ─────────────────────────────────────────────────────────────────
-- Migración 015: fichar_jugador con validación de composición
--
-- Cupos por posición (los 15 lugares):
--   POR: exactamente 2
--   DEF: exactamente 5
--   MED: exactamente 5
--   DEL: exactamente 3
--   TOTAL: 15
--
-- Nuevos errores:
--   limite_posicion_POR  — ya tienes 2 porteros
--   limite_posicion_DEF  — ya tienes 5 defensas
--   limite_posicion_MED  — ya tienes 5 mediocampistas
--   limite_posicion_DEL  — ya tienes 3 delanteros
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fichar_jugador(
  p_usuario_id UUID,
  p_jugador_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_precio          NUMERIC(5,2);
  v_seleccion_id    UUID;
  v_posicion        posicion_jugador;
  v_presupuesto     NUMERIC(10,2);
  v_count_equipo    INTEGER;
  v_count_seleccion INTEGER;
  v_count_posicion  INTEGER;

  -- Cupos máximos por posición
  MAX_POR CONSTANT INTEGER := 2;
  MAX_DEF CONSTANT INTEGER := 5;
  MAX_MED CONSTANT INTEGER := 5;
  MAX_DEL CONSTANT INTEGER := 3;
  MAX_EQUIPO CONSTANT INTEGER := 15;
BEGIN
  -- ── Seguridad ─────────────────────────────────────────────────
  IF auth.uid() IS DISTINCT FROM p_usuario_id THEN
    RAISE EXCEPTION 'accion_no_autorizada: Solo puedes modificar tu propio equipo.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Lock del perfil (previene race conditions) ───────────────
  SELECT presupuesto_restante
  INTO   v_presupuesto
  FROM   public.perfiles
  WHERE  id = p_usuario_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'accion_no_autorizada: Perfil no encontrado.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Datos del jugador ─────────────────────────────────────────
  SELECT precio, seleccion_id, posicion
  INTO   v_precio, v_seleccion_id, v_posicion
  FROM   public.jugadores
  WHERE  id     = p_jugador_id
    AND  activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'jugador_no_disponible: El jugador no existe o no está disponible.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── V1: ¿ya está fichado? ─────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM public.equipos_usuarios
    WHERE  usuario_id = p_usuario_id AND jugador_id = p_jugador_id
  ) THEN
    RAISE EXCEPTION 'jugador_ya_fichado: Este jugador ya está en tu equipo.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── V2: presupuesto ───────────────────────────────────────────
  IF v_presupuesto < v_precio THEN
    RAISE EXCEPTION 'presupuesto_insuficiente: Necesitás $%M pero solo tenés $%M.',
      v_precio, v_presupuesto
      USING ERRCODE = 'P0001';
  END IF;

  -- ── V3: cupo total (15) ───────────────────────────────────────
  SELECT COUNT(*) INTO v_count_equipo
  FROM   public.equipos_usuarios
  WHERE  usuario_id = p_usuario_id;

  IF v_count_equipo >= MAX_EQUIPO THEN
    RAISE EXCEPTION 'equipo_completo: Tu equipo ya tiene % jugadores (máximo permitido).',
      MAX_EQUIPO
      USING ERRCODE = 'P0001';
  END IF;

  -- ── V4: composición por posición ──────────────────────────────
  SELECT COUNT(*) INTO v_count_posicion
  FROM   public.equipos_usuarios eu
  JOIN   public.jugadores j ON j.id = eu.jugador_id
  WHERE  eu.usuario_id = p_usuario_id
    AND  j.posicion    = v_posicion;

  CASE v_posicion
    WHEN 'POR' THEN
      IF v_count_posicion >= MAX_POR THEN
        RAISE EXCEPTION 'limite_posicion_POR: Ya tenés % porteros (máximo %).',
          v_count_posicion, MAX_POR USING ERRCODE = 'P0001';
      END IF;
    WHEN 'DEF' THEN
      IF v_count_posicion >= MAX_DEF THEN
        RAISE EXCEPTION 'limite_posicion_DEF: Ya tenés % defensas (máximo %).',
          v_count_posicion, MAX_DEF USING ERRCODE = 'P0001';
      END IF;
    WHEN 'MED' THEN
      IF v_count_posicion >= MAX_MED THEN
        RAISE EXCEPTION 'limite_posicion_MED: Ya tenés % mediocampistas (máximo %).',
          v_count_posicion, MAX_MED USING ERRCODE = 'P0001';
      END IF;
    WHEN 'DEL' THEN
      IF v_count_posicion >= MAX_DEL THEN
        RAISE EXCEPTION 'limite_posicion_DEL: Ya tenés % delanteros (máximo %).',
          v_count_posicion, MAX_DEL USING ERRCODE = 'P0001';
      END IF;
  END CASE;

  -- ── V5: máximo 3 por selección nacional ───────────────────────
  SELECT COUNT(*) INTO v_count_seleccion
  FROM   public.equipos_usuarios eu
  JOIN   public.jugadores j ON j.id = eu.jugador_id
  WHERE  eu.usuario_id  = p_usuario_id
    AND  j.seleccion_id = v_seleccion_id;

  IF v_count_seleccion >= 3 THEN
    RAISE EXCEPTION 'limite_seleccion: Ya tenés 3 jugadores de esta selección (máximo permitido).'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Commit ─────────────────────────────────────────────────────
  INSERT INTO public.equipos_usuarios (usuario_id, jugador_id, es_titular)
  VALUES (p_usuario_id, p_jugador_id, false);

  UPDATE public.perfiles
  SET    presupuesto_restante = presupuesto_restante - v_precio
  WHERE  id = p_usuario_id;

END;
$$;

REVOKE ALL ON FUNCTION public.fichar_jugador(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fichar_jugador(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.fichar_jugador(UUID, UUID) IS
  'Ficha un jugador aplicando reglas: 15 cupos (2POR+5DEF+5MED+3DEL), '
  'max 3 por selección, presupuesto $100M.';
