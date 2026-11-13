-- ─────────────────────────────────────────────────────────────────
-- Migración 016: Restricciones de alineación (11 titulares + 4 suplentes)
--
-- Reglas:
--   1. Un usuario no puede tener más de 11 titulares simultáneos.
--   2. La columna es_titular ya existía en equipos_usuarios.
--   3. Trigger BEFORE INSERT/UPDATE evita el 12º titular.
--   4. Vista cupos_alineacion_usuario: estado actual de cada usuario.
--   5. RPC validar_alineacion_completa: confirma que hay exactamente
--      11 titulares con una formación válida al momento de "guardar".
-- ─────────────────────────────────────────────────────────────────

-- ── 1. Trigger: máximo 11 titulares por usuario ───────────────────

CREATE OR REPLACE FUNCTION public.check_titulares_max()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Solo aplica cuando se intenta marcar como titular
  IF NEW.es_titular IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Cuenta titulares actuales del usuario, excluyendo la fila que se modifica
  SELECT COUNT(*)
  INTO   v_count
  FROM   public.equipos_usuarios
  WHERE  usuario_id = NEW.usuario_id
    AND  es_titular = true
    AND  id IS DISTINCT FROM NEW.id;   -- excluye el UPDATE de la misma fila

  IF v_count >= 11 THEN
    RAISE EXCEPTION 'titular_limit: No podés tener más de 11 titulares. '
      'Quitá uno antes de agregar otro. (actuales: %)', v_count
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_titulares_max ON public.equipos_usuarios;
CREATE TRIGGER trg_check_titulares_max
  BEFORE INSERT OR UPDATE OF es_titular
  ON     public.equipos_usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.check_titulares_max();

-- ── 2. Vista: estado de alineación por usuario ────────────────────

CREATE OR REPLACE VIEW public.estado_alineacion AS
SELECT
  eu.usuario_id,
  p.nombre_equipo,
  COUNT(*)                                    AS total_jugadores,
  COUNT(*) FILTER (WHERE eu.es_titular)       AS titulares,
  COUNT(*) FILTER (WHERE NOT eu.es_titular)   AS suplentes,
  COUNT(*) FILTER (WHERE j.posicion='POR')    AS total_por,
  COUNT(*) FILTER (WHERE j.posicion='DEF')    AS total_def,
  COUNT(*) FILTER (WHERE j.posicion='MED')    AS total_med,
  COUNT(*) FILTER (WHERE j.posicion='DEL')    AS total_del,
  COUNT(*) FILTER (WHERE eu.es_titular AND j.posicion='POR') AS tit_por,
  COUNT(*) FILTER (WHERE eu.es_titular AND j.posicion='DEF') AS tit_def,
  COUNT(*) FILTER (WHERE eu.es_titular AND j.posicion='MED') AS tit_med,
  COUNT(*) FILTER (WHERE eu.es_titular AND j.posicion='DEL') AS tit_del,
  -- Alineación completa: 15 jugadores + 11 titulares
  (COUNT(*) = 15 AND COUNT(*) FILTER (WHERE eu.es_titular) = 11) AS alineacion_completa
FROM  public.equipos_usuarios eu
JOIN  public.jugadores j    ON j.id = eu.jugador_id
JOIN  public.perfiles p     ON p.id = eu.usuario_id
GROUP BY eu.usuario_id, p.nombre_equipo;

-- ── 3. RPC: validar_alineacion_completa(usuario_id, formacion) ────
--
-- Llama desde el frontend al hacer "Guardar alineación".
-- Devuelve TRUE si todo es correcto, lanza EXCEPTION si no.
-- Formaciones válidas: 4-3-3, 4-4-2, 3-4-3, 5-3-2, 4-5-1, 3-5-2

