#!/usr/bin/env node
// FAST Newsletter — pipeline en 2 pasos:
//   Step 1 (Sonnet 4.6 + web_search): investigación → dossier estructurado de hechos crudos.
//   Step 2 (Haiku 4.5, sin tools): redacción editorial → datos estructurados del newsletter.
//   Step 3 (local): renderiza HTML desde los datos + template Quantum Makers.
//
// Output: /tmp/body.html, /tmp/subject.txt, /tmp/preheader.txt, /tmp/data.json, /tmp/dossier.json
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

const researchPromptPath = path.join(__dirname, "prompts", `research_${editionType}.txt`);
const writePromptPath = path.join(__dirname, "prompts", `write_${editionType}.txt`);
const researchPrompt = fs.readFileSync(researchPromptPath, "utf8");
const writePrompt = fs.readFileSync(writePromptPath, "utf8");

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

const anthropic = new Anthropic();

// ============================================================
// STEP 1 — Investigación (Sonnet 4.6 + web_search)
// ============================================================

const researchTools = [
  { type: "web_search_20250305", name: "web_search", max_uses: 2 },
  {
    name: "submit_research",
    description: "Devuelve el dossier de investigación estructurado, sin redacción editorial.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Hechos crudos encontrados, agrupados por tópico/categoría.",
          items: {
            type: "object",
            properties: {
              topico: { type: "string", description: "Tópico/categoría (ej. 'Plataforma', 'AdTech', 'LATAM')." },
              destacada: { type: "boolean", description: "true si esta pieza debería ser la noticia destacada (weekly)." },
              hechos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    titulo_corto: { type: "string", description: "Título corto del hecho (no editorial, solo descriptivo)." },
                    dato_clave: { type: "string", description: "Dato clave o cifra concreta del hecho." },
                    fuente_url: { type: "string" },
                    fuente_nombre: { type: "string" },
                    fecha_publicacion: { type: "string", description: "YYYY-MM-DD si la verificaste." },
                    es_rumor: { type: "boolean", description: "true si es rumor/estimación sin confirmar." },
                  },
                  required: ["titulo_corto", "dato_clave", "fuente_url", "fuente_nombre"],
                },
              },
            },
            required: ["topico", "hechos"],
          },
        },
        formacion: {
          type: "array",
          description: "Oportunidades de formación/networking encontradas (solo daily; weekly puede ser []).",
          items: {
            type: "object",
            properties: {
              nombre: { type: "string" },
              lugar: { type: "string" },
              fecha: { type: "string" },
              url: { type: "string" },
            },
            required: ["nombre"],
          },
        },
      },
      required: ["items", "formacion"],
    },
  },
];

const researchSystem = `${researchPrompt}

---
CONTEXTO DE EJECUCIÓN:
- Fecha hoy: ${todayLong} (${today})
- Edición: ${editionType.toUpperCase()}

FORMACION_VETADOS (NO incluir):
${vetados.length ? vetados.map((s) => `  - ${s}`).join("\n") : "  (ninguno)"}

FORMACION_HISTORIAL_RECIENTE (info, no es bloqueo):
${recientes.length ? recientes.map((s) => `  - ${s}`).join("\n") : "  (sin historial)"}`;

console.log(`→ Step 1: investigación con Sonnet 4.6 + web_search (max_uses: 2)...`);
const startStep1 = Date.now();

const researchRes = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4000,
  system: [{ type: "text", text: researchSystem, cache_control: { type: "ephemeral" } }],
  tools: researchTools,
  tool_choice: { type: "any" },
  messages: [
    { role: "user", content: `Investigá noticias FAST/CTV/AVOD de ${editionType === "daily" ? "las últimas 24h" : "los últimos 7 días"}. Llamá a submit_research con los hechos crudos y fuentes verificadas.` },
  ],
});

console.log(`  stop_reason: ${researchRes.stop_reason}`);
console.log(`  blocks: ${researchRes.content.map((b) => `${b.type}${b.name ? `(${b.name})` : ""}`).join(", ")}`);
console.log(`  tokens: input ${researchRes.usage.input_tokens}, output ${researchRes.usage.output_tokens}, cache_read ${researchRes.usage.cache_read_input_tokens ?? 0}`);

let dossier = null;
for (const block of researchRes.content) {
  if (block.type === "tool_use" && block.name === "submit_research") {
    dossier = block.input;
    break;
  }
}
if (!dossier) {
  console.error("Step 1: no llegó submit_research.");
  process.exit(1);
}
fs.writeFileSync("/tmp/dossier.json", JSON.stringify(dossier, null, 2));
console.log(`  ✓ Dossier: ${dossier.items.length} items, ${dossier.formacion?.length ?? 0} formación`);
console.log(`  Step 1 tiempo: ${Math.round((Date.now() - startStep1) / 1000)}s`);

// ============================================================
// STEP 2 — Redacción editorial (Haiku 4.5, sin tools)
// ============================================================

const bulletItemSchema = {
  type: "object",
  properties: {
    texto: { type: "string" },
    fuente_url: { type: "string" },
    fuente_nombre: { type: "string" },
  },
  required: ["texto"],
};

const bloqueSchema = {
  type: "object",
  properties: {
    etiqueta: { type: "string" },
    titular: { type: "string" },
    bullets: { type: "array", items: bulletItemSchema },
  },
  required: ["etiqueta", "titular", "bullets"],
};

