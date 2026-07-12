import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import JSZip from 'jszip';
import {
  normalizeCrmCredentials,
  fetchCrmClientScriptPages,
  fetchAllCrmClientScriptSnippets,
  fetchCrmClientScriptSnippetDetail,
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
    .slice(0, 120);
}

/** @param {string | null | undefined} v */
function fmt(v) {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

/**
 * @param {string} url
 * @param {ReturnType<typeof normalizeCrmCredentials>} normalized
 */
async function fetchSourceCode(url, normalized) {
  if (!url || typeof url !== 'string') return '';
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...buildCrmHeaders(normalized),
        accept: 'text/plain, application/javascript, */*',
      },
    });
    if (res.ok) return await res.text();
  } catch {
    // fall through to unauthenticated fetch
  }
  try {
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) return await res.text();
  } catch {
    return '';
  }
  return '';
}

/**
 * @param {object} snippet
 * @param {Map<string, object>} pagesByUuid
 */
function enrichSnippetWithPage(snippet, pagesByUuid) {
  const pageUuid = snippet?.cscript_page?.uuid;
  const page = pageUuid ? pagesByUuid.get(pageUuid) : null;
  return {
    ...snippet,
    cscript_page_detail: page ?? null,
  };
}

/**
 * @param {object} record
 */
export function clientScriptToReadableText(record) {
  const snippet = record?.snippet ?? record;
  const page = record?.cscript_page_detail ?? record?.cscript_page ?? null;
  const selectors = page?.selectors ?? {};
  const moduleName =
    selectors.Module?.value ?? selectors.Module?.id ?? '—';
  const layoutName =
    selectors.Layout?.value ?? selectors.Layout?.id ?? '—';
  const definitionName = page?.definition_name ?? snippet?.cscript_page?.definition_name ?? '—';
  const event = snippet?.script_event ?? {};
  const eventType = event.type ?? '—';
  const eventName = event.event ?? '—';
  const eventArgs = Array.isArray(event.arguments)
    ? event.arguments.join(', ')
    : '—';

  const lines = [];
  lines.push('Zoho CRM — Client Script');
  lines.push('═'.repeat(56));
  lines.push('');
  lines.push(`Name:                 ${fmt(snippet?.name)}`);
  lines.push(`Description:          ${fmt(snippet?.description)}`);
  lines.push(`Active:               ${fmt(snippet?.active)}`);
  lines.push(`Precedence:           ${fmt(snippet?.precedence)}`);
  lines.push(`Size (bytes):         ${fmt(snippet?.size)}`);
  lines.push(`Script ID:            ${fmt(snippet?.id)}`);
  lines.push(`Script UUID:          ${fmt(snippet?.uuid)}`);
  lines.push('');
  lines.push('─'.repeat(56));
  lines.push('Page context');
  lines.push('─'.repeat(56));
  lines.push(`Definition:           ${fmt(definitionName)}`);
  lines.push(`Module:               ${fmt(moduleName)}`);
  lines.push(`Layout:               ${fmt(layoutName)}`);
  lines.push(`Page UUID:            ${fmt(page?.uuid ?? snippet?.cscript_page?.uuid)}`);
  lines.push('');
  lines.push('─'.repeat(56));
  lines.push('Event');
  lines.push('─'.repeat(56));
  lines.push(`Type:                 ${fmt(eventType)}`);
  lines.push(`Event:                ${fmt(eventName)}`);
  lines.push(`Arguments:            ${fmt(eventArgs)}`);
  lines.push('');
  lines.push('─'.repeat(56));
  lines.push('Audit');
  lines.push('─'.repeat(56));
  lines.push(`Created Time:         ${fmt(snippet?.created_time)}`);
  lines.push(`Created By:           ${fmt(snippet?.created_by?.name)}`);
  lines.push(`Modified Time:        ${fmt(snippet?.modified_time)}`);
  lines.push(`Modified By:          ${fmt(snippet?.modified_by?.name)}`);
  lines.push('');
  if (record?.source_code) {
    lines.push('─'.repeat(56));
    lines.push('Source code');
    lines.push('─'.repeat(56));
    lines.push(record.source_code);
    lines.push('');
  }
  lines.push('═'.repeat(56));
  lines.push('Tip: Open the matching .json file for the full API payload.');
  lines.push('');
  return lines.join('\n');
}

/**
 * @param {object} record
 */
