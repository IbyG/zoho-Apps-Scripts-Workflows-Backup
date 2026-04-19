import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import JSZip from 'jszip';
import {
  normalizeCrmCredentials,
  fetchBooksFunctionsList,
  buildCrmHeaders,
} from '../crm/validateCrmSession.mjs';

const require = createRequire(import.meta.url);
const beautify = require('js-beautify').js;

/**
 * @param {string} base
 * @param {ReturnType<typeof normalizeCrmCredentials>} normalized
 * @param {string} id
 */
async function fetchBooksFunctionDetail(base, normalized, id) {
  const url = `${base.replace(/\/$/, '')}/api/v3/integrations/customfunctions/editpage?customfunction_id=${encodeURIComponent(id)}`;
  const headers = {
    ...buildCrmHeaders(normalized),
    'content-type': 'application/json; charset=utf-8',
  };
  try {
    const res = await fetch(url, { method: 'GET', headers });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return 'error';
    }
    if (!res.ok) return 'error';
    if (data.code !== 0 || !data.customfunction) return 'error';
    return data.customfunction;
  } catch {
    return 'error';
  }
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 */
export async function collectBooksFunctionsExport(creds) {
  const normalized = normalizeCrmCredentials(creds);
  const { base, data: listData } = await fetchBooksFunctionsList(normalized);
  const rows = listData.customfunctions || [];
  const funcs = rows.map((row) =>
    fetchBooksFunctionDetail(base, normalized, row.customfunction_id),
  );
  const details = await Promise.all(funcs);

  /** @type {object[]} */
  const merged = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const d = details[i];
    if (d && typeof d === 'object') {
      merged.push({ ...row, ...d });
    } else {
      merged.push({ ...row, _fetch_detail_error: true });
    }
  }

  const outFuncs = beautify(JSON.stringify(merged));
  return { fns: merged, outFuncs };
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 * @param {string} [outDir]
 */
export async function writeBooksFunctionsToFilesystem(creds, outDir = 'functions') {
  const { fns, outFuncs } = await collectBooksFunctionsExport(creds);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, '_AllFunctions.json');
  fs.writeFileSync(jsonPath, outFuncs);
  console.log(`All Functions > ${jsonPath}`);

  for (const f of fns) {
    if (
      f &&
      typeof f === 'object' &&
      !f._fetch_detail_error &&
      f.function_name &&
      typeof f.script === 'string' &&
      f.script.length > 0
    ) {
      const entity = f.entity || 'unknown';
      const baseName = `${entity}-${f.function_name}.ds`;
      const fileName = path.join(outDir, baseName);
      const created =
        f.created_time != null ? String(f.created_time) : '';
      const fileBody =
        '/*\n' +
        `    Name: ${f.function_name}\n` +
        `    ID: ${f.customfunction_id}\n` +
        `    Created: ${created}\n` +
        `    Language: ${f.language}\n` +
        `    Entity: ${entity}\n` +
        '*/\n' +
        f.script;
      try {
        fs.writeFileSync(fileName, fileBody);
        console.log(`${f.function_name} > ${fileName}`);
      } catch (err) {
        console.log(err);
      }
    }
  }
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 * @returns {Promise<Buffer>}
 */
export async function buildBooksFunctionsZipBuffer(creds) {
  const { fns, outFuncs } = await collectBooksFunctionsExport(creds);
  const zip = new JSZip();
  const folder = zip.folder('functions');
  if (!folder) throw new Error('Could not create ZIP folder');
  folder.file('_AllFunctions.json', outFuncs);

  for (const f of fns) {
    if (
      f &&
      typeof f === 'object' &&
      !f._fetch_detail_error &&
      f.function_name &&
      typeof f.script === 'string' &&
      f.script.length > 0
    ) {
      const entity = f.entity || 'unknown';
      const baseName = `${entity}-${f.function_name}.ds`;
      const created =
        f.created_time != null ? String(f.created_time) : '';
      const fileBody =
        '/*\n' +
        `    Name: ${f.function_name}\n` +
        `    ID: ${f.customfunction_id}\n` +
        `    Created: ${created}\n` +
        `    Language: ${f.language}\n` +
        `    Entity: ${entity}\n` +
        '*/\n' +
        f.script;
      folder.file(baseName, fileBody);
    }
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
