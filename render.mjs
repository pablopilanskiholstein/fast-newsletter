// Renderiza el HTML del newsletter desde datos estructurados + template.
// Se usa local en GitHub Actions, no consume API.

import fs from "node:fs";
import path from "node:path";

const palette = {
  red: "#E63329",
  redDeep: "#C2231C",
  ink: "#1a1a1a",
  inkLight: "#5a5a55",
  sep: "#e8e3e0",
  bg: "#f4efec",
  textMuted: "#8a8580",
};

function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function block(kicker, headline, bullets) {
  const bulletsHtml = bullets
    .map((b) => {
      const sourceLink = b.fuente_url
        ? ` <a href="${esc(b.fuente_url)}" style="color:${palette.redDeep};text-decoration:underline;">${esc(b.fuente_nombre || "fuente")}</a>`
        : "";
      return `<li style="margin:0 0 10px 0;padding-left:18px;text-indent:-18px;"><span style="color:${palette.red};font-weight:700;">▷ </span>${esc(b.texto)}${sourceLink}</li>`;
    })
    .join("");
  return `<tr><td style="padding:0 40px 8px 40px;">
<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${palette.red};font-weight:700;margin-bottom:8px;">${esc(kicker)}</div>
<h2 style="margin:0 0 12px 0;font-family:Georgia,serif;font-size:20px;line-height:1.3;color:${palette.ink};font-weight:700;">${esc(headline)}</h2>
<ul style="margin:0;padding-left:0;list-style:none;font-size:14.5px;line-height:1.55;color:${palette.ink};">${bulletsHtml}</ul>
</td></tr>
<tr><td style="padding:0 40px;"><hr style="border:0;border-top:1px solid ${palette.sep};margin:24px 0;"></td></tr>`;
}

function sectionList(kickerLabel, items, prefix = "▷") {
  const html = items
    .map((t) => `<li style="margin:0 0 8px 0;padding-left:18px;text-indent:-18px;"><span style="color:${palette.red};font-weight:700;">${prefix} </span>${esc(t)}</li>`)
    .join("");
  return `<tr><td style="padding:0 40px 16px 40px;">
<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${palette.red};font-weight:700;margin-bottom:10px;">${esc(kickerLabel)}</div>
<ul style="margin:0;padding-left:0;list-style:none;font-size:14.5px;line-height:1.55;color:${palette.ink};">${html}</ul>
</td></tr>`;
}

function formacionList(bullets) {
  const html = bullets
    .map((b) => {
      const link = b.url ? ` <a href="${esc(b.url)}" style="color:${palette.redDeep};text-decoration:underline;">${esc(new URL(b.url).hostname.replace(/^www\./, ""))}</a>` : "";
      const meta = [b.lugar, b.fecha].filter(Boolean).map(esc).join(" · ");
      return `<li style="margin:0 0 8px 0;padding-left:18px;text-indent:-18px;"><span style="color:${palette.red};font-weight:700;">▷ </span><strong>${esc(b.nombre)}</strong>${meta ? ` · ${meta}` : ""}${link}</li>`;
    })
    .join("");
  return `<tr><td style="padding:0 40px 16px 40px;">
<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${palette.red};font-weight:700;margin-bottom:10px;">FORMACIÓN &amp; NETWORKING</div>
<ul style="margin:0;padding-left:0;list-style:none;font-size:14.5px;line-height:1.55;color:${palette.ink};">${html}</ul>
</td></tr>`;
}

