-- =============================================================
-- FANTASY MUNDIAL 2026 — Esquema inicial
-- =============================================================

-- ──────────────────────────────────────────────
-- TIPOS ENUMERADOS
-- ──────────────────────────────────────────────
CREATE TYPE posicion_jugador AS ENUM ('POR', 'DEF', 'MED', 'DEL');


-- ──────────────────────────────────────────────
-- TABLA 1: perfiles
-- Se crea automáticamente al registrar un usuario
-- (ver trigger al final del archivo)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.perfiles (
  id                  UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username            TEXT          NOT NULL UNIQUE,
  presupuesto_restante NUMERIC(10,2) NOT NULL DEFAULT 100.0,
  puntos_totales      INTEGER       NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT username_min_length CHECK (char_length(username) >= 3),
  CONSTRAINT presupuesto_no_negativo CHECK (presupuesto_restante >= 0)
);

COMMENT ON TABLE public.perfiles IS 'Perfil público de cada usuario del fantasy';


-- ──────────────────────────────────────────────
-- TABLA 2: selecciones_nacionales
-- Gestionada externamente (n8n / admin)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.selecciones_nacionales (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT  NOT NULL UNIQUE,
  bandera_url TEXT,
  grupo       TEXT  NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT grupo_valido CHECK (grupo ~ '^[A-L]$')
);

COMMENT ON TABLE public.selecciones_nacionales IS '32 selecciones del Mundial 2026';


-- ──────────────────────────────────────────────
-- TABLA 3: jugadores
-- Gestionada externamente (n8n / admin)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.jugadores (
  id             UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         TEXT             NOT NULL,
  posicion       posicion_jugador NOT NULL,
  seleccion_id   UUID             NOT NULL REFERENCES public.selecciones_nacionales(id) ON DELETE RESTRICT,
  precio         NUMERIC(5,2)     NOT NULL DEFAULT 0.0,
  puntos_torneo  INTEGER          NOT NULL DEFAULT 0,
  activo         BOOLEAN          NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ      NOT NULL DEFAULT now(),

  CONSTRAINT precio_positivo CHECK (precio >= 0)
);

COMMENT ON TABLE public.jugadores IS 'Jugadores disponibles para fichar';

CREATE INDEX idx_jugadores_posicion      ON public.jugadores(posicion);
CREATE INDEX idx_jugadores_seleccion_id  ON public.jugadores(seleccion_id);
CREATE INDEX idx_jugadores_precio        ON public.jugadores(precio);


-- ──────────────────────────────────────────────
-- TABLA 4: equipos_usuarios
-- Plantilla de cada usuario (máx. 15 jugadores)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.equipos_usuarios (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID    NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  jugador_id  UUID    NOT NULL REFERENCES public.jugadores(id) ON DELETE RESTRICT,
  es_titular  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un jugador no puede estar dos veces en el mismo equipo
  CONSTRAINT uq_usuario_jugador UNIQUE (usuario_id, jugador_id)
);

COMMENT ON TABLE public.equipos_usuarios IS 'Plantilla de 15 jugadores por usuario';

CREATE INDEX idx_equipos_usuario_id ON public.equipos_usuarios(usuario_id);
CREATE INDEX idx_equipos_jugador_id ON public.equipos_usuarios(jugador_id);


-- ──────────────────────────────────────────────
-- TABLA 5: ligas
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ligas (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT  NOT NULL,
  codigo_acceso TEXT  NOT NULL UNIQUE,
  creador_id    UUID  REFERENCES public.perfiles(id) ON DELETE SET NULL,
  es_publica    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT codigo_acceso_min_length CHECK (char_length(codigo_acceso) >= 4)
);

COMMENT ON TABLE public.ligas IS 'Ligas públicas y privadas entre usuarios';

CREATE INDEX idx_ligas_codigo_acceso ON public.ligas(codigo_acceso);
CREATE INDEX idx_ligas_creador_id    ON public.ligas(creador_id);


-- ──────────────────────────────────────────────
-- TABLA 6: ligas_usuarios (pivot)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ligas_usuarios (
  liga_id     UUID NOT NULL REFERENCES public.ligas(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (liga_id, usuario_id)
);

COMMENT ON TABLE public.ligas_usuarios IS 'Membresía de usuarios en ligas';

CREATE INDEX idx_ligas_usuarios_usuario ON public.ligas_usuarios(usuario_id);


-- =============================================================
-- TRIGGER: crear perfil automáticamente al registrar usuario
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================

ALTER TABLE public.perfiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selecciones_nacionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jugadores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipos_usuarios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ligas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ligas_usuarios       ENABLE ROW LEVEL SECURITY;


-- ── perfiles ──────────────────────────────────
-- Cualquiera puede leer perfiles (ranking público)
CREATE POLICY "perfiles_select_all"
  ON public.perfiles FOR SELECT
  USING (true);

-- Solo el propio usuario puede editar su perfil
CREATE POLICY "perfiles_update_own"
  ON public.perfiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ── selecciones_nacionales ────────────────────
-- Solo lectura para todos los usuarios autenticados
CREATE POLICY "selecciones_select_auth"
  ON public.selecciones_nacionales FOR SELECT
  TO authenticated
  USING (true);


-- ── jugadores ─────────────────────────────────
-- Solo lectura para todos los usuarios autenticados
CREATE POLICY "jugadores_select_auth"
  ON public.jugadores FOR SELECT
  TO authenticated
  USING (true);


-- ── equipos_usuarios ──────────────────────────
-- El usuario solo ve y gestiona su propia plantilla
CREATE POLICY "equipos_select_own"
  ON public.equipos_usuarios FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "equipos_insert_own"
  ON public.equipos_usuarios FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "equipos_update_own"
  ON public.equipos_usuarios FOR UPDATE
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "equipos_delete_own"
  ON public.equipos_usuarios FOR DELETE
  USING (auth.uid() = usuario_id);


-- ── ligas ─────────────────────────────────────
-- Las ligas públicas son visibles para todos los autenticados
CREATE POLICY "ligas_select_auth"
  ON public.ligas FOR SELECT
  TO authenticated
  USING (es_publica = true OR creador_id = auth.uid() OR
         id IN (SELECT liga_id FROM public.ligas_usuarios WHERE usuario_id = auth.uid()));

CREATE POLICY "ligas_insert_auth"
  ON public.ligas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creador_id);

CREATE POLICY "ligas_update_own"
  ON public.ligas FOR UPDATE
  USING (auth.uid() = creador_id)
  WITH CHECK (auth.uid() = creador_id);

CREATE POLICY "ligas_delete_own"
  ON public.ligas FOR DELETE
  USING (auth.uid() = creador_id);


-- ── ligas_usuarios ────────────────────────────
CREATE POLICY "ligas_usuarios_select_member"
  ON public.ligas_usuarios FOR SELECT
  USING (auth.uid() = usuario_id OR
         liga_id IN (SELECT id FROM public.ligas WHERE creador_id = auth.uid()));

CREATE POLICY "ligas_usuarios_insert_own"
  ON public.ligas_usuarios FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "ligas_usuarios_delete_own"
  ON public.ligas_usuarios FOR DELETE
  USING (auth.uid() = usuario_id);
