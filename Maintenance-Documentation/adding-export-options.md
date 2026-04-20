# Adding a new export option (e.g. Zoho Books → Webhooks)

This document describes what you must change in the codebase when you add another row to **What to download**—either as a placeholder (**In Development**) or as a real, downloadable export.

## Concepts

- **Job key:** Every selectable row is identified by `{{systemId}}:{{jobId}}`, for example `books:webhooks`. The UI builds this with `jobKey(systemId, jobId)` in `web/src/design.ts`.
- **Single source of truth for the grid:** `web/Full-Design.json` → imported as `design` in `web/src/design.ts`. The export screen reads `design.rightPanel.systems[]` and renders one row per `jobs[]` entry.
- **Implementation drives behavior:**
  - `"available"` — checkbox, **Available** badge, included in **Select all available**, and eligible for Download (if session is valid).
  - `"waitlist"` — no checkbox; shows **In Development** (peach badge). Not downloaded until you switch it to `"available"` and wire the backend.

Types for jobs live in `web/src/design.ts` (`DesignJob`, `JobImplementation`). Keep JSON fields consistent with those types.

---

## Option A — UI-only placeholder (“In Development”)

Use this when the product name should appear in the app but there is no export script yet.

### 1. Edit `web/Full-Design.json`

1. Under the correct product in `rightPanel.systems`, add an object to `jobs` (sibling order controls display order).

   Required fields:

   | Field | Rule |
   |--------|------|
   | `id` | Stable machine id (lowercase, no spaces), e.g. `webhooks`. Becomes part of the job key: `books:webhooks`. |
   | `userLabel` | Text shown in the UI, e.g. `Webhooks`. |
   | `implementation` | Use `"waitlist"` for a non-downloadable row (renders as **In Development** in `web/src/components/ExportPanel.tsx`). |
   | `backendJobId` | Internal string, e.g. `books_webhooks`. Document-only until the job is implemented; keep it unique. |

   Optional but recommended for consistency with other waitlist rows:

   - `waitlistBehavior` — metadata for future “join waitlist” UX (`ui`, `primaryControl`, `secondaryCopy`, `blocksDownload`). The current UI does not render separate waitlist buttons; the row still appears as **In Development**.

2. Optionally add the new job key to `rightPanel.selectionModel.examples` (documentation / examples only).

### 2. No other code changes required

- `AppStateContext` discovers **available** jobs from `design` automatically; waitlist jobs are never pre-selected.
- `ExportPanel` already maps non-`available` jobs to **In Development**.
- `buildExportTasks` in `ExportPanel` skips anything that is not `implementation === "available"`, so no ZIP is requested for the new row.

### 3. Verify

From the `web/` directory: `npm run build`.

---

## Option B — Real export (checkbox + ZIP download)

Use this when users should be able to download data for the new type.

### 1. Edit `web/Full-Design.json`

1. Add or change the job under the right `rightPanel.systems[]` entry.
2. Set `"implementation": "available"`.
3. Set `userLabel` and `backendJobId` as in Option A.
4. Remove or omit `waitlistBehavior` (not used for available jobs).

### 2. Implement the export logic (Node)

- Add scripts under the right app folder, following existing patterns:
  - Zoho CRM → `crm/` (see `fetchAllFunctionsCore.mjs`, `fetchAllWorkflowsCore.mjs`).
  - Zoho Books → `books/` (see `fetchAllFunctionsCore.mjs`).
- Expose a function that returns a `Buffer` for a ZIP (or follow the same pattern as existing `build*ZipBuffer` functions).

### 3. Wire the Vite dev/preview API — `web/vite-plugin-crm-validate.ts`

The browser cannot send the real `Cookie` header; the dev server runs the export in Node.

Rules:

- **CRM exports** are handled by `crmExportHandler` on `/api/crm-export`. It inspects `selectedJobs` for keys like `crm:functions` and `crm:workflows`, and dispatches to the matching `buildCrm*ZipBuffer` helper. For a new CRM job, add a constant for the new job key, extend the `selectedJobs` checks, and call your new builder (one job per request matches the current “one ZIP per checkbox” behavior).
- **Books exports** are handled by `booksExportHandler` on `/api/books-export`. Today it only accepts `books:functions` alone. For an additional Books job you must extend the validation logic (which keys are allowed, one-at-a-time vs combined) and call the appropriate `buildBooks*ZipBuffer` (or new) function.

Keep error messages accurate when no valid job is selected.

### 4. UI and filenames

- `ExportPanel` → `buildExportTasks` routes CRM jobs to `/api/crm-export` and Books jobs to `/api/books-export` based on `sys.id`. No change is needed for a **new job under an existing system** (`crm` or `books`).
- ZIP names use `formatCrmExportZipFilename` / `formatBooksExportZipFilename` in `web/src/utils/formatZipFilename.ts`, with `job.userLabel` passed through from the selected job. New available jobs automatically affect `{{exportTypes}}` in the pattern when that job is selected.

### 5. Optional documentation in `web/Full-Design.json`

You can add an entry under `developerRegistry.example` describing `backendJobId` → script path. This is not read by the app; it is for maintainers only.

### 6. Verify

- `npm run build` in `web/`.
- Manual test: validate session, select only the new export, Download, confirm ZIP content.

---

## Adding a new Zoho *product* (new system row)

If you introduce a **new** `systems[]` entry (new `id`, e.g. `inventory`), you must do everything in Options A or B **plus**:

1. **`web/src/components/ExportPanel.tsx`** — In `buildExportTasks`, add a branch for the new `sys.id` with the correct `/api/...` path and zip filename helper (you may need a new `format*ExportZipFilename` or reuse `formatSystemExportZipFilename` with a new settings pattern).
2. **`web/vite-plugin-crm-validate.ts`** — Register a new middleware handler for the new API route, or extend an existing handler in a clear, documented way.
3. **`web/Full-Design.json` → `settingsPage`** — Add a ZIP name field for the new system if users should customize names (mirror `zipPattern.crm` / `zipPattern.books`).
4. **`web/src/context/AppStateContext.tsx`** — Extend stored `zipPatterns` and `SettingsPage.tsx` inputs if you add new pattern fields.

This is substantially more work than adding a job under CRM or Books alone.

---

## Quick checklist

| Goal | `Full-Design.json` (`jobs`) | Backend / Vite plugin |
|------|-----------------------------|-------------------------|
| Show **In Development** only | Add job with `implementation: "waitlist"` | None |
| Downloadable export | Add job with `implementation: "available"` | Implement ZIP builder + extend `crmExportHandler` or `booksExportHandler` |
| New product / system | New `systems[]` block + settings field | New API route + `buildExportTasks` + state for ZIP patterns |

---

## Files reference

| Area | File(s) |
|------|---------|
| Grid labels and job definitions | `web/Full-Design.json` |
| TypeScript types for `design` | `web/src/design.ts` |
| Export UI | `web/src/components/ExportPanel.tsx` |
| Selection state | `web/src/context/AppStateContext.tsx` |
| Dev server export APIs | `web/vite-plugin-crm-validate.ts` |
| ZIP name tokens | `web/src/utils/formatZipFilename.ts` |
| CRM / Books fetch logic | `crm/*.mjs`, `books/*.mjs` |
