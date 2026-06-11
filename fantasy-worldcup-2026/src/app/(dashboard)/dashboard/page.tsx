import { createClient } from "@/lib/supabase/server";
import { ShoppingCart, Users, Trophy, TrendingUp, Medal } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_equipo, presupuesto_restante, puntos_totales")
    .eq("id", user!.id)
    .single();

  const [{ count: jugadoresFichados }, { data: rankingRow }] = await Promise.all([
    supabase
      .from("equipos_usuarios")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", user!.id),
    supabase
      .from("ranking_usuarios")
      .select("posicion, valor_plantilla")
      .eq("usuario_id", user!.id)
      .single(),
  ]);

  const quickLinks = [
    { href: "/mercado",   icon: ShoppingCart, label: "Mercado",   desc: "Ficha jugadores" },
    { href: "/mi-equipo", icon: Users,         label: "Mi Equipo", desc: "Arma tu once" },
    { href: "/ranking",   icon: Trophy,        label: "Ranking",   desc: "Tabla global" },
    { href: "/ligas",     icon: Medal,         label: "Mis Ligas", desc: "Ligas privadas" },
  ];

  const initial = (perfil?.nombre_equipo?.[0] ?? "?").toUpperCase();

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Hero ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Fantasy WorldCup 2026
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
            {perfil?.nombre_equipo}
          </h1>
        </div>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-black text-black"
          style={{ background: "#4ade80" }}
        >
          {initial}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Trophy className="h-4 w-4" />}
          label="Puntos"
          value={String(perfil?.puntos_totales ?? 0)}
          valueColor="#4ade80"
        />
        <StatCard
          icon={<Medal className="h-4 w-4" />}
          label="Posición"
          value={rankingRow?.posicion ? `#${rankingRow.posicion}` : "—"}
          valueColor="#fff"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Presupuesto"
          value={`$${(perfil?.presupuesto_restante ?? 0).toFixed(1)}M`}
          valueColor="#4ade80"
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Plantilla"
          value={`${jugadoresFichados ?? 0}/15`}
          valueColor="#fff"
        />
      </div>

      {/* ── Quick actions ── */}
      <div>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">
          Acceso rápido
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickLinks.map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:border-slate-700 hover:bg-slate-800 hover:-translate-y-0.5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 group-hover:border-[#4ade80]/30 group-hover:bg-[#4ade80]/10 transition-all">
                <Icon className="h-4 w-4 text-slate-300 group-hover:text-[#4ade80] transition-colors" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, valueColor,
}: { icon: React.ReactNode; label: string; value: string; valueColor: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
        <span className="text-slate-600">{icon}</span>
        {label}
      </div>
      <p className="font-mono text-2xl font-black tabular-nums" style={{ color: valueColor }}>
        {value}
      </p>
    </div>
  );
}
