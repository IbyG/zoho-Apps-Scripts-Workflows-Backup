import { design } from "../design";
import { useAppState, type Credentials } from "../context/AppStateContext";

const intro = design.leftPanel.sharedCredentials.introCopy;
const fields = design.leftPanel.sharedCredentials.fields;
const validateAction = design.leftPanel.validation.actions[0];

export function SessionPanel() {
  const { credentials, setCredentials, sessionValidation, validateSession } =
    useAppState();

  const busy = sessionValidation.status === "loading";

  return (
    <section className="panel" aria-labelledby="session-heading">
      <h2 id="session-heading" className="panel__heading">
        Session
      </h2>
      <p className="panel__sub">{intro}</p>

      {fields.map((f) => (
        <div key={f.id} className="field">
          <label className="field__label" htmlFor={f.id}>
            {f.label}
          </label>
          <span className="field__hint" id={`${f.id}-hint`}>
            {f.userVisibleDescription}
          </span>
          {f.control === "textarea" ? (
            <textarea
              id={f.id}
              className="textarea"
              rows={f.rows ?? 4}
              autoComplete="off"
              spellCheck={false}
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
              className="input"
              type={f.control === "password-or-text" ? "password" : "text"}
              autoComplete="off"
              spellCheck={false}
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

      <button
        type="button"
        className="btn btn--primary"
        disabled={busy}
        onClick={() => void validateSession()}
      >
        {busy ? "Validating…" : validateAction.label}
      </button>

      {sessionValidation.status !== "idle" && (
        <div
          className={`status-banner status-banner--${sessionValidation.status}`}
          role="status"
        >
          {sessionValidation.status === "loading" && "Checking your session…"}
          {sessionValidation.status === "success" && sessionValidation.message}
          {sessionValidation.status === "error" && sessionValidation.message}
        </div>
      )}
    </section>
  );
}
