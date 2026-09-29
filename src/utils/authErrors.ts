// Supabase Auth answers in English; the login screen shows these instead.

const MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, "El usuario o la contraseña no coinciden. Revisá que no haya espacios de más."],
  [/signups not allowed for otp|user not found/i, "No hay ninguna cuenta con ese email."],
  [/email not confirmed/i, "Todavía no confirmaste tu email. Revisá tu casilla y seguí el enlace."],
  [/rate limit|too many requests|security purposes/i, "Hubo demasiados intentos. Esperá un minuto y probá de nuevo."],
  [/failed to fetch|network|load failed/i, "No hay conexión con el servidor. Revisá tu conexión y probá de nuevo."]
];

export const loginErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  for (const [pattern, text] of MESSAGES) if (pattern.test(message)) return text;
  return "No se pudo iniciar sesión. Probá de nuevo en un momento.";
};
