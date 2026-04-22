import { design, type SessionValidationStatus } from "../design";
import { useAppState, type Credentials } from "../context/AppStateContext";

const intro = design.leftPanel.sharedCredentials.introCopy;
const fields = design.leftPanel.sharedCredentials.fields;
const validateAction = design.leftPanel.validation.actions[0];

const fieldPlaceholders: Record<string, string> = {
  xCrmOrg: "Enter org ID",
  xZcsrfToken: "Enter CSRF token",
  cookie: "Enter session cookie",
};

function contextBadge(status: SessionValidationStatus): {
  label: string;
  dotClass: string;
} {
  if (status === "loading")
    return { label: "Verifying", dotClass: "bg-amber-500" };
  if (status === "success")
    return { label: "Verified", dotClass: "bg-emerald-500" };
  return { label: "Unverified", dotClass: "bg-red-500" };
}

function fieldLabel(f: (typeof fields)[0]): string {
  return f.requestHeaderName === "Cookie"
    ? "COOKIE"
    : f.requestHeaderName.toUpperCase();
}

export function SessionPanel() {
  const { credentials, setCredentials, sessionValidation, validateSession } =
    useAppState();

  const busy = sessionValidation.status === "loading";
  const badge = contextBadge(sessionValidation.status);

  return (
    <section
      className="rounded-xl border border-slate-200 bg-slate-100/50 p-3 shadow-sm md:p-4"
      aria-labelledby="session-heading"
    >
      <div className="flex flex-col items-stretch justify-between gap-8 rounded-lg bg-white p-6 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.03)] sm:p-8 md:flex-row md:items-start">
        <div className="flex min-w-0 max-w-2xl flex-1 flex-col gap-2">
          <div className="mb-1 flex items-center gap-3">
            <span
              className="material-symbols-outlined text-primary text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
              aria-hidden
            >
              security
            </span>
            <h2
              id="session-heading"
              className="font-headline text-2xl font-bold tracking-tight text-slate-900"
            >
              Session Validation
            </h2>
          </div>
          <p className="font-body text-sm leading-relaxed text-slate-600">
            {intro}
          </p>

          <div className="mt-6 grid w-full grid-cols-1 gap-4 md:grid-cols-3">
            {fields.map((f) => (
              <div key={f.id} className="flex flex-col gap-1.5">
                <label
                  className="font-label text-[11px] font-bold uppercase tracking-wider text-slate-500"
                  htmlFor={f.id}
                >
                  {fieldLabel(f)}
                </label>
                <span id={`${f.id}-hint`} className="sr-only">
                  {f.userVisibleDescription}
                </span>
                {f.control === "textarea" && f.id !== "cookie" ? (
                  <textarea
                    id={f.id}
                    className="min-h-[5.5rem] resize-y rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-900 focus:ring-1 focus:ring-indigo-900"
                    rows={f.rows ?? 3}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={fieldPlaceholders[f.id] ?? "Paste value"}
                    aria-describedby={`${f.id}-hint`}
                    value={credentials[f.id as keyof Credentials]}
                    onChange={(e) =>
                      setCredentials({
                        [f.id]: e.target.value,
                      } as Partial<Credentials>)
                    }
                    />
                ) : (
                  <input
                    id={f.id}
                    className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-900 focus:ring-1 focus:ring-indigo-900"
                    type={f.control === "password-or-text" ? "password" : "text"}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={fieldPlaceholders[f.id] ?? "Paste value"}
                    aria-describedby={`${f.id}-hint`}
                    value={credentials[f.id as keyof Credentials]}
                    onChange={(e) =>
                      setCredentials({
                        [f.id]: e.target.value,
                      } as Partial<Credentials>)
                    }
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="font-label text-xs font-semibold uppercase tracking-widest text-slate-500">
              Current Context:
            </span>
            <div className="flex items-center gap-2 rounded-md bg-secondary-container px-3 py-1">
              <span
                className={`h-2 w-2 rounded-full ${badge.dotClass}`}
                aria-hidden
              />
              <span className="font-body text-xs font-medium text-on-secondary-container">
                {badge.label}
              </span>
            </div>
          </div>

          {(sessionValidation.status === "loading" ||
            sessionValidation.status === "error") && (
            <div
              className={`mt-4 rounded-lg p-3 text-sm leading-relaxed ${
                sessionValidation.status === "loading"
                  ? "bg-amber-50 text-slate-800"
                  : "bg-red-50 text-slate-800"
              }`}
              role="status"
            >
              {sessionValidation.status === "loading" &&
                "Checking your session…"}
              {sessionValidation.status === "success" && sessionValidation.message}
              {sessionValidation.status === "error" && sessionValidation.message}
              {sessionValidation.status === "error" && sessionValidation.errorHint && (
                <p className="mt-2 break-words text-xs text-slate-600">
                  {sessionValidation.errorHint}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 self-stretch md:self-center">
          <button
            type="button"
            className="w-full rounded-md bg-primary px-8 py-3.5 font-body text-sm font-medium text-on-primary shadow-md transition-all hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
            disabled={busy}
            onClick={() => void validateSession()}
          >
            {busy ? "Validating…" : validateAction.label}
          </button>
        </div>
      </div>
    </section>
  );
}
