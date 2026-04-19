import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import JSZip from 'jszip';
import {
  normalizeCrmCredentials,
  fetchAllCrmWorkflowRules,
  buildCrmHeaders,
} from './validateCrmSession.mjs';

const require = createRequire(import.meta.url);
const beautify = require('js-beautify').js;

/**
 * @param {string} s
 */
function sanitizeFileSegment(s) {
  return String(s || 'unknown')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

/** @param {string | undefined} apiName */
function prettyFieldLabel(apiName) {
  if (!apiName || typeof apiName !== 'string') return 'Field';
  return apiName.replace(/_/g, ' ');
}

/** @param {unknown} v */
function formatCriteriaValue(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') {
    if (v === '${ANYVALUE}') return 'any value';
    return v;
  }
  if (Array.isArray(v)) {
    return v.map((x) => formatCriteriaValue(x)).join(', ');
  }
  return String(v);
}

/** @param {string | undefined} comp */
function comparatorToWords(comp) {
  const c = String(comp || '');
  const map = {
    equal: 'is',
    not_equal: 'is not',
    contains: 'contains',
    not_contains: 'does not contain',
    starts_with: 'starts with',
    ends_with: 'ends with',
    greater_than: 'is greater than',
    less_than: 'is less than',
    greater_equal: 'is greater than or equal to',
    less_equal: 'is less than or equal to',
    is_empty: 'is empty',
    is_not_empty: 'is not empty',
    '${ANYVALUE}': 'changes to',
  };
  return map[c] || c.replace(/_/g, ' ');
}

/**
 * @param {unknown} crit
 * @returns {string}
 */
function formatOneCriterion(crit) {
  if (!crit || typeof crit !== 'object') return '';
  const o = /** @type {Record<string, unknown>} */ (crit);
  if (Array.isArray(o.group) && o.group.length) {
    const inner = o.group.map((sub) => formatOneCriterion(sub)).filter(Boolean);
    const joiner = o.group_operator === 'OR' ? ' OR ' : ' AND ';
    return inner.length ? `(${inner.join(joiner)})` : '';
  }
  const field = prettyFieldLabel(
    /** @type {{ api_name?: string }} */ (o.field)?.api_name,
  );
  const comp = comparatorToWords(/** @type {string} */ (o.comparator));
  const valRaw = o.value;
  const val = formatCriteriaValue(valRaw);
  if (o.comparator === 'is_empty' || o.comparator === 'is_not_empty') {
    return `${field} ${comp}`;
  }
  return val ? `${field} ${comp} ${val}` : `${field} ${comp}`;
}

/**
 * @param {unknown} criteria
 * @returns {string[]}
 */
function linesForCriteriaDetails(criteria) {
  if (criteria === null || criteria === undefined) {
    return ['(No filter — whenever the trigger above runs, this branch is evaluated.)'];
  }
  if (typeof criteria !== 'object') {
    return [String(criteria)];
  }
  const c = /** @type {Record<string, unknown>} */ (criteria);
  if (Array.isArray(c.group) && c.group.length) {
    const op = c.group_operator === 'OR' ? 'OR' : 'AND';
    const parts = c.group.map((item) => formatOneCriterion(item)).filter(Boolean);
    if (!parts.length) return ['(Empty condition group)'];
    if (parts.length === 1) return [parts[0]];
    return [`${parts.join(` ${op} `)}`];
  }
  const line = formatOneCriterion(criteria);
  return line ? [line] : ['(Unrecognized criteria — see JSON export.)'];
}

const ACTION_TYPE_LABEL = {
  field_updates: 'Field update',
  email_notifications: 'Email notification',
  tasks: 'Task',
  webhooks: 'Webhook',
  functions: 'Custom function',
};

/**
 * @param {unknown} actionsBlock
 * @returns {{ instant: { type: string, name: string }[] }}
 */
function collectActions(actionsBlock) {
  const instant = [];
  if (!actionsBlock || typeof actionsBlock !== 'object') {
    return { instant };
  }
  const ab = /** @type {Record<string, unknown>} */ (actionsBlock);
  const inst = ab.actions;
  if (Array.isArray(inst)) {
    for (const a of inst) {
      if (!a || typeof a !== 'object') continue;
      const t = /** @type {{ type?: string, name?: string }} */ (a).type || 'action';
      const n = /** @type {{ type?: string, name?: string }} */ (a).name || '(unnamed)';
      instant.push({ type: t, name: n });
    }
  }
  return { instant };
}

/**
 * @param {unknown} rule
 */
