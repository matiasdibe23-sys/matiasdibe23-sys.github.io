"use client";

import { useState, useRef, useMemo, useEffect, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Loader2, Check, AlertCircle, ChevronDown } from "lucide-react";
import { guardarAlineacion } from "@/app/(dashboard)/equipo/actions";
import type { PlantillaItem, PosicionJugador } from "@/types/database.types";
import NationalKitIcon from "@/components/NationalKitIcon";

// ── Formations ────────────────────────────────────────────────────
export type Formacion = "4-3-3" | "4-4-2" | "3-4-3" | "5-3-2" | "4-5-1" | "3-5-2";

const FORMATION_SLOTS: Record<Formacion, PosicionJugador[]> = {
  "4-3-3": ["DEL","DEL","DEL","MED","MED","MED","DEF","DEF","DEF","DEF","POR"],
  "4-4-2": ["DEL","DEL","MED","MED","MED","MED","DEF","DEF","DEF","DEF","POR"],
  "3-4-3": ["DEL","DEL","DEL","MED","MED","MED","MED","DEF","DEF","DEF","POR"],
  "5-3-2": ["DEL","DEL","MED","MED","MED","DEF","DEF","DEF","DEF","DEF","POR"],
  "4-5-1": ["DEL","MED","MED","MED","MED","MED","DEF","DEF","DEF","DEF","POR"],
  "3-5-2": ["DEL","DEL","MED","MED","MED","MED","MED","DEF","DEF","DEF","POR"],
};

type FormationRow = { posicion: PosicionJugador; slots: number[] };

function getFormationRows(formacion: Formacion): FormationRow[] {
  const defs = FORMATION_SLOTS[formacion];
  const rows: FormationRow[] = [];
  for (let i = 0; i < defs.length; i++) {
    const last = rows[rows.length - 1];
    if (last?.posicion === defs[i]) last.slots.push(i);
    else rows.push({ posicion: defs[i], slots: [i] });
  }
  return rows;
}

function initSlots(plantilla: PlantillaItem[], formacion: Formacion): (string | null)[] {
  const defs = FORMATION_SLOTS[formacion];
  const slots: (string | null)[] = new Array(11).fill(null);
  const byPos: Record<PosicionJugador, string[]> = { POR: [], DEF: [], MED: [], DEL: [] };
  for (const p of plantilla) {
    if (p.es_titular) byPos[p.jugadores.posicion].push(p.jugador_id);
  }
  for (let i = 0; i < defs.length; i++) {
    const arr = byPos[defs[i]];
    if (arr.length > 0) slots[i] = arr.shift()!;
  }
  return slots;
}

function abreviar(p: PlantillaItem, max = 10): string {
  const nc = p.jugadores.nombre_camiseta;
  if (nc) return nc.length > max ? nc.slice(0, max - 1) + "." : nc;
  const parts = p.jugadores.nombre.split(" ");
  const last = parts.at(-1) ?? "";
  return last.length > max ? last.slice(0, max - 1) + "." : last;
}

function abreviarSeleccion(nombre?: string | null): string {
  if (!nombre) return "";
  const words = nombre.split(" ");
  if (words.length === 1) return nombre.slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join("").toUpperCase().slice(0, 3);
}

// ── Position colors ────────────────────────────────────────────────
const POS_COLOR: Record<PosicionJugador, { border: string; glow: string; label: string }> = {
  POR: { border: "rgba(245,158,11,0.3)",  glow: "rgba(245,158,11,0.12)", label: "rgba(245,158,11,0.7)" },
  DEF: { border: "rgba(14,165,233,0.3)",  glow: "rgba(14,165,233,0.12)", label: "rgba(14,165,233,0.7)" },
  MED: { border: "rgba(74,222,128,0.3)",  glow: "rgba(74,222,128,0.12)", label: "rgba(74,222,128,0.7)" },
  DEL: { border: "rgba(244,63,94,0.3)",   glow: "rgba(244,63,94,0.12)",  label: "rgba(244,63,94,0.7)" },
};

// ── Empty slot ─────────────────────────────────────────────────────
function EmptySlot({ posicion, isOver }: { posicion: PosicionJugador; isOver: boolean }) {
  const c = POS_COLOR[posicion];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="flex items-center justify-center rounded-2xl transition-all duration-200"
        style={{
          width: 62, height: 70,
          border: `1.5px dashed ${isOver ? "rgba(255,255,255,0.6)" : c.border}`,
          background: isOver ? "rgba(255,255,255,0.08)" : c.glow,
          transform: isOver ? "scale(1.1)" : "scale(1)",
        }}
      >
        <span
          className="text-2xl font-thin leading-none transition-colors"
          style={{ color: isOver ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)" }}
        >
          +
        </span>
      </div>
      <span
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: c.label }}
      >
        {posicion}
      </span>
    </div>
  );
}

