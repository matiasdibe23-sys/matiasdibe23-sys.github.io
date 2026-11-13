-- Agrega columnas de detalle del jugador (extraídas del PDF FIFA)
ALTER TABLE public.jugadores
  ADD COLUMN IF NOT EXISTS dorsal          SMALLINT,
  ADD COLUMN IF NOT EXISTS nombre_camiseta TEXT,
  ADD COLUMN IF NOT EXISTS club            TEXT,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS estatura_cm     SMALLINT;
