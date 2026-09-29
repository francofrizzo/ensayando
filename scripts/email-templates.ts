// Builds the Supabase Auth email templates (supabase/templates/*.html) from one
// base layout, plus a local preview with sample values.
//
//   pnpm emails:build            writes the templates
//   pnpm emails:build --preview  also writes supabase/templates/preview.html
//
// Templates use Supabase's Go template variables ({{ .ConfirmationURL }}, …).
// Email clients don't read oklch() or CSS variables, so colors come from the
// palette as hex and every style is inline.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatHex } from "culori";

import { BRAND_SPEC, canvasColor, deriveColor } from "../src/utils/palette";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../supabase/templates");

const hex = (css: string) => formatHex(css) ?? "#000000";
const C = {
  canvas: hex(canvasColor("light")),
  surface: hex(`oklch(0.994 0.003 ${(BRAND_SPEC as { hue: number }).hue})`),
  line: hex(deriveColor(BRAND_SPEC, "line", "light")),
  soft: hex(deriveColor(BRAND_SPEC, "soft", "light")),
  fill: hex(deriveColor(BRAND_SPEC, "fill", "light")),
  ink: hex(deriveColor(BRAND_SPEC, "ink", "light")),
  text: hex(`oklch(0.21 0.014 ${(BRAND_SPEC as { hue: number }).hue})`),
  muted: hex(`oklch(0.48 0.014 ${(BRAND_SPEC as { hue: number }).hue})`)
};

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

type Email = {
  /** Supabase template key: [auth.email.template.<key>] */
  key: string;
  subject: string;
  /** Inbox preview line (hidden in the body). */
  preheader: string;
  heading: string;
  /** Paragraphs before the action (HTML, may use Go template syntax). */
  intro: string[];
  action: { kind: "button"; label: string } | { kind: "code" };
  /** Small print after the action. */
  outro: string[];
};

const p = (html: string) =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.55;color:${C.text};">${html}</p>`;
const small = (html: string) =>
  `<p style="margin:0 0 10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${html}</p>`;

