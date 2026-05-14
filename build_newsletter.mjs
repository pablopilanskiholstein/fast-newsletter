#!/usr/bin/env node
// Genera el HTML del FAST Newsletter llamando a Claude API con web_search.
// Output: escribe /tmp/body.html, /tmp/subject.txt, /tmp/preheader.txt.
// Actualiza history.json con los bullets de FORMACIÓN usados.
//
// Variables de entorno requeridas:
//   ANTHROPIC_API_KEY
//
// Uso:  node build_newsletter.mjs [daily|weekly]

import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editionType = process.argv[2] === "weekly" ? "weekly" : "daily";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Falta ANTHROPIC_API_KEY");
  process.exit(2);
}

// Carga prompt base
const promptPath = path.join(__dirname, "prompts", `${editionType}.txt`);
if (!fs.existsSync(promptPath)) {
  console.error(`Falta el prompt: ${promptPath}`);
  process.exit(2);
}
const basePrompt = fs.readFileSync(promptPath, "utf8");

// Carga template HTML como referencia visual
const templatePath = path.join(__dirname, `template_${editionType}.html`);
const template = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, "utf8") : "";

// Carga history para anti-repetición de FORMACIÓN
const historyPath = path.join(__dirname, "history.json");
const history = fs.existsSync(historyPath)
  ? JSON.parse(fs.readFileSync(historyPath, "utf8"))
  : { formacion: [] };

// Calcula bullets vetados: los que ya tienen 3 apariciones en los últimos 7 días.
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const recentFormacion = history.formacion.filter((e) => e.date >= sevenDaysAgo);
const counts = {};
for (const e of recentFormacion) {
  for (const bullet of e.bullets) counts[bullet] = (counts[bullet] || 0) + 1;
}
const vetados = Object.entries(counts).filter(([, c]) => c >= 3).map(([b]) => b);
const recientesPermitidos = Object.entries(counts).filter(([, c]) => c < 3).map(([b, c]) => `${b} (${c}/3)`);

const today = new Date().toISOString().slice(0, 10);
const todayLong = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// Tool: submit_newsletter (cliente)
const tools = [
  { type: "web_search_20250305", name: "web_search", max_uses: 3 },
  {
    name: "submit_newsletter",
    description: "Envía el newsletter completo en formato estructurado. Llama a esta tool UNA SOLA VEZ cuando hayas terminado la investigación y la redacción.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Asunto del email. Empieza con [TEST] durante fase de pruebas. Incluye fecha y 2-3 keywords. Sin Re: ni Fwd:." },
        preheader: { type: "string", description: "Texto preview de 80-100 caracteres con titulares de la jornada." },
        html: { type: "string", description: "HTML completo del email siguiendo el template. CSS inline. Logo vía cid:qm-logo." },
        formacion_bullets: {
          type: "array",
          items: { type: "string" },
          description: "Identificadores cortos y consistentes de las oportunidades incluidas en FORMACIÓN & NETWORKING. Ej: 'NAB Show NY 2026', 'Curso LSE Programming FAST'.",
        },
        sources_used: {
          type: "array",
          items: { type: "string" },
          description: "URLs principales consultadas, para auditoría.",
        },
      },
      required: ["subject", "preheader", "html", "formacion_bullets", "sources_used"],
    },
  },
];

const systemPrompt = `${basePrompt}

---
CONTEXTO DE EJECUCIÓN:
- Fecha de hoy: ${todayLong} (${today})
- Edición: ${editionType.toUpperCase()}

FORMACION_HISTORY (bullets ya usados y cuántas veces en los últimos 7 días):
${recientesPermitidos.length ? recientesPermitidos.map((s) => `  - ${s}`).join("\n") : "  (sin historial reciente)"}

FORMACION_VETADOS (NO incluir estos bullets, ya alcanzaron 3 apariciones):
${vetados.length ? vetados.map((s) => `  - ${s}`).join("\n") : "  (ninguno vetado)"}

---
TEMPLATE HTML DE REFERENCIA (estructura visual que debes seguir; los placeholders {{...}} debes rellenarlos con contenido real):
${template.slice(0, 4000)}${template.length > 4000 ? "\n... (template truncado, sigue el mismo patrón visual)" : ""}
`;

