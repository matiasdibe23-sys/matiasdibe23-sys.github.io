"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type OnboardingState = { error?: string } | null;

export async function completarOnboarding(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  // Verify identity with the session-aware client
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const nombreEquipo = (formData.get("nombre_equipo") as string | null)?.trim();
  if (!nombreEquipo || nombreEquipo.length < 3) {
    return { error: "El nombre debe tener al menos 3 caracteres." };
  }

  // Use service_role to bypass RLS for this trusted server-side write
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await admin.from("perfiles").upsert(
    {
      id: user.id,
      username:
        user.user_metadata?.username ??
        user.email?.split("@")[0] ??
        "usuario",
      nombre_equipo: nombreEquipo,
    },
    { onConflict: "id" }
  );

  if (error) {
    return { error: `Error al guardar: ${error.message}` };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
