"use client";

import { useState, useTransition } from "react";
import {
  Plus, Save, CheckCircle2, Loader2, AlertCircle, Trophy, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  crearPartido, guardarStats, completarPartido, cerrarJornada,
  type StatInput,
} from "./actions";

type Seleccion = { id: string; nombre: string };
type Jugador   = { id: string; nombre: string; nombre_camiseta: string | null; posicion: string; dorsal: number | null };
type Partido   = {
  id: string;
  jornada: number;
  fase: string;
  completado: boolean;
  goles_local: number;
  goles_visitante: number;
  seleccion_local: Seleccion & { jugadores: Jugador[] };
  seleccion_visitante: Seleccion & { jugadores: Jugador[] };
};

// ── Stat row for one player ───────────────────────────────────────
type StatRow = Omit<StatInput, "partido_id" | "jornada">;

function defaultStat(jugador_id: string, posicion: string): StatRow {
  return {
    jugador_id, posicion,
    minutos_jugados: 0, goles: 0, asistencias: 0,
    tarjeta_amarilla: false, tarjeta_roja: false,
    porteria_a_cero: false, errores_gol: 0,
  };
}

function StatEditor({
  jugador,
  stat,
  onChange,
}: {
  jugador: Jugador;
  stat: StatRow;
  onChange: (s: StatRow) => void;
}) {
  const nombre = jugador.nombre_camiseta ?? jugador.nombre.split(" ").at(-1)!;
  const n = (key: keyof StatRow, val: number | boolean) =>
    onChange({ ...stat, [key]: val });

  return (
    <div className="grid grid-cols-[1fr_repeat(7,auto)] items-center gap-x-3 gap-y-1 rounded-lg border border-gray-700/50 bg-gray-800/40 px-3 py-2 text-sm">
      <span className="min-w-0 truncate font-semibold text-white" title={jugador.nombre}>
        <span className="mr-1.5 rounded border border-gray-600 px-1 py-0.5 text-[9px] font-bold text-gray-400">
          {jugador.posicion}
        </span>
        {nombre}
        {jugador.dorsal !== null && (
          <span className="ml-1 text-[11px] text-gray-500">#{jugador.dorsal}</span>
        )}
      </span>

      <label className="flex flex-col items-center gap-0.5">
        <span className="text-[9px] text-gray-500">MIN</span>
        <input
          type="number" min={0} max={120} value={stat.minutos_jugados}
          onChange={(e) => n("minutos_jugados", Number(e.target.value))}
          className="w-14 rounded border border-gray-600 bg-gray-700 px-1.5 py-1 text-center text-xs text-white focus:border-blue-400 focus:outline-none"
        />
      </label>

      <label className="flex flex-col items-center gap-0.5">
        <span className="text-[9px] text-gray-500">GOL</span>
        <input
          type="number" min={0} max={20} value={stat.goles}
          onChange={(e) => n("goles", Number(e.target.value))}
          className="w-12 rounded border border-gray-600 bg-gray-700 px-1.5 py-1 text-center text-xs text-white focus:border-blue-400 focus:outline-none"
        />
      </label>

      <label className="flex flex-col items-center gap-0.5">
        <span className="text-[9px] text-gray-500">AST</span>
        <input
          type="number" min={0} max={20} value={stat.asistencias}
          onChange={(e) => n("asistencias", Number(e.target.value))}
          className="w-12 rounded border border-gray-600 bg-gray-700 px-1.5 py-1 text-center text-xs text-white focus:border-blue-400 focus:outline-none"
        />
      </label>

      <label className="flex flex-col items-center gap-0.5">
        <span className="text-[9px] text-gray-500">AM</span>
        <input
          type="checkbox" checked={stat.tarjeta_amarilla}
          onChange={(e) => n("tarjeta_amarilla", e.target.checked)}
          className="h-4 w-4 accent-yellow-400"
        />
      </label>

      <label className="flex flex-col items-center gap-0.5">
        <span className="text-[9px] text-gray-500">RJ</span>
        <input
          type="checkbox" checked={stat.tarjeta_roja}
          onChange={(e) => n("tarjeta_roja", e.target.checked)}
          className="h-4 w-4 accent-red-400"
        />
      </label>

      <label className="flex flex-col items-center gap-0.5">
        <span className="text-[9px] text-gray-500">P0</span>
        <input
          type="checkbox" checked={stat.porteria_a_cero}
          onChange={(e) => n("porteria_a_cero", e.target.checked)}
          className="h-4 w-4 accent-green-400"
        />
      </label>

      <label className="flex flex-col items-center gap-0.5">
        <span className="text-[9px] text-gray-500">ERR</span>
        <input
          type="number" min={0} max={10} value={stat.errores_gol}
          onChange={(e) => n("errores_gol", Number(e.target.value))}
          className="w-12 rounded border border-gray-600 bg-gray-700 px-1.5 py-1 text-center text-xs text-white focus:border-blue-400 focus:outline-none"
        />
      </label>
    </div>
  );
}

