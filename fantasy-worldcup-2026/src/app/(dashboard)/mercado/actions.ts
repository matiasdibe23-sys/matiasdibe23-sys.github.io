"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FichajeResultado = {
  jugador_id: string;
  nombre: string;
  ok: boolean;
  errorMsg?: string;
};

export type FichajeResponse = {
  resultados: FichajeResultado[];
  presupuestoActualizado: number;
};

const ERROR_MAP: Record<string, string> = {
  jugador_ya_fichado: "Ya está en tu equipo",
  presupuesto_insuficiente: "Presupuesto insuficiente",
  equipo_completo: "Equipo completo (máx. 15)",
  limite_seleccion: "Máx. 3 por selección",
  jugador_no_disponible: "Jugador no disponible",
  accion_no_autorizada: "No autorizado",
};

function parsearError(msg: string): string {
  const codigo = msg.split(":")[0].trim();
  return ERROR_MAP[codigo] ?? msg;
}

export async function ficharJugadores(
  items: { jugador_id: string; nombre: string }[]
): Promise<FichajeResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      resultados: items.map((i) => ({
        ...i,
        ok: false,
        errorMsg: "No autenticado",
      })),
      presupuestoActualizado: 0,
    };
  }

  const resultados: FichajeResultado[] = [];

  for (const { jugador_id, nombre } of items) {
    const { error } = await supabase.rpc("fichar_jugador", {
      p_usuario_id: user.id,
      p_jugador_id: jugador_id,
    });
    resultados.push({
      jugador_id,
      nombre,
      ok: !error,
      errorMsg: error ? parsearError(error.message) : undefined,
    });
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("presupuesto_restante")
    .eq("id", user.id)
    .single();

  revalidatePath("/mercado");
  revalidatePath("/dashboard");

  return {
    resultados,
    presupuestoActualizado: perfil?.presupuesto_restante ?? 0,
  };
}
