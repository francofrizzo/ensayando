import type { IncomingHttpHeaders } from "node:http";

export type VercelRequest = {
  method?: string;
  headers: IncomingHttpHeaders;
  body: unknown;
};

export type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(body: unknown): void;
  end(): void;
};

// An error whose message is safe to show in the UI.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

// Codes raised by the database functions (see the phase 3 migrations), in Spanish for the UI.
const DATABASE_ERRORS: Record<string, [number, string]> = {
  FORBIDDEN: [403, "No tenés permiso para hacer esto."],
  NOT_FOUND: [404, "No encontramos lo que buscabas."],
  LAST_ADMIN: [409, "La colección tiene que tener al menos un admin."],
  ALREADY_MEMBER: [409, "Esa persona ya está en la colección."],
  INVALID_ROLE: [400, "Ese rol no existe."],
  INVALID_ORDER: [400, "El orden tiene que incluir cada canción de la colección una sola vez."]
};

export function databaseError(error: { message?: string } | null | undefined): ApiError {
  const known = error?.message ? DATABASE_ERRORS[error.message] : undefined;
  if (known) return new ApiError(known[0], known[1]);
  return new ApiError(500, "Algo falló del lado del servidor. Probá de nuevo.");
}

export function authorizationHeader(req: VercelRequest): string | undefined {
  const value = req.headers.authorization;
  return Array.isArray(value) ? value[0] : value;
}

export function requireAuthorization(req: VercelRequest): string {
  const authorization = authorizationHeader(req);
  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError(401, "Tu sesión venció. Volvé a entrar.");
  }
  return authorization;
}

export function jsonBody(req: VercelRequest): Record<string, unknown> {
  let body: unknown = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      throw new ApiError(400, "Solicitud inválida");
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "Solicitud inválida");
  }
  return body as Record<string, unknown>;
}

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Where links in invitation and recovery emails point. Never taken from an arbitrary
 * Origin header: production requires APP_URL (fails closed without it); elsewhere only
 * APP_URL or a local dev origin is accepted.
 */
export function requestOrigin(
  req: VercelRequest,
  env: Record<string, string | undefined> = process.env
): string | undefined {
  const configured = env.APP_URL?.replace(/\/$/, "") || undefined;
  if (env.VERCEL_ENV === "production") {
    if (!configured) {
      throw new ApiError(500, "Falta configurar la dirección de la app (APP_URL).");
    }
    return configured;
  }
  const header = req.headers.origin;
  const origin = Array.isArray(header) ? header[0] : header;
  if (origin && (origin === configured || LOCAL_ORIGIN.test(origin))) return origin;
  return configured;
}

// Wraps a handler: POST only, ApiError -> its status and message, anything else -> 500.
export function postHandler(
  name: string,
  handle: (req: VercelRequest) => Promise<{ status: number; body?: unknown }>
) {
  return async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).json({ error: "Método no permitido" });
      return;
    }
    try {
      const result = await handle(req);
      if (result.body === undefined) res.status(result.status).end();
      else res.status(result.status).json(result.body);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      console.error(`${name} API error`, error);
      res.status(500).json({ error: "Algo falló del lado del servidor. Probá de nuevo." });
    }
  };
}
