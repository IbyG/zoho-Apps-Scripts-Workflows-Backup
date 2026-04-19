export interface CredentialsFields {
  xCrmOrg: string;
  xZcsrfToken: string;
  cookie: string;
}

function cleanseCookieString(s: string): string {
  return s
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Normalizes pasted session fields (spaces, accidental newlines). */
export function cleanseCredentials(c: CredentialsFields): CredentialsFields {
  return {
    xCrmOrg: c.xCrmOrg.replace(/\s+/g, "").trim(),
    xZcsrfToken: c.xZcsrfToken.replace(/\s+/g, " ").trim(),
    cookie: cleanseCookieString(c.cookie),
  };
}

/** Cleanses only keys present in `patch` (for incremental `setCredentials` updates). */
export function cleanseCredentialsPatch(
  patch: Partial<CredentialsFields>,
): Partial<CredentialsFields> {
  const out: Partial<CredentialsFields> = {};
  if (patch.xCrmOrg !== undefined) {
    out.xCrmOrg = patch.xCrmOrg.replace(/\s+/g, "").trim();
  }
  if (patch.xZcsrfToken !== undefined) {
    out.xZcsrfToken = patch.xZcsrfToken.replace(/\s+/g, " ").trim();
  }
  if (patch.cookie !== undefined) {
    out.cookie = cleanseCookieString(patch.cookie);
  }
  return out;
}