const formacionItemSchema = {
  type: "object",
  properties: {
    nombre: { type: "string" },
    lugar: { type: "string" },
    fecha: { type: "string" },
    url: { type: "string" },
  },
  required: ["nombre"],
};

const dailyOutputSchema = {
  type: "object",
  properties: {
    subject: { type: "string" },
    preheader: { type: "string" },
    headline: { type: "string" },
    resumen_bullets: { type: "array", items: { type: "string" } },
    bloques: { type: "array", items: bloqueSchema },
    senales_bullets: { type: "array", items: { type: "string" } },
    formacion_bullets: { type: "array", items: formacionItemSchema },
  },
  required: ["subject", "preheader", "headline", "resumen_bullets", "bloques", "senales_bullets", "formacion_bullets"],
};

const langBlockSchema = {
  type: "object",
  properties: {
    resumen: { type: "string" },
    destacada: {
      type: "object",
      properties: { titular: { type: "string" }, subtitulo: { type: "string" }, cuerpo: { type: "string" } },
    },
    bloques: { type: "array", items: bloqueSchema },
    senales_bullets: { type: "array", items: { type: "string" } },
  },
  required: ["resumen", "destacada", "bloques", "senales_bullets"],
};

const weeklyOutputSchema = {
  type: "object",
  properties: {
    subject: { type: "string" },
    preheader: { type: "string" },
    headline: { type: "string" },
    semana: { type: "string" },
    es: langBlockSchema,
    cat: langBlockSchema,
  },
  required: ["subject", "preheader", "headline", "semana", "es", "cat"],
};

const writeTools = [
  {
    name: "submit_newsletter",
    description: "Devuelve el contenido editorial estructurado del newsletter. NO HTML, solo datos.",
    input_schema: editionType === "daily" ? dailyOutputSchema : weeklyOutputSchema,
  },
];

const writeSystem = `${writePrompt}

---
CONTEXTO:
- Fecha hoy: ${todayLong} (${today})
- Edición: ${editionType.toUpperCase()}

RESEARCH_DOSSIER (hechos crudos verificados que debes usar; NO inventes lo que no esté aquí):
\`\`\`json
${JSON.stringify(dossier, null, 2)}
\`\`\``;

console.log(`→ Step 2: redacción con Haiku 4.5...`);
const startStep2 = Date.now();

const writeRes = await anthropic.messages.create({
  model: "claude-haiku-4-5",
  // max_tokens NO cuesta plata, solo lo que se genera. Margen amplio para evitar truncamiento.
  max_tokens: editionType === "weekly" ? 16000 : 6000,
  system: [{ type: "text", text: writeSystem }],
  tools: writeTools,
  tool_choice: { type: "any" },
  messages: [
    { role: "user", content: "Usá el dossier del system prompt para producir el newsletter estructurado. Llamá a submit_newsletter." },
  ],
});

console.log(`  stop_reason: ${writeRes.stop_reason}`);
console.log(`  blocks: ${writeRes.content.map((b) => `${b.type}${b.name ? `(${b.name})` : ""}`).join(", ")}`);
console.log(`  tokens: input ${writeRes.usage.input_tokens}, output ${writeRes.usage.output_tokens}, cache_read ${writeRes.usage.cache_read_input_tokens ?? 0}`);

let data = null;
for (const block of writeRes.content) {
  if (block.type === "tool_use" && block.name === "submit_newsletter") {
    data = block.input;
    break;
  }
}
if (!data) {
  console.error("Step 2: no llegó submit_newsletter.");
  process.exit(1);
}

// Validación defensiva
const requiredTop = editionType === "daily"
  ? ["subject", "preheader", "headline", "resumen_bullets", "bloques", "senales_bullets", "formacion_bullets"]
  : ["subject", "preheader", "headline", "semana", "es", "cat"];
for (const field of requiredTop) {
  if (data[field] === undefined || data[field] === null) {
    console.error(`❌ Campo obligatorio faltante: ${field}. stop_reason=${writeRes.stop_reason}.`);
    process.exit(1);
  }
}

console.log(`  Step 2 tiempo: ${Math.round((Date.now() - startStep2) / 1000)}s`);

// ============================================================
// STEP 3 — Render HTML local + outputs
// ============================================================

const html = editionType === "daily"
  ? renderDaily({ ...data, fecha_larga: todayLong })
  : renderWeekly({ ...data, fecha_larga: todayLong });

console.log(`✓ HTML renderizado: ${html.length} chars`);

fs.writeFileSync("/tmp/body.html", html);
fs.writeFileSync("/tmp/subject.txt", data.subject);
fs.writeFileSync("/tmp/preheader.txt", data.preheader);
fs.writeFileSync("/tmp/data.json", JSON.stringify(data, null, 2));

if (editionType === "daily" && Array.isArray(data.formacion_bullets)) {
  const bulletNames = data.formacion_bullets.map((b) => b.nombre).filter(Boolean);
  history.formacion.push({ date: today, bullets: bulletNames });
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  history.formacion = history.formacion.filter((e) => e.date >= thirtyDaysAgo);
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  console.log(`  history.json actualizado con ${bulletNames.length} bullets.`);
}

console.log(`✓ Subject: ${data.subject}`);
