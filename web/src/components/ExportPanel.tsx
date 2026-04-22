import { useState } from "react";
import { design, jobKey } from "../design";
import { useAppState } from "../context/AppStateContext";
import { cleanseCredentials } from "../utils/cleanseCredentials";
import {
  formatBooksExportZipFilename,
  formatCrmExportZipFilename,
} from "../utils/formatZipFilename";

const { globalControls, systems, primaryAction } = design.rightPanel;

const systemIcons: Record<string, string> = {
  crm: "hub",
  books: "account_balance",
  inventory: "inventory_2",
  campaigns: "campaign",
};

function systemIconFor(id: string): string {
  return systemIcons[id] ?? "package_2";
}

function systemCardTitle(displayName: string): string {
  return displayName.replace(/^Zoho\s+/i, "").trim() || displayName;
}

function buildExportTasks(
  selectedKeys: Set<string>,
  zipPatterns: { crm: string; books: string },
): Array<{ jobKey: string; apiPath: string; zipFilename: string }> {
  const tasks: Array<{ jobKey: string; apiPath: string; zipFilename: string }> =
    [];
  for (const sys of design.rightPanel.systems) {
    for (const job of sys.jobs) {
      if (job.implementation !== "available") continue;
      const k = jobKey(sys.id, job.id);
      if (!selectedKeys.has(k)) continue;
      if (sys.id === "crm") {
        tasks.push({
          jobKey: k,
          apiPath: "/api/crm-export",
          zipFilename: formatCrmExportZipFilename(
            zipPatterns.crm,
            sys.displayName,
            [job.userLabel],
          ),
        });
      } else if (sys.id === "books") {
        tasks.push({
          jobKey: k,
          apiPath: "/api/books-export",
          zipFilename: formatBooksExportZipFilename(
            zipPatterns.books,
            sys.displayName,
            [job.userLabel],
          ),
        });
      }
    }
  }
  return tasks;
}

