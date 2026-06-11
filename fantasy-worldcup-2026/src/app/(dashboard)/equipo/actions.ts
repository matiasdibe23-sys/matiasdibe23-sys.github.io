"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function guardarAlineacion(
  titularIds: string[],
  formacion: string
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false };

  const { data: equipo, error: fetchError } = await supabase
    .from("equipos_usuarios")
    .select("jugador_id, es_titular")
    .eq("usuario_id", user.id);

  if (fetchError || !equipo) return { ok: false };

  const titularSet = new Set(titularIds);

  const cambios = equipo.filter(
    (e) => e.es_titular !== titularSet.has(e.jugador_id)
  );

  for (const { jugador_id } of cambios) {
    const { error } = await supabase
      .from("equipos_usuarios")
      .update({ es_titular: titularSet.has(jugador_id) })
      .eq("usuario_id", user.id)
      .eq("jugador_id", jugador_id);

    if (error) return { ok: false };
  }

  // Persist chosen formation on the user's profile
  await supabase
    .from("perfiles")
    .update({ formacion })
    .eq("id", user.id);

  revalidatePath("/mi-equipo");
  revalidatePath("/dashboard");

  return { ok: true };
}
