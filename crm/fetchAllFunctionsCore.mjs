import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import JSZip from 'jszip';
import {
  normalizeCrmCredentials,
  fetchCrmFunctionsList,
  buildCrmHeaders,
} from './validateCrmSession.mjs';

const require = createRequire(import.meta.url);
const beautify = require('js-beautify').js;

/**
 * @param {string} base
 * @param {ReturnType<typeof normalizeCrmCredentials>} normalized
 * @param {string} id
 */
async function fetchFunctionDetail(base, normalized, id) {
  const url = `${base.replace(/\/$/, '')}/crm/v2/settings/functions/${id}?source=crm&language=deluge`;
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
    const fn = data.functions?.[0];
    if (!fn) return 'error';
    if (fn.nameSpace === 'ExtensionAction') return '';
    return fn;
  } catch {
    return 'error';
  }
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 */
export async function collectCrmFunctionsExport(creds) {
  const normalized = normalizeCrmCredentials(creds);
  const { base, data: listData } = await fetchCrmFunctionsList(normalized);
  const functions = listData.functions || [];
  const funcs = functions.map((f) =>
    fetchFunctionDetail(base, normalized, f.id),
  );
  const fns = await Promise.all(funcs);
  const outFuncs = beautify(JSON.stringify(fns));
  return { fns, outFuncs };
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 * @param {string} [outDir]
 */
export async function writeCrmFunctionsToFilesystem(creds, outDir = 'functions') {
  const { fns, outFuncs } = await collectCrmFunctionsExport(creds);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, '_AllFunctions.json');
  fs.writeFileSync(jsonPath, outFuncs);
  console.log(`All Functions > ${jsonPath}`);

  for (const f of fns) {
    if (f && typeof f === 'object' && f.display_name && f.script?.length > 0) {
      const moduleName = f.associated_place ? f.associated_place[0].module : null;
      const baseName = moduleName
        ? `${moduleName}-${f.name}.ds`
        : `Standalone-${f.name}.ds`;
      const fileName = path.join(outDir, baseName);
      const fileBody =
        '/*\n' +
        `    Name: ${f.display_name}\n` +
        `    ID: ${f.id}\n` +
        `    Last Modified: ${f.modified_on}\n` +
        `    Last Modified By: ${f.modified_by}\n` +
        `    Language: ${f.language}\n` +
        `    Module: ${moduleName}\n` +
        '*/\n' +
        f.script;
      try {
        fs.writeFileSync(fileName, fileBody);
        console.log(`${f.display_name} > ${fileName}`);
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
export async function buildCrmFunctionsZipBuffer(creds) {
  const { fns, outFuncs } = await collectCrmFunctionsExport(creds);
  const zip = new JSZip();
  const folder = zip.folder('functions');
  if (!folder) throw new Error('Could not create ZIP folder');
  folder.file('_AllFunctions.json', outFuncs);

  for (const f of fns) {
    if (f && typeof f === 'object' && f.display_name && f.script?.length > 0) {
      const moduleName = f.associated_place ? f.associated_place[0].module : null;
      const baseName = moduleName
        ? `${moduleName}-${f.name}.ds`
        : `Standalone-${f.name}.ds`;
      const fileBody =
        '/*\n' +
        `    Name: ${f.display_name}\n` +
        `    ID: ${f.id}\n` +
        `    Last Modified: ${f.modified_on}\n` +
        `    Last Modified By: ${f.modified_by}\n` +
        `    Language: ${f.language}\n` +
        `    Module: ${moduleName}\n` +
        '*/\n' +
        f.script;
      folder.file(baseName, fileBody);
    }
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
