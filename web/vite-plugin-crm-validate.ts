import type { Connect, Plugin } from "vite";
import { validateCrmSession } from "../crm/validateCrmSession.mjs";

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: string | Buffer) => {
      data += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/** Browsers refuse to set the `Cookie` header on fetch(); Node can, so we validate here. */
export function crmValidateApiPlugin(): Plugin {
  return {
    name: "crm-validate-api",
    configureServer(server) {
      server.middlewares.use(crmValidateHandler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(crmValidateHandler);
    },
  };
}

async function crmValidateHandler(
  req: Connect.IncomingMessage,
  res: {
    statusCode?: number;
    setHeader(name: string, value: string): void;
    end(chunk?: string): void;
  },
  next: Connect.NextFunction,
): Promise<void> {
  const pathOnly = req.url?.split("?")[0] ?? "";
  if (pathOnly !== "/api/crm-validate" || req.method !== "POST") {
    next();
    return;
  }

  try {
    const raw = await readBody(req);
    if (raw.length > 512_000) {
      res.statusCode = 413;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Body too large" }));
      return;
    }
    const body = JSON.parse(raw) as {
      xCrmOrg?: string;
      xZcsrfToken?: string;
      cookie?: string;
    };
    await validateCrmSession({
      xCrmOrg: String(body.xCrmOrg ?? ""),
      xZcsrfToken: String(body.xZcsrfToken ?? ""),
      cookie: String(body.cookie ?? ""),
    });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    const e = err as Error & { detail?: unknown; attemptUrl?: string };
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: false,
        error: e.message,
        detail: e.detail,
        crmBaseUrl: (e as { crmBaseUrl?: string }).crmBaseUrl,
        attemptUrl: e.attemptUrl,
      }),
    );
  }
}