// ── Single match panel ────────────────────────────────────────────
function PartidoCard({
  partido,
  jornada,
  onDone,
}: {
  partido: Partido;
  jornada: number;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(!partido.completado);
  const [golesLocal, setGolesLocal] = useState(partido.goles_local);
  const [golesVisitante, setGolesVisitante] = useState(partido.goles_visitante);
  const [statsMap, setStatsMap] = useState<Map<string, StatRow>>(() => {
    const m = new Map<string, StatRow>();
    for (const j of partido.seleccion_local.jugadores)
      m.set(j.id, defaultStat(j.id, j.posicion));
    for (const j of partido.seleccion_visitante.jugadores)
      m.set(j.id, defaultStat(j.id, j.posicion));
    return m;
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, start] = useTransition();

  function setStat(id: string, s: StatRow) {
    setStatsMap((prev) => new Map(prev).set(id, s));
  }

  function handleGuardar() {
    start(async () => {
      setMsg(null);
      const stats: StatInput[] = [...statsMap.values()].map((s) => ({
        ...s,
        partido_id: partido.id,
        jornada,
      }));
      const res = await guardarStats(stats);
      setMsg(res.ok ? { ok: true, text: "Stats guardadas" } : { ok: false, text: res.error! });
    });
  }

  function handleCompletar() {
    start(async () => {
      setMsg(null);
      const res = await completarPartido(partido.id, golesLocal, golesVisitante);
      if (res.ok) {
        setMsg({ ok: true, text: "Partido completado" });
        onDone();
      } else {
        setMsg({ ok: false, text: res.error! });
      }
    });
  }

  const localNombre = partido.seleccion_local.nombre;
  const visitanteNombre = partido.seleccion_visitante.nombre;

  return (
    <div className={cn(
      "rounded-xl border",
      partido.completado ? "border-green-700/40 bg-green-900/10" : "border-gray-700/50 bg-gray-800/30"
    )}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          {partido.completado && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />}
          <span className="font-bold text-white">
            {localNombre}
            <span className="mx-2 font-normal text-gray-500">
              {partido.completado ? `${partido.goles_local}–${partido.goles_visitante}` : "vs"}
            </span>
            {visitanteNombre}
          </span>
          <span className="text-[11px] text-gray-500">{partido.fase}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>

      {open && (
        <div className="border-t border-gray-700/40 px-4 pb-4 pt-3 space-y-4">
          {/* Result */}
          <div className="flex items-center gap-3">
            <span className="w-32 truncate text-sm font-semibold text-white text-right">{localNombre}</span>
            <input
              type="number" min={0} value={golesLocal}
              onChange={(e) => setGolesLocal(Number(e.target.value))}
              disabled={partido.completado}
              className="w-14 rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-center text-lg font-black text-white focus:border-blue-400 focus:outline-none disabled:opacity-50"
            />
            <span className="text-gray-500 font-bold">—</span>
            <input
              type="number" min={0} value={golesVisitante}
              onChange={(e) => setGolesVisitante(Number(e.target.value))}
              disabled={partido.completado}
              className="w-14 rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-center text-lg font-black text-white focus:border-blue-400 focus:outline-none disabled:opacity-50"
            />
            <span className="w-32 truncate text-sm font-semibold text-white">{visitanteNombre}</span>
          </div>

          {/* Players from local team */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
              {localNombre}
            </p>
            <div className="space-y-1.5">
              {partido.seleccion_local.jugadores.map((j) => (
                <StatEditor
                  key={j.id}
                  jugador={j}
                  stat={statsMap.get(j.id)!}
                  onChange={(s) => setStat(j.id, s)}
                />
              ))}
            </div>
          </div>

          {/* Players from visitante team */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
              {visitanteNombre}
            </p>
            <div className="space-y-1.5">
              {partido.seleccion_visitante.jugadores.map((j) => (
                <StatEditor
                  key={j.id}
                  jugador={j}
                  stat={statsMap.get(j.id)!}
                  onChange={(s) => setStat(j.id, s)}
                />
              ))}
            </div>
          </div>

          {/* Feedback */}
          {msg && (
            <div className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
              msg.ok ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"
            )}>
              {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {msg.text}
            </div>
          )}

          {/* Actions */}
          {!partido.completado && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleGuardar}
                disabled={isPending}
                className="flex items-center gap-2 rounded-lg border border-blue-500/50 bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-300 transition-all hover:bg-blue-500/25 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar stats
              </button>
              <button
                type="button"
                onClick={handleCompletar}
                disabled={isPending}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-green-500 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Completar partido
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Create partido form ───────────────────────────────────────────
function NuevoPartidoForm({
  jornada,
  selecciones,
  onCreated,
}: {
  jornada: number;
  selecciones: Seleccion[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("jornada", String(jornada));
    start(async () => {
      setErr(null);
      const res = await crearPartido(fd);
      if (res.ok) { setOpen(false); onCreated(); }
      else setErr(res.error ?? "Error desconocido");
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-dashed border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-400 transition-all hover:border-gray-400 hover:text-gray-200"
      >
        <Plus className="h-4 w-4" />
        Añadir partido
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 space-y-3">
      <p className="text-sm font-bold text-white">Nuevo partido — Jornada {jornada}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">Local</label>
          <select name="local_id" required className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-blue-400 focus:outline-none">
            {selecciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">Visitante</label>
          <select name="visitante_id" required className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-blue-400 focus:outline-none">
            {selecciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">Fase</label>
          <select name="fase" className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-blue-400 focus:outline-none">
            {["grupos","octavos","cuartos","semis","final"].map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">Fecha y hora</label>
          <input
            type="datetime-local" name="fecha" required
            className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Crear
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ── Main panel ────────────────────────────────────────────────────
export default function JornadaPanel({
  partidos: initialPartidos,
  selecciones,
  jornadaNum,
  jornadas,
}: {
  partidos: Partido[];
  selecciones: Seleccion[];
  jornadaNum: number;
  jornadas: number[];
}) {
  const [partidos, setPartidos] = useState(initialPartidos);
  const [jornada, setJornada] = useState(jornadaNum);
  const [rankingMsg, setRankingMsg] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const todosCompletos = partidos.length > 0 && partidos.every((p) => p.completado);
  const completados = partidos.filter((p) => p.completado).length;

  function handleCerrar() {
    start(async () => {
      setRankingMsg(null);
      const res = await cerrarJornada(jornada);
      if (res.ok) {
        setRankingMsg(`✓ Jornada ${jornada} cerrada. ${Array.isArray(res.ranking) ? res.ranking.length : 0} usuarios actualizados.`);
      } else {
        setRankingMsg(`✗ ${res.error}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Jornada selector */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black text-white">Jornada</h1>
        <input
          type="number" min={1} max={99} value={jornada}
          onChange={(e) => setJornada(Number(e.target.value))}
          className="w-20 rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-lg font-black text-white focus:border-blue-400 focus:outline-none"
        />
        {jornadas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {jornadas.map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setJornada(j)}
                className={cn(
                  "rounded px-2 py-1 text-xs font-bold transition-all",
                  jornada === j ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                )}
              >
                J{j}
              </button>
            ))}
          </div>
        )}
        <span className="text-sm text-gray-500">
          {completados}/{partidos.length} completados
        </span>
      </div>

      {/* Partidos list */}
      <div className="space-y-3">
        {partidos.length === 0 ? (
          <p className="text-sm text-gray-500">No hay partidos para esta jornada.</p>
        ) : (
          partidos.map((p) => (
            <PartidoCard
              key={p.id}
              partido={p}
              jornada={jornada}
              onDone={() => setPartidos((prev) =>
                prev.map((x) => x.id === p.id ? { ...x, completado: true } : x)
              )}
            />
          ))
        )}
        <NuevoPartidoForm
          jornada={jornada}
          selecciones={selecciones}
          onCreated={() => window.location.reload()}
        />
      </div>

      {/* Cerrar jornada */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-800/20 p-4">
        <div className="flex items-center gap-4">
          <Trophy className="h-5 w-5 shrink-0 text-yellow-400" />
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Cerrar Jornada {jornada}</p>
            <p className="text-xs text-gray-500">
              Acumula puntos a todos los usuarios, actualiza precios y registra la jornada. Irreversible.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCerrar}
            disabled={!todosCompletos || isPending}
            title={!todosCompletos ? "Hay partidos sin completar" : undefined}
            className="flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-black text-black transition-all hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
            Cerrar
          </button>
        </div>
        {rankingMsg && (
          <p className={cn(
            "mt-3 text-sm",
            rankingMsg.startsWith("✓") ? "text-green-400" : "text-red-400"
          )}>
            {rankingMsg}
          </p>
        )}
      </div>
    </div>
  );
}
