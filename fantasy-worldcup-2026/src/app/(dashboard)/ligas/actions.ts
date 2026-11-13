"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as adminClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

function admin() {
  return adminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function crearLiga(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const nombre = (formData.get("nombre") as string)?.trim();
  if (!nombre || nombre.length < 3) return { error: "El nombre debe tener al menos 3 caracteres." };

  const db = admin();
  const codigo_acceso = generateCode();

  const { data: liga, error } = await db
    .from("ligas")
    .insert({ nombre, codigo_acceso, creador_id: user.id, es_publica: false })
    .select()
    .single();

  if (error) return { error: error.message };

  // Auto-join creator
  await db.from("ligas_usuarios").insert({ liga_id: liga.id, usuario_id: user.id });

  revalidatePath("/ligas");
  redirect(`/ligas/${liga.id}`);
}

export async function unirseALiga(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const codigo = (formData.get("codigo") as string)?.trim().toUpperCase();
  if (!codigo) return { error: "Ingresa un código de acceso." };

  const db = admin();

  const { data: liga } = await db
    .from("ligas")
    .select("id, nombre")
    .eq("codigo_acceso", codigo)
    .single();

  if (!liga) return { error: "Código inválido — no se encontró ninguna liga." };

  const { error } = await db
    .from("ligas_usuarios")
    .insert({ liga_id: liga.id, usuario_id: user.id });

  if (error) {
    if (error.code === "23505") return { error: "Ya eres miembro de esta liga." };
    return { error: error.message };
  }

  revalidatePath("/ligas");
  redirect(`/ligas/${liga.id}`);
}

export async function salirDeLiga(ligaId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const db = admin();
  await db.from("ligas_usuarios").delete().eq("liga_id", ligaId).eq("usuario_id", user.id);

  revalidatePath("/ligas");
  redirect("/ligas");
}
