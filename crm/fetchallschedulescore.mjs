import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import JSZip from 'jszip';
import {
  normalizeCrmCredentials,
  fetchAllCrmSchedules,
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

/** @param {string | null | undefined} v */
function fmt(v) {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

/**
 * @param {string} base
 * @param {ReturnType<typeof normalizeCrmCredentials>} normalized
 * @param {object} listItem
 */
async function fetchScheduleDetail(base, normalized, listItem) {
  const id = listItem?.id;
  if (!id) return listItem;
  const url = `${base.replace(/\/$/, '')}/crm/v9/settings/automation/schedules/${id}`;
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
    const schedule = data.schedules?.[0] ?? data.schedule ?? null;
    if (schedule && typeof schedule === 'object' && schedule.id) return schedule;
    return listItem;
  } catch {
    return listItem;
  }
}

/**
 * @param {object} schedule
 */
export function scheduleToReadableText(schedule) {
  const lines = [];
  const frequencyType = schedule.frequency?.type ?? '—';
  const repeatEvery = schedule.frequency?.repeating_period;
  const endType = schedule.execution_ending_details?.execution_end ?? '—';
  const fn = schedule.function?.name ?? '—';

  lines.push('Zoho CRM — Schedule');
  lines.push('═'.repeat(56));
  lines.push('');
  lines.push(`Name:                 ${fmt(schedule.name)}`);
  lines.push(`Description:          ${fmt(schedule.description)}`);
  lines.push(`Status:               ${fmt(schedule.status)}`);
  lines.push(`Source:               ${fmt(schedule.source)}`);
  lines.push(`Schedule ID:          ${fmt(schedule.id)}`);
  lines.push('');
  lines.push('─'.repeat(56));
  lines.push('Execution');
  lines.push('─'.repeat(56));
  lines.push(`Function:             ${fmt(fn)}`);
  lines.push(`Start Time:           ${fmt(schedule.execution_start_time)}`);
  lines.push(`Next Execution:       ${fmt(schedule.next_execution_time)}`);
  lines.push(`Last Execution:       ${fmt(schedule.last_execution_time)}`);
  lines.push(`Frequency:            ${fmt(frequencyType)}`);
  if (repeatEvery != null) {
    lines.push(`Run Every:            ${fmt(repeatEvery)} ${fmt(frequencyType)}`);
  }
  lines.push(`Ends:                 ${fmt(endType)}`);
  lines.push('');
  lines.push('─'.repeat(56));
  lines.push('Audit');
  lines.push('─'.repeat(56));
  lines.push(`Created Time:         ${fmt(schedule.created_time)}`);
  lines.push(`Created By:           ${fmt(schedule.created_by?.name)}`);
  lines.push(`Modified Time:        ${fmt(schedule.modified_time)}`);
  lines.push(`Modified By:          ${fmt(schedule.modified_by?.name)}`);
  lines.push('');
  lines.push('═'.repeat(56));
  lines.push('Tip: Open the matching .json file for the full API payload.');
  lines.push('');
  return lines.join('\n');
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 * @param {{ baseUrl?: string, perPage?: number }} [options]
 */
export async function collectCrmSchedulesExport(creds, options = {}) {
  const normalized = normalizeCrmCredentials(creds);
  const { base, schedules } = await fetchAllCrmSchedules(normalized, options);
  const details = schedules.map((s) => fetchScheduleDetail(base, normalized, s));
  const fullSchedules = await Promise.all(details);
  const outJson = beautify(JSON.stringify(fullSchedules));
  return { schedules: fullSchedules, outJson };
}

/**
 * @param {{ xCrmOrg: string, xZcsrfToken: string, cookie: string }} creds
 * @param {string} [outDir]
 * @param {{ baseUrl?: string, perPage?: number }} [options]
 */
export async function writeCrmSchedulesToFilesystem(
  creds,
  outDir = 'schedules',
  options = {},
) {
  const { schedules, outJson } = await collectCrmSchedulesExport(creds, options);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, '_AllSchedules.json');
  fs.writeFileSync(jsonPath, outJson);
  console.log(`All Schedules > ${jsonPath}`);

  for (const s of schedules) {
    if (!s || typeof s !== 'object' || !s.id) continue;
    const baseName = `${sanitizeFileSegment(s.name)}-${s.id}.json`;
    const fileName = path.join(outDir, baseName);
    const txtName = fileName.replace(/\.json$/i, '.txt');
    const body = beautify(JSON.stringify(s));
    const readable = scheduleToReadableText(s);
    try {
      fs.writeFileSync(fileName, body);
      fs.writeFileSync(txtName, readable);
      console.log(`${s.name} > ${fileName}`);
      console.log(`${s.name} > ${txtName}`);
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
export async function buildCrmSchedulesZipBuffer(creds, options = {}) {
  const { schedules, outJson } = await collectCrmSchedulesExport(creds, options);
  const zip = new JSZip();
  const folder = zip.folder('schedules');
  if (!folder) throw new Error('Could not create ZIP folder');
  folder.file('_AllSchedules.json', outJson);

  for (const s of schedules) {
    if (!s || typeof s !== 'object' || !s.id) continue;
    const baseName = `${sanitizeFileSegment(s.name)}-${s.id}.json`;
    const body = beautify(JSON.stringify(s));
    const txtBaseName = baseName.replace(/\.json$/i, '.txt');
    folder.file(baseName, body);
    folder.file(txtBaseName, scheduleToReadableText(s));
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
