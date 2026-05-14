#!/usr/bin/env node
// Genera el HTML del FAST Newsletter:
// 1) Pide a Claude API solo DATOS ESTRUCTURADOS (no HTML) → bajísimo output → ~$0.05/run
// 2) Renderiza el HTML localmente en render.mjs desde esos datos + diseño Quantum Makers
// 3) Actualiza history.json con bullets de FORMACIÓN
//
// Output: /tmp/body.html, /tmp/subject.txt, /tmp/preheader.txt, /tmp/data.json
//
// Uso:  node build_newsletter.mjs [daily|weekly]
// Env requeridas: ANTHROPIC_API_KEY

import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderDaily, renderWeekly } from "./render.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editionType = process.argv[2] === "weekly" ? "weekly" : "daily";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Falta ANTHROPIC_API_KEY");
  process.exit(2);
}

const promptPath = path.join(__dirname, "prompts", `${editionType}.txt`);
const basePrompt = fs.readFileSync(promptPath, "utf8");

const historyPath = path.join(__dirname, "history.json");
const history = fs.existsSync(historyPath)
  ? JSON.parse(fs.readFileSync(historyPath, "utf8"))
  : { formacion: [] };

const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const recentFormacion = history.formacion.filter((e) => e.date >= sevenDaysAgo);
const counts = {};
for (const e of recentFormacion) for (const b of e.bullets) counts[b] = (counts[b] || 0) + 1;
const vetados = Object.entries(counts).filter(([, c]) => c >= 3).map(([b]) => b);
const recientes = Object.entries(counts).filter(([, c]) => c < 3).map(([b, c]) => `${b} (${c}/3)`);

const today = new Date().toISOString().slice(0, 10);
const todayLong = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// Schemas estructurados — el modelo NO produce HTML, solo datos.
const bulletItemSchema = {
  type: "object",
  properties: {
    texto: { type: "string", description: "Texto de la noticia, 2-4 líneas." },
    fuente_url: { type: "string", description: "URL del artículo fuente." },
    fuente_nombre: { type: "string", description: "Nombre breve del medio (ej. 'Variety', 'AdExchanger')." },
  },
  required: ["texto"],
};

const bloqueSchema = {
  type: "object",
  properties: {
    etiqueta: { type: "string", description: "Kicker en MAYÚSCULAS (ej. 'PLATAFORMA', 'ADTECH', 'LATAM')." },
    titular: { type: "string", description: "Titular del bloque, una frase." },
    bullets: { type: "array", items: bulletItemSchema, description: "3-5 bullets de noticias." },
  },
  required: ["etiqueta", "titular", "bullets"],
};

const formacionItemSchema = {
  type: "object",
  properties: {
    nombre: { type: "string", description: "Nombre del evento/curso/beca. Identificador consistente para tracking anti-repetición." },
    lugar: { type: "string", description: "Lugar o formato (ej. 'Madrid', 'Online', 'Londres')." },
    fecha: { type: "string", description: "Fechas o plazo (ej. '10-12 jun', 'Plazo: 30 jun')." },
    url: { type: "string", description: "URL del evento/curso." },
  },
  required: ["nombre"],
};

const dailySchema = {
  type: "object",
  properties: {
    subject: { type: "string", description: "Asunto del email con prefijo [TEST] durante pruebas. Incluye fecha + 2-3 keywords." },
    preheader: { type: "string", description: "Preview 80-100 chars." },
    headline: { type: "string", description: "Titular principal del newsletter." },
    resumen_bullets: { type: "array", items: { type: "string" }, description: "3-5 bullets de resumen ejecutivo." },
    bloques: { type: "array", items: bloqueSchema, description: "Bloques temáticos (PLATAFORMA, ADTECH, etc.)." },
    senales_bullets: { type: "array", items: { type: "string" }, description: "3-5 señales a vigilar." },
    formacion_bullets: { type: "array", items: formacionItemSchema, description: "2-4 oportunidades de formación/networking. Respetar regla anti-repetición." },
  },
  required: ["subject", "preheader", "headline", "resumen_bullets", "bloques", "senales_bullets", "formacion_bullets"],
};

const langBlockSchema = {
  type: "object",
  properties: {
    resumen: { type: "string", description: "Resumen ejecutivo, párrafo de 4-6 líneas." },
    destacada: {
      type: "object",
      properties: {
        titular: { type: "string" },
        subtitulo: { type: "string" },
        cuerpo: { type: "string", description: "Cuerpo de la noticia destacada." },
      },
    },
    bloques: { type: "array", items: bloqueSchema },
    senales_bullets: { type: "array", items: { type: "string" } },
  },
  required: ["resumen", "destacada", "bloques", "senales_bullets"],
};

