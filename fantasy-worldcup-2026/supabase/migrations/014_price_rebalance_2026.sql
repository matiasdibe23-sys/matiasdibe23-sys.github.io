-- ─────────────────────────────────────────────────────────────────
-- Migración 014: Re-balance de precios para Fantasy Mundial 2026
--
-- Tier 1 → $14M  (estrellas mundiales)
-- Tier 2 → $10M  (jugadores de élite)
-- Tier 3 → $7M   (primera línea)
-- Tier 4 → $4M   (regulares)
-- Tier 5 → $2M   (jóvenes / suplentes)
--
-- Con 15 cupos y $100M:
--   11T1 + 4T5 = 11×14 + 4×2  = $162M → imposible → fuerza mezcla de tiers
--   11T2 + 4T4 = 11×10 + 4×4  = $126M → imposible
--   8T2 + 4T3 + 3T4            = 80+28+12 = $120M → imposible
--   6T2 + 5T3 + 4T4            = 60+35+16 = $111M → casi
--   5T2 + 6T3 + 4T4            = 50+42+16 = $108M → casi
--   4T2 + 7T3 + 4T4            = 40+49+16 = $105M → cerca del límite
--   Mix realista con T1:  2T1+5T2+5T3+3T4 = 28+50+35+12 = $125M → necesita T5
--   Ejemplo competitivo:  1T1+4T2+5T3+3T4+2T5 = 14+40+35+12+4 = $105M → casi
--   Ejemplo optimizado:   1T1+3T2+6T3+4T4+1T5 = 14+30+42+16+2 = $104M ≈ $100M
-- Conclusión: estrategia de selección real, no compras premium masivas.
-- ─────────────────────────────────────────────────────────────────

-- 1. Actualizar precios actuales y de base por tier
UPDATE public.jugadores
SET
  precio_base = CASE
    WHEN tier = 1 THEN 14.00
    WHEN tier = 2 THEN 10.00
    WHEN tier = 3 THEN  7.00
    WHEN tier = 4 THEN  4.00
    WHEN tier = 5 THEN  2.00
    ELSE                2.00
  END,
  precio = CASE
    WHEN tier = 1 THEN 14.00
    WHEN tier = 2 THEN 10.00
    WHEN tier = 3 THEN  7.00
    WHEN tier = 4 THEN  4.00
    WHEN tier = 5 THEN  2.00
    ELSE                2.00
  END;

-- 2. Ampliar el tope del CHECK para admitir subidas de precio post-jornada
--    (precio_base 14 + máx subida acumulada de ~4M a lo largo del torneo)
ALTER TABLE public.jugadores
  DROP CONSTRAINT IF EXISTS precio_rango,
  ADD CONSTRAINT precio_rango CHECK (precio >= 0 AND precio <= 20.00);

-- 3. Recalcular presupuesto_restante de todos los usuarios basado en
--    los nuevos precios de sus jugadores ya fichados
UPDATE public.perfiles p
SET presupuesto_restante = 100.00 - COALESCE(
  (SELECT SUM(j.precio)
   FROM   public.equipos_usuarios eu
   JOIN   public.jugadores j ON j.id = eu.jugador_id
   WHERE  eu.usuario_id = p.id),
  0.00
);

-- Verificación rápida
DO $$
DECLARE
  v_total    INTEGER;
  v_t1 INTEGER; v_t2 INTEGER; v_t3 INTEGER; v_t4 INTEGER; v_t5 INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.jugadores WHERE activo = true;
  SELECT COUNT(*) INTO v_t1 FROM public.jugadores WHERE tier=1 AND activo=true;
  SELECT COUNT(*) INTO v_t2 FROM public.jugadores WHERE tier=2 AND activo=true;
  SELECT COUNT(*) INTO v_t3 FROM public.jugadores WHERE tier=3 AND activo=true;
  SELECT COUNT(*) INTO v_t4 FROM public.jugadores WHERE tier=4 AND activo=true;
  SELECT COUNT(*) INTO v_t5 FROM public.jugadores WHERE tier=5 AND activo=true;
  RAISE NOTICE 'Jugadores activos: % | T1=$14M:% T2=$10M:% T3=$7M:% T4=$4M:% T5=$2M:%',
    v_total, v_t1, v_t2, v_t3, v_t4, v_t5;
END;
$$;
