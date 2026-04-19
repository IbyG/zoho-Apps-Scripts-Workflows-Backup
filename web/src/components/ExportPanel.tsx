import { useState } from "react";
import { design, jobKey } from "../design";
import { useAppState } from "../context/AppStateContext";

const { globalControls, systems, primaryAction } = design.rightPanel;

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
    selectedJobs,
    toggleJob,
    selectAllAvailable,
    clearSelection,
    canDownload,
    sessionValidation,
  } = useAppState();

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

  const handleDownload = () => {
    if (!canDownload) return;
    // Backend integration later — surface intent only
    alert(
      "Download will request one ZIP per system with selected exports. Wiring comes next.",
    );
  };

  return (
    <section className="panel" aria-labelledby="export-heading">
      <h2 id="export-heading" className="panel__heading">
        What to download
      </h2>
      <p className="panel__sub">
        Choose products and data types. Each system produces a single ZIP that
        bundles everything you select for that product.
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
                                title="Included in ZIP when selected"
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
            : "Download runs one job per system; only available export types are included."}
        </p>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canDownload}
          onClick={handleDownload}
        >
          {primaryAction.label}
        </button>
      </div>
    </section>
  );
}
