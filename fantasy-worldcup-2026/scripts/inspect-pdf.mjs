/**
 * Diagnóstico: imprime las primeras páginas del PDF para ver la estructura real del texto.
 * Ejecutar: node scripts/inspect-pdf.mjs
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PDF_PATH = join(__dirname, "..", "scripts", "SquadLists-Spanish.pdf");

const buffer = readFileSync(PDF_PATH);
const data = await pdfParse(buffer, { max: 4 }); // solo primeras 4 páginas

console.log("=== TEXTO RAW (primeras 4 páginas) ===\n");
console.log(data.text);
console.log("\n=== TOTAL PÁGINAS ===", data.numpages);
