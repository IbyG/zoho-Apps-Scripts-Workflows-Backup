import { useState } from "react";
import { design, jobKey } from "../design";
import { useAppState } from "../context/AppStateContext";
import { cleanseCredentials } from "../utils/cleanseCredentials";
import {
  formatBooksExportZipFilename,
  formatCrmExportZipFilename,
} from "../utils/formatZipFilename";

const { globalControls, systems, primaryAction } = design.rightPanel;

function buildExportTasks(
  selectedKeys: Set<string>,
  zipPatterns: { crm: string; books: string },
): Array<{ jobKey: string; apiPath: string; zipFilename: string }> {
  const tasks: Array<{ jobKey: string; apiPath: string; zipFilename: string }> =
    [];
  for (const sys of design.rightPanel.systems) {
    for (const job of sys.jobs) {
      if (job.implementation !== "available") continue;
      const key = jobKey(sys.id, job.id);
      if (!selectedKeys.has(key)) continue;
      if (sys.id === "crm") {
        tasks.push({
          jobKey: key,
          apiPath: "/api/crm-export",
          zipFilename: formatCrmExportZipFilename(
            zipPatterns.crm,
            sys.displayName,
            [job.userLabel],
          ),
        });
      } else if (sys.id === "books") {
        tasks.push({
          jobKey: key,
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

function ChevronIcon() {
  return (
    <svg
      className="system-block__chevron-svg"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
    >
      <path
        d="M2.5 4.25L6 7.75L9.5 4.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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

  const [openBySystemId, setOpenBySystemId] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const s of systems) {
      initial[s.id] = true;
    }
    return initial;
  });

  const sessionReady = sessionValidation.status === "success";

  const toggleSystemSection = (systemId: string) => {
    setOpenBySystemId((prev) => ({
      ...prev,
      [systemId]: !prev[systemId],
    }));
  };

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

  return (
    <section className="panel" aria-labelledby="export-heading">
      <h2 id="export-heading" className="panel__heading">
        What to download
      </h2>
      <p className="panel__sub">
        Choose products and data types. Each selected export downloads as its own
        ZIP file.
      </p>

      <div className="toolbar">
        {globalControls.map((c) => (
          <button
            key={c.id}
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              if (c.id === "selectAllAvailable") selectAllAvailable();
              if (c.id === "clearSelection") clearSelection();
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {systems.map((sys) => {
        const isOpen = openBySystemId[sys.id] ?? true;
        const headingId = `system-heading-${sys.id}`;
        const panelId = `system-panel-${sys.id}`;

        return (
          <div key={sys.id} className="system-block">
            <button
              type="button"
              className="system-block__toggle"
              id={headingId}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggleSystemSection(sys.id)}
            >
              <span
                className="system-block__chevron"
                aria-hidden
              >
                <ChevronIcon />
              </span>
              <span className="system-block__title">{sys.displayName}</span>
            </button>
            <div
              id={panelId}
              className="system-block__panel"
              role="region"
              aria-labelledby={headingId}
              hidden={!isOpen}
            >
              <fieldset>
                <legend>{sys.displayName} exports</legend>
                <div className="job-grid">
                  {sys.jobs.map((job) => {
                    const key = jobKey(sys.id, job.id);
                    const isAvailable = job.implementation === "available";
                    const checked = selectedJobs.has(key);

                    return (
                      <div key={key} className="job-row">
                        <div>
                          <div className="job-row__label">{job.userLabel}</div>
                        </div>
                        <div className="job-row__actions">
                          {isAvailable ? (
                            <>
                              <span
                                className="pill-tag pill-tag--ok"
                                title="Downloads as its own ZIP when selected"
                              >
                                Available
                              </span>
                              <input
                                type="checkbox"
                                className="checkbox"
                                checked={checked}
                                aria-label={`${job.userLabel} for ${sys.displayName}`}
                                onChange={(e) => toggleJob(key, e.target.checked)}
                              />
                            </>
                          ) : (
                            <span className="pill-tag pill-tag--wait">In Development</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </div>
        );
      })}

      <div className="download-bar">
        <p className="download-bar__note">
          {!sessionReady
            ? "Validate your session to enable download. You can choose exports anytime."
            : "Each selected export type triggers a separate ZIP download."}
        </p>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canDownload || downloading}
          onClick={() => void handleDownload()}
        >
          {downloading ? "Downloading…" : primaryAction.label}
        </button>
      </div>
    </section>
  );
}
