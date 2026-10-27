/**
 * scripts/check-ml-availability.ts
 *
 * Busca cada producto del listado Divinittys en Mercado Libre Chile (API pública)
 * y reporta cuáles NO están o tienen muy poca competencia.
 *
 * Uso:
 *   npx tsx scripts/check-ml-availability.ts
 *   npx tsx scripts/check-ml-availability.ts --delay 1200
 *   npx tsx scripts/check-ml-availability.ts --limit 20          # solo primeros N (prueba)
 *   npx tsx scripts/check-ml-availability.ts --csv path/to.csv   # columnas: producto,detalle
 *
 * Salida:
 *   - Consola con resumen
 *   - artifacts/ml-availability-YYYYMMDD-HHmmss.json
 *   - artifacts/ml-availability-YYYYMMDD-HHmmss.csv
 *
 * No requiere Docker ni token ML. Solo Node 18+ y red hacia api.mercadolibre.com.
 */

import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Listado embebido (del archivo adjunto 2026-10-26)
// ---------------------------------------------------------------------------
const EMBEDDED_PRODUCTS: { producto: string; detalle: string }[] = [
  { producto: "Decolorante pote BlueBerry Elgon", detalle: "500gr" },
  { producto: "Decolorante pote AmoniaFree Elgon", detalle: "500gr" },
  { producto: "Decolorante pote Classico Elgon", detalle: "500gr" },
  { producto: "More Inside Suero Crea Rizos", detalle: "Davines" },
  { producto: "Decolorante Century Of Light Progress", detalle: "800gr" },
  { producto: "Link-d 3 Bond Keeper 3", detalle: "250ml" },
  { producto: "Shampoo Mood Silver", detalle: "400ml" },
  { producto: "Mascara Silver Monmetique", detalle: "300ml (la morada)" },
  { producto: "Activador Davines", detalle: "900mL Volumen 20" },
  { producto: "Crema Oxidante Bonmetique", detalle: "Litro Volumen 20" },
  { producto: "Oxi-cream Elgon 125ml", detalle: "Volumen 10" },
  { producto: "Oxi-cream Elgon 125ml", detalle: "Volumen 20" },
  { producto: "Oxi-cream Elgon 125ml", detalle: "Volumen 40" },
  { producto: "Oxi-cream Litro Elgon", detalle: "Volumen 20" },
  { producto: "Oxi-cream Litro Elgon", detalle: "Volumen 40" },
  { producto: "Oxi-cream Litro Elgon", detalle: "Volumen 30" },
  { producto: "Oxi-cream Litro Elgon", detalle: "Volumen 5" },
  { producto: "Oxi-cream Litro Elgon", detalle: "Volumen 10" },
  { producto: "Crema Oxidante Bonmetique", detalle: "100ml Volumen 20" },
  { producto: "Link-d Trial Kit", detalle: "100ml paso 1 y 2" },
  { producto: "The Renaissance Circle Hair Mask", detalle: "50ml" },
  { producto: "The Spotlight Circle Hair Mask", detalle: "50ml" },
  { producto: "The Quick Fix Circle Hair Mask", detalle: "50ml" },
  { producto: "Acondicionador Momo", detalle: "250ml Davines" },
  { producto: "Acondicionador Oi", detalle: "250ml Davines" },
  { producto: "Acondicionador Oi", detalle: "1 Lt Davines" },
  { producto: "Calming Shampoo", detalle: "250 mL Davines" },
  { producto: "Shampoo Energizing Naturaltech", detalle: "250ml Davines" },
  { producto: "Oi Milk Davines", detalle: "135mL" },
  { producto: "Oi Milk Davines", detalle: "50mL" },
  { producto: "Shampoo Oi", detalle: "280 ml Davines" },
  { producto: "Shampoo Oi", detalle: "1 Lt Davines" },
  { producto: "Shampoo Silver Bonmetique", detalle: "350ml" },
  { producto: "Sublimia Dd Cream", detalle: "150ml Elgon" },
  { producto: "Crema Alisadora Tango Strong", detalle: "120ml Elgon" },
  { producto: "Davines Natural Tech Shampoo 1lt CALMING", detalle: "" },
  { producto: "Davines Natural Tech Shampoo 1lt ENERGIZING", detalle: "" },
  { producto: "Davines Natural Tech Shampoo 1lt NOURISHING", detalle: "" },
  { producto: "Davines Natural Tech Shampoo 1lt REBALANCING", detalle: "" },
  { producto: "Davines Natural Tech Shampoo 1lt WELL BEING", detalle: "" },
  { producto: "Davines Natural Tech Shampoo 1lt REPLUMPING", detalle: "" },
  { producto: "Natural Tech Shampoo 1lt PURIFYING", detalle: "Davines" },
  { producto: "Davines Alchemic Shampoo", detalle: "280 ml Copper" },
  { producto: "Davines Alchemic Shampoo", detalle: "280 ml Golden" },
  { producto: "Davines Alchemic Shampoo", detalle: "280 ml Chocolate" },
  { producto: "Davines Alchemic Shampoo", detalle: "280 ml Silver" },
  { producto: "Davines Alchemic Shampoo", detalle: "280 ml Tabaco" },
  { producto: "Davines Alchemic Shampoo", detalle: "280 ml Red" },
  { producto: "Serum Light Mood", detalle: "100ml" },
  { producto: "Davines Alchemic Conditioner", detalle: "250ml Chocolate" },
  { producto: "Davines Alchemic Conditioner", detalle: "250ml Silver" },
  { producto: "Davines Alchemic Conditioner", detalle: "250ml Golden" },
  { producto: "Davines Alchemic Conditioner", detalle: "250ml Tabaco" },
  { producto: "Davines Alchemic Conditioner", detalle: "250ml Copper" },
  { producto: "Davines Alchemic Conditioner", detalle: "250ml Red" },
  { producto: "Roux Fanci-full Color Temporal", detalle: "Color 12" },
  { producto: "Roux Fanci-full Color Temporal", detalle: "Color 16" },
  { producto: "Roux Fanci-full Color Temporal", detalle: "Color 18" },
  { producto: "Roux Fanci-full Color Temporal", detalle: "Color 21" },
  { producto: "Roux Fanci-full Color Temporal", detalle: "Color 26" },
  { producto: "Roux Fanci-full Color Temporal", detalle: "Color 32" },
  { producto: "Roux Fanci-full Color Temporal", detalle: "Color 42" },
  { producto: "Purifying Shampoo", detalle: "250 mL Davines" },
  { producto: "Acide Bonmetique", detalle: "350 mL" },
  { producto: "Shampoo Replumping", detalle: "250 ml Davines" },
  { producto: "Color Remover Elgon", detalle: "30ml 1 y 2" },
  { producto: "Color Protect Acondicionador Mood", detalle: "300ml" },
  { producto: "Elgon I-light", detalle: "100ml Nro 11" },
  { producto: "Elgon I-light", detalle: "100ml Nro 12" },
  { producto: "Elgon I-light", detalle: "100ml Nro 8" },
  { producto: "Elgon I-light", detalle: "100ml Nro 10" },
  { producto: "Elgon I-light", detalle: "100ml Nro 13" },
  { producto: "Decolorantes Elgon 50g", detalle: "clasico" },
  { producto: "Decolorantes Elgon 50g", detalle: "AmoniaFree" },
  { producto: "Decolorantes Elgon 50g", detalle: "Blue-Berry" },
  { producto: "Decolorantes Elgon 50g", detalle: "Blue Bleach" },
  { producto: "Daily Care Shampoo Mood", detalle: "400ml" },
  { producto: "Mood Intense Repair Shampoo", detalle: "400ml" },
  { producto: "Gel Aclarante Solarea Elgon", detalle: "150mL" },
  { producto: "Color Protect Shampoo Mood", detalle: "400 ml" },
  { producto: "Restaurador 2 Minutos Bonmetique", detalle: "900ml" },
  { producto: "Acondicionador Mood Silver Specific", detalle: "400mL" },
  { producto: "Davines Natural Tech Acondicionador 1lt", detalle: "Replumping" },
  { producto: "Shampoo MINU", detalle: "250 mL Davines" },
  { producto: "Nourishing Vegetarian Miracle Conditioner", detalle: "250ml Davines" },
  { producto: "Máscara Diamante Elgon", detalle: "500ml" },
  { producto: "Mascarilla Nutrienergética Sinsea Elgon", detalle: "250 Ml" },
  { producto: "Máscara De Seda Nutritiva Elgon", detalle: "150 Ml" },
  { producto: "Mascara Capilar Revitalizante Bonmetique", detalle: "300ml" },
  { producto: "Shampoo Nou Nou", detalle: "250ml Davines" },
  { producto: "Shampoo Man Silver Elgon", detalle: "250ml" },
  { producto: "Naturaltech Nourishing Shampoo", detalle: "250ml Davines" },
  { producto: "Aceite Supremo De Argan Elgon", detalle: "100 Ml" },
  { producto: "Restructuring Miracle MASK", detalle: "1 Lt" },
  { producto: "Shampoo Detoxifying Scrub", detalle: "Litro Davines" },
  { producto: "Shampoo Detoxifying Scrub", detalle: "250ml Davines" },
  { producto: "Shampoo Dede", detalle: "250ml Davines" },
  { producto: "Acondicionador Replumping", detalle: "Litro Davines" },
  { producto: "Elgon Sublimia Shampoo", detalle: "250ml" },
  { producto: "Authentic Cleansing Nectar Shampoo", detalle: "280ml Davines" },
  { producto: "Acondicionador Love smooth", detalle: "250ml Davines" },
  { producto: "Acondicionador Love curl", detalle: "250ml Davines" },
  { producto: "Shampoo Essential Love Curl", detalle: "Davines" },
  { producto: "Shampoo Rebalancing", detalle: "250 Ml Davines" },
  { producto: "Forma Wax Hairstyling Elgon", detalle: "125 mL" },
  { producto: "Elgon Qsei", detalle: "20 mL" },
  { producto: "Decolorante Bonmetique", detalle: "70gr" },
  { producto: "Bouquet 7 Oli REFIBRA", detalle: "100mL" },
  { producto: "Tratamiento Acide Bonmetique", detalle: "900 mL" },
  { producto: "Shampoo Ph 5.5 Delicate Colorcare Elgon", detalle: "300ml" },
  { producto: "Davines Oi Oil", detalle: "50 mL" },
  { producto: "Essential Shampoo Imagea Elgon", detalle: "250ml" },
  { producto: "Bouquet 7 Aceites Sinsea Elgon", detalle: "100mL" },
  { producto: "Shampoo Acide Bonmetique", detalle: "350ml" },
  { producto: "Stain Remover Elgon Colorcare", detalle: "125 ml" },
  { producto: "Liquido Neutralizante Pestaña", detalle: "Neutralizer #2" },
  { producto: "Liquido Permanente De Pestañas", detalle: "Perming Solution #1" },
  { producto: "Prep Shampoo Davines", detalle: "250ml" },
  { producto: "Absolute Beautifying Oil", detalle: "135ml Davines" },
  { producto: "Cera More Inside Strong Dry Wax", detalle: "75mL Davines" },
  { producto: "Acondicionador Well Being", detalle: "150 mL Davines" },
  { producto: "Crema Para Peinar Nutritiva Bonmetique", detalle: "300ml" },
  { producto: "Mascara Black Platinum Bonmetique", detalle: "300mL" },
  { producto: "Decolorante Iblonde White Plus Plex", detalle: "Elgon" },
  { producto: "Affixx Rasta Gum", detalle: "100ml Elgon" },
  { producto: "Mascara Reestructurante Elgon", detalle: "100ml" },
  { producto: "Acondicionador Silver Morado", detalle: "300ml Elgon" },
  { producto: "Shampoo Limpieza Profunda Luminoil", detalle: "250 Ml Elgon" },
  { producto: "Acondicionador Ph 4.5 Delicate Colorcare", detalle: "300ml Elgon" },
  { producto: "Elgon Shampoo Refibra", detalle: "350mL" },
  { producto: "Shampoo Silver Ph6 Morado Matizador", detalle: "300ml Elgon" },
  { producto: "Intense Repair Oil Mood", detalle: "100ml" },
  { producto: "Shampoo Well Being", detalle: "250 Ml DAVINES" },
  { producto: "Shampoo Y Loción Purificante Man", detalle: "250 Ml Elgon" },
  { producto: "Crema Regenerante Elgon", detalle: "150gr" },
  { producto: "Sublimia Hair Dd Conditioner Elgon", detalle: "250 Ml" },
  { producto: "Nourishing Vegetarian Miracle Conditioner", detalle: "Litro Davines" },
  { producto: "Color Protect Serum Mood", detalle: "150ml" },
  { producto: "Shampoo MOMO", detalle: "250ML Davines" },
  { producto: "Color Oil Additive ColorCare", detalle: "100mL" },
  { producto: "Color Oil Additive ColorCare", detalle: "125mL" },
  { producto: "Medium Hold Pliable Paste", detalle: "125ml Davines" },
  { producto: "Mascarilla Nutrienergética ARGAN Elgon", detalle: "250 Ml" },
  { producto: "Silkey Hidro Ker", detalle: "80" },
  { producto: "Acondicionador Nutritivo Argán Supremo", detalle: "150ml Elgon" },
  { producto: "Óleo Argán Supremo 3", detalle: "100ml Elgon" },
  { producto: "Decolorante Iblonde White Plus Plex", detalle: "Elgon" },
  { producto: "Acondicionador Silver Matizador", detalle: "350ml Bonmetique" },
  { producto: "Decolorante Iblonde super 9 Plex", detalle: "Elgon" },
  { producto: "Cera More Inside Forming Pomade", detalle: "75mL Davines" },
];

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SITE_ID = "MLC";
const API_BASE = `https://api.mercadolibre.com/sites/${SITE_ID}/search`;
const USER_AGENT = "DivinittysBot/1.0 (+https://divinittys.cl; availability-check)";

