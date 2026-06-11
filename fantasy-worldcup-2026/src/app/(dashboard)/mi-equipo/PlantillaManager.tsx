"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { venderJugador } from "./actions";
import type { PlantillaItem, PosicionJugador } from "@/types/database.types";

const POS_ORDER: PosicionJugador[] = ["POR", "DEF", "MED", "DEL"];
const POS_LABEL: Record<PosicionJugador, string> = {
  POR: "Porteros", DEF: "Defensas", MED: "Mediocampistas", DEL: "Delanteros",
};
const POS_COLOR: Record<PosicionJugador, string> = {
  POR: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  DEF: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  MED: "text-violet-300 border-violet-500/40 bg-violet-500/10",
  DEL: "text-rose-300 border-rose-500/40 bg-rose-500/10",
};

export default function PlantillaManager({ plantilla }: { plantilla: PlantillaItem[] }) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function handleVender(jugadorId: string, nombre: string, precio: number) {
    start(async () => {
      const res = await venderJugador(jugadorId);
      if (res.ok) {
        toast.success(`${nombre} vendido`, {
          description: `+$${precio.toFixed(1)}M recuperados`,
        });
        setConfirmId(null);
      } else {
        toast.error("Error al vender", { description: res.error });
      }
    });
  }

  const byPos = POS_ORDER.reduce<Record<PosicionJugador, PlantillaItem[]>>(
    (acc, pos) => {
      acc[pos] = plantilla.filter((p) => p.jugadores.posicion === pos);
      return acc;
    },
    { POR: [], DEF: [], MED: [], DEL: [] }
  );

  return (
    <div className="space-y-5">
      {POS_ORDER.map((pos) => {
        const players = byPos[pos];
        if (players.length === 0) return null;
        return (
          <div key={pos}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {POS_LABEL[pos]} ({players.length})
            </p>
            <div className="space-y-1.5">
              {players.map((p) => {
                const j = p.jugadores;
                const nombre = j.nombre_camiseta ?? j.nombre.split(" ").at(-1)!;
                const isConfirming = confirmId === p.jugador_id;

                return (
                  <div
                    key={p.jugador_id}
                    className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5"
                  >
                    <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold", POS_COLOR[pos])}>
                      {pos}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white" title={j.nombre}>
                        {nombre}
                        {j.dorsal !== null && (
                          <span className="ml-1.5 text-[11px] text-slate-500">#{j.dorsal}</span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {p.jugadores.selecciones_nacionales?.nombre ?? "—"}
                        {p.es_titular && (
                          <span className="ml-2 rounded bg-white/10 px-1 text-slate-300">titular</span>
                        )}
                      </p>
                    </div>

                    <span className="shrink-0 text-sm font-black text-white">
                      ${Number(j.precio).toFixed(1)}
                      <span className="text-xs font-normal text-slate-500">M</span>
                    </span>

                    {isConfirming ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="flex items-center gap-1 text-[11px] text-yellow-400">
                          <AlertCircle className="h-3 w-3" /> ¿Vender?
                        </span>
                        <button
                          type="button"
                          onClick={() => handleVender(p.jugador_id, nombre, Number(j.precio))}
                          disabled={isPending}
                          className="rounded-lg bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-400 disabled:opacity-50"
                        >
                          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sí"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:text-white"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(p.jugador_id)}
                        className="shrink-0 rounded-lg border border-red-800 bg-red-950/40 p-1.5 text-red-400 transition-all hover:bg-red-950/80 hover:text-red-300"
                        title="Vender jugador"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