export function ExportPanel() {
  const {
    credentials,
    selectedJobs,
    toggleJob,
    selectAllAvailable,
    clearSelection,
    canDownload,
    sessionValidation,
    zipPatterns,
  } = useAppState();

  const [downloading, setDownloading] = useState(false);
  const [failedCustomIcons, setFailedCustomIcons] = useState<Set<string>>(
    () => new Set(),
  );
  const sessionReady = sessionValidation.status === "success";

  const handleDownload = async () => {
    if (!canDownload || downloading) return;

    const creds = cleanseCredentials(credentials);
    const tasks = buildExportTasks(selectedJobs, zipPatterns);
    if (tasks.length === 0) {
      alert(
        "Select at least one available export (Zoho CRM and/or Zoho Books).",
      );
      return;
    }

    setDownloading(true);
    try {
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        const res = await fetch(t.apiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...creds,
            selectedJobs: [t.jobKey],
            zipFilename: t.zipFilename,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          if (res.status === 404) {
            alert(
              "Export API not found (404). Stop the dev server and run `npm run dev` again from the `web` folder so the latest server code (including /api/crm-export and /api/books-export) is loaded.",
            );
            return;
          }
          let msg = `Export failed (${res.status})`;
          try {
            const j = JSON.parse(text) as {
              error?: string;
              detail?: unknown;
              booksBaseUrl?: string;
              crmBaseUrl?: string;
            };
            if (j.error) msg = j.error;
            if (j.detail != null) {
              const detailStr =
                typeof j.detail === "string"
                  ? j.detail
                  : JSON.stringify(j.detail).slice(0, 400);
              msg = `${msg} — ${detailStr}`;
            }
          } catch {
            if (text.trim()) msg = text.slice(0, 500);
          }
          alert(msg);
          return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = t.zipFilename;
        a.click();
        URL.revokeObjectURL(url);

        if (i < tasks.length - 1) {
          await new Promise((r) => setTimeout(r, 450));
        }
      }
    } catch {
      alert(
        "Could not download the ZIP. Check that the dev server is running and try again.",
      );
    } finally {
      setDownloading(false);
    }
  };

  const exportTitle =
    !sessionReady
      ? "Validate your session to enable export"
      : !canDownload
        ? "Select at least one available export to download"
        : undefined;

  return (
    <>
      <section
        className="flex flex-col gap-6"
        aria-labelledby="data-contexts-heading"
      >
        <h3
          id="data-contexts-heading"
          className="px-2 font-headline text-xl font-bold text-slate-900"
        >
          Data Contexts
        </h3>

        <div className="mb-2 flex flex-wrap items-center gap-3 px-2">
          {globalControls.map((c) => (
            <button
              key={c.id}
              type="button"
              className="rounded-md border border-indigo-200/50 bg-secondary-container px-4 py-2 font-body text-xs font-semibold uppercase tracking-wider text-on-secondary-container shadow-sm transition-all hover:bg-indigo-200/80 active:scale-[0.98]"
              onClick={() => {
                if (c.id === "selectAllAvailable") selectAllAvailable();
                if (c.id === "clearSelection") clearSelection();
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {systems.map((sys) => {
            return (
              <div
                key={sys.id}
                className="flex flex-col gap-6 rounded-xl border border-slate-100 bg-white p-7 shadow-[0_4px_20px_-1px_rgba(0,0,0,0.02)] transition-shadow duration-300 hover:shadow-[0_15px_30px_-5px_rgba(30,35,46,0.08)]"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-50 text-primary">
                    {sys.iconPath && !failedCustomIcons.has(sys.id) ? (
                      <img
                        src={sys.iconPath}
                        alt={`${systemCardTitle(sys.displayName)} icon`}
                        className="h-7 w-7 object-contain"
                        onError={() =>
                          setFailedCustomIcons((prev) => {
                            const next = new Set(prev);
                            next.add(sys.id);
                            return next;
                          })
                        }
                      />
                    ) : (
                      <span
                        className="material-symbols-outlined text-2xl"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                        aria-hidden
                      >
                        {systemIconFor(sys.id)}
                      </span>
                    )}
                  </div>
                  <h4 className="font-headline text-lg font-bold text-slate-900">
                    {systemCardTitle(sys.displayName)}
                  </h4>
                </div>

                <div className="flex flex-grow flex-col gap-4 pt-2">
                  <fieldset className="m-0 min-w-0 border-0 p-0">
                    <legend className="sr-only">
                      {sys.displayName} exports
                    </legend>
                    {sys.jobs.map((job) => {
                      const k = jobKey(sys.id, job.id);
                      const isAvailable = job.implementation === "available";
                      const checked = selectedJobs.has(k);

                      return (
                        <div
                          key={k}
                          className="mb-3 flex min-w-0 items-center justify-between gap-2 last:mb-0"
                        >
                          <span
                            className={
                              isAvailable
                                ? "font-body text-sm font-medium text-slate-700"
                                : "font-body text-sm font-medium text-slate-500"
                            }
                          >
                            {job.userLabel}
                          </span>
                          <div className="flex shrink-0 items-center gap-3">
                            {isAvailable ? (
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-indigo-900 accent-primary focus:ring-indigo-900/20"
                                checked={checked}
                                aria-label={`${job.userLabel} for ${sys.displayName}`}
                                onChange={(e) => toggleJob(k, e.target.checked)}
                              />
                            ) : (
                              <span className="font-label rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-800">
                                In Development
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </fieldset>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 font-body text-base font-medium text-on-primary shadow-xl transition-all hover:bg-slate-800 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 sm:bottom-8 sm:right-8"
        title={exportTitle}
        disabled={!canDownload || downloading}
        onClick={() => void handleDownload()}
        aria-label={
          downloading ? "Exporting" : sessionReady ? "Export" : "Export disabled"
        }
      >
        <span className="material-symbols-outlined" aria-hidden>
          download
        </span>
        <span>
          {downloading ? "Downloading…" : primaryAction.label}
        </span>
      </button>
    </>
  );
}
