import type { Connect, Plugin } from "vite";
import { validateCrmSession } from "../crm/validateCrmSession.mjs";
import { buildCrmFunctionsZipBuffer } from "../crm/fetchAllFunctionsCore.mjs";

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

const CRM_FUNCTIONS_JOB_KEY = "crm:functions";

function safeAsciiFilename(name: string): string {
  const s = name.replace(/[^\w.\- ()]+/g, "-").replace(/-+/g, "-").trim();
  const base = s.slice(0, 180) || "zoho-crm-functions";
  return /\.zip$/i.test(base) ? base : `${base}.zip`;
}

/** Browsers refuse to set the `Cookie` header on fetch(); Node can, so we validate here. */
export function crmValidateApiPlugin(): Plugin {
  return {
    name: "crm-validate-api",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(crmExportFunctionsHandler);
      server.middlewares.use(crmValidateHandler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(crmExportFunctionsHandler);
      server.middlewares.use(crmValidateHandler);
    },
  };
}

async function crmExportFunctionsHandler(
  req: Connect.IncomingMessage,
  res: {
    statusCode?: number;
    setHeader(name: string, value: string): void;
    end(chunk?: string | Buffer): void;
  },
  next: Connect.NextFunction,
): Promise<void> {
  const pathOnly = req.url?.split("?")[0] ?? "";
  if (pathOnly !== "/api/crm-export-functions" || req.method !== "POST") {
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
      selectedJobs?: string[];
      zipFilename?: string;
    };
    const selectedJobs = Array.isArray(body.selectedJobs) ? body.selectedJobs : [];
    if (!selectedJobs.includes(CRM_FUNCTIONS_JOB_KEY)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: false,
          error: "CRM Functions export was not selected.",
        }),
      );
      return;
    }

    const creds = {
      xCrmOrg: String(body.xCrmOrg ?? ""),
      xZcsrfToken: String(body.xZcsrfToken ?? ""),
      cookie: String(body.cookie ?? ""),
    };
    if (!creds.xCrmOrg || !creds.xZcsrfToken || !creds.cookie) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Missing session credentials." }));
      return;
    }

    const buffer = await buildCrmFunctionsZipBuffer(creds);
    const filename = safeAsciiFilename(String(body.zipFilename ?? "zoho-crm-functions.zip"));
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.end(buffer);
  } catch (err) {
    const e = err as Error & { detail?: unknown; attemptUrl?: string; crmBaseUrl?: string };
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: false,
        error: e.message || "Export failed",
        detail: e.detail,
        crmBaseUrl: e.crmBaseUrl,
        attemptUrl: e.attemptUrl,
      }),
    );
  }
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
