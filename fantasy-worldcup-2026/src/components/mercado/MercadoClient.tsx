"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Search, X, CheckCircle2, Loader2,
  SlidersHorizontal, Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ficharJugadores } from "@/app/(dashboard)/mercado/actions";
import type { PosicionJugador } from "@/types/database.types";

// ── Types ──────────────────────────────────────────────────────────
type JugadorMercado = {
  id: string;
  nombre: string;
  nombre_camiseta: string | null;
  posicion: PosicionJugador;
  tier: number;
  precio: number;
  precio_base: number;
  puntos_torneo: number;
  dorsal: number | null;
  club: string | null;
  selecciones_nacionales: { nombre: string; bandera_url: string | null } | null;
};
type ItemCarrito = {
  id: string; nombre: string; nombre_camiseta: string | null;
  precio: number; posicion: PosicionJugador; tier: number; seleccion: string;
};
export interface MercadoClientProps {
  usuarioId: string; presupuestoInicial: number; yaFichadosIds: string[];
  username: string; posicionInicial?: PosicionJugador; tierInicial?: number;
}

// ── Design tokens ──────────────────────────────────────────────────
const PAGE_SIZE = 30;

const POS_BADGE: Record<PosicionJugador, { bg: string; text: string }> = {
  POR: { bg: "#d97706", text: "#fff" },
  DEF: { bg: "#0ea5e9", text: "#fff" },
  MED: { bg: "#4ade80", text: "#000" },
  DEL: { bg: "#f43f5e", text: "#fff" },
};

const POS_PILL_ACTIVE: Record<PosicionJugador, string> = {
  POR: "bg-amber-500 text-white",
  DEF: "bg-sky-500 text-white",
  MED: "bg-green-400 text-black",
  DEL: "bg-rose-500 text-white",
};

const TIER_META: Record<number, { label: string }> = {
  1: { label: "Élite" },
  2: { label: "Top" },
  3: { label: "Primera" },
  4: { label: "Regular" },
  5: { label: "Jóvenes" },
};

const POSICIONES: { valor: PosicionJugador; label: string }[] = [
  { valor: "POR", label: "Porteros" },
  { valor: "DEF", label: "Defensas" },
  { valor: "MED", label: "Mediocampo" },
  { valor: "DEL", label: "Delanteros" },
];

function formatVal(precio: number) {
  return (precio * 1_000_000).toLocaleString("de-DE");
}

