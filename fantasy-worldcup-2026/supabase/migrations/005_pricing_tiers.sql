-- ── Migración 005: Sistema de Tiers y Precios Dinámicos ─────────

-- 1. Columnas nuevas en jugadores
ALTER TABLE public.jugadores
  ADD COLUMN IF NOT EXISTS tier           SMALLINT      NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS precio_base    NUMERIC(5,2)  NOT NULL DEFAULT 4.00,
  ADD COLUMN IF NOT EXISTS puntos_jornada INTEGER       NOT NULL DEFAULT 0;

-- Validaciones
ALTER TABLE public.jugadores
  ADD CONSTRAINT tier_valido CHECK (tier BETWEEN 1 AND 5);

-- Ampliar rango máximo de precio (antes solo era >= 0)
ALTER TABLE public.jugadores
  DROP CONSTRAINT IF EXISTS precio_positivo,
  ADD CONSTRAINT precio_rango CHECK (precio >= 0 AND precio <= 18);

-- ── Función: actualizar_precios_jornada() ──────────────────────
-- Se llama tras cada jornada para ajustar precios según rendimiento.
-- Lee puntos_jornada de cada jugador y aplica la lógica de subida/bajada.
-- Al terminar, resetea puntos_jornada a 0.
--
-- Reglas:
--   > 5 pts  → sube: min(puntos * 0.05, +0.50)  | tope: $18M
--   < 2 pts  → baja: -0.05 fijo                  | suelo: precio_base * 0.80
--   2–5 pts  → sin cambio

CREATE OR REPLACE FUNCTION public.actualizar_precios_jornada()
RETURNS TABLE (
  jugador_id     UUID,
  nombre_jugador TEXT,
  precio_antes   NUMERIC(5,2),
  precio_despues NUMERIC(5,2),
  cambio         NUMERIC(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec            RECORD;
  v_precio_nuevo NUMERIC(5,2);
  v_suelo        NUMERIC(5,2);
BEGIN
  FOR rec IN
    SELECT j.id, j.nombre, j.precio, j.precio_base, j.puntos_jornada
    FROM   public.jugadores j
    WHERE  j.activo = true
    ORDER  BY j.id
  LOOP
    v_suelo := ROUND(rec.precio_base * 0.80, 2);

    IF rec.puntos_jornada > 5 THEN
      -- Sube: +min(puntos*0.05, 0.50), tope $18M
      v_precio_nuevo := LEAST(
        rec.precio + LEAST(rec.puntos_jornada::NUMERIC * 0.05, 0.50),
        18.00
      );
    ELSIF rec.puntos_jornada < 2 THEN
      -- Baja: -0.05 fijo, suelo 80% del precio base
      v_precio_nuevo := GREATEST(rec.precio - 0.05, v_suelo);
    ELSE
      v_precio_nuevo := rec.precio;
    END IF;

    v_precio_nuevo := ROUND(v_precio_nuevo, 2);

    IF v_precio_nuevo <> rec.precio THEN
      UPDATE public.jugadores
      SET    precio = v_precio_nuevo
      WHERE  id = rec.id;

      jugador_id     := rec.id;
      nombre_jugador := rec.nombre;
      precio_antes   := rec.precio;
      precio_despues := v_precio_nuevo;
      cambio         := v_precio_nuevo - rec.precio;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- Resetea puntos de jornada para la siguiente fecha
  UPDATE public.jugadores SET puntos_jornada = 0 WHERE activo = true;
END;
$$;

-- Solo admins (service_role) pueden actualizar precios de jornada
REVOKE ALL ON FUNCTION public.actualizar_precios_jornada() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.actualizar_precios_jornada() TO service_role;

COMMENT ON FUNCTION public.actualizar_precios_jornada() IS
  'Actualiza precios dinámicos tras cada jornada según puntos_jornada. '
  'Llamar desde n8n después de procesar resultados.';
