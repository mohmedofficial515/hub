/**
 * @file The one edit Hub makes to `~/.claude.json` (D44): accepting a folder's trust, when the owner presses Link.
 * @description Only on that press, only for that folder, atomically, keeping every other key, with a backup. If the file is not the shape expected, nothing changes and the
 * caller tells the owner to accept the dialog once. This file is internal to Claude Code and can change with updates, which is why the shape is checked every time.
 * Claude Code's keys are case-sensitive (tested on 2.1.318): `C:/x` and `c:/x` are two entries, and VS Code and a terminal can use different ones, so `folderKeys` names
 * each spelling of the one folder. A writer that lands between read and rename is caught by comparing the file's text, and the merge runs again on what it wrote.
 */
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';

const BACKUP_MARK = '.hub-backup-';
const BACKUPS_KEPT = 5;
const WRITE_ATTEMPTS = 5;

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const toKey = (path) => path.replaceAll('\\', '/').replace(/(?<=.)\/+$/, '');

/** Every spelling Claude Code could use for this folder, as `projects` keys. */
export function folderKeys(folder, platform) {
  const spellings = [folder];
  try {
    spellings.push(realpathSync.native(folder));
  } catch {
    /* Not there: the caller checks that first. */
  }
  const keys = new Set();
  for (const spelling of spellings) {
    const key = toKey(spelling);
    keys.add(key);
    if (platform === 'win32' && /^[A-Za-z]:/.test(key)) {
      keys.add(key[0].toUpperCase() + key.slice(1));
      keys.add(key[0].toLowerCase() + key.slice(1));
    }
  }
  return [...keys];
}

/** Why this config cannot be edited, or null when its shape is the expected one. Reads only. */
function shapeProblem(parsed, keys) {
  if (!isPlainObject(parsed)) return 'not an object';
  if (parsed.projects === undefined) return null;
  if (!isPlainObject(parsed.projects)) return 'projects is not an object';
  for (const key of keys) {
    const entry = parsed.projects[key];
    if (entry === undefined) continue;
    if (!isPlainObject(entry)) return 'the folder entry is not an object';
    const trust = entry.hasTrustDialogAccepted;
    if (trust !== undefined && typeof trust !== 'boolean') return 'hasTrustDialogAccepted is not a boolean';
  }
  return null;
}

function read(file) {
  const text = readFileSync(file, 'utf8');
  return { text, parsed: JSON.parse(text) };
}

/** Looks without touching. A missing or unreadable file is a problem too: Claude Code has not set it up here. */
export function inspectConfig(file, folder, platform) {
  const keys = folderKeys(folder, platform);
  if (!existsSync(file)) return { ok: false, problem: 'no config file', trusted: false, keys };
  let parsed;
  try {
    ({ parsed } = read(file));
  } catch {
    return { ok: false, problem: 'not valid JSON', trusted: false, keys };
  }
  const problem = shapeProblem(parsed, keys);
  if (problem) return { ok: false, problem, trusted: false, keys };
  const trusted = keys.every((key) => parsed.projects?.[key]?.hasTrustDialogAccepted === true);
  return { ok: true, problem: null, trusted, keys, parsed };
}

/** The copy D44 asks for, taken before any change of this press. Only Hub's own older copies are ever removed. */
export function backupConfig(file, now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const backup = `${file}${BACKUP_MARK}${stamp}`;
  copyFileSync(file, backup);
  const folder = dirname(file);
  const ours = readdirSync(folder)
    .filter((name) => name.startsWith(`${basename(file)}${BACKUP_MARK}`))
    .sort();
  for (const old of ours.slice(0, Math.max(0, ours.length - BACKUPS_KEPT))) rmSync(join(folder, old));
  return backup;
}

function renameWithRetry(from, to) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      renameSync(from, to);
      return;
    } catch (error) {
      // Windows refuses a rename while another process has the file open for a moment.
      if (attempt >= WRITE_ATTEMPTS || !['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * attempt);
    }
  }
}

/**
 * Sets `hasTrustDialogAccepted` on this folder's keys and nothing else. Answers `written`, `already` or `shape_unexpected`. An existing entry keeps its other fields;
 * a new one holds only the flag, and Claude Code fills in the rest.
 */
export function writeTrust(file, folder, platform) {
  const tmp = `${file}.hub-tmp-${process.pid}`;
  for (let attempt = 1; attempt <= WRITE_ATTEMPTS; attempt += 1) {
    const look = inspectConfig(file, folder, platform);
    if (!look.ok) return { outcome: 'shape_unexpected', problem: look.problem };
    if (look.trusted) return { outcome: 'already', problem: null };
    const { text, parsed } = read(file);
    const projects = isPlainObject(parsed.projects) ? parsed.projects : {};
    for (const key of look.keys) projects[key] = { ...projects[key], hasTrustDialogAccepted: true };
    const next = { ...parsed, projects };
    const mode = statSync(file).mode;
    writeFileSync(tmp, JSON.stringify(next, null, 2), { mode });
    if (readFileSync(file, 'utf8') !== text) {
      rmSync(tmp, { force: true });
      continue;
    }
    try {
      renameWithRetry(tmp, file);
    } catch (error) {
      rmSync(tmp, { force: true });
      throw error;
    }
    return { outcome: 'written', problem: null };
  }
  throw new Error('Claude Code kept rewriting its config; press Link again');
}
