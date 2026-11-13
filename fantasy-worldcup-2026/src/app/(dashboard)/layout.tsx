import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/Navbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // New user — trigger may not have fired yet or nombre_equipo not set
  if (!perfil || !perfil.nombre_equipo) redirect("/onboarding");

  return (
    <div className="h-screen flex flex-col" style={{ background: "#080b10" }}>
      <Navbar perfil={perfil} />
      <div className="flex-1 min-h-0 overflow-auto pb-20 lg:pb-0">
        {children}
      </div>
    </div>
  );
}
