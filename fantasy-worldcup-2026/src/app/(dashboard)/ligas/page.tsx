import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Users, Trophy } from "lucide-react";
import LigasForms from "./LigasForms";

export default async function LigasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("ligas_usuarios")
    .select("liga_id, joined_at")
    .eq("usuario_id", user!.id)
    .order("joined_at", { ascending: false });

  const ligaIds = (memberships ?? []).map((m) => m.liga_id);

  const { data: ligasData } = ligaIds.length > 0
    ? await supabase
        .from("ligas")
        .select("id, nombre, codigo_acceso, creador_id, es_publica")
        .in("id", ligaIds)
    : { data: [] };

  const ligas = (ligasData ?? []).map((liga) => ({
    ...liga,
    es_creador: liga.creador_id === user!.id,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-white" />
        <h1 className="text-2xl font-black text-white">Mis Ligas</h1>
      </div>

      {ligas.length === 0 ? (
        <p className="text-sm text-slate-500">No perteneces a ninguna liga todavía.</p>
      ) : (
        <div className="space-y-2">
          {ligas.map((liga) => (
            <Link
              key={liga.id}
              href={`/ligas/${liga.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 transition-all hover:border-slate-600 hover:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <Trophy className="h-4 w-4 shrink-0 text-yellow-400" />
                <div>
                  <p className="font-bold text-white">{liga.nombre}</p>
                  <p className="text-[11px] text-slate-500">
                    Código:{" "}
                    <span className="font-mono font-bold text-slate-300">{liga.codigo_acceso}</span>
                    {liga.es_creador && <span className="ml-2 text-yellow-500">· creador</span>}
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-600">Ver →</span>
            </Link>
          ))}
        </div>
      )}

      <LigasForms />
    </div>
  );
}

