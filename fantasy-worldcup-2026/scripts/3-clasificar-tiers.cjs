/**
 * Script 3: Clasifica los 1248 jugadores en tiers y actualiza precios base.
 *
 * Tiers:
 *   1 - Íconos      $15M  (~50 jugadores)  — referentes mundiales
 *   2 - Estrellas   $12M  (~150 jugadores) — titulares en top clubes
 *   3 - Sólidos     $9M   (~350 jugadores) — claves para sus equipos
 *   4 - Rotación    $6M   (~400 jugadores) — rol players / banquillo élite
 *   5 - Revelaciones $4M  (~300 jugadores) — promesas / selecciones pequeñas
 *
 * Uso:
 *   node scripts/3-clasificar-tiers.cjs            # aplica a Supabase
 *   node scripts/3-clasificar-tiers.cjs --dry-run  # solo muestra stats
 */

const { createClient } = require("@supabase/supabase-js");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH   = 100; // jugadores por UPDATE
const DELAY   = 200; // ms entre lotes

const PRECIO_POR_TIER = { 1: 15.0, 2: 12.0, 3: 9.0, 4: 6.0, 5: 4.0 };

// ── Helpers ───────────────────────────────────────────────────────

/** Normaliza: quita tildes + transliteraciones especiales, pasa a mayúsculas */
function norm(str) {
  return (str || "")
    .replace(/[ØøÐð]/g, (c) => ({ Ø: "O", ø: "o", Ð: "D", ð: "d" }[c]))
    .replace(/[ÅåÆæ]/g, (c) => ({ Å: "A", å: "a", Æ: "AE", æ: "ae" }[c]))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

/** ¿El patron aparece en nombre_camiseta O en nombre completo? */
function match(camiseta, nombre, patron) {
  const p = norm(patron);
  return norm(camiseta).includes(p) || norm(nombre).includes(p);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Listas explícitas ─────────────────────────────────────────────
// Formato: [seleccion_codigo, patron_nombre, tier]
// El patrón se busca en nombre_camiseta Y nombre completo (normalizado).

const EXPLICITOS = [
  // ═══════════════════ TIER 1 — Íconos ════════════════════════════
  // Argentina
  ["ARG", "MESSI",          1],
  ["ARG", "J. ALVAREZ",     1],
  // Brazil (squad confirmado: sin Rodrygo ni Militão — tiene Neymar)
  ["BRA", "VINICIUS",       1], // "VINI JR." camiseta; nombre tiene "VINICIUS"
  ["BRA", "NEYMAR",         1],
  ["BRA", "CASEMIRO",       1],
  ["BRA", "ALISSON",        1], // nombre_camiseta = "A. BECKER"; nombre = "Álisson...BECKER"
  // France
  ["FRA", "MBAPPE",         1],
  ["FRA", "DEMBELE",        1],
  ["FRA", "TCHOUAMENI",     1],
  ["FRA", "MAIGNAN",        1],
  // England
  ["ENG", "BELLINGHAM",     1],
  ["ENG", "SAKA",           1],
  ["ENG", "KANE",           1],
  // Spain
  ["ESP", "LAMINE YAMAL",   1],
  ["ESP", "RODRIGO HERNANDEZ", 1], // Rodri; nombre_camiseta = "RODRIGO"
  ["ESP", "PEDRI",          1],
  // Portugal
  ["POR", "RONALDO",        1],
  ["POR", "BERNARDO MOTA",  1], // nombre = "Bernardo MOTA VEIGA..." (evita G. Inácio)
  ["POR", "B. FERNANDES",   1],
  ["POR", "RAFA LEAO",      1],
  ["POR", "JOAO CANCELO",   1],
  // Germany
  ["GER", "WIRTZ",          1],
  ["GER", "KIMMICH",        1],
  ["GER", "HAVERTZ",        1],
  ["GER", "RUDIGER",        1],
  ["GER", "MUSIALA",        1],
  // Netherlands
  ["NED", "VAN DIJK",       1], // camiseta = "VIRGIL"; nombre = "Virgil VAN DIJK"
  ["NED", "F. DE JONG",     1],
  // Norway
  ["NOR", "HAALAND",        1], // camiseta = "BRAUT HAALAND"
  ["NOR", "ODEGAARD",       1],
  // Belgium
  ["BEL", "DE BRUYNE",      1],
  ["BEL", "LUKAKU",         1],
  ["BEL", "COURTOIS",       1],
  // Korea Republic
  ["KOR", "HEUNG MIN SON",  1], // nombre = "Heung Min SON"
  // Egypt
  ["EGY", "SALAH",          1], // camiseta = "M. SALAH"
  // Colombia
  ["COL", "LUIS DIAZ",      1],
  // Morocco
  ["MAR", "HAKIMI",         1],
  // Turkey
  ["TUR", "CALHANOGLU",     1],
  // Uruguay
  ["URU", "F. VALVERDE",    1],
  ["URU", "VALVERDE",       1],
  ["URU", "D. NUNEZ",       1],
  ["URU", "DARWIN",         1], // Darwin Núñez
  // Senegal
  ["SEN", "SADIO MANE",     1],

  // ═══════════════════ TIER 2 — Estrellas ══════════════════════════
  // Argentina
  ["ARG", "DE PAUL",        2],
  ["ARG", "MAC ALLISTER",   2],
  ["ARG", "LISANDRO",       2],  // Lisandro Martínez
  ["ARG", "DAMIAN",         2],  // Damián Martínez (GK)
  ["ARG", "ROMERO",         2],
  ["ARG", "ENZO JEREMIAS",  2],  // Enzo Fernández
  ["ARG", "DYBALA",         2],
  ["ARG", "BALERDI",        2],
  ["ARG", "PAREDES",        2],
  // Brazil (squad real: Marquinhos, Gabriel, Raphinha, Endrick, L. Paquetá, Bruno G., Martinelli)
  ["BRA", "MARQUINHOS",     2],
  ["BRA", "GABRIEL DOS SANTOS", 2], // Gabriel Magalhães (DEF Arsenal)
  ["BRA", "RAPHINHA",       2],
  ["BRA", "ENDRICK",        2],
  ["BRA", "EDERSON SANTANA",2], // GK Ederson
  ["BRA", "L. PAQUETA",     2],
  ["BRA", "LUCAS TOLENTINO",2], // Lucas Paquetá (nombre)
  ["BRA", "MARTINELLI",     2],
  ["BRA", "BRUNO GUIMARAES",2], // "BRUNO G." camiseta
  ["BRA", "BREMER",         2],
  ["BRA", "CUNHA",          2],
  // France
  ["FRA", "KONATE",         2],
  ["FRA", "SALIBA",         2],
  ["FRA", "UPAMECANO",      2],
  ["FRA", "THURAM",         2],
  ["FRA", "BARCOLA",        2],
  ["FRA", "OLISE",          2],
  ["FRA", "CHERKI",         2],
  ["FRA", "ZAIRE EMERY",    2],
  ["FRA", "T. HERNANDEZ",   2],
  ["FRA", "L. HERNANDEZ",   2],
  ["FRA", "KANTE",          2],
  ["FRA", "RABIOT",         2],
  ["FRA", "DOUE",           2],
  // England
  ["ENG", "RICE",           2],
  ["ENG", "MAINOO",         2],
  ["ENG", "GORDON",         2],
  ["ENG", "RASHFORD",       2],
  ["ENG", "WATKINS",        2],
  ["ENG", "PICKFORD",       2],
  ["ENG", "KONSA",          2],
  ["ENG", "GUEH",           2],  // Guéhi
  ["ENG", "MADUEKE",        2],
  ["ENG", "EZE",            2],
  // Spain
  ["ESP", "GAVI",           2],
  ["ESP", "LAPORTE",        2],
  ["ESP", "FERRAN",         2],
  ["ESP", "WILLIAMS JR",    2],  // Nico Williams
  ["ESP", "MERINO",         2],
  ["ESP", "OLMO",           2],
  ["ESP", "OYARZABAL",      2],
  ["ESP", "GRIMALDO",       2],
  ["ESP", "FABIEN",         2],
  ["ESP", "FABIÁN",         2],
  ["ESP", "ZUBIMENDI",      2],
  ["ESP", "CUBARSÍ",        2],
  ["ESP", "CUCURELLA",      2],
  ["ESP", "RAYA",           2],
  // Portugal
  ["POR", "JOAO FELIX",     2],
  ["POR", "RUBEN DIAS",     2],
  ["POR", "VITINHA",        2],
  ["POR", "JOAO NEVES",     2],
  ["POR", "G. RAMOS",       2],
  ["POR", "N. MENDES",      2],
  ["POR", "F. CONCEICAO",   2],
  ["POR", "DALOT",          2],
  // Germany
  ["GER", "SANE",           2],
  ["GER", "GORETZKA",       2],
  ["GER", "NEUER",          2],
  ["GER", "SCHLOTTERBECK",  2],
  ["GER", "RUDIGER",        2], // ya T1, sin efecto
  ["GER", "TAH",            2],
  ["GER", "PAVLOVIC",       2],
  ["GER", "STILLER",        2],
  // Netherlands
  ["NED", "DUMFRIES",       2],
  ["NED", "GAKPO",          2],
  ["NED", "REIJNDERS",      2],
  ["NED", "GRAVENBERCH",    2],
  ["NED", "KOOPMEINERS",    2],
  ["NED", "AKE",            2],
  ["NED", "MEMPHIS",        2],  // camiseta = "MEMPHIS"
  ["NED", "VAN DE VEN",     2],
  ["NED", "KLUIVERT",       2],
  // Norway
  ["NOR", "SORLOTH",        2],  // Sørloth
  ["NOR", "AURSNES",        2],
  ["NOR", "NUSA",           2],
  ["NOR", "BERGE",          2],
  // Belgium
  ["BEL", "TROSSARD",       2],
  ["BEL", "DOKU",           2],
  ["BEL", "TIELEMANS",      2],
  ["BEL", "DE KETELAERE",   2],
  ["BEL", "ONANA",          2],
  ["BEL", "MEUNIER",        2],
  ["BEL", "WITSEL",         2],
  // Korea Republic
  ["KOR", "MINJAE",         2],  // Kim Min-jae (Bayern)
  ["KOR", "HEECHAN",        2],  // Hee-chan Hwang (Wolves)
  ["KOR", "KANGIN",         2],  // Lee Kang-in (PSG)
  // Colombia
  ["COL", "JAMES",          2],
  ["COL", "RICHARD RIOS",   2],
  ["COL", "D. MUNOZ",       2],
  ["COL", "J. LUCUMI",      2],
  ["COL", "DAVINSON",       2],
  ["COL", "C. HERNANDEZ",   2],  // Cucho Hernández
  // Morocco
  ["MAR", "BRAHIM",         2],  // Brahim Díaz (Real Madrid)
  ["MAR", "AMRABAT",        2],
  ["MAR", "MAZRAOUI",       2],
  ["MAR", "OUNAHI",         2],
  ["MAR", "EL KHANNOUSS",   2],
  ["MAR", "EL AYNAOUI",     2],
  ["MAR", "BOUNOU",         2],  // Bono (match via nombre)
  ["MAR", "EL KAABI",       2],
  // Turkey
  ["TUR", "ARDA GULER",     2],
  ["TUR", "YILDIZ",         2],
  ["TUR", "DEMIРАЛЬНЬ", 2],
  ["TUR", "DEMIRAL",        2],
  ["TUR", "F. KADIOGLU",    2],
  ["TUR", "AKTÜRKOGLU",     2],
  ["TUR", "AKTURKOGLU",     2],
  // Uruguay
  ["URU", "R. BENTANCUR",   2],
  ["URU", "R. ARAUJO",      2],
  ["URU", "G. DE ARRASCAETA",2],
  ["URU", "M. UGARTE",      2],
  ["URU", "J.M. GIMENEZ",   2],
  ["URU", "M. OLIVERA",     2],
  // Senegal
  ["SEN", "KOULIBALY",      2],
  ["SEN", "NICOLAS JACKSON",2],
  ["SEN", "GANA",           2],  // Idrissa Gana Gueye
  ["SEN", "LAMINE",         2],  // Lamine Camara (Monaco)
  ["SEN", "ILIMAN",         2],  // Iliman Ndiaye
  ["SEN", "MENDY",          2],  // Édouard Mendy
  ["SEN", "P.M. SARR",      2],  // Pape Matar Sarr (Tottenham)
  ["SEN", "ISMAILA SARR",   2],  // Ismaila Sarr (Crystal Palace)
  // Sweden
  ["SWE", "ISAK",           2],
  ["SWE", "GYOKERES",       2],
  ["SWE", "GYÖKERES",       2],
  ["SWE", "LINDELOF",       2],
  ["SWE", "HIEN",           2],
  ["SWE", "BERGVALL",       2],
  ["SWE", "ELANGA",         2],
  // Japan
  ["JPN", "KUBO",           2],
  ["JPN", "ENDO",           2],
  ["JPN", "DOAN",           2],
  ["JPN", "KAMADA",         2],
  ["JPN", "TOMIYASU",       2],
  // Croatia
  ["CRO", "MODRIC",         2],
  ["CRO", "KOVACIC",        2],
  ["CRO", "GVARDIOL",       2],
  ["CRO", "KRAMARIC",       2],
  ["CRO", "PERISIC",        2],
  ["CRO", "PASALIC",        2],
  ["CRO", "LIVAKOVIC",      2],
  // Switzerland
  ["SUI", "XHAKA",          2],
  ["SUI", "SHAQIRI",        2],
  ["SUI", "ZAKARIA",        2],
  // Austria
  ["AUT", "ALABA",          2],
  ["AUT", "ARNAUTOVIC",     2],
  ["AUT", "SABITZER",       2],
  // USA
  ["USA", "PULISIC",        1], // ya definido arriba como T1 pero redundancia sin efecto
  ["USA", "REYNA",          2],
  ["USA", "ADAMS",          2],
  ["USA", "WEAH",           2],
  ["USA", "MCKENNIE",       2],
  ["USA", "BALOGUN",        2],
  ["USA", "DEST",           2],
  // Algeria
  ["ALG", "MAHREZ",         2],
  ["ALG", "BENRAHMA",       2],
  ["ALG", "BENSEBAINI",     2],
  // Egypt
  ["EGY", "MARMOUSH",       2],
  // Czech Republic
  ["CZE", "SCHICK",         2],
  ["CZE", "SOUCEK",         2],
  // Ghana
  ["GHA", "KUDUS",          2],
  ["GHA", "PARTEY",         2],
  // Bosnia
  ["BIH", "DZEKO",          2],
  ["BIH", "PJANIC",         2],
  // Ivory Coast
  ["CIV", "HALLER",         2],
  ["CIV", "ZAHA",           2],
  // South Africa
  ["RSA", "ZWANE",          2],
  // Ecuador
  ["ECU", "CAICEDO",        2],
  ["ECU", "ESTUPINAN",      2],
  ["ECU", "PLATA",          2],
  // Paraguay
  ["PAR", "ALMADA",         2],
];

// ── Clasificación basada en club + nación ─────────────────────────
// Para jugadores no listados explícitamente.

const ELITE_CLUBS = new Set([
  "REAL MADRID", "REAL MADRID C. F.",
  "MANCHESTER CITY", "MANCHESTER CITY FC",
  "FC BAYERN MUNCHEN", "FC BAYERN MÜNCHEN", "BAYERN MUNICH",
  "LIVERPOOL", "LIVERPOOL FC",
  "PARIS SAINT-GERMAIN", "PARIS SAINT-GERMAIN FC",
  "ARSENAL", "ARSENAL FC",
  "CHELSEA", "CHELSEA FC",
  "ATLETICO DE MADRID", "ATLETICO MADRID", "ATLÉTICO DE MADRID",
  "ATLETICO MADRID FC",
  "JUVENTUS", "JUVENTUS FC",
  "INTER MILAN", "FC INTERNAZIONALE MILANO",
  "FC BARCELONA", "BARCELONA",
  "BORUSSIA DORTMUND",
  "NAPOLI", "SSC NAPOLI",
  "MANCHESTER UNITED", "MANCHESTER UNITED FC",
  "INTER MIAMI CF",
]);

const BUENOS_CLUBS = new Set([
  "ASTON VILLA", "ASTON VILLA FC",
  "TOTTENHAM", "TOTTENHAM HOTSPUR", "TOTTENHAM HOTSPUR FC",
  "NEWCASTLE", "NEWCASTLE UNITED FC",
  "WEST HAM", "WEST HAM UNITED FC",
  "BAYER 04 LEVERKUSEN", "BAYER LEVERKUSEN",
  "FEYENOORD", "FEYENOORD ROTTERDAM",
  "AFC AJAX", "AJAX",
  "FC PORTO", "PORTO",
  "SL BENFICA", "BENFICA",
  "SPORTING CP", "SPORTING PORTUGAL",
  "OLYMPIQUE LYONNAIS", "OLYMPIQUE MARSEILLE",
  "AS MONACO", "MONACO",
  "SEVILLA FC", "SEVILLA",
  "REAL SOCIEDAD",
  "VILLARREAL CF", "VILLARREAL",
  "REAL BETIS", "REAL BETIS BALOMPIE",
  "ATHLETIC CLUB",
  "AS ROMA", "ROMA",
  "SS LAZIO", "LAZIO",
  "AC MILAN",
  "ATALANTA", "ATALANTA BERGAMO",
  "ACF FIORENTINA", "FIORENTINA",
  "CELTIC FC", "CELTIC",
  "PSV EINDHOVEN", "PSV",
  "RB LEIPZIG",
  "VFB STUTTGART",
  "EINTRACHT FRANKFURT",
  "BRIGHTON & HOVE ALBION FC", "BRIGHTON",
  "GALATASARAY SK", "GALATASARAY",
  "FENERBAHCE SK", "FENERBAHÇE SK",
  "CA RIVER PLATE", "RIVER PLATE",
  "SE PALMEIRAS", "PALMEIRAS",
  "CR FLAMENGO", "FLAMENGO",
  "RC STRASBOURG",
  "LENS", "RC LENS",
  "GIRONA FC",
  "LILLE OSC",
  "RAYO VALLECANO",
  "PSG", // alias
  "BRENTFORD FC",
  "FULHAM FC",
  "WOLVERHAMPTON WANDERERS FC",
  "CRYSTAL PALACE FC",
  "NOTTINGHAM FOREST FC",
  "LEEDS UNITED FC",
  "STADE RENNAIS FC",
  "VFL WOLFSBURG",
]);

// Tier de la selección nacional (A=top, B=buena, C=media, D=pequeña)
const NACION = {
  A: new Set(["ARG", "BRA", "FRA", "ENG", "ESP", "GER", "POR", "NED", "BEL"]),
  B: new Set(["URU", "COL", "MEX", "USA", "MAR", "SEN", "JPN", "KOR", "CRO", "SUI", "NOR", "TUR", "AUT"]),
  C: new Set(["ECU", "AUS", "SWE", "CZE", "TUN", "EGY", "KSA", "IRN", "IRQ", "GHA", "CIV", "COD", "RSA", "ALG", "BIH", "SCO", "PAR"]),
  D: new Set(["QAT", "UZB", "CUW", "HAI", "PAN", "NZL", "CPV", "JOR"]),
};

function nacionTier(codigo) {
  for (const [t, set] of Object.entries(NACION)) {
    if (set.has(codigo)) return t;
  }
  return "D";
}

function clubScore(club) {
  if (!club) return 0;
  const c = norm(club);
  for (const e of ELITE_CLUBS) if (c.includes(norm(e)) || norm(e).includes(c)) return 2;
  for (const b of BUENOS_CLUBS) if (c.includes(norm(b)) || norm(b).includes(c)) return 1;
  return 0;
}

// ── Clasificador principal ────────────────────────────────────────
function clasificar(j) {
  const { seleccion_codigo, nombre_camiseta, nombre, club } = j;

  // 1. Buscar en la lista explícita (orden: el primer match gana)
  for (const [sel, patron, tier] of EXPLICITOS) {
    if (sel === seleccion_codigo && match(nombre_camiseta, nombre, patron)) {
      return tier;
    }
  }

  // 2. Reglas por club + nación
  const nac = nacionTier(seleccion_codigo);
  const cs  = clubScore(club);

  if (nac === "A") {
    if (cs >= 2) return 2;  // Elite club + nación top
    if (cs >= 1) return 3;
    return 3;               // Toda nación A ≥ Tier 3
  }
  if (nac === "B") {
    if (cs >= 2) return 3;
    if (cs >= 1) return 3;
    return 4;
  }
  if (nac === "C") {
    if (cs >= 2) return 3;
    if (cs >= 1) return 4;
    return 4;
  }
  // Nación D
  if (cs >= 2) return 4;
  return 5;
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log("🏆 Fantasy Mundial — Clasificación de Tiers");
  if (DRY_RUN) console.log("   ⚠️  DRY RUN — no se escribe en BD\n");

  const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SUPABASE_KEY);

  // Descarga todos los jugadores con código de selección
  let jugadores;
  if (DRY_RUN) {
    const fs = require("fs");
    const raw = JSON.parse(
      fs.readFileSync(path.join(__dirname, "jugadores.json"), "utf8")
    );
    jugadores = raw.map((j) => ({
      id:                `fake-${j.seleccion_codigo}-${j.dorsal}`,
      nombre:            j.nombre,
      nombre_camiseta:   j.nombre_camiseta,
      club:              j.club,
      seleccion_codigo:  j.seleccion_codigo,
    }));
  } else {
    // Pagina de 1000 en 1000 (límite por defecto de Supabase)
    const todos = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("jugadores")
        .select(`id, nombre, nombre_camiseta, club, selecciones_nacionales(nombre)`)
        .range(from, from + PAGE - 1);
      if (error) { console.error("❌", error.message); process.exit(1); }
      todos.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    jugadores = todos.map((j) => ({
      ...j,
      seleccion_codigo:
        j.selecciones_nacionales?.nombre?.match(/\(([A-Z]{3})\)/)?.[1] ?? "",
    }));
  }

  console.log(`📦 ${jugadores.length} jugadores cargados\n`);

  // Clasifica cada jugador
  const resultados = jugadores.map((j) => ({
    ...j,
    tier: clasificar(j),
  }));

  // Estadísticas
  const stats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const tierNombres = {
    1: "Íconos       ($15M)",
    2: "Estrellas    ($12M)",
    3: "Sólidos      ($9M) ",
    4: "Rotación     ($6M) ",
    5: "Revelaciones ($4M) ",
  };

  for (const j of resultados) stats[j.tier]++;

  console.log("── Distribución por tier ──────────────────────");
  for (const [t, n] of Object.entries(stats)) {
    const bar = "█".repeat(Math.round(n / 8));
    console.log(`  Tier ${t} ${tierNombres[t]}: ${String(n).padStart(4)} jugadores  ${bar}`);
  }
  console.log(`${"─".repeat(50)}`);
  console.log(`  TOTAL: ${resultados.length}\n`);

  // Muestra los Tier 1 encontrados
  const tier1 = resultados.filter((j) => j.tier === 1);
  console.log(`── Tier 1 — ${tier1.length} Íconos ────────────────────────────`);
  for (const j of tier1) {
    console.log(
      `  [${j.seleccion_codigo}] ${j.nombre_camiseta.padEnd(20)} ${j.nombre.substring(0, 35)}`
    );
  }

  if (DRY_RUN) {
    console.log("\n✅ Dry run completado — sin cambios en BD");
    return;
  }

  // ── Actualización: un UPDATE por tier (agrupa IDs) ──────────────
  // Evita el problema del upsert con columnas NOT NULL.
  console.log("\n⚙️  Actualizando BD (1 UPDATE por tier)...");

  const porTier = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const j of resultados) porTier[j.tier].push(j.id);

  let actualizados = 0;
  let errores = 0;

  for (const [tier, ids] of Object.entries(porTier)) {
    if (ids.length === 0) continue;

    // UPDATE en sub-lotes de 80 IDs (evita URI too long en PostgREST)
    const sublotes = [];
    for (let i = 0; i < ids.length; i += 80) {
      sublotes.push(ids.slice(i, i + 80));
    }

    for (const sublote of sublotes) {
      const precio = PRECIO_POR_TIER[tier];
      const { error } = await supabase
        .from("jugadores")
        .update({ tier: Number(tier), precio_base: precio, precio })
        .in("id", sublote);

      if (error) {
        errores++;
        console.error(`  ❌ Tier ${tier}: ${error.message}`);
      } else {
        actualizados += sublote.length;
      }
      await sleep(DELAY);
    }

    console.log(
      `  Tier ${tier} ${tierNombres[tier]}: ${ids.length} jugadores ✓`
    );
  }

  console.log(
    `\n${errores === 0 ? "✅" : "⚠️ "} Clasificación completada — ` +
    `${actualizados} actualizados, ${errores} errores`
  );
}

main().catch((err) => {
  console.error("❌ Error fatal:", err.message);
  process.exit(1);
});
