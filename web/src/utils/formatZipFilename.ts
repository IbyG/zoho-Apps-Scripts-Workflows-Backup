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
