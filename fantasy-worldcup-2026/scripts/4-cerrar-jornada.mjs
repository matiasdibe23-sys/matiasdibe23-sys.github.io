/**
 * scripts/4-cerrar-jornada.mjs
 *
 * Cierre automático de jornada Fantasy Mundial 2026.
 *
 * Qué hace:
 *   1. Detecta la jornada lista para cerrar (todos los partidos completados
 *      y el último terminó hace más de HORAS_ESPERA horas)
 *   2. Llama a cerrar_jornada() que:
 *        - Acumula puntos en perfiles.puntos_totales
 *        - Ejecuta actualizar_precios_jornada()
 *        - Registra el cierre en jornadas_procesadas
 *   3. Imprime el ranking de la jornada en consola
 *
 * Uso:
 *   node scripts/4-cerrar-jornada.mjs              # auto-detecta jornada
 *   node scripts/4-cerrar-jornada.mjs --jornada=3  # fuerza jornada específica
 *   node scripts/4-cerrar-jornada.mjs --dry-run    # simula sin modificar datos
 *
 * Automatización:
 *   • Cron en el servidor: "0 * * * * node /ruta/scripts/4-cerrar-jornada.mjs"
 *     (cada hora; la función detecta sola cuándo hay que cerrar)
 *   • O importar el workflow n8n/cerrar-jornada.json en tu instancia de n8n
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ── Configuración ─────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HORAS_ESPERA         = 2; // horas después del último partido

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  log("error", "Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Argumentos ────────────────────────────────────────────────────
const args       = process.argv.slice(2);
const dryRun     = args.includes("--dry-run");
const jornadaArg = args.find((a) => a.startsWith("--jornada="));
const jornadaForzada = jornadaArg ? Number(jornadaArg.split("=")[1]) : null;

// ── Logger ────────────────────────────────────────────────────────
function log(nivel, mensaje, datos) {
  const ts       = new Date().toISOString();
  const prefijos = { info: "ℹ", ok: "✓", warn: "⚠", error: "✗" };
  const p        = prefijos[nivel] ?? "·";
  console.log(`[${ts}] ${p} ${mensaje}`);
  if (datos !== undefined) console.log(JSON.stringify(datos, null, 2));
}

// ── Paso 1: detectar jornada a cerrar ────────────────────────────
async function detectarJornada() {
  if (jornadaForzada) {
    log("info", `Jornada forzada por argumento: ${jornadaForzada}`);
    return jornadaForzada;
  }

  log("info", `Buscando jornada lista (todos los partidos completos + ${HORAS_ESPERA}h de espera)…`);

  const { data, error } = await supabase.rpc("obtener_jornada_a_cerrar", {
    p_horas_espera: HORAS_ESPERA,
  });

  if (error) {
    log("error", "Error al consultar obtener_jornada_a_cerrar()", error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    log("info", "No hay ninguna jornada lista para cerrar. Nada que hacer.");
    return null;
  }

  const { jornada, total_partidos, ultimo_partido_en } = data[0];
  log("ok", `Jornada ${jornada} lista (${total_partidos} partidos, último: ${ultimo_partido_en})`);
  return jornada;
}

// ── Paso 2: cerrar la jornada ────────────────────────────────────
async function cerrarJornada(jornada) {
  if (dryRun) {
    log("warn", `[DRY-RUN] Simulando cierre de jornada ${jornada} — no se modifican datos.`);
    return;
  }

  log("info", `Cerrando jornada ${jornada}…`);

  const { data: ranking, error } = await supabase.rpc("cerrar_jornada", {
    p_jornada: jornada,
  });

  if (error) {
    const cod = error.message ?? "";
    if (cod.includes("jornada_ya_procesada")) {
      log("warn", `La jornada ${jornada} ya estaba cerrada. Sin cambios.`);
    } else if (cod.includes("jornada_incompleta")) {
      log("warn", `La jornada ${jornada} tiene partidos sin completar. Esperando…`);
    } else {
      log("error", `Error al cerrar jornada ${jornada}`, error);
      process.exit(1);
    }
    return;
  }

  // ── Paso 3: notificación / log de resultados ──────────────────
  log("ok", `═══════════════════════════════════════════`);
  log("ok", ` 🏆  Jornada ${jornada} cerrada exitosamente`);
  log("ok", `═══════════════════════════════════════════`);
  log("ok", ` Ranking de la jornada:`);

  if (!ranking || ranking.length === 0) {
    log("info", " (ningún usuario tiene jugadores con puntos en esta jornada)");
  } else {
    const maxNombre = Math.max(...ranking.map((r) => r.nombre_equipo.length), 14);
    const cabecera  = [
      "POS".padEnd(4),
      "EQUIPO".padEnd(maxNombre),
      "J.JORNADA".padStart(10),
      "TOTAL".padStart(8),
    ].join("  ");

    log("ok", ` ${cabecera}`);
    log("ok", ` ${"─".repeat(cabecera.length)}`);

    for (const r of ranking) {
      const fila = [
        `${r.posicion}°`.padEnd(4),
        r.nombre_equipo.padEnd(maxNombre),
        `+${r.puntos_jornada}`.padStart(10),
        `${r.puntos_acumulados}`.padStart(8),
      ].join("  ");
      log("ok", ` ${fila}`);
    }
  }

  log("ok", `═══════════════════════════════════════════`);

  // TODO: cuando se configure, reemplazar este log por un
  // envío a Slack / email / push notification.
}

// ── Main ─────────────────────────────────────────────────────────
const jornada = await detectarJornada();
if (jornada !== null) {
  await cerrarJornada(jornada);
}
