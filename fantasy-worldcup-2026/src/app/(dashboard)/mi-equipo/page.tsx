import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShoppingCart, Users } from "lucide-react";
import Cancha from "@/components/Cancha";
import PlantillaManager from "./PlantillaManager";
import type { Formacion } from "@/components/Cancha";
import type { PlantillaItem } from "@/types/database.types";

const FORMACIONES_VALIDAS: Formacion[] = ["4-3-3","4-4-2","3-4-3","5-3-2","4-5-1","3-5-2"];

export default async function MiEquipoPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const tab = params.tab === "plantilla" ? "plantilla" : "cancha";

  const [{ data: perfil }, { data: equipo }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("nombre_equipo, presupuesto_restante, puntos_totales, formacion")
      .eq("id", user.id)
      .single(),
    supabase
      .from("equipos_usuarios")
      .select(`
        jugador_id, es_titular,
        jugadores (
          id, nombre, nombre_camiseta, posicion, dorsal, club, tier,
          precio, puntos_torneo, puntos_jornada,
          selecciones_nacionales ( nombre, bandera_url, grupo, pais_codigo_iso )
        )
      `)
      .eq("usuario_id", user.id),
  ]);

  const plantilla = (equipo ?? []) as unknown as PlantillaItem[];
  const formacionGuardada = (
    FORMACIONES_VALIDAS.includes(perfil?.formacion as Formacion)
      ? perfil?.formacion : "4-3-3"
  ) as Formacion;

  const totalJugadores = plantilla.length;
  const titulares = plantilla.filter((p) => p.es_titular).length;
  const valorPlantilla = plantilla.reduce((s, p) => s + Number(p.jugadores.precio), 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">MI EQUIPO</p>
          <h1 className="mt-0.5 text-2xl font-black text-white">
            {perfil?.nombre_equipo ?? "Mi Equipo"}
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            {totalJugadores}/15 jugadores · valor ${valorPlantilla.toFixed(1)}M
          </p>
        </div>
        <Link
          href="/mercado"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700 hover:text-white"
        >
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden sm:inline">Mercado</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
        {(["cancha", "plantilla"] as const).map((t) => (
          <Link
            key={t}
            href={`/mi-equipo?tab=${t}`}
            className={`flex-1 rounded-lg py-2 text-center text-sm font-bold transition-all ${
              tab === t
                ? "bg-white text-black shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t === "cancha" ? `Cancha (${titulares}/11)` : `Plantilla (${totalJugadores})`}
          </Link>
        ))}
      </div>

      {totalJugadores === 0 ? (
        <EmptyState />
      ) : tab === "cancha" ? (
        <Cancha plantilla={plantilla} formacionInicial={formacionGuardada} />
      ) : (
        <PlantillaManager plantilla={plantilla} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-800 bg-slate-900 py-20 text-center">
      <Users className="h-12 w-12 text-slate-700" />
      <div>
        <p className="text-base font-semibold text-slate-300">Tu plantilla está vacía</p>
        <p className="mt-1 text-sm text-slate-500">Ve al mercado y ficha jugadores para armar tu equipo.</p>
      </div>
      <Link
        href="/mercado"
        className="mt-2 flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-black text-black hover:bg-zinc-100"
      >
        <ShoppingCart className="h-4 w-4" />
        Ir al Mercado
      </Link>
    </div>
  );
}

