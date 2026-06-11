"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as adminClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Mirrors the calcular_puntos_jugador SQL function
function calcularPuntos(s: StatInput): number {
  const golesBase: Record<string, number> = { POR: 6, DEF: 6, MED: 5, DEL: 4 };
  let pts = s.goles * (golesBase[s.posicion] ?? 4);
  pts += s.asistencias * 3;
  if (s.porteria_a_cero && ["POR", "DEF"].includes(s.posicion) && s.minutos_jugados >= 60) pts += 4;
  if (s.tarjeta_amarilla && !s.tarjeta_roja) pts -= 1;
  if (s.tarjeta_roja) pts -= 3;
  pts -= s.errores_gol * 2;
  return pts;
}

function admin() {
  return adminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data } = await supabase
    .from("perfiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!data?.is_admin) throw new Error("Sin permisos");
}

// ── Crear partido ─────────────────────────────────────────────────
export async function crearPartido(formData: FormData) {
  await assertAdmin();
  const db = admin();

  const { error, data } = await db.from("partidos").insert({
    jornada: Number(formData.get("jornada")),
    fase: String(formData.get("fase") || "grupos"),
    seleccion_local_id: String(formData.get("local_id")),
    seleccion_visitante_id: String(formData.get("visitante_id")),
    goles_local: Number(formData.get("goles_local") ?? 0),
    goles_visitante: Number(formData.get("goles_visitante") ?? 0),
    fecha: String(formData.get("fecha")),
    completado: false,
  }).select().single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, partido: data };
}

// ── Guardar stats de un jugador ───────────────────────────────────
export type StatInput = {
  partido_id: string;
  jugador_id: string;
  jornada: number;
  posicion: string;
  minutos_jugados: number;
  goles: number;
  asistencias: number;
  tarjeta_amarilla: boolean;
  tarjeta_roja: boolean;
  porteria_a_cero: boolean;
  errores_gol: number;
};

export async function guardarStats(stats: StatInput[]) {
  await assertAdmin();
  const db = admin();

  const rows = stats.map((s) => ({
    partido_id: s.partido_id,
    jugador_id: s.jugador_id,
    jornada: s.jornada,
    minutos_jugados: s.minutos_jugados,
    goles: s.goles,
    asistencias: s.asistencias,
    tarjeta_amarilla: s.tarjeta_amarilla,
    tarjeta_roja: s.tarjeta_roja,
    porteria_a_cero: s.porteria_a_cero,
    errores_gol: s.errores_gol,
    // Calculate points via the DB function
    puntos: 0, // placeholder — will be recalculated via trigger or separately
  }));

  // Upsert stats
  const { error: upsertErr } = await db
    .from("puntos_jornada")
    .upsert(rows, { onConflict: "partido_id,jugador_id" });

  if (upsertErr) return { ok: false, error: upsertErr.message };

  // Calculate and update points for each stat row
  for (const s of stats) {
    const pts = calcularPuntos(s);

    await db
      .from("puntos_jornada")
      .update({ puntos: pts })
      .eq("partido_id", s.partido_id)
      .eq("jugador_id", s.jugador_id);

    // Keep jugadores.puntos_jornada in sync (live display)
    await db
      .from("jugadores")
      .update({ puntos_jornada: pts })
      .eq("id", s.jugador_id);
  }

  return { ok: true };
}

// ── Completar partido ─────────────────────────────────────────────
export async function completarPartido(
  partido_id: string,
  goles_local: number,
  goles_visitante: number
) {
  await assertAdmin();
  const db = admin();

  const { error } = await db
    .from("partidos")
    .update({ completado: true, goles_local, goles_visitante })
    .eq("id", partido_id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Cerrar jornada ────────────────────────────────────────────────
export async function cerrarJornada(jornada: number) {
  await assertAdmin();
  const db = admin();

  const { data, error } = await db.rpc("cerrar_jornada", { p_jornada: jornada });

  if (error) return { ok: false, error: error.message };
  return { ok: true, ranking: data };
}
