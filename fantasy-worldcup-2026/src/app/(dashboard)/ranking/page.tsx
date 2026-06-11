import { createClient } from "@/lib/supabase/server";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function RankingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: ranking } = await supabase
    .from("ranking_usuarios")
    .select("*")
    .order("posicion");

  const total = ranking?.length ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6 lg:pb-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-white">
          Clasificación
        </h1>
        {total > 0 && (
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-bold text-slate-400">
            {total} managers
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {(ranking ?? []).map((row, i) => {
          const isMe = row.usuario_id === user?.id;
          const pos = row.posicion as number;

          return (
            <div
              key={row.usuario_id}
              className={cn(
                "flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition-all duration-200",
                isMe
                  ? "border-[#4ade80]/25 bg-[#4ade80]/[0.05]"
                  : "border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/80"
              )}
            >
              {/* Position badge */}
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black",
                  pos === 1
                    ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40"
                    : pos === 2
                      ? "bg-slate-400/15 text-slate-300 ring-1 ring-slate-400/30"
                      : pos === 3
                        ? "bg-amber-700/20 text-amber-600 ring-1 ring-amber-600/30"
                        : isMe
                          ? "ring-1 text-[#4ade80] ring-[#4ade80]/30"
                          : "bg-slate-800 text-slate-500"
                )}
                style={
                  isMe && pos > 3
                    ? { background: "rgba(74,222,128,0.08)" }
                    : undefined
                }
              >
                {pos}
              </div>

              {/* Name + team value */}
              <div className="flex-1 min-w-0">
                <p className={cn("truncate font-bold", isMe ? "text-[#4ade80]" : "text-white")}>
                  {row.nombre_equipo ?? row.username}
                  {isMe && (
                    <span className="ml-2 text-[10px] font-normal opacity-60">(tú)</span>
                  )}
                </p>
                <p className="text-[11px] text-slate-500">
                  Team value{" "}
                  <span className="font-mono font-semibold text-slate-400">
                    ${Number(row.valor_plantilla ?? 0).toFixed(1)}M
                  </span>
                </p>
              </div>

              {/* Points */}
              <div className="shrink-0 text-right">
                <p className="font-mono text-2xl font-black tabular-nums text-white">
                  {row.puntos_totales}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Points
                </p>
              </div>
            </div>
          );
        })}

        {(!ranking || ranking.length === 0) && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 py-16 text-center">
            <Trophy className="mx-auto mb-3 h-10 w-10 text-slate-700" />
            <p className="text-sm font-semibold text-slate-500">Aún no hay participantes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