// ── Flag circle ────────────────────────────────────────────────────
function FlagCircle({ banderaUrl, nombre, posicion }: {
  banderaUrl: string | null; nombre: string; posicion: PosicionJugador;
}) {
  const badge = POS_BADGE[posicion];
  return (
    <div className="relative shrink-0">
      <div
        className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800"
      >
        {banderaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banderaUrl} alt={nombre} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xl font-black text-slate-500">
            {nombre.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      {/* Position badge overlay */}
      <span
        className="absolute -left-1 -top-1 rounded px-1.5 py-0.5 text-[9px] font-black leading-none"
        style={{ background: badge.bg, color: badge.text }}
      >
        {posicion}
      </span>
    </div>
  );
}

// ── Player Card (horizontal) ───────────────────────────────────────
function JugadorCard({
  jugador, enCarrito, yaFichado, presupuestoDisponible, onToggle,
}: {
  jugador: JugadorMercado; enCarrito: boolean; yaFichado: boolean;
  presupuestoDisponible: number; onToggle: (j: JugadorMercado) => void;
}) {
  const sinPresupuesto = !enCarrito && !yaFichado && presupuestoDisponible < jugador.precio;
  const nombre = jugador.nombre_camiseta ?? jugador.nombre.split(" ").pop()!;
  const seleccion = jugador.selecciones_nacionales?.nombre ?? "—";
  const bandera = jugador.selecciones_nacionales?.bandera_url ?? null;
  const disabled = yaFichado || sinPresupuesto;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3 transition-all duration-200",
        enCarrito
          ? "border-[#4ade80]/35 bg-[#4ade80]/[0.05]"
          : yaFichado
            ? "border-slate-800 bg-slate-900/60 opacity-55"
            : sinPresupuesto
              ? "border-slate-800/60 bg-slate-900/40 opacity-55"
              : "border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/80 cursor-pointer"
      )}
      onClick={!disabled ? () => onToggle(jugador) : undefined}
    >
      {/* Flag + position badge */}
      <FlagCircle
        banderaUrl={bandera}
        nombre={seleccion}
        posicion={jugador.posicion}
      />

      {/* Center: name + status */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold leading-tight text-white">{nombre}</p>
        <p className="truncate text-[11px] text-slate-500">{seleccion}</p>
        <div className="mt-1 flex items-center gap-1">
          {yaFichado ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-[#4ade80]" />
              <span className="text-[10px] font-semibold" style={{ color: "#4ade80" }}>
                En tu equipo
              </span>
            </>
          ) : sinPresupuesto ? (
            <span className="text-[10px] font-semibold text-rose-400">Sin presupuesto</span>
          ) : (
            <>
              <CheckCircle2 className="h-3 w-3 text-[#4ade80]" />
              <span className="text-[10px] font-semibold" style={{ color: "#4ade80" }}>
                Disponible
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: points + price + button */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {/* Points */}
        <span className="font-mono text-xl font-black tabular-nums text-white">
          {jugador.puntos_torneo}
        </span>

        {/* Price info */}
        <div className="space-y-0.5 text-right">
          <p className="text-[10px] text-slate-500">
            Valor:{" "}
            <span className="font-mono font-semibold text-slate-400">
              ${jugador.precio.toFixed(1)}M
            </span>
          </p>
          <p className="text-[10px] text-slate-500">
            Base:{" "}
            <span className="font-mono font-semibold text-slate-400">
              ${jugador.precio_base.toFixed(1)}M
            </span>
          </p>
        </div>

        {/* Action button */}
        {!yaFichado && !sinPresupuesto && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(jugador); }}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-black transition-all duration-200 active:scale-95",
              enCarrito
                ? "bg-rose-500 text-white hover:bg-rose-400"
                : "text-black hover:opacity-90"
            )}
            style={enCarrito ? {} : { background: "#4ade80" }}
          >
            {enCarrito ? "Quitar" : "Offer"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Cart Item ──────────────────────────────────────────────────────
function CartItem({ item, onRemove }: { item: ItemCarrito; onRemove: (id: string) => void }) {
  const badge = POS_BADGE[item.posicion];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
      <span
        className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black"
        style={{ background: badge.bg, color: badge.text }}
      >
        {item.posicion}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold text-white">
          {item.nombre_camiseta ?? item.nombre}
        </p>
        <p className="text-[10px] text-slate-500">{item.seleccion}</p>
      </div>
      <span className="shrink-0 font-mono text-xs font-black tabular-nums text-white">
        ${item.precio.toFixed(1)}M
      </span>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="shrink-0 rounded-lg p-1 text-slate-600 transition-colors hover:text-rose-400"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Cart Panel ─────────────────────────────────────────────────────
function CarritoPanel({
  items, presupuesto, totalCarrito, isPending, onRemove, onConfirmar,
}: {
  items: ItemCarrito[]; presupuesto: number; totalCarrito: number;
  isPending: boolean; onRemove: (id: string) => void; onConfirmar: () => void;
}) {
  const disponible = presupuesto - totalCarrito;
  const sobrepasado = disponible < 0;
  const gastado = 100 - presupuesto + totalCarrito;
  const pct = Math.min((gastado / 100) * 100, 100);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-black text-white">
          Carrito
          {items.length > 0 && (
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-black text-black"
              style={{ background: "#4ade80" }}
            >
              {items.length}
            </span>
          )}
        </h2>
      </div>

      {/* Budget */}
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="mb-2 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Wallet className="h-3 w-3" /> Presupuesto
          </span>
          <span className="font-mono font-bold text-white">${gastado.toFixed(1)}M / $100M</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: sobrepasado
                ? "#f43f5e"
                : pct > 80
                  ? "#f59e0b"
                  : "linear-gradient(90deg,#38bdf8,#4ade80)",
            }}
          />
        </div>
        <div className="mt-3 flex items-end justify-between">
          <span className="text-[11px] text-slate-500">Disponible</span>
          <span
            className="font-mono text-2xl font-black tabular-nums leading-none"
            style={{
              color: sobrepasado ? "#f43f5e" : disponible < 10 ? "#f59e0b" : "#fff",
            }}
          >
            ${disponible.toFixed(1)}
            <span className="ml-0.5 text-sm font-normal text-slate-400">M</span>
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800">
              <Wallet className="h-6 w-6 text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-500">Carrito vacío</p>
            <p className="text-[11px] text-slate-600">Presiona "Offer" en un jugador</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => (
              <CartItem key={item.id} item={item} onRemove={onRemove} />
            ))}
          </div>
        )}
      </div>

      {/* Confirm */}
      <div className="border-t border-slate-800 p-4">
        {items.length > 0 && (
          <div className="mb-3 flex items-baseline justify-between text-sm">
            <span className="text-slate-400">Total</span>
            <span className="font-mono text-lg font-black tabular-nums text-white">
              ${totalCarrito.toFixed(1)}M
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onConfirmar}
          disabled={items.length === 0 || sobrepasado || isPending}
          className="w-full rounded-2xl py-3 text-sm font-black transition-all duration-200 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600 active:scale-[0.98]"
          style={
            items.length > 0 && !sobrepasado && !isPending
              ? { background: "#4ade80", color: "#000" }
              : {}
          }
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Fichando…
            </span>
          ) : items.length === 0 ? (
            "Añade jugadores"
          ) : sobrepasado ? (
            "Presupuesto insuficiente"
          ) : (
            `Fichar ${items.length} jugador${items.length !== 1 ? "es" : ""}`
          )}
        </button>
      </div>
    </div>
  );
}

