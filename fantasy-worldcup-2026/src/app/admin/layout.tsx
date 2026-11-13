import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Shield } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("is_admin, nombre_equipo")
    .eq("id", user.id)
    .single();

  if (!perfil?.is_admin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Shield className="h-5 w-5 text-red-400" />
          <span className="font-black text-white">
            Admin <span className="text-red-400">Panel</span>
          </span>
          <span className="text-gray-600">/</span>
          <Link
            href="/admin/jornada"
            className="text-sm font-semibold text-gray-300 hover:text-white"
          >
            Jornada
          </Link>
          <Link
            href="/dashboard"
            className="ml-auto text-sm text-gray-500 hover:text-gray-300"
          >
            ← Volver al dashboard
          </Link>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
