/** Zoho web apps (CRM, Books, …) often reject requests without a real browser User-Agent (see Bruno / Network tab). */
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

/** Maps CROSSCDNCOUNTRY (from your Cookie header) to the Books web app host. */
const DC_BOOKS_WEB = {
  AU: 'https://books.zoho.com.au',
  EU: 'https://books.zoho.eu',
  IN: 'https://books.zoho.in',
  JP: 'https://books.zoho.jp',
  CN: 'https://books.zoho.com.cn',
  US: 'https://books.zoho.com',
  CA: 'https://books.zohocloud.ca',
};

/**
 * @param {string} cookie
 * @returns {string} Web Books origin (e.g. https://books.zoho.com.au)
 */
export function resolveBooksWebBaseUrlFromCookie(cookie) {
  const code = getDcCode(cookie);
  return DC_BOOKS_WEB[code] ?? 'https://books.zoho.com';
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

/** Default page size for workflow rules list (v8 automation API). */
export const DEFAULT_WORKFLOW_RULES_PER_PAGE = 200;

/**
 * @param {string} orgId
 * @param {number} page
 * @param {number} perPage
 */
export function candidateWorkflowRulesListPaths(orgId, page, perPage) {
  const q = `page=${page}&per_page=${perPage}`;
  return [
    `/crm/v8/settings/automation/workflow_rules?${q}`,
    `/crm/org${orgId}/v8/settings/automation/workflow_rules?${q}`,
  ];
}

/** Default page size for schedules list (v9 automation API). */
export const DEFAULT_SCHEDULES_PER_PAGE = 50;

/**
 * @param {string} orgId
 * @param {number} page
 * @param {number} perPage
 */
export function candidateSchedulesListPaths(orgId, page, perPage) {
  const q = `page=${page}&per_page=${perPage}`;
  return [
    `/crm/v9/settings/automation/schedules?${q}`,
    `/crm/org${orgId}/v9/settings/automation/schedules?${q}`,
  ];
}

function workflowRulesListSuccess(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.workflow_rules) &&
    data.status !== 'error'
  );
}

function schedulesListSuccess(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.schedules) &&
    data.status !== 'error'
  );
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

function booksCustomFunctionsListPageSuccess(data) {
  return (
    data &&
    typeof data === 'object' &&
    data.code === 0 &&
    Array.isArray(data.customfunctions) &&
    data.page_context &&
    typeof data.page_context === 'object'
  );
}

const DEFAULT_BOOKS_CUSTOMFUNCTIONS_PER_PAGE = 50;

/**
 * Paginated Books custom functions list (same session headers as CRM — x-crm-org, x-zcsrf-token, cookie).
 *
 * @param {ReturnType<typeof normalizeCrmCredentials>} normalized
 * @param {{ baseUrl?: string, perPage?: number }} [options]
 * @returns {Promise<{ base: string, data: { customfunctions: object[] } }>}
 */
export async function fetchBooksFunctionsList(normalized, options = {}) {
  const base = (
    options.baseUrl || resolveBooksWebBaseUrlFromCookie(normalized.cookie)
  ).replace(/\/$/, '');
  const perPage = options.perPage ?? DEFAULT_BOOKS_CUSTOMFUNCTIONS_PER_PAGE;

  /** @type {object[]} */
  const customfunctions = [];
  let page = 1;

  while (true) {
    const q = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      filter_by: 'Entity.All',
      sort_column: 'created_time',
      sort_order: 'A',
      usestate: 'false',
    });
    const path = `/api/v3/integrations/customfunctions?${q.toString()}`;
    const attemptUrl = `${base}${path}`;
    const headers = buildCrmHeaders(normalized);

    try {
      const res = await fetch(attemptUrl, { method: 'GET', headers });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (!res.ok) {
        const err = new Error(`Books custom functions list failed (${res.status})`);
        err.detail = data || text;
        err.booksBaseUrl = base;
        err.attemptUrl = attemptUrl;
        throw err;
      }

      if (!booksCustomFunctionsListPageSuccess(data)) {
        const err = new Error(
          data?.message || 'Unexpected response from Books (custom functions list)',
        );
        err.detail = data || text;
        err.booksBaseUrl = base;
        err.attemptUrl = attemptUrl;
        throw err;
      }

      customfunctions.push(...(data.customfunctions || []));

      if (!data.page_context.has_more_page) {
        return { base, data: { customfunctions } };
      }
      page += 1;
    } catch (e) {
      const err = /** @type {Error & { detail?: unknown; attemptUrl?: string; booksBaseUrl?: string }} */ (
        e instanceof Error ? e : new Error(String(e))
      );
      err.booksBaseUrl = base;
      err.attemptUrl = attemptUrl;
      throw err;
    }
  }
}