const button = (label: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr>
    <td align="center" bgcolor="${C.fill}" style="border-radius:10px;">
      <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
    </td>
  </tr>
</table>
${small("Si el botón no funciona, copiá este link en el navegador:")}
<p style="margin:0 0 20px;font-family:${MONO};font-size:12px;line-height:1.5;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:${C.ink};">{{ .ConfirmationURL }}</a></p>`;

const code = () => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr>
    <td bgcolor="${C.soft}" style="border-radius:10px;padding:14px 22px;font-family:${MONO};font-size:28px;font-weight:700;letter-spacing:6px;color:${C.ink};">{{ .Token }}</td>
  </tr>
</table>`;

const layout = (email: Email) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${email.subject}</title>
</head>
<body style="margin:0;padding:0;background:${C.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${email.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.canvas}" style="background:${C.canvas};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
        <tr>
          <td style="padding:0 4px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:${FONT};font-size:19px;font-weight:700;letter-spacing:-0.2px;color:${C.ink};">Ensayando</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td bgcolor="${C.surface}" style="background:${C.surface};border:1px solid ${C.line};border-radius:16px;padding:32px 28px 20px;">
            <h1 style="margin:0 0 16px;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.3px;color:${C.text};">${email.heading}</h1>
            ${email.intro.map(p).join("\n            ")}
            ${email.action.kind === "button" ? button(email.action.label) : code()}
            ${email.outro.map(small).join("\n            ")}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 4px 0;">
            ${small(`Ensayando · <a href="{{ .SiteURL }}" style="color:${C.muted};">app.ensayando.com.ar</a>`)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`;

const NOT_YOU = "Si no fuiste vos, ignorá este email: no cambia nada en tu cuenta.";

export const EMAILS: Email[] = [
  {
    key: "invite",
    subject: "Te invitaron a Ensayando",
    preheader: "Elegí una contraseña para entrar y empezar a ensayar.",
    heading: "Te invitaron a Ensayando",
    intro: [
      `{{ if .Data.collection_name }}Te sumaron a <strong>{{ .Data.collection_name }}</strong> en Ensayando{{ else }}Te sumaron a una colección en Ensayando{{ end }}: ahí están las pistas y las letras de las canciones para ensayar.`,
      "Para entrar, elegí una contraseña. Después vas a iniciar sesión con este email."
    ],
    action: { kind: "button", label: "Elegir contraseña" },
    outro: [
      "El link sirve una sola vez y vence pronto. Si ya no funciona, pedile a quien te invitó que te mande otro.",
      "Si no esperabas esta invitación, podés ignorar este email."
    ]
  },
  {
    key: "recovery",
    subject: "Restablecé tu contraseña de Ensayando",
    preheader: "Elegí una contraseña nueva para tu cuenta.",
    heading: "Elegí una contraseña nueva",
    intro: ["Pediste restablecer la contraseña de tu cuenta de Ensayando ({{ .Email }})."],
    action: { kind: "button", label: "Elegir contraseña nueva" },
    outro: [
      "El link sirve una sola vez y vence en una hora. Si venció, pedí otro desde la pantalla de inicio de sesión.",
      "Si no lo pediste, ignorá este email: tu contraseña sigue siendo la misma."
    ]
  },
  {
    key: "confirmation",
    subject: "Confirmá tu email en Ensayando",
    preheader: "Un paso más para activar tu cuenta.",
    heading: "Confirmá tu email",
    intro: ["Para activar tu cuenta de Ensayando, confirmá que {{ .Email }} es tu email."],
    action: { kind: "button", label: "Confirmar email" },
    outro: ["El link sirve una sola vez y vence en una hora.", NOT_YOU]
  },
  {
    key: "magic_link",
    subject: "Tu link para entrar a Ensayando",
    preheader: "Entrá a Ensayando sin contraseña.",
    heading: "Entrá a Ensayando",
    intro: ["Usá este botón para entrar con {{ .Email }}."],
    action: { kind: "button", label: "Entrar" },
    outro: ["El link sirve una sola vez y vence en una hora.", NOT_YOU]
  },
  {
    key: "email_change",
    subject: "Confirmá tu nuevo email en Ensayando",
    preheader: "Confirmá el cambio de email de tu cuenta.",
    heading: "Confirmá tu nuevo email",
    intro: [
      "Pediste cambiar el email de tu cuenta de Ensayando de {{ .Email }} a <strong>{{ .NewEmail }}</strong>."
    ],
    action: { kind: "button", label: "Confirmar cambio" },
    outro: [
      "Hasta que lo confirmes, seguís entrando con el email de siempre.",
      "Si no lo pediste, ignorá este email y cambiá tu contraseña."
    ]
  },
  {
    key: "reauthentication",
    subject: "Tu código de verificación de Ensayando",
    preheader: "Usá este código para confirmar que sos vos.",
    heading: "Confirmá que sos vos",
    intro: ["Ingresá este código en Ensayando para seguir:"],
    action: { kind: "code" },
    outro: ["El código vence en una hora.", NOT_YOU]
  }
];

const SAMPLE: Record<string, string> = {
  ".ConfirmationURL":
    "https://szwejhoyemgokppoabfb.supabase.co/auth/v1/verify?token=abc123&type=invite&redirect_to=https://app.ensayando.com.ar/reset-password",
  ".SiteURL": "https://app.ensayando.com.ar",
  ".Email": "ana@ejemplo.com",
  ".NewEmail": "ana.nueva@ejemplo.com",
  ".Token": "482913",
  ".Data.collection_name": "Coro del Sur"
};

/** Rough Go-template rendering for the preview: sample values, `if` takes its first branch. */
const renderSample = (html: string) =>
  html
    .replace(/{{ if [^}]+ }}(.*?){{ else }}.*?{{ end }}/gs, "$1")
    .replace(/{{ (\.[\w.]+) }}/g, (_, name: string) => SAMPLE[name] ?? name);

mkdirSync(OUT_DIR, { recursive: true });
for (const email of EMAILS) writeFileSync(join(OUT_DIR, `${email.key}.html`), layout(email));

if (process.argv.includes("--preview")) {
  const frames = EMAILS.map(
    (email) => `<section><h2>${email.key} · <span>${email.subject}</span></h2>
<iframe srcdoc="${renderSample(layout(email)).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></iframe></section>`
  ).join("\n");
  writeFileSync(
    join(OUT_DIR, "preview.html"),
    `<!doctype html><meta charset="utf-8"><title>Emails de Ensayando</title>
<style>body{margin:0;padding:24px;background:#777;font:14px system-ui;display:grid;grid-template-columns:repeat(auto-fill,minmax(560px,1fr));gap:24px}
h2{margin:0 0 8px;font-size:14px;color:#fff}h2 span{font-weight:400;opacity:.8}iframe{width:100%;height:760px;border:0;border-radius:12px;background:#fff}</style>
${frames}`
  );
}

console.log(`Wrote ${EMAILS.length} templates to ${OUT_DIR}`);
