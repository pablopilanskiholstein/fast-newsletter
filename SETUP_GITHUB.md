# Setup GitHub Actions — FAST Newsletter

Guía rápida para mover el cron de claude.ai routines a GitHub Actions bajo la organización **qformedia**.

## 1 · Crear el repo privado

1. https://github.com/qformedia → click **New repository**.
2. Configura:
   - **Repository name**: `fast-newsletter` (o el nombre que prefieras)
   - **Visibility**: **Private** ✅
   - **NO** inicialices con README, .gitignore, ni license (vamos a pushear el local que ya está listo).
3. Create repository.
4. Copia la URL SSH o HTTPS del repo (la usarás en el paso 2).

## 2 · Subir el código local al repo

Desde tu Mac, en la carpeta del proyecto:

```bash
cd ~/Documents/newsletter_fast

# Inicializa git si no está
git init -b main

# Configura el remote (sustituí URL_DEL_REPO por la real)
git remote add origin URL_DEL_REPO

# Primer commit
git add .
git commit -m "Initial: FAST Newsletter automation v1"
git push -u origin main
```

> **Verificá antes del push** que `.gitignore` está excluyendo `node_modules/`, archivos temporales, `get_refresh_token.mjs` y `smoke_test.mjs`. Si por error commiteás secretos, el push los expone aunque sea privado; mejor revisar antes con `git status`.

## 3 · Añadir los Secrets al repo

En el repo en GitHub:

1. **Settings → Secrets and variables → Actions**.
2. Click **New repository secret** y crea uno por uno estos 6:

| Nombre del secret | Valor | De dónde |
|---|---|---|
| `ANTHROPIC_API_KEY` | API key | console.anthropic.com → API Keys → de la cuenta qformedia |
| `GOOGLE_CLIENT_ID` | Client ID | Bitwarden item "FAST Newsletter — Google Cloud OAuth Client", campo Username |
| `GOOGLE_CLIENT_SECRET` | Client Secret | Mismo item, campo Password |
| `GOOGLE_REFRESH_TOKEN` | Refresh Token | Mismo item, campo personalizado `refresh_token` |
| `GMAIL_USER` | `pablo.pilanski@qformedia.com` | hardcoded |
| `GMAIL_FROM` | `FAST Channels Newsletter <newsletter_fast@qformedia.com>` | hardcoded (con < > literales) |

## 4 · Probar manualmente antes del primer cron

1. En el repo: **Actions** → workflow "FAST Daily Newsletter" → **Run workflow** → branch `main` → Run.
2. Espera 2–4 minutos (búsqueda + redacción Claude + envío).
3. Verifica:
   - El email llega a `pablo.pilanski@qformedia.com` con `From: newsletter_fast@qformedia.com`.
   - En la pestaña Actions, el job aparece en verde ✅.
   - Hay un commit nuevo `history: YYYY-MM-DD daily` en main (el bot del workflow lo creó al actualizar history.json).
4. Si algo falla, los logs de cada step están en la run.

## 5 · Cron automático

Ya está configurado en `.github/workflows/daily.yml`: `0 6 * * 1-5` (06:00 UTC = 08:00 Madrid en verano CEST, 07:00 en invierno CET).

Si querés cambiar el horario para que sea siempre 08:00 Madrid: GitHub Actions cron no soporta timezones, así que se hace duplicando el cron (uno para CEST y otro para CET con `0 7 * * 1-5`), pero requiere lógica adicional. Por ahora dejamos UTC.

## 6 · Apagar la routine vieja de claude.ai

Cuando el primer run real de GitHub Actions sea exitoso y verifiques que el email llegó OK:

1. Ve a https://claude.ai/code/routines
2. Abre "FAST Channels — Newsletter Diario (ES-LATAM)" → cubo de basura → eliminar.
3. (Opcional) También la weekly si decidimos migrarla — por ahora la dejamos en claude.ai routines y vemos cómo funciona el daily nuevo primero.

---

## Troubleshooting

- **"Error: Resource not accessible by integration"** al commitear history.json → falta dar permisos write al workflow. Settings → Actions → General → Workflow permissions → "Read and write permissions" → Save.
- **"401 Unauthorized" en Anthropic API** → la API key venció o no es de la cuenta correcta. Verificá en console.anthropic.com.
- **"401 invalid_grant" en Gmail API** → el refresh_token expiró. Regenerar con `get_refresh_token.mjs` desde tu Mac y actualizar el secret.
- **Newsletter llega como pablo.pilanski en vez de newsletter_fast** → revisar que el alias "Send mail as" sigue activo en Gmail Settings + "Default sender: Group address" sigue activo en Google Groups.

## Costes esperados

- GitHub Actions: ~30 min/mes sobre 2.000 free → **$0**.
- Claude API: ~$0.05–0.15 por run × 22 días = **$1.10–3.30/mes**.
- Gmail API: **$0**.

Total: **~$2–4 USD/mes** facturado a la cuenta Anthropic de qformedia.