function linesForExecuteWhen(rule) {
  const ew = rule?.execute_when;
  if (!ew || typeof ew !== 'object') {
    return ['(Trigger details missing — see JSON export.)'];
  }
  const type = ew.type;
  const d = ew.details && typeof ew.details === 'object' ? ew.details : {};
  const mod =
    d.trigger_module?.api_name ||
    rule.module?.api_name ||
    rule.module?.apiName ||
    'this module';

  if (type === 'create') {
    return [`This rule runs when a new record is created in ${mod}.`];
  }
  if (type === 'edit') {
    const rep = d.repeat === true ? ' (runs on every edit / save as configured)' : '';
    return [`This rule runs when a record is edited in ${mod}.${rep}`];
  }
  if (type === 'delete') {
    return [`This rule runs when a record is deleted from ${mod}.`];
  }
  if (type === 'create_or_edit') {
    const rep = d.repeat === true ? ' May run on each save as configured.' : '';
    return [
      `This rule runs when a record is created or edited in ${mod}.${rep}`,
    ];
  }
  if (type === 'field_update') {
    const crit = d.criteria;
    const fieldApi =
      crit && typeof crit === 'object' ? crit.field?.api_name : undefined;
    const field = prettyFieldLabel(fieldApi);
    const comp = crit?.comparator;
    const valRaw = crit?.value;
    if (comp === '${ANYVALUE}' || valRaw === '${ANYVALUE}') {
      return [
        `This rule runs when ${field} is modified to any value.`,
      ];
    }
    const val = formatCriteriaValue(valRaw);
    return [
      `This rule runs when ${field} is modified${val ? ` (${comparatorToWords(comp)} ${val})` : ''}.`,
    ];
  }
  if (type === 'date_or_datetime') {
    const field = prettyFieldLabel(d.field?.api_name);
    const unit = typeof d.unit === 'number' ? d.unit : null;
    const period = d.period != null ? String(d.period) : 'units';
    const when =
      unit === null
        ? 'on a date/time schedule'
        : unit < 0
          ? `${Math.abs(unit)} ${period} before ${field}`
          : `${unit} ${period} after ${field}`;
    const at = d.execute_at ? ` at ${d.execute_at}` : '';
    const recur = d.recur_cycle ? ` (${d.recur_cycle})` : '';
    return [
      `Scheduled relative to ${field}: ${when}${at}${recur}.`,
      `Applies to records in ${mod}.`,
    ];
  }
  return [
    `Trigger type: ${String(type)}`,
    `Module: ${mod}`,
    '(See JSON export for full trigger details.)',
  ];
}

/**
 * Plain-language summary similar to the Zoho CRM workflow UI (WHEN / CONDITION / ACTIONS).
 * @param {object} rule
 */
export function workflowRuleToFriendlyText(rule) {
  const lines = [];
  const name = rule.name ?? '(unnamed rule)';
  const mod = rule.module?.api_name ?? rule.module?.apiName ?? '?';
  const desc = rule.description;
  const active = rule.status?.active !== false;

  lines.push('Zoho CRM — Workflow rule');
  lines.push('═'.repeat(56));
  lines.push('');
  lines.push(`Name:        ${name}`);
  lines.push(`Module:      @ ${mod}`);
  if (desc) lines.push(`Description: ${desc}`);
  lines.push(`Status:      ${active ? 'Active' : 'Inactive'}`);
  lines.push(`Rule ID:     ${rule.id ?? '—'}`);
  lines.push('');
  lines.push('─'.repeat(56));
  lines.push('WHEN');
  lines.push('─'.repeat(56));
  lines.push(...linesForExecuteWhen(rule));
  lines.push('');

  const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
  if (!conditions.length) {
    lines.push('─'.repeat(56));
    lines.push('CONDITION');
    lines.push('─'.repeat(56));
    lines.push('(No conditions defined.)');
    lines.push('');
  }

  conditions.forEach((cond, idx) => {
    const n = cond?.sequence_number ?? idx + 1;
    lines.push('─'.repeat(56));
    lines.push(`CONDITION ${n}`);
    lines.push('─'.repeat(56));
    const critLines = linesForCriteriaDetails(cond?.criteria_details?.criteria);
    critLines.forEach((ln, i) => {
      lines.push(`${i + 1}. ${ln}`);
    });
    const rel = cond?.criteria_details?.relational_criteria;
    if (
      rel &&
      typeof rel === 'object' &&
      rel.criteria != null &&
      rel.module
    ) {
      lines.push(
        `(Related module criteria present — see JSON for full relational rules.)`,
      );
    }
    lines.push('');
    lines.push('─'.repeat(56));
    lines.push(`ACTIONS (condition ${n})`);
    lines.push('─'.repeat(56));

    const { instant } = collectActions(cond?.instant_actions);

    /** @type {{ type: string, name: string }[]} */
    const scheduled = [];
    const schedRaw = cond?.scheduled_actions;
    if (schedRaw && typeof schedRaw === 'object' && schedRaw !== null) {
      const s = /** @type {Record<string, unknown>} */ (schedRaw);
      const sa = s.actions;
      if (Array.isArray(sa)) {
        for (const a of sa) {
          if (!a || typeof a !== 'object') continue;
          const t = /** @type {{ type?: string, name?: string }} */ (a).type || 'action';
          const n = /** @type {{ type?: string, name?: string }} */ (a).name || '(unnamed)';
          scheduled.push({ type: t, name: n });
        }
      }
    }

    lines.push('Instant actions:');
    if (!instant.length) {
      lines.push('  (none)');
    } else {
      for (const a of instant) {
        const label = ACTION_TYPE_LABEL[a.type] || a.type;
        lines.push(`  • ${label}: ${a.name}`);
      }
    }
    lines.push('');
    lines.push('Scheduled actions:');
    if (!scheduled.length) {
      lines.push('  (none)');
    } else {
      for (const a of scheduled) {
        const label = ACTION_TYPE_LABEL[a.type] || a.type;
        lines.push(`  • ${label}: ${a.name}`);
      }
    }
    lines.push('');
  });

  lines.push('═'.repeat(56));
  lines.push('Tip: Open the matching .json file for the full API payload.');
  lines.push('');
  return lines.join('\n');
}