// ── Filter Sidebar ─────────────────────────────────────────────────
function FilterSidebar({
  busquedaInput, setBusquedaInput,
  filtroPosicion, setFiltroPosicion,
  filtroTier, setFiltroTier,
  presupuesto, yaFichadosCount, carritoCount,
}: {
  busquedaInput: string; setBusquedaInput: (v: string) => void;
  filtroPosicion: PosicionJugador | null; setFiltroPosicion: (v: PosicionJugador | null) => void;
  filtroTier: number | null; setFiltroTier: (v: number | null) => void;
  presupuesto: number; yaFichadosCount: number; carritoCount: number;
}) {
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto px-4 py-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar jugador…"
          value={busquedaInput}
          onChange={(e) => setBusquedaInput(e.target.value)}
          className="h-9 w-full rounded-xl border border-slate-700/50 bg-slate-800/60 pl-9 pr-8 text-sm text-white placeholder:text-slate-600 focus:border-slate-500 focus:bg-slate-800 focus:outline-none transition-all duration-200"
        />
        {busquedaInput && (
          <button
            type="button"
            onClick={() => setBusquedaInput("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Position */}
      <div>
        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Posición
        </p>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setFiltroPosicion(null)}
            className={cn(
              "rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all duration-200",
              filtroPosicion === null
                ? "border-[#4ade80]/50 bg-[#4ade80]/10 text-[#4ade80]"
                : "border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-white"
            )}
          >
            Todas las posiciones
          </button>
          {POSICIONES.map((p) => {
            const badge = POS_BADGE[p.valor];
            const active = filtroPosicion === p.valor;
            return (
              <button
                key={p.valor}
                type="button"
                onClick={() => setFiltroPosicion(active ? null : p.valor)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all duration-200",
                  active
                    ? "border-transparent text-white"
                    : "border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-white"
                )}
                style={active ? { background: badge.bg, borderColor: "transparent", color: badge.text } : {}}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: badge.bg }}
                />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tier */}
      <div>
        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Nivel
        </p>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setFiltroTier(null)}
            className={cn(
              "rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all duration-200",
              filtroTier === null
                ? "border-[#4ade80]/50 bg-[#4ade80]/10 text-[#4ade80]"
                : "border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-white"
            )}
          >
            Todos los niveles
          </button>
          {[1, 2, 3, 4, 5].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFiltroTier(filtroTier === t ? null : t)}
              className={cn(
                "rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all duration-200",
                filtroTier === t
                  ? "border-[#4ade80]/50 bg-[#4ade80]/10 text-[#4ade80]"
                  : "border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-white"
              )}
            >
              T{t} — {TIER_META[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-[11px] space-y-2">
        <div className="flex justify-between">
          <span className="text-slate-500">Presupuesto</span>
          <span className="font-mono font-bold" style={{ color: "#4ade80" }}>${presupuesto.toFixed(1)}M</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Fichados</span>
          <span className="font-mono font-bold text-white">{yaFichadosCount}/15</span>
        </div>
        {carritoCount > 0 && (
          <div className="flex justify-between border-t border-slate-800 pt-2">
            <span className="text-slate-400">En carrito</span>
            <span className="font-mono font-bold text-amber-400">{carritoCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────
export default function MercadoClient({
  presupuestoInicial, yaFichadosIds, posicionInicial, tierInicial,
}: MercadoClientProps) {
  const supabase = createClient();

  const [busquedaInput, setBusquedaInput] = useState("");
  const [debouncedBusqueda, setDebouncedBusqueda] = useState("");
  const [filtroPosicion, setFiltroPosicion] = useState<PosicionJugador | null>(posicionInicial ?? null);
  const [filtroTier, setFiltroTier] = useState<number | null>(tierInicial ?? null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const [jugadores, setJugadores] = useState<JugadorMercado[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [loading, setLoading] = useState(true);

  const [carrito, setCarrito] = useState<Map<string, ItemCarrito>>(new Map());
  const [presupuesto, setPresupuesto] = useState(presupuestoInicial);
  const [yaFichados, setYaFichados] = useState(() => new Set(yaFichadosIds));
  const [isPending, startTransition] = useTransition();

  const filtroRef = useRef({ busqueda: "", posicion: null as PosicionJugador | null, tier: null as number | null });

  const carritoItems = [...carrito.values()];
  const totalCarrito = carritoItems.reduce((s, j) => s + j.precio, 0);
  const presupuestoDisponible = presupuesto - totalCarrito;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedBusqueda(busquedaInput), 350);
    return () => clearTimeout(t);
  }, [busquedaInput]);

  const fetchJugadores = useCallback(async (pagina: number) => {
    const { busqueda, posicion, tier } = filtroRef.current;
    setLoading(true);
    const from = pagina * PAGE_SIZE;
    let q = supabase
      .from("jugadores")
      .select("id,nombre,nombre_camiseta,posicion,tier,precio,precio_base,puntos_torneo,dorsal,club,selecciones_nacionales(nombre,bandera_url)")
      .eq("activo", true);
    if (busqueda.trim()) q = q.or(`nombre.ilike.%${busqueda.trim()}%,nombre_camiseta.ilike.%${busqueda.trim()}%`);
    if (posicion) q = q.eq("posicion", posicion);
    if (tier) q = q.eq("tier", tier);
    const { data } = await q.order("tier").order("precio", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    const res = (data ?? []) as JugadorMercado[];
    setJugadores((prev) => pagina === 0 ? res : [...prev, ...res]);
    setHayMas(res.length >= PAGE_SIZE);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filtroRef.current = { busqueda: debouncedBusqueda, posicion: filtroPosicion, tier: filtroTier };
    setJugadores([]);
    setHayMas(false);
    fetchJugadores(0);
  }, [debouncedBusqueda, filtroPosicion, filtroTier, fetchJugadores]);

  function toggleCarrito(j: JugadorMercado) {
    setCarrito((prev) => {
      const next = new Map(prev);
      if (next.has(j.id)) next.delete(j.id);
      else next.set(j.id, { id: j.id, nombre: j.nombre, nombre_camiseta: j.nombre_camiseta, precio: j.precio, posicion: j.posicion, tier: j.tier, seleccion: j.selecciones_nacionales?.nombre ?? "—" });
      return next;
    });
  }

  function confirmarFichajes() {
    const items = carritoItems.map((j) => ({ jugador_id: j.id, nombre: j.nombre_camiseta ?? j.nombre }));
    startTransition(async () => {
      const { resultados, presupuestoActualizado } = await ficharJugadores(items);
      const exitos = resultados.filter((r) => r.ok);
      const errores = resultados.filter((r) => !r.ok);
      if (exitos.length > 0) {
        setYaFichados((prev) => { const n = new Set(prev); exitos.forEach((r) => n.add(r.jugador_id)); return n; });
        setCarrito((prev) => { const n = new Map(prev); exitos.forEach((r) => n.delete(r.jugador_id)); return n; });
        setPresupuesto(presupuestoActualizado);
        toast.success(
          exitos.length === items.length
            ? `${exitos.length} fichaje${exitos.length > 1 ? "s" : ""} completado${exitos.length > 1 ? "s" : ""}`
            : `${exitos.length}/${items.length} fichajes ok`,
          { description: exitos.map((r) => r.nombre).join(", ") }
        );
      }
      errores.forEach((r) => toast.error(`No se pudo fichar a ${r.nombre}`, { description: r.errorMsg }));
    });
  }

  const activeFilters = [filtroPosicion, filtroTier, busquedaInput].filter(Boolean).length;

  return (
    <div className="flex h-full flex-col" style={{ background: "#080b10" }}>
      {/* ── Mobile filter bar ── */}
      <div
        className="sticky top-0 z-20 border-b border-white/[0.06] backdrop-blur-md lg:hidden"
        style={{ background: "rgba(8,11,16,0.95)" }}
      >
        {/* Available balance pill */}
        <div className="px-4 pt-3 pb-2">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5"
            style={{ borderColor: "rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.08)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "#4ade80" }} />
            <span className="text-sm font-bold" style={{ color: "#4ade80" }}>
              Available balance: ${presupuestoDisponible.toFixed(1)}M
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 pb-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar jugador…"
              value={busquedaInput}
              onChange={(e) => setBusquedaInput(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-700/50 bg-slate-800/60 pl-9 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setMostrarFiltros((p) => !p)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all duration-200",
              mostrarFiltros
                ? "border-[#4ade80]/50 bg-[#4ade80]/10 text-[#4ade80]"
                : "border-slate-700 bg-slate-800/60 text-slate-400 hover:text-white"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {activeFilters > 0 && (
              <span
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-black"
                style={{ background: "#4ade80" }}
              >
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {mostrarFiltros && (
          <div className="space-y-4 border-t border-white/[0.06] px-4 pb-4 pt-3">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFiltroPosicion(null)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all",
                  filtroPosicion === null
                    ? "border-[#4ade80]/50 bg-[#4ade80]/10 text-[#4ade80]"
                    : "border-slate-700 bg-slate-800 text-slate-400"
                )}
              >
                Todas
              </button>
              {POSICIONES.map((p) => {
                const badge = POS_BADGE[p.valor];
                const active = filtroPosicion === p.valor;
                return (
                  <button
                    key={p.valor}
                    type="button"
                    onClick={() => setFiltroPosicion(active ? null : p.valor)}
                    className="rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all"
                    style={
                      active
                        ? { background: badge.bg, borderColor: badge.bg, color: badge.text }
                        : { borderColor: "#334155", background: "#1e293b", color: "#94a3b8" }
                    }
                  >
                    {p.valor}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFiltroTier(filtroTier === t ? null : t)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all",
                    filtroTier === t
                      ? "border-[#4ade80]/50 bg-[#4ade80]/10 text-[#4ade80]"
                      : "border-slate-700 bg-slate-800 text-slate-400"
                  )}
                >
                  T{t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Filters sidebar (desktop) */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-white/[0.06] bg-slate-900/30 backdrop-blur-sm lg:flex">
          <FilterSidebar
            busquedaInput={busquedaInput}
            setBusquedaInput={setBusquedaInput}
            filtroPosicion={filtroPosicion}
            setFiltroPosicion={setFiltroPosicion}
            filtroTier={filtroTier}
            setFiltroTier={setFiltroTier}
            presupuesto={presupuesto}
            yaFichadosCount={yaFichados.size}
            carritoCount={carrito.size}
          />
        </aside>

        {/* Player list */}
        <main className="flex-1 overflow-y-auto px-4 py-5">
          {/* Desktop balance pill */}
          <div className="mb-4 hidden lg:flex">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2"
              style={{ borderColor: "rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.08)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#4ade80" }} />
              <span className="text-sm font-bold" style={{ color: "#4ade80" }}>
                Available balance: ${presupuestoDisponible.toFixed(1)}M
              </span>
            </div>
          </div>

          {loading && jugadores.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-32">
              <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
              <p className="text-sm text-slate-500">Cargando jugadores…</p>
            </div>
          ) : jugadores.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-32">
              <Search className="h-10 w-10 text-slate-700" />
              <p className="font-bold text-slate-400">Sin resultados</p>
              <button
                type="button"
                onClick={() => { setBusquedaInput(""); setFiltroPosicion(null); setFiltroTier(null); }}
                className="rounded-2xl border border-slate-700 bg-slate-800 px-5 py-2 text-sm font-bold text-white hover:bg-slate-700"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {jugadores.map((j) => (
                  <JugadorCard
                    key={j.id}
                    jugador={j}
                    enCarrito={carrito.has(j.id)}
                    yaFichado={yaFichados.has(j.id)}
                    presupuestoDisponible={presupuestoDisponible}
                    onToggle={toggleCarrito}
                  />
                ))}
              </div>

              {hayMas && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => fetchJugadores(Math.ceil(jugadores.length / PAGE_SIZE))}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 px-8 py-2.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cargar más"}
                  </button>
                </div>
              )}

              <p className="mt-6 text-center text-[11px] text-slate-600">
                {jugadores.length} jugadores · {hayMas ? "hay más" : "fin de lista"}
              </p>
            </>
          )}
        </main>

        {/* Cart sidebar (desktop) */}
        <aside className="hidden w-72 shrink-0 flex-col border-l border-white/[0.06] bg-slate-900/40 backdrop-blur-sm lg:flex">
          <CarritoPanel
            items={carritoItems}
            presupuesto={presupuesto}
            totalCarrito={totalCarrito}
            isPending={isPending}
            onRemove={(id) => setCarrito((p) => { const n = new Map(p); n.delete(id); return n; })}
            onConfirmar={confirmarFichajes}
          />
        </aside>
      </div>

      {/* ── Mobile sticky bottom bar ── */}
      <div
        className="sticky bottom-0 z-30 border-t border-white/[0.06] px-4 py-3 backdrop-blur-md lg:hidden"
        style={{ background: "rgba(8,11,16,0.97)", paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500">Disponible</span>
            <span
              className="font-mono text-base font-black tabular-nums leading-tight"
              style={{
                color: presupuestoDisponible < 0 ? "#f43f5e"
                  : presupuestoDisponible < 10 ? "#f59e0b"
                  : "#4ade80",
              }}
            >
              ${presupuestoDisponible.toFixed(1)}M
            </span>
          </div>

          {carritoItems.length > 0 && (
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500">Carrito</span>
              <span className="font-mono text-base font-black tabular-nums text-amber-400">
                {carritoItems.length} · ${totalCarrito.toFixed(1)}M
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={confirmarFichajes}
            disabled={carritoItems.length === 0 || presupuestoDisponible < 0 || isPending}
            className="ml-auto flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-black transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600"
            style={
              carritoItems.length > 0 && presupuestoDisponible >= 0 && !isPending
                ? { background: "#4ade80", color: "#000" }
                : {}
            }
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              carritoItems.length > 0 ? `Fichar (${carritoItems.length})` : "Fichar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
