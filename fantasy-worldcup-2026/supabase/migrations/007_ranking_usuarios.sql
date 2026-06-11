-- ══════════════════════════════════════════════════════════════════
-- Migración 007: Nombre de equipo + Vista ranking_usuarios
-- ══════════════════════════════════════════════════════════════════

-- ── Columna nombre_equipo en perfiles ────────────────────────────
-- Permite que cada usuario personalice el nombre de su equipo.
-- Si no lo configura, se muestra su username.
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS nombre_equipo TEXT;

-- ── Vista: ranking_usuarios ───────────────────────────────────────
-- Calcula en tiempo real los puntos de cada usuario sumando
-- puntos_torneo de sus jugadores activos (jugadores.activo = true).
-- Usa DENSE_RANK para que usuarios empatados compartan posición.
--
-- Columnas expuestas:
--   posicion         — puesto en el ranking (1 = primero)
--   usuario_id       — UUID del usuario
--   nombre_equipo    — nombre personalizado o username como fallback
--   total_jugadores  — cuántos jugadores tiene en el equipo
--   valor_plantilla  — suma de precios actuales de todos sus jugadores
--   puntos_totales   — suma de puntos_torneo de jugadores activos
CREATE OR REPLACE VIEW public.ranking_usuarios
WITH (security_invoker = true)   -- respeta RLS de las tablas subyacentes
AS
WITH stats_por_usuario AS (
  SELECT
    p.id                                                        AS usuario_id,
    COALESCE(p.nombre_equipo, p.username)                       AS nombre_equipo,
    p.username,
    COUNT(eu.id)                                                AS total_jugadores,
    COALESCE(SUM(j.precio),         0)::NUMERIC(8,2)           AS valor_plantilla,
    COALESCE(
      SUM(j.puntos_torneo) FILTER (WHERE j.activo = true), 0
    )::INTEGER                                                  AS puntos_totales
  FROM public.perfiles p
  LEFT JOIN public.equipos_usuarios eu ON eu.usuario_id = p.id
  LEFT JOIN public.jugadores        j  ON j.id = eu.jugador_id
  GROUP BY p.id, p.nombre_equipo, p.username
)
SELECT
  DENSE_RANK() OVER (ORDER BY puntos_totales DESC)::INTEGER  AS posicion,
  usuario_id,
  nombre_equipo,
  username,
  total_jugadores,
  valor_plantilla,
  puntos_totales
FROM stats_por_usuario
ORDER BY posicion, nombre_equipo;   -- desempate alfabético

-- Acceso de lectura para todos los usuarios autenticados
GRANT SELECT ON public.ranking_usuarios TO authenticated;

COMMENT ON VIEW public.ranking_usuarios IS
  'Ranking en tiempo real. Suma puntos_torneo de jugadores activos por usuario. '
  'Actualizar puntos en jugadores.puntos_torneo via registrar_partido() para que este ranking refleje el estado actual.';

-- ── Política en perfiles para escribir nombre_equipo ─────────────
-- El usuario ya puede hacer UPDATE en su propio perfil (política existente),
-- así que nombre_equipo queda cubierto automáticamente.
-- Solo añadimos la validación de longitud mínima.
ALTER TABLE public.perfiles
  ADD CONSTRAINT nombre_equipo_min_length
    CHECK (nombre_equipo IS NULL OR char_length(nombre_equipo) >= 3);
