/** Zoho CRM often rejects requests without a real browser User-Agent (see Bruno / Network tab). */
export const DEFAULT_CRM_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

/** Maps CROSSCDNCOUNTRY (from your Cookie header) to the CRM web app host. */
const DC_CR_WEB = {
  AU: 'https://crm.zoho.com.au',
  EU: 'https://crm.zoho.eu',
  IN: 'https://crm.zoho.in',
  JP: 'https://crm.zoho.jp',
  CN: 'https://crm.zoho.com.cn',
  US: 'https://crm.zoho.com',
  CA: 'https://crm.zohocloud.ca',
};

/** Public API host for the same DC (used as fallback when crm.* returns INVALID_REQUEST). */
const DC_ZOHOAPIS = {
  AU: 'https://www.zohoapis.com.au',
  EU: 'https://www.zohoapis.eu',
  IN: 'https://www.zohoapis.in',
  JP: 'https://www.zohoapis.jp',
  CN: 'https://www.zohoapis.com.cn',
  US: 'https://www.zohoapis.com',
  // CA DC: use US API host unless Zoho documents a dedicated zohoapis CA domain.
  CA: 'https://www.zohoapis.com',
};

function getDcCode(cookie) {
  if (!cookie || typeof cookie !== 'string') return 'US';
  const m = /(?:^|;\s*)CROSSCDNCOUNTRY=([^;]+)/i.exec(cookie);
  return m ? m[1].trim().toUpperCase() : 'US';
}

/**
 * @param {string} cookie
 * @returns {string} Web CRM origin (e.g. https://crm.zoho.com.au)
 */
export function resolveCrmWebBaseUrlFromCookie(cookie) {
  const code = getDcCode(cookie);
  return DC_CR_WEB[code] ?? 'https://crm.zoho.com';
}

export function resolveZohoApisBaseFromCookie(cookie) {
  const code = getDcCode(cookie);
  return DC_ZOHOAPIS[code] ?? 'https://www.zohoapis.com';
}

/**
 * @param {string} orgId numeric org / x-crm-org value
 */
export function candidateFunctionListPaths(orgId) {
  const qPaged = 'type=org&start=1&limit=200';
  return [
    '/crm/v2/settings/functions?type=org',
    `/crm/v2/settings/functions?source=crm&${qPaged}`,
    `/crm/v2/settings/functions?${qPaged}&source=crm`,
    `/crm/org${orgId}/v2/settings/functions?${qPaged}`,
    `/crm/v2/settings/functions?${qPaged}`,
  ];
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 */
export function normalizeCrmCredentials(creds) {
  const cookie = creds.cookie.replace(/\s+/g, ' ').trim();
  let xZcsrfToken = creds.xZcsrfToken.trim();
  if (xZcsrfToken && !/^crmcsrfparam=/i.test(xZcsrfToken)) {
    xZcsrfToken = `crmcsrfparam=${xZcsrfToken}`;
  }
  return {
    xCrmOrg: creds.xCrmOrg.trim(),
    xZcsrfToken,
    cookie,
  };
}

export function buildCrmHeaders(normalized) {
  /** Match a minimal Bruno-style request: Cookie, x-zcsrf-token, x-crm-org, User-Agent. */
  return {
    accept: 'application/json',
    'x-crm-org': normalized.xCrmOrg,
    'x-zcsrf-token': normalized.xZcsrfToken,
    cookie: normalized.cookie,
    'user-agent': DEFAULT_CRM_USER_AGENT,
  };
}

function functionsListSuccess(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.functions) &&
    data.status !== 'error'
  );
}

/**
 * Resolves the CRM / zohoapis host and returns the first successful functions list payload.
 *
 * @param {ReturnType<typeof normalizeCrmCredentials>} normalized
 * @param {{ baseUrl?: string }} [options]
 * @returns {Promise<{ base: string, data: object }>}
 */
export async function fetchCrmFunctionsList(normalized, options = {}) {
  const crmWebBase = (
    options.baseUrl || resolveCrmWebBaseUrlFromCookie(normalized.cookie)
  ).replace(/\/$/, '');
  const apisBase = resolveZohoApisBaseFromCookie(normalized.cookie).replace(
    /\/$/,
    '',
  );

  /** Web CRM first (cookie session); then DC API host if different (AU/EU often need zohoapis.*). */
  const uniqueBases = options.baseUrl
    ? [crmWebBase]
    : [...new Set([crmWebBase, apisBase])];

  const orgId = normalized.xCrmOrg;
  const paths = candidateFunctionListPaths(orgId);

  let lastErr = /** @type {Error & { detail?: unknown; crmBaseUrl?: string }} */ (
    new Error('No validation attempts')
  );

  for (const base of uniqueBases) {
    const headers = buildCrmHeaders(normalized);
    for (const path of paths) {
      const url = `${base.replace(/\/$/, '')}${path}`;
      try {
        const res = await fetch(url, { method: 'GET', headers });
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }

        if (!res.ok) {
          const err = new Error(`Authentication Failed (${res.status})`);
          err.detail = data || text;
          err.crmBaseUrl = base;
          err.attemptUrl = url;
          lastErr = err;
          continue;
        }

        if (data && data.status === 'error') {
          const err = new Error(data.message || 'API returned status error');
          err.detail = data;
          err.crmBaseUrl = base;
          err.attemptUrl = url;
          lastErr = err;
          continue;
        }

        if (functionsListSuccess(data)) {
          return { base, data };
        }

        const err = new Error('Unexpected response from CRM');
        err.detail = data || text;
        err.crmBaseUrl = base;
        err.attemptUrl = url;
        lastErr = err;
      } catch (e) {
        const err = /** @type {Error & { detail?: unknown; attemptUrl?: string }} */ (
          e instanceof Error ? e : new Error(String(e))
        );
        err.crmBaseUrl = base;
        err.attemptUrl = `${base.replace(/\/$/, '')}${path}`;
        lastErr = err;
      }
    }
  }

  throw lastErr;
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 * @param {{ baseUrl?: string }} [options]
 */
export async function validateCrmSession(creds, options = {}) {
  const normalized = normalizeCrmCredentials(creds);
  await fetchCrmFunctionsList(normalized, options);
}
