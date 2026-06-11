"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, ShoppingCart, Users, Trophy, Medal, LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/app/(auth)/login/actions";
import type { Perfil } from "@/types/database.types";
import { cn } from "@/lib/utils";

interface NavbarProps {
  perfil: Perfil;
}

const NAV_LINKS = [
  { href: "/dashboard",  label: "Inicio",   icon: Home },
  { href: "/ranking",    label: "Posición",  icon: Trophy },
  { href: "/mi-equipo",  label: "Equipo",   icon: Users },
  { href: "/mercado",    label: "Mercado",  icon: ShoppingCart },
  { href: "/ligas",      label: "Ligas",    icon: Medal },
];

export function Navbar({ perfil: initialPerfil }: NavbarProps) {
  const [perfil, setPerfil] = useState(initialPerfil);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("perfil-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "perfiles", filter: `id=eq.${initialPerfil.id}` },
        (payload) => { setPerfil((prev) => ({ ...prev, ...(payload.new as Perfil) })); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [initialPerfil.id]);

  const budgetColor =
    perfil.presupuesto_restante >= 30 ? "text-[#4ade80]" :
    perfil.presupuesto_restante >= 10 ? "text-amber-400" : "text-rose-400";

  const initial = (perfil.nombre_equipo?.[0] ?? "?").toUpperCase();

  return (
    <>
      {/* ── Top header ─────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-md"
        style={{ background: "rgba(10,12,18,0.92)" }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Logo */}
          <Link href="/dashboard" className="flex shrink-0 items-center gap-1.5">
            <span className="text-lg font-extrabold tracking-tight text-white">
              Fantasy
            </span>
            <span className="text-lg font-extrabold tracking-tight" style={{ color: "#4ade80" }}>
              WorldCup
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all duration-200",
                    active
                      ? "text-black"
                      : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                  )}
                  style={active ? { background: "#4ade80", color: "#000" } : {}}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right: budget + avatar */}
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[11px] font-bold leading-tight text-slate-400">
                {perfil.nombre_equipo}
              </p>
              <p className={cn("font-mono text-sm font-black leading-tight tabular-nums", budgetColor)}>
                ${perfil.presupuesto_restante.toFixed(1)}M
              </p>
            </div>

            {/* Avatar circle */}
            <form action={logout}>
              <button
                type="submit"
                title="Salir"
                className="flex h-9 w-9 items-center justify-center rounded-full font-black text-sm text-black transition-transform hover:scale-105 active:scale-95"
                style={{ background: "#4ade80" }}
              >
                {initial}
              </button>
            </form>
          </div>
        </div>
      </nav>

      {/* ── Mobile bottom tab bar ──────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] backdrop-blur-md lg:hidden"
        style={{ background: "rgba(10,12,18,0.97)" }}
      >
        <div className="flex items-center justify-around px-2 py-1.5">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-1 flex-col items-center gap-0.5 py-1 transition-opacity active:opacity-70"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200",
                    active ? "bg-[#4ade80]/15" : ""
                  )}
                >
                  <Icon
                    className="h-5 w-5 transition-colors"
                    style={{ color: active ? "#4ade80" : "#64748b" }}
                    strokeWidth={active ? 2.5 : 2}
                  />
                </div>
                <span
                  className="text-[9px] font-semibold leading-none transition-colors"
                  style={{ color: active ? "#4ade80" : "#64748b" }}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
        {/* iPhone safe area */}
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </nav>
    </>
  );
}
