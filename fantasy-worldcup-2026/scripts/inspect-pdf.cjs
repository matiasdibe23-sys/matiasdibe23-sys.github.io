const { PDFParse } = require("pdf-parse");
const path = require("path");

const PDF_PATH = path.join(__dirname, "SquadLists-Spanish.pdf");

async function main() {
  const parser = new PDFParse({ url: PDF_PATH });

  // 1. Texto raw de las primeras páginas
  const textResult = await parser.getText({ pages: [1, 2, 3] });
  console.log("=== TEXTO RAW (págs 1-3) ===");
  console.log(textResult.text.slice(0, 4000));

  // 2. Tablas de las primeras páginas
  console.log("\n=== TABLAS (págs 1-3) ===");
  try {
    const tableResult = await parser.getTable({ pages: [1, 2, 3] });
    console.log(JSON.stringify(tableResult, null, 2).slice(0, 4000));
  } catch (e) {
    console.log("getTable error:", e.message);
  }
}

main().catch(console.error);
