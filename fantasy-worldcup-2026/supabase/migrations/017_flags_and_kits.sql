-- ─────────────────────────────────────────────────────────────────
-- Migración 017: Banderas ISO + Kits de selecciones
--
-- 1. Añade pais_codigo_iso a selecciones_nacionales (ej. "ar", "gb-eng")
-- 2. Genera bandera_url apuntando a flagicons CDN (1×1 SVG circular)
-- 3. Crea tabla kits_templates con colores primario/secundario y patrón
-- ─────────────────────────────────────────────────────────────────

-- ── 1. Columna ISO en selecciones_nacionales ──────────────────────

ALTER TABLE public.selecciones_nacionales
  ADD COLUMN IF NOT EXISTS pais_codigo_iso TEXT;

-- Constraint: solo letras minúsculas y guión (para "gb-eng", "gb-sct")
ALTER TABLE public.selecciones_nacionales
  DROP CONSTRAINT IF EXISTS iso_formato,
  ADD CONSTRAINT iso_formato CHECK (pais_codigo_iso ~ '^[a-z]{2}(-[a-z]+)?$');

-- ── 2. Mapeo nombre → código ISO ──────────────────────────────────

UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'dz' WHERE nombre = 'Algeria (ALG)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'ar' WHERE nombre = 'Argentina (ARG)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'au' WHERE nombre = 'Australia (AUS)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'at' WHERE nombre = 'Austria (AUT)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'be' WHERE nombre = 'Belgium (BEL)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'ba' WHERE nombre = 'Bosnia And Herzegovina (BIH)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'br' WHERE nombre = 'Brazil (BRA)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'cv' WHERE nombre = 'Cabo Verde (CPV)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'ca' WHERE nombre = 'Canada (CAN)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'co' WHERE nombre = 'Colombia (COL)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'cd' WHERE nombre = 'Congo DR (COD)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'ci' WHERE nombre = 'Côte D''Ivoire (CIV)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'hr' WHERE nombre = 'Croatia (CRO)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'cw' WHERE nombre = 'Curaçao (CUW)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'cz' WHERE nombre = 'Czechia (CZE)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'ec' WHERE nombre = 'Ecuador (ECU)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'eg' WHERE nombre = 'Egypt (EGY)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'gb-eng' WHERE nombre = 'England (ENG)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'fr' WHERE nombre = 'France (FRA)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'de' WHERE nombre = 'Germany (GER)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'gh' WHERE nombre = 'Ghana (GHA)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'ht' WHERE nombre = 'Haiti (HAI)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'ir' WHERE nombre = 'IR Iran (IRN)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'iq' WHERE nombre = 'Iraq (IRQ)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'jp' WHERE nombre = 'Japan (JPN)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'jo' WHERE nombre = 'Jordan (JOR)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'kr' WHERE nombre = 'Korea Republic (KOR)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'mx' WHERE nombre = 'Mexico (MEX)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'ma' WHERE nombre = 'Morocco (MAR)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'nl' WHERE nombre = 'Netherlands (NED)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'nz' WHERE nombre = 'New Zealand (NZL)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'no' WHERE nombre = 'Norway (NOR)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'pa' WHERE nombre = 'Panama (PAN)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'py' WHERE nombre = 'Paraguay (PAR)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'pt' WHERE nombre = 'Portugal (POR)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'qa' WHERE nombre = 'Qatar (QAT)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'sa' WHERE nombre = 'Saudi Arabia (KSA)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'gb-sct' WHERE nombre = 'Scotland (SCO)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'sn' WHERE nombre = 'Senegal (SEN)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'za' WHERE nombre = 'South Africa (RSA)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'es' WHERE nombre = 'Spain (ESP)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'se' WHERE nombre = 'Sweden (SWE)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'ch' WHERE nombre = 'Switzerland (SUI)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'tn' WHERE nombre = 'Tunisia (TUN)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'tr' WHERE nombre = 'Türkiye (TUR)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'uy' WHERE nombre = 'Uruguay (URU)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'us' WHERE nombre = 'USA (USA)';
UPDATE public.selecciones_nacionales SET pais_codigo_iso = 'uz' WHERE nombre = 'Uzbekistan (UZB)';

-- ── 3. bandera_url → CDN flagicons (1×1 circular SVG) ────────────

