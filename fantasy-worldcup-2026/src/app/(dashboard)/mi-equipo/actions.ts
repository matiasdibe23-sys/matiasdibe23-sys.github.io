"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as adminClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

function admin() {
  return adminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function venderJugador(
  jugadorId: string
): Promise<{ ok: boolean; nuevoPrespuesto?: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const db = admin();

  // Get current price to refund
  const { data: jugador } = await db
    .from("jugadores")
    .select("precio")
    .eq("id", jugadorId)
    .single();

  if (!jugador) return { ok: false, error: "Jugador no encontrado" };

  // Remove from squad
  const { error: deleteErr } = await db
    .from("equipos_usuarios")
    .delete()
    .eq("usuario_id", user.id)
    .eq("jugador_id", jugadorId);

  if (deleteErr) return { ok: false, error: deleteErr.message };

  // Read current budget, then refund
  const { data: perfil } = await db
    .from("perfiles")
    .select("presupuesto_restante")
    .eq("id", user.id)
    .single();

  const newBudget = Number(perfil?.presupuesto_restante ?? 0) + Number(jugador.precio);

  const { data: updated, error: budgetErr } = await db
    .from("perfiles")
    .update({ presupuesto_restante: newBudget })
    .eq("id", user.id)
    .select("presupuesto_restante")
    .single();

  if (budgetErr) return { ok: false, error: budgetErr.message };

  revalidatePath("/mi-equipo");
  revalidatePath("/dashboard");

  return { ok: true, nuevoPrespuesto: updated?.presupuesto_restante };
}