// ── Player token ───────────────────────────────────────────────────
function PlayerToken({
  player, posicion, isDragSource, isOver, onDragStart, onDragEnd,
}: {
  player: PlantillaItem;
  posicion: PosicionJugador;
  isDragSource: boolean;
  isOver: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const nombre = abreviar(player, 10);
  const seleccion = abreviarSeleccion(player.jugadores.selecciones_nacionales?.nombre);
  const mismatch = player.jugadores.posicion !== posicion;

  return (
    <div
      className={cn(
        "flex cursor-grab select-none flex-col items-center gap-1 transition-all duration-150 active:cursor-grabbing",
        isDragSource && "opacity-20 scale-90",
        isOver && "scale-110 z-10"
      )}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={player.jugadores.nombre}
    >
      <div className="relative">
        <NationalKitIcon
          isoCode={player.jugadores.selecciones_nacionales?.pais_codigo_iso}
          dorsal={player.jugadores.dorsal}
          size={52}
          highlighted={isOver}
        />
        {mismatch && (
          <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] font-black text-black shadow">
            !
          </span>
        )}
      </div>

      {/* Name chip */}
      <div className="flex flex-col items-center gap-0.5">
        <div className="rounded-md bg-white px-2 py-0.5 shadow-md">
          <span
            className="block truncate text-[10px] font-black leading-tight text-black"
            style={{ maxWidth: 68 }}
          >
            {nombre}
          </span>
        </div>
        {seleccion && (
          <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.45)" }}>
            {seleccion}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Slot on pitch ──────────────────────────────────────────────────
function SlotCampo({
  slotIdx, posicion, player, isDragSource, isOver,
  onDragStart, onDragEnd, onDragOver, onDrop, onDragLeave,
}: {
  slotIdx: number; posicion: PosicionJugador;
  player: PlantillaItem | null; isDragSource: boolean; isOver: boolean;
  onDragStart?: (e: React.DragEvent) => void; onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void;
  onDragLeave: () => void;
}) {
  return (
    <div onDragOver={onDragOver} onDrop={onDrop} onDragLeave={onDragLeave}>
      {player ? (
        <PlayerToken
          player={player} posicion={posicion} isDragSource={isDragSource} isOver={isOver}
          onDragStart={onDragStart} onDragEnd={onDragEnd}
        />
      ) : (
        <EmptySlot posicion={posicion} isOver={isOver} />
      )}
    </div>
  );
}

// ── Bench card ────────────────────────────────────────────────────
function TarjetaSuplente({
  player, isDragging, onDragStart, onDragEnd,
}: {
  player: PlantillaItem; isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void;
}) {
  const j = player.jugadores;
  const nombre = abreviar(player, 11);
  const seleccion = abreviarSeleccion(j.selecciones_nacionales?.nombre);
  const c = POS_COLOR[j.posicion];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={j.nombre}
      className={cn(
        "flex shrink-0 cursor-grab select-none flex-col items-center gap-2 rounded-2xl border px-3 py-3 transition-all hover:scale-[1.03] active:cursor-grabbing",
        isDragging && "scale-90 opacity-25"
      )}
      style={{
        borderColor: c.border,
        background: `linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.9) 100%)`,
        minWidth: 70,
      }}
    >
      <NationalKitIcon
        isoCode={j.selecciones_nacionales?.pais_codigo_iso}
        dorsal={j.dorsal}
        size={40}
      />
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="rounded-sm px-1.5 py-0.5 text-[9px] font-black leading-none"
          style={{ background: c.border, color: c.label }}
        >
          {j.posicion}
        </span>
        <span className="max-w-[64px] truncate text-center text-[10px] font-bold text-white">
          {nombre}
        </span>
        {seleccion && (
          <span className="text-[9px]" style={{ color: "rgba(148,163,184,0.6)" }}>{seleccion}</span>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export interface CanchaProps {
  plantilla: PlantillaItem[];
  formacionInicial?: Formacion;
}

type DragSrc =
  | { type: "slot"; slotIdx: number; playerId: string }
  | { type: "bench"; playerId: string };

export default function Cancha({ plantilla, formacionInicial = "4-3-3" }: CanchaProps) {
  const [formacion, setFormacion] = useState<Formacion>(formacionInicial);
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    initSlots(plantilla, formacionInicial)
  );

  const dragSrc = useRef<DragSrc | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [dragOverBench, setDragOverBench] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showFormationPicker, setShowFormationPicker] = useState(false);

  const [, startSave] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isFirst = useRef(true);

  const playerMap = useMemo(() => new Map(plantilla.map((p) => [p.jugador_id, p])), [plantilla]);
  const titularSet = useMemo(() => new Set(slots.filter(Boolean) as string[]), [slots]);
  const suplentes = useMemo(() => plantilla.filter((p) => !titularSet.has(p.jugador_id)), [plantilla, titularSet]);
  const rows = useMemo(() => getFormationRows(formacion), [formacion]);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(() => {
      const ids = slots.filter(Boolean) as string[];
      startSave(async () => {
        const res = await guardarAlineacion(ids, formacion);
        setSaveStatus(res.ok ? "saved" : "error");
        setTimeout(() => setSaveStatus("idle"), 2500);
      });
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [slots, formacion]);

  function handleFormacion(f: Formacion) {
    if (f === formacion) return;
    setFormacion(f);
    setShowFormationPicker(false);
    const newDefs = FORMATION_SLOTS[f];
    const newSlots = new Array<string | null>(11).fill(null);
    const byPos: Record<PosicionJugador, string[]> = { POR: [], DEF: [], MED: [], DEL: [] };
    for (const id of [...(slots.filter(Boolean) as string[]), ...suplentes.map((p) => p.jugador_id)]) {
      const p = playerMap.get(id);
      if (p) byPos[p.jugadores.posicion].push(id);
    }
    for (let i = 0; i < newDefs.length; i++) {
      const arr = byPos[newDefs[i]];
      if (arr.length > 0) newSlots[i] = arr.shift()!;
    }
    setSlots(newSlots);
  }

  function beginDrag(src: DragSrc, e: React.DragEvent) {
    dragSrc.current = src;
    setDraggingId(src.playerId);
    e.dataTransfer.effectAllowed = "move";
  }

  function clearDrag() {
    dragSrc.current = null;
    setDraggingId(null);
    setDragOverSlot(null);
    setDragOverBench(false);
  }

  function onSlotDrop(targetIdx: number, e: React.DragEvent) {
    e.preventDefault();
    const src = dragSrc.current;
    if (!src) return;
    setSlots((prev) => {
      const next = [...prev];
      if (src.type === "slot") {
        [next[targetIdx], next[src.slotIdx]] = [next[src.slotIdx], next[targetIdx]];
      } else {
        next[targetIdx] = src.playerId;
      }
      return next;
    });
    clearDrag();
  }

  const titularCount = slots.filter(Boolean).length;
  const formacionDisplay = formacion.replace(/-/g, " · ");

  return (
    <div className="flex flex-col gap-4">
      {/* ── Controls bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Formation picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFormationPicker((p) => !p)}
            className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-black text-white transition-all hover:border-slate-600 hover:bg-slate-700"
          >
            <span>{formacionDisplay}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform text-slate-400", showFormationPicker && "rotate-180")} />
          </button>
          {showFormationPicker && (
            <div className="absolute left-0 top-full z-20 mt-1.5 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50">
              {(Object.keys(FORMATION_SLOTS) as Formacion[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleFormacion(f)}
                  className={cn(
                    "flex w-full items-center gap-3 px-5 py-2.5 text-sm font-bold transition-colors",
                    formacion === f
                      ? "text-black"
                      : "text-slate-300 hover:bg-slate-800"
                  )}
                  style={formacion === f ? { background: "#4ade80" } : {}}
                >
                  {f.replace(/-/g, " · ")}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-black tabular-nums",
              titularCount === 11
                ? "border-[#4ade80]/30 bg-[#4ade80]/10 text-[#4ade80]"
                : "border-amber-500/30 bg-amber-500/10 text-amber-400"
            )}
          >
            {titularCount}/11
          </span>
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "#4ade80" }}>
              <Check className="h-3 w-3" /> Guardado
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-xs text-rose-400">
              <AlertCircle className="h-3 w-3" /> Error
            </span>
          )}
        </div>
      </div>

      {/* Click-away for formation picker */}
      {showFormationPicker && (
        <div className="fixed inset-0 z-10" onClick={() => setShowFormationPicker(false)} />
      )}

      {/* ── Pitch ── */}
      <div
        className="relative w-full overflow-visible rounded-3xl shadow-2xl"
        style={{
          background: "linear-gradient(180deg,#1a3320 0%,#1e4028 18%,#224834 38%,#1e4028 62%,#1a3320 100%)",
          minHeight: 480,
        }}
      >
        {/* Pitch markings */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          {/* Outer border */}
          <div className="absolute inset-[12px] rounded-xl border border-white/10" />
          {/* Centre line */}
          <div className="absolute left-[12px] right-[12px] top-1/2 h-px bg-white/10" />
          {/* Centre circle */}
          <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20" />
          {/* Top penalty box */}
          <div className="absolute left-1/2 top-[12px] h-[56px] w-[144px] -translate-x-1/2 border border-white/10" />
          {/* Bottom penalty box */}
          <div className="absolute bottom-[12px] left-1/2 h-[56px] w-[144px] -translate-x-1/2 border border-white/10" />
          {/* Grass stripes */}
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0"
              style={{
                top: `${(i / 10) * 100}%`,
                height: "10%",
                background: i % 2 === 0 ? "rgba(0,0,0,0.07)" : "transparent",
              }}
            />
          ))}
          {/* Vignette */}
          <div className="absolute inset-0 rounded-3xl" style={{
            background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.35) 100%)",
          }} />
        </div>

        {/* Player rows */}
        <div
          className="relative z-10 flex h-full flex-col py-6"
          style={{ minHeight: 480, justifyContent: "space-around" }}
        >
          {rows.map((row) => (
            <div
              key={row.posicion}
              className="flex items-end justify-center"
              style={{ gap: "clamp(4px, 3vw, 28px)", padding: "0 12px" }}
            >
              {row.slots.map((slotIdx) => {
                const playerId = slots[slotIdx] ?? null;
                const player = playerId ? (playerMap.get(playerId) ?? null) : null;
                return (
                  <SlotCampo
                    key={slotIdx}
                    slotIdx={slotIdx}
                    posicion={row.posicion}
                    player={player}
                    isDragSource={draggingId !== null && draggingId === playerId}
                    isOver={dragOverSlot === slotIdx}
                    onDragStart={playerId ? (e) => beginDrag({ type: "slot", slotIdx, playerId }, e) : undefined}
                    onDragEnd={clearDrag}
                    onDragOver={(e) => { e.preventDefault(); setDragOverSlot(slotIdx); }}
                    onDrop={(e) => onSlotDrop(slotIdx, e)}
                    onDragLeave={() => setDragOverSlot((p) => (p === slotIdx ? null : p))}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Bench ── */}
      <div
        className={cn(
          "rounded-2xl border transition-colors",
          dragOverBench ? "border-[#4ade80]/30 bg-[#4ade80]/[0.03]" : "border-slate-800 bg-slate-900/60"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOverBench(true); }}
        onDrop={(e) => {
          e.preventDefault();
          const src = dragSrc.current;
          if (src?.type === "slot") {
            setSlots((prev) => { const next = [...prev]; next[src.slotIdx] = null; return next; });
          }
          clearDrag();
        }}
        onDragLeave={() => setDragOverBench(false)}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Banquillo
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-400">
            {suplentes.length} jugador{suplentes.length !== 1 ? "es" : ""}
          </span>
        </div>
        <div className={cn(
          "flex min-h-[104px] items-center gap-2.5 overflow-x-auto p-3",
          suplentes.length === 0 && "justify-center"
        )}>
          {suplentes.length === 0 ? (
            <p className="text-xs font-semibold text-slate-600">
              {dragOverBench ? "Suelta para enviar al banquillo" : "Arrastra jugadores aquí"}
            </p>
          ) : (
            suplentes.map((p) => (
              <TarjetaSuplente
                key={p.jugador_id}
                player={p}
                isDragging={draggingId === p.jugador_id}
                onDragStart={(e) => beginDrag({ type: "bench", playerId: p.jugador_id }, e)}
                onDragEnd={clearDrag}
              />
            ))
          )}
        </div>
      </div>

      {/* Hint */}
      <p className="text-center text-[10px]" style={{ color: "rgba(100,116,139,0.7)" }}>
        Arrastra los jugadores para reorganizar la alineación
      </p>
    </div>
  );
}
