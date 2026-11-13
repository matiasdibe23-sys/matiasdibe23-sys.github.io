-- Constraint única para upsert de jugadores por nombre + selección
ALTER TABLE public.jugadores
  ADD CONSTRAINT uq_jugador_nombre_seleccion UNIQUE (nombre, seleccion_id);
