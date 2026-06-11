import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy, Medal, ArrowLeft, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { salirDeLiga } from "../actions";

export default async function LigaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: liga } = await supabase
    .from("ligas")
    .select("id, nombre, codigo_acceso, creador_id")
    .eq("id", id)
    .single();

  if (!liga) redirect("/ligas");

  const { data: members } = await supabase
    .from("ligas_usuarios")
    .select("usuario_id")
    .eq("liga_id", id);

  const memberIds = (members ?? []).map((m) => m.usuario_id);

  const { data: rankings } = await supabase
    .from("ranking_usuarios")
    .select("*")
    .in("usuario_id", memberIds)
    .order("posicion");

  const esCreador = liga.creador_id === user.id;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/ligas" className="mb-2 flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Mis ligas
          </Link>
          <h1 className="text-2xl font-black text-white">{liga.nombre}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Código:{" "}
            <span className="font-mono font-bold text-yellow-300">{liga.codigo_acceso}</span>
            <span className="ml-2 text-slate-600">· compártelo con tus amigos</span>
          </p>
        </div>

        {!esCreador && (
          <form action={async () => { "use server"; await salirDeLiga(id); }}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400 hover:bg-red-950/80"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </form>
        )}
      </div>

      {/* Ranking table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <div className="grid grid-cols-[2.5rem_1fr_5rem_5rem] gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <span className="text-center">#</span>
          <span>Equipo</span>
          <span className="text-center">Pts</span>
          <span className="text-center">Valor</span>
        </div>

        {(rankings ?? []).map((row, i) => {
          const isMe = row.usuario_id === user.id;
          const medal =
            i === 0 ? "text-yellow-400" :
            i === 1 ? "text-slate-300" :
            i === 2 ? "text-amber-600" : null;

          return (
            <div
              key={row.usuario_id}
              className={cn(
                "grid grid-cols-[2.5rem_1fr_5rem_5rem] items-center gap-2 border-b border-slate-800 px-4 py-3 last:border-b-0",
                isMe ? "border-l-2 border-l-yellow-400 bg-yellow-400/5" : "hover:bg-slate-900/60"
              )}
            >
              <div className="flex justify-center">
                {medal ? (
                  <Medal className={cn("h-4 w-4", medal)} />
                ) : (
                  <span className="text-sm font-bold text-slate-600">{i + 1}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className={cn("truncate text-sm font-bold", isMe ? "text-yellow-300" : "text-white")}>
                  {row.nombre_equipo ?? row.username}
                  {isMe && <span className="ml-1.5 text-[10px] font-normal text-yellow-500">(tú)</span>}
                </p>
                <p className="text-[11px] text-slate-500">@{row.username}</p>
              </div>
              <div className="text-center">
                <span className={cn("text-base font-black tabular-nums", i === 0 ? "text-yellow-400" : "text-white")}>
                  {row.puntos_totales}
                </span>
              </div>
              <div className="text-center">
                <span className="text-sm font-semibold text-slate-400">
                  ${Number(row.valor_plantilla).toFixed(1)}M
                </span>
              </div>
            </div>
          );
        })}

        {(!rankings || rankings.length === 0) && (
          <div className="py-12 text-center text-sm text-slate-600">Sin participantes aún.</div>
        )}
      </div>
    </div>
  );
}
