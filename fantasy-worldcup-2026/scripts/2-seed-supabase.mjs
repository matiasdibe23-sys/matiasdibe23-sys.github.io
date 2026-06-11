/**
 * Script 2: Lee jugadores.json e inserta en Supabase via upsert por lotes.
 *
 * Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
 * (o las variables directas como SERVICE_ROLE si usás admin).
 *
 * Uso: node scripts/2-seed-supabase.mjs
 * Flags:
 *   --dry-run    Solo muestra qué se insertaría sin tocar la BD
 *   --batch N    Tamaño de lote (default: 50)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "dotenv";

// ── Config ─────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));

// Carga .env.local desde la raíz del proyecto
config({ path: join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? // preferimos service role para admin
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const BATCH_SIZE = parseInt(
  process.argv.find((a) => a.startsWith("--batch="))?.split("=")[1] ?? "50"
);
const DRY_RUN = process.argv.includes("--dry-run");
const DELAY_MS = 300; // pausa entre lotes (ms)

// ── Validaciones ───────────────────────────────────────────────
const isDryRun = process.argv.includes("--dry-run");

if (!isDryRun && (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.startsWith("your_"))) {
  console.error(
    "❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
  console.error(
    "   Asegurate de tener .env.local en la raíz del proyecto con esos valores."
  );
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function barra(actual, total, ancho = 30) {
  const pct = actual / total;
  const lleno = Math.round(pct * ancho);
  const vacio = ancho - lleno;
  return `[${"█".repeat(lleno)}${"░".repeat(vacio)}] ${actual}/${total}`;
}

// ── Paso 1: Upsert de selecciones nacionales ───────────────────

async function upsertSelecciones(supabase, jugadores) {
  // Construye mapa único de selecciones a partir de los jugadores
  const mapaSelecciones = new Map();
  for (const j of jugadores) {
    if (!mapaSelecciones.has(j.seleccion_codigo)) {
      mapaSelecciones.set(j.seleccion_codigo, {
        nombre: j.seleccion_nombre,
        // grupo: a asignar manualmente o por n8n
        grupo: "A", // placeholder — actualizar cuando se sorteen grupos
      });
    }
  }

  const selecciones = Array.from(mapaSelecciones.entries()).map(
    ([codigo, data]) => ({
      nombre: `${data.nombre} (${codigo})`,
      grupo: data.grupo,
    })
  );

  console.log(`\n📋 Paso 1/2 — Selecciones (${selecciones.length})`);

  if (DRY_RUN) {
    console.log("   [DRY RUN] Se insertarían:", selecciones.slice(0, 3), "...");
    // Retorna un mapa ficticio de nombre → uuid simulado
    return new Map(selecciones.map((s, i) => [s.nombre, `uuid-${i}`]));
  }

  const { error } = await supabase
    .from("selecciones_nacionales")
    .upsert(selecciones, { onConflict: "nombre" });

  if (error) throw new Error(`Selecciones: ${error.message}`);

  // Recarga para obtener UUIDs reales
  const { data, error: err2 } = await supabase
    .from("selecciones_nacionales")
    .select("id, nombre");

  if (err2) throw new Error(`Selecciones fetch: ${err2.message}`);

  const mapaId = new Map(data.map((s) => [s.nombre, s.id]));
  console.log(`   ✅ ${data.length} selecciones en BD`);
  return mapaId;
}

// ── Paso 2: Upsert de jugadores por lotes ─────────────────────

async function upsertJugadores(supabase, jugadores, mapaSelecciones) {
  console.log(`\n⚽ Paso 2/2 — Jugadores (${jugadores.length} en lotes de ${BATCH_SIZE})`);

  // Prepara los registros mapeando seleccion_id
  const registros = jugadores.map((j) => {
    const nombreSeleccion = `${j.seleccion_nombre} (${j.seleccion_codigo})`;
    const seleccion_id = mapaSelecciones.get(nombreSeleccion);

    if (!seleccion_id && !DRY_RUN) {
      console.warn(`   ⚠️  Sin ID para selección: ${nombreSeleccion}`);
    }

    // Parsea fecha "DD/M/YYYY" → "YYYY-MM-DD" para PostgreSQL DATE
    let fechaNac = null;
    if (j.fecha_nacimiento) {
      const parts = j.fecha_nacimiento.split("/");
      if (parts.length === 3) {
        const [d, m, y] = parts;
        fechaNac = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
    }

    return {
      nombre: j.nombre,
      posicion: j.posicion,
      seleccion_id: seleccion_id ?? null,
      dorsal: j.dorsal ?? null,
      nombre_camiseta: j.nombre_camiseta ?? null,
      club: j.club ?? null,
      fecha_nacimiento: fechaNac,
      estatura_cm: j.estatura_cm ?? null,
      precio: 5.0,
      puntos_torneo: 0,
      activo: true,
    };
  });

  const lotes = chunk(registros, BATCH_SIZE);
  let insertados = 0;
  let errores = 0;

  for (let i = 0; i < lotes.length; i++) {
    const lote = lotes[i];

    process.stdout.write(
      `\r   ${barra(insertados, registros.length)} — lote ${i + 1}/${lotes.length}`
    );

    if (!DRY_RUN) {
      const { error } = await supabase
        .from("jugadores")
        .upsert(lote, { onConflict: "nombre,seleccion_id" });

      if (error) {
        errores++;
        console.error(`\n   ❌ Error en lote ${i + 1}: ${error.message}`);
      } else {
        insertados += lote.length;
      }

      // Pausa entre lotes para no saturar la API
      if (i < lotes.length - 1) await sleep(DELAY_MS);
    } else {
      insertados += lote.length;
    }
  }

  process.stdout.write("\n");
  return { insertados, errores };
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  const jsonPath = join(__dirname, "jugadores.json");

  console.log("🚀 Fantasy Mundial — Seed Supabase");
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log(`   Lote: ${BATCH_SIZE} jugadores | Pausa: ${DELAY_MS}ms`);
  if (DRY_RUN) console.log("   ⚠️  MODO DRY RUN — no se escribe en BD");

  // Lee el JSON
  let jugadores;
  try {
    jugadores = JSON.parse(readFileSync(jsonPath, "utf8"));
  } catch {
    console.error(`❌ No se encontró ${jsonPath}. Ejecutá primero el script 1.`);
    process.exit(1);
  }

  console.log(`\n📦 ${jugadores.length} jugadores cargados desde JSON`);

  // En dry-run no necesitamos URL válida
  const supabase = DRY_RUN
    ? null
    : createClient(SUPABASE_URL, SUPABASE_KEY);

  // Paso 1 — selecciones
  const mapaSelecciones = await upsertSelecciones(supabase, jugadores);

  // Paso 2 — jugadores
  const { insertados, errores } = await upsertJugadores(
    supabase,
    jugadores,
    mapaSelecciones
  );

  // Resumen final
  console.log("\n" + "─".repeat(40));
  if (DRY_RUN) {
    console.log("✅ Dry run completado — sin cambios en BD");
    console.log(`   Se procesarían ${insertados} jugadores`);
  } else {
    console.log(
      errores === 0
        ? `✅ Seed completado exitosamente`
        : `⚠️  Seed completado con ${errores} lote(s) con error`
    );
    console.log(`   Jugadores insertados/actualizados: ${insertados}`);
    console.log(`   Lotes con error: ${errores}`);
  }
}

main().catch((err) => {
  console.error("❌ Error fatal:", err.message);
  process.exit(1);
});