UPDATE public.selecciones_nacionales
SET bandera_url = 'https://flagicons.lipis.dev/flags/1x1/' || pais_codigo_iso || '.svg'
WHERE pais_codigo_iso IS NOT NULL;

-- ── 4. Tabla kits_templates ───────────────────────────────────────
--
-- patron_estilo:
--   solid      — color liso
--   stripes_v  — rayas verticales (Argentina, Curaçao, Côte d'Ivoire)
--   stripes_h  — rayas horizontales (Austria, Ecuador, Haiti)
--   checkers   — tablero (Croacia)
--   halves_v   — mitad izquierda / mitad derecha (Portugal)
--   hoops      — bandas horizontales anchas (Camerún-style)

CREATE TABLE IF NOT EXISTS public.kits_templates (
  id                SERIAL PRIMARY KEY,
  seleccion_id      UUID NOT NULL REFERENCES public.selecciones_nacionales(id) ON DELETE CASCADE,
  color_primario    TEXT NOT NULL,   -- hex
  color_secundario  TEXT NOT NULL,   -- hex
  color_contorno    TEXT NOT NULL,   -- hex (sombra/borde SVG)
  patron_estilo     TEXT NOT NULL DEFAULT 'solid',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (seleccion_id)
);

ALTER TABLE public.kits_templates
  DROP CONSTRAINT IF EXISTS patron_valido,
  ADD CONSTRAINT patron_valido
    CHECK (patron_estilo IN ('solid','stripes_v','stripes_h','checkers','halves_v','hoops'));

-- RLS: lectura pública para usuarios autenticados
ALTER TABLE public.kits_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kits_select_auth" ON public.kits_templates
  FOR SELECT TO authenticated USING (true);

-- ── 5. Datos de kits por selección ───────────────────────────────

-- helper: insertar por nombre
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Tabla de datos: nombre, primario, secundario, contorno, patron
  FOR r IN SELECT * FROM (VALUES
    ('Algeria (ALG)',               '#007749','#FFFFFF','#005a37','solid'),
    ('Argentina (ARG)',             '#74ACDF','#FFFFFF','#5090c0','stripes_v'),
    ('Australia (AUS)',             '#FFD700','#006400','#d4b800','solid'),
    ('Austria (AUT)',               '#ED2939','#FFFFFF','#c0202f','stripes_h'),
    ('Belgium (BEL)',               '#000000','#FDDA24','#111111','stripes_v'),
    ('Bosnia And Herzegovina (BIH)','#003DA5','#FFCD00','#002d7a','solid'),
    ('Brazil (BRA)',                '#009B3A','#FEDF00','#007a2d','solid'),
    ('Cabo Verde (CPV)',            '#003893','#CF1126','#002870','solid'),
    ('Canada (CAN)',                '#FF0000','#FFFFFF','#cc0000','solid'),
    ('Colombia (COL)',              '#FDD116','#003087','#d4b200','solid'),
    ('Congo DR (COD)',              '#007FFF','#F7D618','#0063c6','solid'),
    ('Côte D''Ivoire (CIV)',        '#F77F00','#FFFFFF','#d46a00','stripes_v'),
    ('Croatia (CRO)',               '#FF2020','#FFFFFF','#cc0000','checkers'),
    ('Curaçao (CUW)',               '#003DA5','#F9E814','#002d7a','solid'),
    ('Czechia (CZE)',               '#D7141A','#FFFFFF','#b01015','stripes_h'),
    ('Ecuador (ECU)',               '#FFD100','#003DA5','#d4af00','stripes_h'),
    ('Egypt (EGY)',                 '#C8102E','#FFFFFF','#a00d24','solid'),
    ('England (ENG)',               '#FFFFFF','#CF081F','#e0e0e0','solid'),
    ('France (FRA)',                '#002395','#FFFFFF','#001a70','solid'),
    ('Germany (GER)',               '#FFFFFF','#000000','#cccccc','solid'),
    ('Ghana (GHA)',                 '#FFFFFF','#006B3F','#e0e0e0','solid'),
    ('Haiti (HAI)',                 '#00209F','#D21034','#001880','stripes_h'),
    ('IR Iran (IRN)',               '#239F40','#FFFFFF','#1a7d30','stripes_h'),
    ('Iraq (IRQ)',                  '#FFFFFF','#CE1126','#e0e0e0','solid'),
    ('Japan (JPN)',                 '#1A2F5E','#FFFFFF','#0f1f3e','solid'),
    ('Jordan (JOR)',                '#007A3D','#FFFFFF','#005e2f','solid'),
    ('Korea Republic (KOR)',        '#FFFFFF','#CD2E3A','#e0e0e0','solid'),
    ('Mexico (MEX)',                '#006847','#FFFFFF','#004f36','solid'),
    ('Morocco (MAR)',               '#C1272D','#006233','#9a1e24','solid'),
    ('Netherlands (NED)',           '#FF6600','#FFFFFF','#cc5200','solid'),
    ('New Zealand (NZL)',           '#FFFFFF','#000000','#e0e0e0','solid'),
    ('Norway (NOR)',                '#EF2B2D','#FFFFFF','#bf2224','solid'),
    ('Panama (PAN)',                '#FFFFFF','#DA121A','#e0e0e0','solid'),
    ('Paraguay (PAR)',              '#D52B1E','#FFFFFF','#aa2218','stripes_h'),
    ('Portugal (POR)',              '#006600','#FF0000','#004d00','halves_v'),
    ('Qatar (QAT)',                 '#8D1B3D','#FFFFFF','#6e1530','solid'),
    ('Saudi Arabia (KSA)',          '#FFFFFF','#006C35','#e0e0e0','solid'),
    ('Scotland (SCO)',              '#003B8E','#FFFFFF','#002d6e','solid'),
    ('Senegal (SEN)',               '#00853F','#FDEF42','#006830','solid'),
    ('South Africa (RSA)',          '#007A4D','#FFB81C','#005e3b','solid'),
    ('Spain (ESP)',                 '#AA151B','#F1BF00','#881118','solid'),
    ('Sweden (SWE)',                '#006AA7','#FECC02','#004e7d','solid'),
    ('Switzerland (SUI)',           '#FF0000','#FFFFFF','#cc0000','solid'),
    ('Tunisia (TUN)',               '#E70013','#FFFFFF','#b8000f','solid'),
    ('Türkiye (TUR)',               '#E30A17','#FFFFFF','#b50812','solid'),
    ('Uruguay (URU)',               '#5EB6E4','#FFFFFF','#4a91b8','solid'),
    ('USA (USA)',                   '#002868','#BF0A30','#001f52','solid'),
    ('Uzbekistan (UZB)',            '#1EB53A','#FFFFFF','#189030','stripes_h')
  ) AS t(nombre_sel, cp, cs, cc, ps)
  LOOP
    INSERT INTO public.kits_templates (seleccion_id, color_primario, color_secundario, color_contorno, patron_estilo)
    SELECT s.id, r.cp, r.cs, r.cc, r.ps
    FROM   public.selecciones_nacionales s
    WHERE  s.nombre = r.nombre_sel
    ON CONFLICT (seleccion_id) DO UPDATE
      SET color_primario   = EXCLUDED.color_primario,
          color_secundario = EXCLUDED.color_secundario,
          color_contorno   = EXCLUDED.color_contorno,
          patron_estilo    = EXCLUDED.patron_estilo;
  END LOOP;
END;
$$;

-- ── 6. Verificación ───────────────────────────────────────────────

DO $$
DECLARE
  v_sin_iso  INTEGER;
  v_sin_kit  INTEGER;
  v_total    INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.selecciones_nacionales;
  SELECT COUNT(*) INTO v_sin_iso FROM public.selecciones_nacionales WHERE pais_codigo_iso IS NULL;
  SELECT COUNT(*) INTO v_sin_kit
  FROM public.selecciones_nacionales s
  LEFT JOIN public.kits_templates k ON k.seleccion_id = s.id
  WHERE k.id IS NULL;

  RAISE NOTICE '== Verificación ==';
  RAISE NOTICE 'Total selecciones: %', v_total;
  RAISE NOTICE 'Sin código ISO: %  (esperado: 0)', v_sin_iso;
  RAISE NOTICE 'Sin kit template: % (esperado: 0)', v_sin_kit;

  IF v_sin_iso > 0 OR v_sin_kit > 0 THEN
    RAISE WARNING 'Hay selecciones sin datos completos — revisa los UPDATEs de arriba';
  ELSE
    RAISE NOTICE 'OK — todas las selecciones tienen ISO + kit';
  END IF;
END;
$$;
