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
 * Per-system export ZIP names (CRM, Books, etc.). Tokens: `{{date}}`, `{{displayName}}`, `{{exportTypes}}`
 * (`exportTypeLabels` joined with `-`, e.g. `Functions` or `Functions-Workflows`).
 * Default when the pattern is blank: `{{displayName}}-{{exportTypes}}-Export-{{date}}.zip`
 */
function formatSystemExportZipFilename(
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

/** @see formatSystemExportZipFilename */
export function formatCrmExportZipFilename(
  pattern: string,
  displayName: string,
  exportTypeLabels: string[],
): string {
  return formatSystemExportZipFilename(pattern, displayName, exportTypeLabels);
}

/** @see formatSystemExportZipFilename */
export function formatBooksExportZipFilename(
  pattern: string,
  displayName: string,
  exportTypeLabels: string[],
): string {
  return formatSystemExportZipFilename(pattern, displayName, exportTypeLabels);
}