CREATE OR REPLACE FUNCTION public.validar_alineacion_completa(
  p_usuario_id UUID,
  p_formacion  TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total     INTEGER;
  v_titulares INTEGER;
  v_tit_por   INTEGER;
  v_tit_def   INTEGER;
  v_tit_med   INTEGER;
  v_tit_del   INTEGER;

  -- Formación válida: "DEF-MED-DEL" ej. "4-3-3"
  v_parts  TEXT[];
  v_def_f  INTEGER;
  v_med_f  INTEGER;
  v_del_f  INTEGER;

  FORMACIONES_VALIDAS TEXT[] := ARRAY[
    '4-3-3','4-4-2','3-4-3','5-3-2','4-5-1','3-5-2'
  ];
BEGIN
  -- ── Seguridad ─────────────────────────────────────────────────
  IF auth.uid() IS DISTINCT FROM p_usuario_id THEN
    RAISE EXCEPTION 'accion_no_autorizada'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Validar formación ─────────────────────────────────────────
  IF p_formacion <> ALL(FORMACIONES_VALIDAS) THEN
    RAISE EXCEPTION 'formacion_invalida: "%" no es una formación válida. '
      'Opciones: 4-3-3, 4-4-2, 3-4-3, 5-3-2, 4-5-1, 3-5-2.', p_formacion
      USING ERRCODE = 'P0001';
  END IF;

  -- Parsear "4-3-3" → DEF=4, MED=3, DEL=3
  v_parts  := string_to_array(p_formacion, '-');
  v_def_f  := v_parts[1]::INTEGER;
  v_med_f  := v_parts[2]::INTEGER;
  v_del_f  := v_parts[3]::INTEGER;
  -- + 1 portero siempre
  -- Total en campo: 1 + v_def_f + v_med_f + v_del_f  debe ser 11

  IF (1 + v_def_f + v_med_f + v_del_f) <> 11 THEN
    RAISE EXCEPTION 'formacion_invalida: La formación "%" suma % jugadores en lugar de 11.',
      p_formacion, (1 + v_def_f + v_med_f + v_del_f)
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Leer estado del equipo ────────────────────────────────────
  SELECT
    COUNT(*)                                         AS total,
    COUNT(*) FILTER (WHERE eu.es_titular)            AS titulares,
    COUNT(*) FILTER (WHERE eu.es_titular AND j.posicion='POR') AS tit_por,
    COUNT(*) FILTER (WHERE eu.es_titular AND j.posicion='DEF') AS tit_def,
    COUNT(*) FILTER (WHERE eu.es_titular AND j.posicion='MED') AS tit_med,
    COUNT(*) FILTER (WHERE eu.es_titular AND j.posicion='DEL') AS tit_del
  INTO v_total, v_titulares, v_tit_por, v_tit_def, v_tit_med, v_tit_del
  FROM public.equipos_usuarios eu
  JOIN public.jugadores j ON j.id = eu.jugador_id
  WHERE eu.usuario_id = p_usuario_id;

  -- ── Validaciones de conteo ────────────────────────────────────
  IF v_titulares <> 11 THEN
    RAISE EXCEPTION 'titulares_incorrectos: La alineación tiene % titulares; deben ser exactamente 11.',
      v_titulares
      USING ERRCODE = 'P0001';
  END IF;

  IF v_tit_por <> 1 THEN
    RAISE EXCEPTION 'composicion_invalida: Debe haber exactamente 1 portero titular (hay %).',
      v_tit_por
      USING ERRCODE = 'P0001';
  END IF;

  IF v_tit_def <> v_def_f THEN
    RAISE EXCEPTION 'composicion_invalida: La formación % requiere % defensas titulares (hay %).',
      p_formacion, v_def_f, v_tit_def
      USING ERRCODE = 'P0001';
  END IF;

  IF v_tit_med <> v_med_f THEN
    RAISE EXCEPTION 'composicion_invalida: La formación % requiere % mediocampistas titulares (hay %).',
      p_formacion, v_med_f, v_tit_med
      USING ERRCODE = 'P0001';
  END IF;

  IF v_tit_del <> v_del_f THEN
    RAISE EXCEPTION 'composicion_invalida: La formación % requiere % delanteros titulares (hay %).',
      p_formacion, v_del_f, v_tit_del
      USING ERRCODE = 'P0001';
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_alineacion_completa(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.validar_alineacion_completa(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.validar_alineacion_completa(UUID, TEXT) IS
  'Valida que la alineación guardada tenga exactamente 11 titulares '
  'en la distribución correcta según la formación. '
  'Llamar antes de cerrar la pantalla de Mi Equipo.';

-- ── 4. Verificación: formaciones producen 11 titulares ────────────
DO $$
DECLARE form TEXT;
BEGIN
  FOREACH form IN ARRAY ARRAY['4-3-3','4-4-2','3-4-3','5-3-2','4-5-1','3-5-2']
  LOOP
    DECLARE parts TEXT[] := string_to_array(form, '-');
    DECLARE total INTEGER := 1 + parts[1]::INT + parts[2]::INT + parts[3]::INT;
    BEGIN
      IF total <> 11 THEN
        RAISE EXCEPTION 'FALLA: formación % suma %', form, total;
      END IF;
      RAISE NOTICE 'OK formación % → % jugadores en campo', form, total;
    END;
  END LOOP;
END;
$$;
