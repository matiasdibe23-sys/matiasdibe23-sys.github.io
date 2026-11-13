import { createClient } from "@/lib/supabase/server";
import JornadaPanel from "./JornadaPanel";

export default async function AdminJornadaPage({
  searchParams,
}: {
  searchParams: Promise<{ j?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const jornada = Math.max(1, Number(params.j ?? 1) || 1);

  // Load partidos for selected jornada with joined player data
  const { data: partidos } = await supabase
    .from("partidos")
    .select(`
      id, jornada, fase, completado, goles_local, goles_visitante,
      seleccion_local:selecciones_nacionales!partidos_seleccion_local_id_fkey (
        id, nombre,
        jugadores ( id, nombre, nombre_camiseta, posicion, dorsal )
      ),
      seleccion_visitante:selecciones_nacionales!partidos_seleccion_visitante_id_fkey (
        id, nombre,
        jugadores ( id, nombre, nombre_camiseta, posicion, dorsal )
      )
    `)
    .eq("jornada", jornada)
    .order("fecha");

  // All national teams for the create form
  const { data: selecciones } = await supabase
    .from("selecciones_nacionales")
    .select("id, nombre")
    .order("nombre");

  // List of existing jornadas (for the quick-nav pills)
  const { data: jornadasData } = await supabase
    .from("partidos")
    .select("jornada")
    .order("jornada");

  const jornadas = [...new Set((jornadasData ?? []).map((r) => r.jornada))];

  return (
    <JornadaPanel
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      partidos={(partidos ?? []) as any}
      selecciones={selecciones ?? []}
      jornadaNum={jornada}
      jornadas={jornadas}
    />
  );
}
