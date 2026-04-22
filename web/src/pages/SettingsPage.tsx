import { Link } from "react-router-dom";
import { design } from "../design";
import { useAppState } from "../context/AppStateContext";

const page = design.settingsPage;
const zipSection = page.sections.find((s) => s.id === "zipNames");

export function SettingsPage() {
  const { zipPatterns, setZipPatterns } = useAppState();

  if (!zipSection) return null;

  return (
    <div className="flex w-full max-w-3xl flex-col">
      <header className="mb-10">
        <p className="mb-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-on-surface-variant hover:text-primary"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden>
              arrow_back
            </span>
            Back
          </Link>
        </p>
        <h1 className="font-headline text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {page.title}
        </h1>
        <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-slate-600">
          Naming patterns only — session secrets are never stored here.
        </p>
      </header>

      <section
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_-1px_rgba(0,0,0,0.04)] sm:p-8"
        aria-labelledby="zip-settings-heading"
      >
        <h2
          id="zip-settings-heading"
          className="font-headline text-lg font-bold text-slate-900"
        >
          {zipSection.title}
        </h2>
        <p className="mb-6 mt-1 max-w-[60ch] text-sm text-slate-600">
          {zipSection.description}
        </p>

        {zipSection.fields.map((f) => (
          <div key={f.id} className="mb-5 flex flex-col gap-1.5 last:mb-0">
            <label
              className="font-label text-sm font-medium text-slate-700"
              htmlFor={f.id}
            >
              {f.label}
            </label>
            <input
              id={f.id}
              className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-900 focus:ring-1 focus:ring-indigo-900"
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