export function renderDaily(data) {
  const {
    headline,
    fecha_larga,
    preheader,
    resumen_bullets,
    bloques,
    senales_bullets,
    formacion_bullets,
    destinatario,
  } = data;

  const resumenHtml = resumen_bullets
    .map((t) => `<li style="margin-bottom:6px;">${esc(t)}</li>`)
    .join("");

  const bloquesHtml = bloques
    .map((b) => block(b.etiqueta, b.titular, b.bullets || []))
    .join("");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${palette.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${palette.ink};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${palette.bg};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${palette.bg};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;">
<tr><td style="background:${palette.red};height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>
<tr><td style="padding:36px 40px 12px 40px;">
<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${palette.red};font-weight:700;">▶ FAST CHANNELS · NEWSLETTER DIARIO</div>
<h1 style="margin:14px 0 6px 0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;color:${palette.ink};font-weight:700;">${esc(headline)}</h1>
<div style="font-size:13px;color:${palette.inkLight};">${esc(fecha_larga)} · Edición diaria · Cobertura global</div>
</td></tr>
<tr><td style="padding:0 40px;"><hr style="border:0;border-top:1px solid ${palette.sep};margin:24px 0;"></td></tr>
<tr><td style="padding:0 40px 8px 40px;">
<div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${palette.red};font-weight:700;margin-bottom:10px;">RESUMEN EJECUTIVO</div>
<ul style="margin:0;padding-left:18px;font-size:15px;line-height:1.55;color:${palette.ink};">${resumenHtml}</ul>
</td></tr>
<tr><td style="padding:0 40px;"><hr style="border:0;border-top:1px solid ${palette.sep};margin:28px 0;"></td></tr>
${bloquesHtml}
${sectionList("SEÑALES A VIGILAR", senales_bullets)}
<tr><td style="padding:0 40px;"><hr style="border:0;border-top:1px solid ${palette.sep};margin:28px 0;"></td></tr>
${formacionList(formacion_bullets)}
<tr><td style="padding:0 40px;"><hr style="border:0;border-top:1px solid ${palette.sep};margin:28px 0 24px 0;"></td></tr>
<tr><td align="center" style="padding:8px 40px 40px 40px;">
<img src="cid:qm-logo" alt="Quantum Makers" width="140" style="display:block;width:140px;max-width:140px;height:auto;margin:0 auto 14px auto;">
<div style="font-size:12px;line-height:1.5;color:${palette.inkLight};text-align:center;">
<strong style="color:${palette.ink};">FAST Channels Newsletter</strong> · Una iniciativa de Quantum Makers<br>
Edición del ${esc(fecha_larga)} · Destinatario: ${esc(destinatario || "pablo.pilanski@qformedia.com")}<br>
<span style="color:${palette.textMuted};">Newsletter generado mediante curación editorial con asistencia de IA sobre fuentes públicas recientes. Datos etiquetados como rumor/estimación cuando corresponde.</span>
</div></td></tr>
</table></td></tr></table></body></html>`;
}

export function renderWeekly(data) {
  const {
    headline,
    semana,
    fecha_larga,
    fecha_larga_cat,
    preheader,
    destinatario,
    es,
    cat,
  } = data;

  const renderLang = (langData, isCAT = false) => {
    const labels = isCAT
      ? { resumen: "RESUM EXECUTIU", destacada: "NOTÍCIA DESTACADA", senales: "SENYALS A VIGILAR" }
      : { resumen: "RESUMEN EJECUTIVO", destacada: "NOTICIA DESTACADA", senales: "SEÑALES A VIGILAR" };

    const bloquesHtml = (langData.bloques || []).map((b) => block(b.etiqueta, b.titular, b.bullets || [])).join("");

    return `<tr><td style="padding:24px 40px 8px 40px;">
<div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${palette.red};font-weight:700;margin-bottom:10px;">${labels.resumen}</div>
<p style="margin:0;font-size:15px;line-height:1.6;color:${palette.ink};">${esc(langData.resumen)}</p>
</td></tr>
<tr><td style="padding:0 40px;"><hr style="border:0;border-top:1px solid ${palette.sep};margin:28px 0;"></td></tr>
<tr><td style="padding:0 40px 8px 40px;">
<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${palette.red};font-weight:700;margin-bottom:8px;">${labels.destacada}</div>
<h2 style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:24px;line-height:1.25;color:${palette.ink};font-weight:700;">${esc(langData.destacada?.titular || "")}</h2>
<div style="font-size:14px;color:${palette.inkLight};font-style:italic;margin-bottom:14px;">${esc(langData.destacada?.subtitulo || "")}</div>
<div style="font-size:15px;line-height:1.6;color:${palette.ink};">${esc(langData.destacada?.cuerpo || "")}</div>
</td></tr>
<tr><td style="padding:0 40px;"><hr style="border:0;border-top:1px solid ${palette.sep};margin:28px 0;"></td></tr>
${bloquesHtml}
${sectionList(labels.senales, langData.senales_bullets || [])}`;
  };

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${palette.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${palette.ink};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${palette.bg};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${palette.bg};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;">
<tr><td style="background:${palette.red};height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>
<tr><td style="padding:36px 40px 12px 40px;">
<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${palette.red};font-weight:700;">▶ FAST CHANNELS · NEWSLETTER WEEKLY</div>
<h1 style="margin:14px 0 6px 0;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.2;color:${palette.ink};font-weight:700;">${esc(headline)}</h1>
<div style="font-size:13px;color:${palette.inkLight};">Semana ${esc(semana)} · ${esc(fecha_larga)} · Cobertura global · Europa &amp; USA</div>
</td></tr>
<tr><td style="padding:32px 40px 0 40px;"><div style="border-top:3px solid ${palette.red};padding-top:14px;"><div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:${palette.red};font-weight:700;">ES · EDICIÓN EN ESPAÑOL</div></div></td></tr>
${renderLang(es, false)}
<tr><td style="padding:40px 40px 0 40px;"><div style="border-top:3px solid ${palette.red};padding-top:14px;"><div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:${palette.red};font-weight:700;">CAT · EDICIÓ EN CATALÀ</div></div></td></tr>
${renderLang(cat, true)}
<tr><td style="padding:0 40px;"><hr style="border:0;border-top:1px solid ${palette.sep};margin:28px 0 24px 0;"></td></tr>
<tr><td align="center" style="padding:8px 40px 40px 40px;">
<img src="cid:qm-logo" alt="Quantum Makers" width="140" style="display:block;width:140px;max-width:140px;height:auto;margin:0 auto 14px auto;">
<div style="font-size:12px;line-height:1.55;color:${palette.inkLight};text-align:center;">
<strong style="color:${palette.ink};">FAST Channels Newsletter</strong> · Una iniciativa de Quantum Makers<br>
Edición del ${esc(fecha_larga)} / Edició de l'${esc(fecha_larga_cat || fecha_larga)}<br>
Destinatario / Destinatari: ${esc(destinatario || "pablo.pilanski@qformedia.com")}<br>
<span style="color:${palette.textMuted};">Este newsletter ha sido generado mediante curación editorial con asistencia de IA sobre fuentes públicas recientes.<br>Aquest butlletí ha estat generat mitjançant curació editorial amb assistència d'IA sobre fonts públiques recents.</span>
</div></td></tr>
</table></td></tr></table></body></html>`;
}
