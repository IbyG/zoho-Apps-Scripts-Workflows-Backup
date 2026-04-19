/** Supported tokens: `{{date}}` (YYYY-MM-DD), `{{displayName}}`. */
export function formatSystemZipFilename(pattern: string, displayName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const trimmed = pattern.trim();
  const resolved = trimmed
    ? trimmed
        .replace(/\{\{date\}\}/g, date)
        .replace(/\{\{displayName\}\}/g, displayName)
    : `${displayName}-export-${date}.zip`;
  return /\.zip$/i.test(resolved) ? resolved : `${resolved}.zip`;
}

/**
 * CRM export ZIP names. Tokens: `{{date}}`, `{{displayName}}`, `{{exportTypes}}`
 * (`exportTypeLabels` joined with `-`, e.g. `Functions-Workflows`).
 * Default when the pattern is blank: `{{displayName}}-{{exportTypes}}-Export-{{date}}.zip`
 * (e.g. `Zoho CRM-Functions-Workflows-Export-2026-04-19.zip`).
 */
export function formatCrmExportZipFilename(
  pattern: string,
  displayName: string,
  exportTypeLabels: string[],
): string {
  const date = new Date().toISOString().slice(0, 10);
  const exportTypes =
    exportTypeLabels.length > 0 ? exportTypeLabels.join("-") : "Export";
  const trimmed = pattern.trim();
  const resolved = trimmed
    ? trimmed
        .replace(/\{\{date\}\}/g, date)
        .replace(/\{\{displayName\}\}/g, displayName)
        .replace(/\{\{exportTypes\}\}/g, exportTypes)
    : `${displayName}-${exportTypes}-Export-${date}.zip`;
  return /\.zip$/i.test(resolved) ? resolved : `${resolved}.zip`;
}