const anthropic = new Anthropic();

console.log(`→ Generando ${editionType} newsletter para ${todayLong}...`);
console.log(`  Vetados FORMACIÓN: ${vetados.length}`);

let messages = [
  { role: "user", content: "Genera el newsletter siguiendo las instrucciones del system prompt. Investiga con web_search primero, luego llama a submit_newsletter." },
];

let submission = null;
const startTime = Date.now();
let iterations = 0;
const MAX_ITERATIONS = 20;

while (!submission && iterations < MAX_ITERATIONS) {
  iterations++;
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    // Prompt caching: el system prompt es grande y se reutiliza en cada iteración del tool-use loop.
    // Marcar con cache_control reduce ~90% del coste de input en las iteraciones tras la primera.
    system: [
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
    ],
    tools,
    messages,
  });

  messages.push({ role: "assistant", content: res.content });

  if (res.stop_reason === "end_turn") {
    console.error("Claude terminó sin llamar a submit_newsletter. Última respuesta:");
    const txt = res.content.find((b) => b.type === "text")?.text || "";
    console.error(txt.slice(0, 1000));
    process.exit(1);
  }

  if (res.stop_reason === "tool_use") {
    const toolResults = [];
    for (const block of res.content) {
      // Server tools (web_search) llegan como type "server_tool_use" y se auto-resuelven; los ignoramos.
      if (block.type !== "tool_use") continue;
      // Cliente tools (las que registré en `tools` con campos input_schema, no las "server_tool" como web_search)
      if (block.name === "submit_newsletter") {
        submission = block.input;
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "Newsletter recibido. Gracias." });
      } else {
        // Defensivo: cualquier otro tool_use cliente desconocido recibe un noop para no dejar huérfanos.
        console.error(`  ⚠ tool_use desconocido (${block.name}, id=${block.id}). Respondo noop.`);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "OK" });
      }
    }
    if (toolResults.length === 0) {
      // No hubo tool_use cliente en esta iteración (solo server tools). Algo raro porque stop_reason era tool_use.
      // Diagnóstico:
      const blockTypes = res.content.map((b) => `${b.type}${b.name ? `(${b.name})` : ""}`).join(", ");
      console.error(`  Iteración ${iterations}: stop_reason=tool_use pero no hubo tool_use cliente. Blocks: ${blockTypes}`);
      // Forzamos al modelo a continuar pidiéndole explícitamente que llame a submit_newsletter
      messages.push({ role: "user", content: "Continúa con la investigación si te faltan datos, o llama YA a submit_newsletter con el newsletter completo." });
    } else {
      messages.push({ role: "user", content: toolResults });
    }
  }
}

if (!submission) {
  console.error(`No se obtuvo submit_newsletter tras ${MAX_ITERATIONS} iteraciones.`);
  process.exit(1);
}

const elapsedSec = Math.round((Date.now() - startTime) / 1000);
console.log(`✓ Newsletter generado en ${elapsedSec}s (${iterations} iteraciones).`);
console.log(`  Subject: ${submission.subject}`);
console.log(`  Bullets FORMACIÓN: ${submission.formacion_bullets.length}`);
console.log(`  Fuentes consultadas: ${submission.sources_used.length}`);

// Escribe outputs
fs.writeFileSync("/tmp/body.html", submission.html);
fs.writeFileSync("/tmp/subject.txt", submission.subject);
fs.writeFileSync("/tmp/preheader.txt", submission.preheader);
fs.writeFileSync("/tmp/sources.json", JSON.stringify(submission.sources_used, null, 2));

// Actualiza history
history.formacion.push({ date: today, bullets: submission.formacion_bullets });
// Mantén solo últimos 30 días para no crecer infinito
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
history.formacion = history.formacion.filter((e) => e.date >= thirtyDaysAgo);
fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

console.log(`✓ Outputs escritos: /tmp/body.html, /tmp/subject.txt, /tmp/preheader.txt`);
console.log(`✓ history.json actualizado.`);