const weeklySchema = {
  type: "object",
  properties: {
    subject: { type: "string" },
    preheader: { type: "string" },
    headline: { type: "string" },
    semana: { type: "string", description: "Número de semana ISO (ej. '20')." },
    es: langBlockSchema,
    cat: langBlockSchema,
  },
  required: ["subject", "preheader", "headline", "semana", "es", "cat"],
};

const tools = [
  { type: "web_search_20250305", name: "web_search", max_uses: 2 },
  {
    name: "submit_newsletter",
    description: "Envía el newsletter como datos estructurados. El HTML se renderiza localmente desde estos datos.",
    input_schema: editionType === "daily" ? dailySchema : weeklySchema,
  },
];

const systemPrompt = `${basePrompt}

---
CONTEXTO DE EJECUCIÓN:
- Fecha de hoy: ${todayLong} (${today})
- Edición: ${editionType.toUpperCase()}

FORMACION_HISTORY (bullets usados últimos 7 días):
${recientes.length ? recientes.map((s) => `  - ${s}`).join("\n") : "  (sin historial reciente)"}

FORMACION_VETADOS (NO incluir):
${vetados.length ? vetados.map((s) => `  - ${s}`).join("\n") : "  (ninguno vetado)"}

---
NUEVA ARQUITECTURA — IMPORTANTE:
- NO escribas HTML. NO uses placeholders {{...}}. NO copies el template_${editionType}.html.
- Devuelve SOLO los datos estructurados en submit_newsletter. El HTML se construye localmente.
- Maquetación, paleta, tipografía, logo: están en el renderer local. No te ocupes.
- Tu trabajo: investigar con web_search + redactar contenido editorial + estructurar datos.
- Cada bullet/noticia: texto editorial + fuente_url + fuente_nombre. Sin HTML.
`;

const anthropic = new Anthropic();

console.log(`→ Generando ${editionType} para ${todayLong}...`);
console.log(`  Vetados FORMACIÓN: ${vetados.length}`);

const startTime = Date.now();

const res = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 8000, // ahora basta porque output es solo JSON estructurado
  system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
  tools,
  tool_choice: { type: "any" },
  messages: [
    { role: "user", content: `Investiga noticias del sector FAST/CTV/AVOD de las últimas ${editionType === "daily" ? "24 horas" : "7 días"} con web_search y luego llama a submit_newsletter con los datos estructurados. NO escribas HTML, solo datos.` },
  ],
});

console.log(`  stop_reason: ${res.stop_reason}`);
console.log(`  blocks: ${res.content.map((b) => `${b.type}${b.name ? `(${b.name})` : ""}`).join(", ")}`);
console.log(`  tokens: input ${res.usage.input_tokens}, output ${res.usage.output_tokens}, cache_read ${res.usage.cache_read_input_tokens ?? 0}`);

let data = null;
for (const block of res.content) {
  if (block.type === "tool_use" && block.name === "submit_newsletter") {
    data = block.input;
    break;
  }
}

if (!data) {
  console.error("No llegó submit_newsletter. Texto del modelo:");
  console.error(res.content.find((b) => b.type === "text")?.text?.slice(0, 1000) || "(sin texto)");
  process.exit(1);
}

// Validación defensiva
const requiredTop = editionType === "daily"
  ? ["subject", "preheader", "headline", "resumen_bullets", "bloques", "senales_bullets", "formacion_bullets"]
  : ["subject", "preheader", "headline", "semana", "es", "cat"];

for (const field of requiredTop) {
  if (data[field] === undefined || data[field] === null) {
    console.error(`❌ Campo obligatorio faltante: ${field}. stop_reason=${res.stop_reason}.`);
    process.exit(1);
  }
}

// Render HTML local
const html = editionType === "daily"
  ? renderDaily({ ...data, fecha_larga: todayLong })
  : renderWeekly({ ...data, fecha_larga: todayLong });

const elapsedSec = Math.round((Date.now() - startTime) / 1000);
console.log(`✓ Newsletter generado en ${elapsedSec}s.`);
console.log(`  Subject: ${data.subject}`);
console.log(`  HTML renderizado: ${html.length} chars`);

// Outputs
fs.writeFileSync("/tmp/body.html", html);
fs.writeFileSync("/tmp/subject.txt", data.subject);
fs.writeFileSync("/tmp/preheader.txt", data.preheader);
fs.writeFileSync("/tmp/data.json", JSON.stringify(data, null, 2));

// Update history (solo para daily; weekly no aplica anti-repetición FORMACIÓN aquí)
if (editionType === "daily" && Array.isArray(data.formacion_bullets)) {
  const bulletNames = data.formacion_bullets.map((b) => b.nombre).filter(Boolean);
  history.formacion.push({ date: today, bullets: bulletNames });
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  history.formacion = history.formacion.filter((e) => e.date >= thirtyDaysAgo);
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  console.log(`  history.json actualizado con ${bulletNames.length} bullets.`);
}
