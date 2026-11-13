import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MercadoClient from "@/components/mercado/MercadoClient";
import type { PosicionJugador } from "@/types/database.types";

const POSICIONES_VALIDAS: PosicionJugador[] = ["POR", "DEF", "MED", "DEL"];

export default async function MercadoPage({
  searchParams,
}: {
  searchParams: Promise<{ posicion?: string; tier?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Sequential awaits preserve Supabase's per-query type inference
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("presupuesto_restante, username, nombre_equipo")
    .eq("id", user.id)
    .single();

  const { data: equipo } = await supabase
    .from("equipos_usuarios")
    .select("jugador_id")
    .eq("usuario_id", user.id);

  const params = await searchParams;

  const posicionParam = params.posicion?.toUpperCase() as PosicionJugador | undefined;
  const posicionInicial = POSICIONES_VALIDAS.includes(posicionParam as PosicionJugador)
    ? posicionParam
    : undefined;

  const tierParam = params.tier ? Number(params.tier) : undefined;
  const tierInicial =
    tierParam && Number.isInteger(tierParam) && tierParam >= 1 && tierParam <= 5
      ? tierParam
      : undefined;

  return (
    <MercadoClient
      usuarioId={user.id}
      presupuestoInicial={perfil?.presupuesto_restante ?? 100}
      yaFichadosIds={(equipo ?? []).map((e) => e.jugador_id)}
      username={perfil?.nombre_equipo ?? perfil?.username ?? ""}
      posicionInicial={posicionInicial}
      tierInicial={tierInicial}
    />
  );
}
