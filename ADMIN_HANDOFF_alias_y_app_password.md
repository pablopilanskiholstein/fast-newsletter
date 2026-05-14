# Handoff para admin de Google Workspace — grupo `newsletter_fast@qformedia.com` + App Password de Pablo

Hola 👋 — esto es una tarea pequeña que necesita hacerse desde una cuenta **admin de Google Workspace** del dominio `qformedia.com`. Lo pide Pablo Pilanski (`pablo.pilanski@qformedia.com`) para automatizar el envío del **Newsletter FAST Channels**.

Si estás leyendo esto desde Claude Code: sigue los pasos como guía, pero los pasos hay que hacerlos manualmente en el navegador (admin.google.com, groups.google.com, myaccount.google.com). Claude Code no puede ejecutarlos por ti.

Estructura elegida: **Grupo de Google** (no alias), igual que ya tenéis con `dev@qformedia.com`. Esto mantiene coherencia con cómo se gestionan otras direcciones funcionales del dominio.

---

## Qué hay que entregar a Pablo cuando termines

1. ✅ Grupo `newsletter_fast@qformedia.com` creado con Pablo como miembro y propietario, y permiso de **"publicar como grupo"** activado para miembros.
2. ✅ App Passwords habilitadas a nivel organización (si no lo están ya).
3. 🔐 **App Password de 16 caracteres** generada en la cuenta de Pablo (la genera Pablo, no tú). Compartir por canal seguro (1Password, Signal, mensaje borrable). **NO la pegues en email plano ni en Slack público.**

---

## Paso 1 — Crear el grupo `newsletter_fast@qformedia.com`

**Requisito:** ser admin de `qformedia.com` en Google Workspace, o tener permiso para crear grupos.

1. Entra en https://admin.google.com con tu cuenta admin.
2. Menú lateral → **Directorio → Grupos**.
3. **Crear grupo**.
4. Rellena:
   - **Nombre del grupo**: `FAST Channels Newsletter`
   - **Descripción**: `Newsletter automatizado del sector FAST Channels / CTV / AVOD`
   - **Correo del grupo**: `newsletter_fast` @ `qformedia.com`
   - **Propietario**: `pablo.pilanski@qformedia.com`
5. Crear.

## Paso 2 — Añadir a Pablo como miembro (si no se hizo en el paso 1)

1. Abrir el grupo recién creado en la consola.
2. **Miembros → Añadir miembros** → `pablo.pilanski@qformedia.com` con rol **Propietario**.

## Paso 3 — Permitir que los miembros publiquen "como el grupo"

Este es el paso **crítico** para que el envío automatizado pueda usar `From: newsletter_fast@qformedia.com`.

1. En la consola de admin, abrir el grupo `newsletter_fast@qformedia.com`.
2. Pestaña **Configuración de acceso** (o bien ir a https://groups.google.com → grupo → Configuración del grupo).
3. Sección **Quién puede publicar**: dejar en "Miembros del grupo" o "Propietarios".
4. Sección **Publicar como grupo / Post as group**: **activar para Propietarios y Administradores** (mínimo) o para Miembros.
5. Guardar.

> Cómo verificar: con Pablo logueado en su Gmail, al añadir el grupo como "Send mail as" debería aceptarlo sin pedir verificación SMTP externa, porque ya tiene permiso de publicar como grupo.

## Paso 4 — Permitir App Passwords a nivel organización

Por defecto Workspace **bloquea las App Passwords** para usuarios. Hay que habilitarlas para Pablo (o para toda la org si no hay OUs separadas).

1. admin.google.com → **Seguridad → Acceso y control de datos → Acceso de aplicaciones menos seguras** *(el nombre cambia según versión; busca también "App passwords" o "Contraseñas de aplicación")*.
2. Asegúrate de que **"Permitir contraseñas de aplicación"** esté **activado** para Pablo o su OU.
3. Guarda. Tarda unos minutos en propagar.

> Si tu consola muestra "Las App Passwords están deshabilitadas y no se pueden activar" (algunas ediciones lo restringen), avisa a Pablo y montamos OAuth como plan B.

---

## Lo que hace Pablo (no tú)

Estos pasos los ejecuta Pablo en su cuenta:

5. **Activar verificación en 2 pasos** (si no la tiene ya) en https://myaccount.google.com/security.
6. **Generar App Password** en https://myaccount.google.com/apppasswords con nombre `FAST Newsletter`. Copiar la cadena de 16 caracteres.
7. (Opcional) **Configurar Send-as** en Gmail → Configuración → Cuentas e importación → Enviar mensaje como → Añadir `newsletter_fast@qformedia.com` marcando "Tratar como un alias". Como ya es miembro del grupo con permiso de "publicar como grupo", debería añadirlo sin pedir verificación.

---

## Checklist final de entrega

- [ ] Grupo `newsletter_fast@qformedia.com` creado.
- [ ] Pablo añadido como Propietario.
- [ ] "Publicar como grupo" habilitado para Propietarios.
- [ ] App Passwords habilitadas a nivel org/OU.
- [ ] Pablo ha generado su App Password (16 caracteres) y la ha guardado.

Cuando estén los puntos 1–4, escríbele a Pablo: "grupo OK, app password en camino" y comparte la password por canal seguro.

---

## Contexto del proyecto

- **Qué es:** dos newsletters automatizados (Daily + Weekly) sobre el sector FAST Channels / CTV / AVOD.
- **Cómo funciona:** dos routines en claude.ai que se ejecutan por cron en servidores de Anthropic, generan el contenido con IA y lo envían vía **SMTP de Gmail** (`smtp.gmail.com:587`) autenticando con la cuenta de Pablo + App Password, con `From: newsletter_fast@qformedia.com` (el grupo).
- **Por qué grupo y no alias:** coherencia con el patrón ya existente en qformedia (ej. `dev@qformedia.com` es grupo), histórico archivable en Google Groups, escalable a más miembros sin reconfigurar nada.
- **Quién lo recibe:** durante fase de pruebas solo Pablo. En producción, también Quim Campa, Robin Valero y Albert Merino.
- **Por qué App Password y no OAuth:** simplicidad. OAuth es plan B si las App Passwords están bloqueadas a nivel organización.

Gracias 🙏