function baseNameForRecord(record) {
  const snippet = record?.snippet ?? record;
  const page = record?.cscript_page_detail ?? null;
  const selectors = page?.selectors ?? {};
  const moduleName = sanitizeFileSegment(
    selectors.Module?.value ?? selectors.Module?.id ?? 'Module',
  );
  const layoutName = sanitizeFileSegment(
    selectors.Layout?.value ?? selectors.Layout?.id ?? 'Layout',
  );
  const definitionName = sanitizeFileSegment(
    page?.definition_name ?? snippet?.cscript_page?.definition_name ?? 'page',
  );
  const scriptName = sanitizeFileSegment(snippet?.name ?? 'script');
  const id = snippet?.id ?? snippet?.uuid ?? 'unknown';
  return `${moduleName}-${layoutName}-${definitionName}-${scriptName}-${id}`;
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 * @param {{ baseUrl?: string }} [options]
 */
export async function collectCrmClientScriptsExport(creds, options = {}) {
  const normalized = normalizeCrmCredentials(creds);
  const { base, cscript_pages, configuration } = await fetchCrmClientScriptPages(
    normalized,
    options,
  );

  const pagesByUuid = new Map(
    cscript_pages
      .filter((p) => p && typeof p === 'object' && p.uuid)
      .map((p) => [p.uuid, p]),
  );

  const snippetRows = await fetchAllCrmClientScriptSnippets(
    normalized,
    base,
    cscript_pages,
  );

  const detailPromises = snippetRows.map(async (row) => {
    const uuid = row?.uuid;
    if (!uuid) return row;
    const detail = await fetchCrmClientScriptSnippetDetail(normalized, base, uuid);
    return detail ?? row;
  });
  const snippets = await Promise.all(detailPromises);

  const records = await Promise.all(
    snippets.map(async (snippet) => {
      const enriched = enrichSnippetWithPage(snippet, pagesByUuid);
      const sourceUrl = enriched.content?.source_code_url ?? '';
      const source_code = sourceUrl
        ? await fetchSourceCode(sourceUrl, normalized)
        : '';
      return {
        snippet: enriched,
        cscript_page_detail: enriched.cscript_page_detail,
        source_code,
      };
    }),
  );

  const exportPayload = {
    cscript_pages_configuration: configuration ?? null,
    cscript_pages,
    client_scripts: records.map((r) => ({
      ...r.snippet,
      source_code: r.source_code,
    })),
  };

  const outJson = beautify(JSON.stringify(exportPayload));
  return { records, outJson, base };
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 * @param {string} [outDir]
 * @param {{ baseUrl?: string }} [options]
 */
export async function writeCrmClientScriptsToFilesystem(
  creds,
  outDir = 'client_scripts',
  options = {},
) {
  const { records, outJson } = await collectCrmClientScriptsExport(creds, options);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, '_AllClientScripts.json');
  fs.writeFileSync(jsonPath, outJson);
  console.log(`All Client Scripts > ${jsonPath}`);

  for (const record of records) {
    const snippet = record.snippet;
    if (!snippet || typeof snippet !== 'object') continue;
    const baseName = baseNameForRecord(record);
    const jsonFile = path.join(outDir, `${baseName}.json`);
    const txtFile = path.join(outDir, `${baseName}.txt`);
    const jsFile = path.join(outDir, `${baseName}.js`);
    const jsonBody = beautify(
      JSON.stringify({
        ...snippet,
        source_code: record.source_code || undefined,
      }),
    );
    try {
      fs.writeFileSync(jsonFile, jsonBody);
      fs.writeFileSync(txtFile, clientScriptToReadableText(record));
      if (record.source_code) {
        fs.writeFileSync(jsFile, record.source_code);
      }
      console.log(`${snippet.name ?? baseName} > ${jsonFile}`);
    } catch (err) {
      console.log(err);
    }
  }
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 * @param {{ baseUrl?: string }} [options]
 * @returns {Promise<Buffer>}
 */
export async function buildCrmClientScriptsZipBuffer(creds, options = {}) {
  const { records, outJson } = await collectCrmClientScriptsExport(creds, options);
  const zip = new JSZip();
  const folder = zip.folder('client_scripts');
  if (!folder) throw new Error('Could not create ZIP folder');
  folder.file('_AllClientScripts.json', outJson);

  for (const record of records) {
    const snippet = record.snippet;
    if (!snippet || typeof snippet !== 'object') continue;
    const baseName = baseNameForRecord(record);
    const jsonBody = beautify(
      JSON.stringify({
        ...snippet,
        source_code: record.source_code || undefined,
      }),
    );
    folder.file(`${baseName}.json`, jsonBody);
    folder.file(`${baseName}.txt`, clientScriptToReadableText(record));
    if (record.source_code) {
      folder.file(`${baseName}.js`, record.source_code);
    }
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
