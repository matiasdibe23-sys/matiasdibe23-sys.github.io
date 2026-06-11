-- ── Migración 011: Corrige límite de plantilla fantasy a 15 ──────
-- El límite del equipo fantasy por usuario es 15 jugadores.
-- Los 26 eran la convocatoria de cada selección real, no el límite de fichajes.
-- Migration 004 tenía >= 26 por error; se corrige aquí.
-- Migration 010 cambió el COMMENT a "26 jugadores" por error; se revierte.

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
  v_presupuesto     NUMERIC(10,2);
  v_count_equipo    INTEGER;
  v_count_seleccion INTEGER;
BEGIN
  -- ── Seguridad: solo el propio usuario puede fichar jugadores ──
  IF auth.uid() IS DISTINCT FROM p_usuario_id THEN
    RAISE EXCEPTION 'accion_no_autorizada: Solo puedes modificar tu propio equipo.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Lock del perfil para prevenir condiciones de carrera ─────
  SELECT presupuesto_restante
  INTO   v_presupuesto
  FROM   public.perfiles
  WHERE  id = p_usuario_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'accion_no_autorizada: Perfil de usuario no encontrado.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Obtener datos del jugador ─────────────────────────────────
  SELECT precio, seleccion_id
  INTO   v_precio, v_seleccion_id
  FROM   public.jugadores
  WHERE  id = p_jugador_id
    AND  activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'jugador_no_disponible: El jugador no existe o no está disponible.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Validación 1: ¿ya está en el equipo? ─────────────────────
  IF EXISTS (
    SELECT 1
    FROM   public.equipos_usuarios
    WHERE  usuario_id = p_usuario_id
      AND  jugador_id = p_jugador_id
  ) THEN
    RAISE EXCEPTION 'jugador_ya_fichado: Este jugador ya está en tu equipo.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Validación 2: presupuesto suficiente ──────────────────────
  IF v_presupuesto < v_precio THEN
    RAISE EXCEPTION 'presupuesto_insuficiente: Necesitás $%M pero solo tenés $%M disponibles.',
      v_precio, v_presupuesto
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Validación 3: máximo 15 jugadores en el equipo ───────────
  SELECT COUNT(*)
  INTO   v_count_equipo
  FROM   public.equipos_usuarios
  WHERE  usuario_id = p_usuario_id;

  IF v_count_equipo >= 15 THEN
    RAISE EXCEPTION 'equipo_completo: Tu equipo ya tiene 15 jugadores, el máximo permitido.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Validación 4: máximo 3 jugadores por selección ───────────
  SELECT COUNT(*)
  INTO   v_count_seleccion
  FROM   public.equipos_usuarios eu
  JOIN   public.jugadores j ON j.id = eu.jugador_id
  WHERE  eu.usuario_id  = p_usuario_id
    AND  j.seleccion_id = v_seleccion_id;

  IF v_count_seleccion >= 3 THEN
    RAISE EXCEPTION 'limite_seleccion: Ya tenés 3 jugadores de esta selección, el máximo permitido.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Commit: insertar jugador y descontar presupuesto ─────────
  INSERT INTO public.equipos_usuarios (usuario_id, jugador_id, es_titular)
  VALUES (p_usuario_id, p_jugador_id, false);

  UPDATE public.perfiles
  SET    presupuesto_restante = presupuesto_restante - v_precio
  WHERE  id = p_usuario_id;

END;
$$;

REVOKE ALL ON FUNCTION public.fichar_jugador(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fichar_jugador(UUID, UUID) TO authenticated;

-- Revertir comment incorrecto de migration 010
COMMENT ON TABLE public.equipos_usuarios IS
  'Plantilla de hasta 15 jugadores por usuario ($100M de presupuesto)';
