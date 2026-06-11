-- ── Migración 010: Correcciones QA ───────────────────────────────
-- Fecha: 2026-06-10
-- Corrige 3 FAILs detectados en auditoría QA:
--   1. jugadores.precio DEFAULT 0.0 → 4.00 (evita fichas gratuitas)
--   2. Falta constraint que impide precio=0 en jugadores activos
--   3. Comentarios de tabla obsoletos (32→48 equipos, 15→26 jugadores)

-- ── FAIL 1 & 2: precio en jugadores ──────────────────────────────
-- El DEFAULT 0.0 dejado por migration 001 permite insertar jugadores
-- activos con precio = 0, que fichar_jugador aceptaría gratis.
-- Migration 005 corrigió el rango [0,18] pero no el DEFAULT ni activos.

ALTER TABLE public.jugadores
  ALTER COLUMN precio SET DEFAULT 4.00;

ALTER TABLE public.jugadores
  ADD CONSTRAINT precio_activo_positivo
    CHECK (activo = FALSE OR precio > 0);

-- ── FAIL 3: Comentarios obsoletos ────────────────────────────────

COMMENT ON TABLE public.selecciones_nacionales IS
  '48 selecciones del Mundial 2026 (grupos A–L, 4 equipos por grupo)';

COMMENT ON TABLE public.equipos_usuarios IS
  'Plantilla de hasta 26 jugadores por usuario ($100M de presupuesto)';
