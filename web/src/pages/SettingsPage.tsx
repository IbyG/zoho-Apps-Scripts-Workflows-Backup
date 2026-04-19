import { design } from "../design";
import { useAppState } from "../context/AppStateContext";

const page = design.settingsPage;
const zipSection = page.sections.find((s) => s.id === "zipNames");

export function SettingsPage() {
  const { zipPatterns, setZipPatterns } = useAppState();

  if (!zipSection) return null;

  return (
    <div>
      <header style={{ marginBottom: "var(--space-6)" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          {page.title}
        </h1>
        <p
          style={{
            margin: "var(--space-2) 0 0",
            fontSize: "15px",
            color: "var(--color-text-secondary)",
            maxWidth: "62ch",
          }}
        >
          Naming patterns only — session secrets are never stored here.
        </p>
      </header>

      <section
        className="panel settings-section"
        aria-labelledby="zip-settings-heading"
      >
        <h2 id="zip-settings-heading">{zipSection.title}</h2>
        <p>{zipSection.description}</p>

        {zipSection.fields.map((f) => (
          <div key={f.id} className="field">
            <label className="field__label" htmlFor={f.id}>
              {f.label}
            </label>
            <input
              id={f.id}
              className="input"
              placeholder={f.placeholder}
              value={f.systemId === "crm" ? zipPatterns.crm : zipPatterns.books}
              onChange={(e) =>
                f.systemId === "crm"
                  ? setZipPatterns({ crm: e.target.value })
                  : setZipPatterns({ books: e.target.value })
              }
              autoComplete="off"
            />
          </div>
        ))}
      </section>
    </div>
  );
}