interface ProductRow {
  producto: string;
  detalle: string;
}

interface SearchHit {
  id: string;
  title: string;
  price: number;
  sold_quantity: number;
  permalink: string;
}

interface ResultRow {
  producto: string;
  detalle: string;
  query: string;
  total: number;
  topTitles: string;
  topPrices: string;
  topSold: string;
  potencial: "ALTO" | "MEDIO" | "BAJO" | "ERROR";
  error?: string;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildQuery(p: ProductRow): string {
  const raw = `${p.producto} ${p.detalle || ""}`
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  // Quitar ruido típico
  return raw
    .replace(/\b(ml|mL|gr|g|lt|litro|volumen)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function classify(total: number, maxSold: number): "ALTO" | "MEDIO" | "BAJO" {
  if (total === 0) return "ALTO";
  if (total <= 5 && maxSold < 20) return "ALTO";
  if (total <= 15 && maxSold < 80) return "MEDIO";
  return "BAJO";
}

async function searchML(q: string): Promise<{ total: number; results: SearchHit[] }> {
  const url = `${API_BASE}?q=${encodeURIComponent(q)}&limit=5`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    paging?: { total?: number };
    results?: Array<{
      id: string;
      title: string;
      price: number;
      sold_quantity?: number;
      permalink: string;
    }>;
  };

  const results: SearchHit[] = (data.results || []).map((r) => ({
    id: r.id,
    title: r.title,
    price: r.price,
    sold_quantity: r.sold_quantity ?? 0,
    permalink: r.permalink,
  }));

  return {
    total: data.paging?.total ?? results.length,
    results,
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  let delay = 1000;
  let limit = Infinity;
  let csvPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--delay" && args[i + 1]) delay = parseInt(args[++i], 10);
    else if (args[i] === "--limit" && args[i + 1]) limit = parseInt(args[++i], 10);
    else if (args[i] === "--csv" && args[i + 1]) csvPath = args[++i];
  }
  return { delay, limit, csvPath };
}

function loadFromCsv(csvPath: string): ProductRow[] {
  const abs = path.resolve(csvPath);
  if (!fs.existsSync(abs)) throw new Error(`CSV no encontrado: ${abs}`);
  const wb = XLSX.readFile(abs);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  return rows.map((r) => ({
    producto: (r.producto || r.Producto || r["Productos"] || Object.values(r)[0] || "").toString().trim(),
    detalle: (r.detalle || r.Detalle || r["Detalle"] || Object.values(r)[1] || "").toString().trim(),
  })).filter((r) => r.producto.length > 2);
}

function ensureArtifactsDir(): string {
  const dir = path.resolve(process.cwd(), "artifacts");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function main() {
  const { delay, limit, csvPath } = parseArgs();
  let products = csvPath ? loadFromCsv(csvPath) : EMBEDDED_PRODUCTS;
  products = products.slice(0, limit);

  console.log(`\n🔍 check-ml-availability — MLC`);
  console.log(`   Productos: ${products.length} | delay: ${delay}ms | fuente: ${csvPath || "embebido"}\n`);

  const results: ResultRow[] = [];
  let idx = 0;

  for (const p of products) {
    idx++;
    const query = buildQuery(p);
    process.stdout.write(`[${idx}/${products.length}] ${query.slice(0, 55).padEnd(55)} `);

    try {
      const { total, results: hits } = await searchML(query);
      const maxSold = hits.reduce((m, h) => Math.max(m, h.sold_quantity), 0);
      const potencial = classify(total, maxSold);

      const row: ResultRow = {
        producto: p.producto,
        detalle: p.detalle,
        query,
        total,
        topTitles: hits.map((h) => h.title).join(" | ") || "—",
        topPrices: hits.map((h) => String(h.price)).join(" | ") || "—",
        topSold: hits.map((h) => String(h.sold_quantity)).join(" | ") || "—",
        potencial,
      };
      results.push(row);

      const emoji = potencial === "ALTO" ? "🟢" : potencial === "MEDIO" ? "🟡" : "🔴";
      console.log(`${emoji} total=${total} sold=${maxSold} → ${potencial}`);
    } catch (err: any) {
      console.log(`❌ ${err.message}`);
      results.push({
        producto: p.producto,
        detalle: p.detalle,
        query,
        total: -1,
        topTitles: "",
        topPrices: "",
        topSold: "",
        potencial: "ERROR",
        error: err.message,
      });
    }

    if (idx < products.length) await sleep(delay);
  }

  // Resumen
  const alto = results.filter((r) => r.potencial === "ALTO");
  const medio = results.filter((r) => r.potencial === "MEDIO");
  const bajo = results.filter((r) => r.potencial === "BAJO");
  const errors = results.filter((r) => r.potencial === "ERROR");

  console.log("\n══════════════════════════════════════════════════");
  console.log(`✅ ALTO potencial (ausentes / poca competencia): ${alto.length}`);
  console.log(`🟡 MEDIO: ${medio.length}`);
  console.log(`🔴 BAJO (ya saturados): ${bajo.length}`);
  if (errors.length) console.log(`❌ Errores: ${errors.length}`);
  console.log("══════════════════════════════════════════════════\n");

  if (alto.length) {
    console.log("── Productos ALTO potencial ──");
    alto.forEach((r) => console.log(`  • ${r.producto} ${r.detalle}  (total=${r.total})`));
    console.log("");
  }

  // Guardar archivos
  const dir = ensureArtifactsDir();
  const ts = stamp();
  const jsonPath = path.join(dir, `ml-availability-${ts}.json`);
  const csvOutPath = path.join(dir, `ml-availability-${ts}.csv`);

  fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary: { alto: alto.length, medio: medio.length, bajo: bajo.length, errors: errors.length }, results }, null, 2));

  const csvHeader = "producto,detalle,query,total,potencial,topTitles,topPrices,topSold,error\n";
  const csvBody = results
    .map((r) =>
      [
        `"${r.producto.replace(/"/g, '""')}"`,
        `"${r.detalle.replace(/"/g, '""')}"`,
        `"${r.query.replace(/"/g, '""')}"`,
        r.total,
        r.potencial,
        `"${r.topTitles.replace(/"/g, '""')}"`,
        `"${r.topPrices}"`,
        `"${r.topSold}"`,
        `"${(r.error || "").replace(/"/g, '""')}"`,
      ].join(",")
    )
    .join("\n");
  fs.writeFileSync(csvOutPath, csvHeader + csvBody);

  console.log(`📁 JSON → ${jsonPath}`);
  console.log(`📁 CSV  → ${csvOutPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