/**
 * @param {object} rule
 */
export function workflowRuleToReadableText(rule) {
  return workflowRuleToFriendlyText(rule);
}

/**
 * @param {string} base
 * @param {ReturnType<typeof normalizeCrmCredentials>} normalized
 * @param {object} listItem
 */
async function fetchWorkflowRuleDetail(base, normalized, listItem) {
  const id = listItem?.id;
  if (!id) return listItem;
  const url = `${base.replace(/\/$/, '')}/crm/v8/settings/automation/workflow_rules/${id}`;
  const headers = buildCrmHeaders(normalized);
  try {
    const res = await fetch(url, { method: 'GET', headers });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return listItem;
    }
    if (!res.ok) return listItem;
    if (data && data.status === 'error') return listItem;
    const rule =
      data.workflow_rules?.[0] ??
      data.workflow_rule ??
      (data.id === id ? data : null);
    if (rule && typeof rule === 'object' && rule.id) return rule;
    return listItem;
  } catch {
    return listItem;
  }
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 * @param {{ baseUrl?: string, perPage?: number }} [options]
 */
export async function collectCrmWorkflowsExport(creds, options = {}) {
  const normalized = normalizeCrmCredentials(creds);
  const { base, workflow_rules } = await fetchAllCrmWorkflowRules(
    normalized,
    options,
  );
  const details = workflow_rules.map((w) =>
    fetchWorkflowRuleDetail(base, normalized, w),
  );
  const rules = await Promise.all(details);
  const outJson = beautify(JSON.stringify(rules));
  return { rules, outJson, base };
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 * @param {string} [outDir]
 * @param {{ baseUrl?: string, perPage?: number }} [options]
 */
export async function writeCrmWorkflowsToFilesystem(
  creds,
  outDir = 'workflows',
  options = {},
) {
  const { rules, outJson } = await collectCrmWorkflowsExport(creds, options);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, '_AllWorkflows.json');
  fs.writeFileSync(jsonPath, outJson);
  console.log(`All Workflows > ${jsonPath}`);

  for (const w of rules) {
    if (!w || typeof w !== 'object' || !w.id) continue;
    const mod =
      w.module?.api_name ?? w.module?.apiName ?? 'UnknownModule';
    const baseName = `${sanitizeFileSegment(mod)}-${sanitizeFileSegment(w.name)}-${w.id}.json`;
    const fileName = path.join(outDir, baseName);
    const txtName = fileName.replace(/\.json$/i, '.txt');
    const body = beautify(JSON.stringify(w));
    const readable = workflowRuleToReadableText(w);
    try {
      fs.writeFileSync(fileName, body);
      fs.writeFileSync(txtName, readable);
      console.log(`${w.name} > ${fileName}`);
      console.log(`${w.name} > ${txtName}`);
    } catch (err) {
      console.log(err);
    }
  }
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 * @param {{ baseUrl?: string, perPage?: number }} [options]
 * @returns {Promise<Buffer>}
 */
export async function buildCrmWorkflowsZipBuffer(creds, options = {}) {
  const { rules, outJson } = await collectCrmWorkflowsExport(creds, options);
  const zip = new JSZip();
  const folder = zip.folder('workflows');
  if (!folder) throw new Error('Could not create ZIP folder');
  folder.file('_AllWorkflows.json', outJson);

  for (const w of rules) {
    if (!w || typeof w !== 'object' || !w.id) continue;
    const mod =
      w.module?.api_name ?? w.module?.apiName ?? 'UnknownModule';
    const baseName = `${sanitizeFileSegment(mod)}-${sanitizeFileSegment(w.name)}-${w.id}.json`;
    const body = beautify(JSON.stringify(w));
    const txtBaseName = baseName.replace(/\.json$/i, '.txt');
    folder.file(baseName, body);
    folder.file(txtBaseName, workflowRuleToReadableText(w));
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
