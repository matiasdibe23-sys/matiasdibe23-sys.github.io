import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_equipo")
    .eq("id", user.id)
    .single();

  if (perfil?.nombre_equipo) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1 text-center">
          <h1 className="text-4xl font-black tracking-tighter text-white">
            FANTASY<span className="text-yellow-400">26</span>
          </h1>
          <p className="text-sm text-slate-500">Pon el nombre de tu equipo para empezar</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
          <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-yellow-500">
              Presupuesto inicial
            </p>
            <p className="mt-1 text-3xl font-black text-white">$100M</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Hasta 15 jugadores · máx. 3 por selección
            </p>
          </div>
          <OnboardingForm />
        </div>
      </div>
    </div>
  );
}

