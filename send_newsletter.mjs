#!/usr/bin/env node
// Envía el FAST Newsletter vía Gmail API (OAuth 2.0 con refresh token).
// Workspace Business Starter no permite App Passwords, por eso usamos OAuth.
//
// Uso:
//   node send_newsletter.mjs \
//     --to "pablo.pilanski@qformedia.com" \
//     --subject "FAST Daily · 14 may 2026 | …" \
//     --html-file /tmp/body.html \
//     [--text-file /tmp/body.txt] \
//     [--reply-to pablo.pilanski@qformedia.com]
//
// Variables de entorno requeridas:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REFRESH_TOKEN
//   GMAIL_USER       cuenta autenticada (ej. pablo.pilanski@qformedia.com)
//   GMAIL_FROM       remitente visible (ej. "FAST Channels <newsletter_fast@qformedia.com>")

import nodemailer from "nodemailer";
import { google } from "googleapis";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const { values } = parseArgs({
  options: {
    to: { type: "string" },
    subject: { type: "string" },
    "html-file": { type: "string" },
    "text-file": { type: "string" },
    "reply-to": { type: "string", default: "pablo.pilanski@qformedia.com" },
  },
});

for (const required of ["to", "subject", "html-file"]) {
  if (!values[required]) {
    console.error(`Falta el argumento obligatorio: --${required}`);
    process.exit(2);
  }
}
for (const envVar of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "GMAIL_USER", "GMAIL_FROM"]) {
  if (!process.env[envVar]) {
    console.error(`Falta la variable de entorno: ${envVar}`);
    process.exit(2);
  }
}

const html = fs.readFileSync(values["html-file"], "utf8");
const text = values["text-file"] ? fs.readFileSync(values["text-file"], "utf8") : htmlToPlainText(html);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logoPath = path.join(__dirname, "assets_logo", "Type_D.png");
const attachments = fs.existsSync(logoPath)
  ? [{ filename: "quantum-makers.png", path: logoPath, cid: "qm-logo" }]
  : [];

// 1) Compone el MIME completo con nodemailer (sin enviar por SMTP).
const mailComposer = nodemailer.createTransport({ streamTransport: true, buffer: true });
const built = await mailComposer.sendMail({
  from: process.env.GMAIL_FROM,
  to: values.to,
  replyTo: values["reply-to"],
  subject: values.subject,
  text,
  html,
  attachments,
  headers: {
    "List-Unsubscribe": `<mailto:${extractEmail(process.env.GMAIL_FROM)}?subject=unsubscribe>`,
    "X-Newsletter": "FAST-Channels",
  },
});
const rawMime = built.message.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// 2) Llama a Gmail API con el MIME como `raw`.
const oauth2 = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const gmail = google.gmail({ version: "v1", auth: oauth2 });
const res = await gmail.users.messages.send({
  userId: "me",
  requestBody: { raw: rawMime },
});

console.log(JSON.stringify({ id: res.data.id, threadId: res.data.threadId, labelIds: res.data.labelIds }));

function htmlToPlainText(s) {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractEmail(from) {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1] : from;
}
