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

/**
 * @param {unknown} v
 */
function scalarToText(v) {
  if (v === null) return 'null';
  if (v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  return JSON.stringify(v);
}

/**
 * Human-readable outline of a workflow rule object (not JSON syntax).
 * @param {unknown} val
 * @param {number} depth
 * @returns {string[]}
 */
function linesForReadableValue(val, depth) {
  const pad = '  '.repeat(depth);
  if (val === null) return [`${pad}null`];
  if (val === undefined) return [`${pad}`];
  const t = typeof val;
  if (t === 'string' || t === 'number' || t === 'boolean') {
    return [`${pad}${scalarToText(val)}`];
  }
  if (Array.isArray(val)) {
    const out = [];
    for (let i = 0; i < val.length; i++) {
      out.push(`${pad}[${i}]`);
      out.push(...linesForReadableValue(val[i], depth + 1));
    }
    return out;
  }
  if (t === 'object') {
    const out = [];
    for (const [k, v] of Object.entries(val)) {
      if (v !== null && typeof v === 'object') {
        out.push(`${pad}${k}:`);
        out.push(...linesForReadableValue(v, depth + 1));
      } else {
        out.push(`${pad}${k}: ${scalarToText(v)}`);
      }
    }
    return out;
  }
  return [`${pad}${String(val)}`];
}

/**
 * @param {object} rule
 */
export function workflowRuleToReadableText(rule) {
  const lines = [
    'Zoho CRM — Workflow rule',
    '—'.repeat(52),
    '',
    ...linesForReadableValue(rule, 0),
    '',
  ];
  return lines.join('\n');
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
