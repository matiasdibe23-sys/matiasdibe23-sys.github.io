export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PosicionJugador = "POR" | "DEF" | "MED" | "DEL";

export interface Database {
  public: {
    Tables: {
      perfiles: {
        Row: {
          id: string;
          username: string;
          nombre_equipo: string | null;
          presupuesto_restante: number;
          puntos_totales: number;
          formacion: string;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          nombre_equipo?: string | null;
          presupuesto_restante?: number;
          puntos_totales?: number;
          formacion?: string;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          nombre_equipo?: string | null;
          presupuesto_restante?: number;
          puntos_totales?: number;
          formacion?: string;
          is_admin?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };

      selecciones_nacionales: {
        Row: {
          id: string;
          nombre: string;
          bandera_url: string | null;
          grupo: string;
          pais_codigo_iso: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          bandera_url?: string | null;
          grupo: string;
          pais_codigo_iso?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          bandera_url?: string | null;
          grupo?: string;
          pais_codigo_iso?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      jugadores: {
        Row: {
          id: string;
          nombre: string;
          posicion: PosicionJugador;
          seleccion_id: string;
          dorsal: number | null;
          nombre_camiseta: string | null;
          club: string | null;
          fecha_nacimiento: string | null;
          estatura_cm: number | null;
          tier: number;
          precio_base: number;
          precio: number;
          puntos_torneo: number;
          puntos_jornada: number;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          posicion: PosicionJugador;
          seleccion_id: string;
          dorsal?: number | null;
          nombre_camiseta?: string | null;
          club?: string | null;
          fecha_nacimiento?: string | null;
          estatura_cm?: number | null;
          tier?: number;
          precio_base?: number;
          precio?: number;
          puntos_torneo?: number;
          puntos_jornada?: number;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          posicion?: PosicionJugador;
          seleccion_id?: string;
          dorsal?: number | null;
          nombre_camiseta?: string | null;
          club?: string | null;
          fecha_nacimiento?: string | null;
          estatura_cm?: number | null;
          tier?: number;
          precio_base?: number;
          precio?: number;
          puntos_torneo?: number;
          puntos_jornada?: number;
          activo?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jugadores_seleccion_id_fkey";
            columns: ["seleccion_id"];
            isOneToOne: false;
            referencedRelation: "selecciones_nacionales";
            referencedColumns: ["id"];
          },
        ];
      };

      equipos_usuarios: {
        Row: {
          id: string;
          usuario_id: string;
          jugador_id: string;
          es_titular: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          jugador_id: string;
          es_titular?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          jugador_id?: string;
          es_titular?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "equipos_usuarios_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "equipos_usuarios_jugador_id_fkey";
            columns: ["jugador_id"];
            isOneToOne: false;
            referencedRelation: "jugadores";
            referencedColumns: ["id"];
          },
        ];
      };

      ligas: {
        Row: {
          id: string;
          nombre: string;
          codigo_acceso: string;
          creador_id: string | null;
          es_publica: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          codigo_acceso: string;
          creador_id?: string | null;
          es_publica?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          codigo_acceso?: string;
          creador_id?: string | null;
          es_publica?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };

      partidos: {
        Row: {
          id: string;
          jornada: number;
          fase: string;
          seleccion_local_id: string;
          seleccion_visitante_id: string;
          goles_local: number;
          goles_visitante: number;
          fecha: string;
          completado: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          jornada: number;
          fase?: string;
          seleccion_local_id: string;
          seleccion_visitante_id: string;
          goles_local?: number;
          goles_visitante?: number;
          fecha: string;
          completado?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          jornada?: number;
          fase?: string;
          seleccion_local_id?: string;
          seleccion_visitante_id?: string;
          goles_local?: number;
          goles_visitante?: number;
          fecha?: string;
          completado?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };

      puntos_jornada: {
        Row: {
          id: string;
          partido_id: string;
          jugador_id: string;
          jornada: number;
          minutos_jugados: number;
          goles: number;
          asistencias: number;
          tarjeta_amarilla: boolean;
          tarjeta_roja: boolean;
          porteria_a_cero: boolean;
          errores_gol: number;
          puntos: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          partido_id: string;
          jugador_id: string;
          jornada: number;
          minutos_jugados?: number;
          goles?: number;
          asistencias?: number;
          tarjeta_amarilla?: boolean;
          tarjeta_roja?: boolean;
          porteria_a_cero?: boolean;
          errores_gol?: number;
          puntos?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          partido_id?: string;
          jugador_id?: string;
          jornada?: number;
          minutos_jugados?: number;
          goles?: number;
          asistencias?: number;
          tarjeta_amarilla?: boolean;
          tarjeta_roja?: boolean;
          porteria_a_cero?: boolean;
          errores_gol?: number;
          puntos?: number;
          created_at?: string;
        };
        Relationships: [];
      };

      ligas_usuarios: {
        Row: {
          liga_id: string;
          usuario_id: string;
          joined_at: string;
        };
        Insert: {
          liga_id: string;
          usuario_id: string;
          joined_at?: string;
        };
        Update: {
          liga_id?: string;
          usuario_id?: string;
          joined_at?: string;
        };
        Relationships: [];
      };

      jornadas_procesadas: {
        Row: {
          jornada: number;
          procesada_en: string;
          usuarios_actualizados: number;
          jugadores_con_cambio_precio: number;
        };
        Insert: {
          jornada: number;
          procesada_en?: string;
          usuarios_actualizados?: number;
          jugadores_con_cambio_precio?: number;
        };
        Update: {
          jornada?: number;
          procesada_en?: string;
          usuarios_actualizados?: number;
          jugadores_con_cambio_precio?: number;
        };
        Relationships: [];
      };

      alineaciones: {
        Row: {
          id: string;
          usuario_id: string;
          jugador_id: string;
          jornada: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          jugador_id: string;
          jornada: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          jugador_id?: string;
          jornada?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alineaciones_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alineaciones_jugador_id_fkey";
            columns: ["jugador_id"];
            isOneToOne: false;
            referencedRelation: "jugadores";
            referencedColumns: ["id"];
          },
        ];
      };

      clasificacion_jornada: {
        Row: {
          usuario_id: string;
          jornada: number;
          puntos: number;
          updated_at: string;
        };
        Insert: {
          usuario_id: string;
          jornada: number;
          puntos?: number;
          updated_at?: string;
        };
        Update: {
          usuario_id?: string;
          jornada?: number;
          puntos?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clasificacion_jornada_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };

    Views: {
      ranking_usuarios: {
        Row: {
          posicion: number;
          usuario_id: string;
          nombre_equipo: string;
          username: string;
          total_jugadores: number;
          valor_plantilla: number;
          puntos_totales: number;
        };
        Relationships: [];
      };
    };

    Functions: {
      fichar_jugador: {
        Args: { p_usuario_id: string; p_jugador_id: string };
        Returns: undefined;
      };
      obtener_jornada_a_cerrar: {
        Args: { p_horas_espera?: number };
        Returns: {
          jornada: number;
          total_partidos: number;
          ultimo_partido_en: string;
        }[];
      };
      cerrar_jornada: {
        Args: { p_jornada: number };
        Returns: {
          posicion: number;
          usuario_id: string;
          username: string;
          nombre_equipo: string;
          puntos_jornada: number;
          puntos_acumulados: number;
        }[];
      };
      actualizar_precios_jornada: {
        Args: Record<string, never>;
        Returns: {
          jugador_id: string;
          nombre_jugador: string;
          precio_antes: number;
          precio_despues: number;
          cambio: number;
        }[];
      };
      registrar_partido: {
        Args: {
          p_jornada: number;
          p_fase: string;
          p_seleccion_local_id: string;
          p_seleccion_visitante_id: string;
          p_goles_local: number;
          p_goles_visitante: number;
          p_fecha: string;
          p_estadisticas: unknown;
        };
        Returns: string;
      };
      congelar_alineacion: {
        Args: { p_jornada: number };
        Returns: number;
      };
    };

    Enums: {
      posicion_jugador: PosicionJugador;
    };

    CompositeTypes: Record<string, never>;
  };
}

// ── Convenience helpers ───────────────────────────────────────────
export type Perfil            = Database["public"]["Tables"]["perfiles"]["Row"];
export type SeleccionNacional = Database["public"]["Tables"]["selecciones_nacionales"]["Row"];
export type Jugador           = Database["public"]["Tables"]["jugadores"]["Row"];
export type EquipoUsuario     = Database["public"]["Tables"]["equipos_usuarios"]["Row"];
export type Liga              = Database["public"]["Tables"]["ligas"]["Row"];
export type LigaUsuario       = Database["public"]["Tables"]["ligas_usuarios"]["Row"];
export type JornadaProcesada  = Database["public"]["Tables"]["jornadas_procesadas"]["Row"];
export type RankingUsuario    = Database["public"]["Views"]["ranking_usuarios"]["Row"];

// Jugador con su selección (join frecuente)
export type JugadorConSeleccion = Jugador & {
  selecciones_nacionales: Pick<SeleccionNacional, "nombre" | "bandera_url" | "grupo" | "pais_codigo_iso">;
};

// Plantilla completa del usuario (join para la vista de equipo)
export type PlantillaItem = EquipoUsuario & {
  jugadores: JugadorConSeleccion;
};

export type Alineacion          = Database["public"]["Tables"]["alineaciones"]["Row"];
export type ClasificacionJornada = Database["public"]["Tables"]["clasificacion_jornada"]["Row"];
