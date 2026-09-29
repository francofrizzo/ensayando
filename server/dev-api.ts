import type { IncomingMessage, ServerResponse } from "node:http";

import type { Plugin, ViteDevServer } from "vite";

// Dev only: serves the Vercel functions in api/*.ts from the Vite dev server, so
// `pnpm dev` can use /api/storage, /api/members and /api/content without `vercel dev`.
// The functions read their configuration from process.env (SUPABASE_URL or
// VITE_SUPABASE_URL, the anon key, SUPABASE_SERVICE_ROLE_KEY, R2_*); see docs/permissions.md.
export function devApi(env: Record<string, string>): Plugin {
  return {
    name: "ensayando-dev-api",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      for (const [key, value] of Object.entries(env)) process.env[key] ??= value;

      server.middlewares.use(async (req, res, next) => {
        const match = /^\/api\/([a-z-]+)(?:\?.*)?$/.exec(req.url ?? "");
        if (!match) return next();
        try {
          const module = (await server.ssrLoadModule(`/api/${match[1]}.ts`)) as {
            default: (req: unknown, res: unknown) => Promise<void>;
          };
          const body = await readBody(req);
          await module.default({ method: req.method, headers: req.headers, body }, vercelResponse(res));
        } catch (error) {
          server.config.logger.error(`[dev-api] ${String(error)}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Error en la función local" }));
          }
        }
      });
    }
  };
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function vercelResponse(res: ServerResponse) {
  const api = {
    setHeader(name: string, value: string) {
      res.setHeader(name, value);
      return api;
    },
    status(code: number) {
      res.statusCode = code;
      return api;
    },
    json(body: unknown) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
    },
    end() {
      res.end();
    }
  };
  return api;
}