/**
 * Fetches one page of workflow rules (v8 settings API).
 *
 * @param {ReturnType<typeof normalizeCrmCredentials>} normalized
 * @param {number} page
 * @param {number} perPage
 * @param {{ baseUrl?: string, base?: string, pathIndex?: number }} [options]
 *   When `base` is set (CRM origin from a prior successful page), only that host is used.
 *   Use `pathIndex` (0 or 1) to match the list URL shape from the first successful page.
 * @returns {Promise<{ base: string, data: object, pathIndex: number }>}
 */
export async function fetchCrmWorkflowRulesPage(
  normalized,
  page,
  perPage,
  options = {},
) {
  const orgId = normalized.xCrmOrg;
  const paths = candidateWorkflowRulesListPaths(orgId, page, perPage);
  const lockedPathIndex =
    typeof options.pathIndex === 'number' ? options.pathIndex : 0;

  if (options.base) {
    const base = options.base.replace(/\/$/, '');
    const headers = buildCrmHeaders(normalized);
    const path = paths[lockedPathIndex] ?? paths[0];
    const url = `${base}${path}`;
    const res = await fetch(url, { method: 'GET', headers });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = new Error(`Workflow rules request failed (${res.status})`);
      err.detail = data || text;
      err.crmBaseUrl = base;
      err.attemptUrl = url;
      throw err;
    }
    if (data && data.status === 'error') {
      const err = new Error(data.message || 'API returned status error');
      err.detail = data;
      err.crmBaseUrl = base;
      err.attemptUrl = url;
      throw err;
    }
    if (!workflowRulesListSuccess(data)) {
      const err = new Error('Unexpected response from CRM (workflow rules)');
      err.detail = data || text;
      err.crmBaseUrl = base;
      err.attemptUrl = url;
      throw err;
    }
    return { base, data, pathIndex: lockedPathIndex };
  }

  const crmWebBase = (
    options.baseUrl || resolveCrmWebBaseUrlFromCookie(normalized.cookie)
  ).replace(/\/$/, '');
  const apisBase = resolveZohoApisBaseFromCookie(normalized.cookie).replace(
    /\/$/,
    '',
  );
  const uniqueBases = options.baseUrl
    ? [crmWebBase]
    : [...new Set([crmWebBase, apisBase])];

  let lastErr = /** @type {Error & { detail?: unknown; crmBaseUrl?: string }} */ (
    new Error('No workflow rules fetch attempts')
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

        if (workflowRulesListSuccess(data)) {
          const pathIndex = paths.indexOf(path);
          return { base, data, pathIndex: pathIndex >= 0 ? pathIndex : 0 };
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
 * Walks all pages and returns every workflow rule row.
 *
 * @param {ReturnType<typeof normalizeCrmCredentials>} normalized
 * @param {{ baseUrl?: string, perPage?: number }} [options]
 * @returns {Promise<{ base: string, workflow_rules: object[], info?: object }>}
 */
export async function fetchAllCrmWorkflowRules(normalized, options = {}) {
  const perPage = options.perPage ?? DEFAULT_WORKFLOW_RULES_PER_PAGE;
  let base;
  /** @type {number | undefined} */
  let pathIndex;
  let page = 1;
  /** @type {object[]} */
  const workflow_rules = [];
  let lastInfo;

  while (true) {
    const { base: resolvedBase, data, pathIndex: resolvedPathIndex } =
      await fetchCrmWorkflowRulesPage(normalized, page, perPage, {
        ...options,
        base,
        pathIndex: base != null ? pathIndex : undefined,
      });
    base = resolvedBase;
    if (pathIndex === undefined) pathIndex = resolvedPathIndex;
    lastInfo = data.info;
    workflow_rules.push(...(data.workflow_rules || []));
    if (!data.info?.more_records) break;
    page += 1;
  }

  return { base, workflow_rules, info: lastInfo };
}

/**
 * Fetches one page of schedules (v9 settings API).
 *
 * @param {ReturnType<typeof normalizeCrmCredentials>} normalized
 * @param {number} page
 * @param {number} perPage
 * @param {{ baseUrl?: string, base?: string, pathIndex?: number }} [options]
 * @returns {Promise<{ base: string, data: object, pathIndex: number }>}
 */
export async function fetchCrmSchedulesPage(
  normalized,
  page,
  perPage,
  options = {},
) {
  const orgId = normalized.xCrmOrg;
  const paths = candidateSchedulesListPaths(orgId, page, perPage);
  const lockedPathIndex =
    typeof options.pathIndex === 'number' ? options.pathIndex : 0;

  if (options.base) {
    const base = options.base.replace(/\/$/, '');
    const headers = buildCrmHeaders(normalized);
    const path = paths[lockedPathIndex] ?? paths[0];
    const url = `${base}${path}`;
    const res = await fetch(url, { method: 'GET', headers });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = new Error(`Schedules request failed (${res.status})`);
      err.detail = data || text;
      err.crmBaseUrl = base;
      err.attemptUrl = url;
      throw err;
    }
    if (data && data.status === 'error') {
      const err = new Error(data.message || 'API returned status error');
      err.detail = data;
      err.crmBaseUrl = base;
      err.attemptUrl = url;
      throw err;
    }
    if (!schedulesListSuccess(data)) {
      const err = new Error('Unexpected response from CRM (schedules)');
      err.detail = data || text;
      err.crmBaseUrl = base;
      err.attemptUrl = url;
      throw err;
    }
    return { base, data, pathIndex: lockedPathIndex };
  }

  const crmWebBase = (
    options.baseUrl || resolveCrmWebBaseUrlFromCookie(normalized.cookie)
  ).replace(/\/$/, '');
  const apisBase = resolveZohoApisBaseFromCookie(normalized.cookie).replace(
    /\/$/,
    '',
  );
  const uniqueBases = options.baseUrl
    ? [crmWebBase]
    : [...new Set([crmWebBase, apisBase])];

  let lastErr = /** @type {Error & { detail?: unknown; crmBaseUrl?: string }} */ (
    new Error('No schedules fetch attempts')
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

        if (schedulesListSuccess(data)) {
          const pathIndex = paths.indexOf(path);
          return { base, data, pathIndex: pathIndex >= 0 ? pathIndex : 0 };
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
 * Walks all pages and returns every schedule row.
 *
 * @param {ReturnType<typeof normalizeCrmCredentials>} normalized
 * @param {{ baseUrl?: string, perPage?: number }} [options]
 * @returns {Promise<{ base: string, schedules: object[], info?: object }>}
 */
export async function fetchAllCrmSchedules(normalized, options = {}) {
  const perPage = options.perPage ?? DEFAULT_SCHEDULES_PER_PAGE;
  let base;
  /** @type {number | undefined} */
  let pathIndex;
  let page = 1;
  /** @type {object[]} */
  const schedules = [];
  let lastInfo;

  while (true) {
    const { base: resolvedBase, data, pathIndex: resolvedPathIndex } =
      await fetchCrmSchedulesPage(normalized, page, perPage, {
        ...options,
        base,
        pathIndex: base != null ? pathIndex : undefined,
      });
    base = resolvedBase;
    if (pathIndex === undefined) pathIndex = resolvedPathIndex;
    lastInfo = data.info;
    schedules.push(...(data.schedules || []));
    if (!data.info?.more_records) break;
    page += 1;
  }

  return { base, schedules, info: lastInfo };
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 * @param {{ baseUrl?: string }} [options]
 */
export async function validateCrmSession(creds, options = {}) {
  const normalized = normalizeCrmCredentials(creds);
  await fetchCrmFunctionsList(normalized, options);
}
