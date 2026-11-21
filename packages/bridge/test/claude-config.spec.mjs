/**
 * @file D44, exactly: on the press only, this folder only, atomic, every other key kept, a backup, and no change at all when the shape is unexpected. Always a temp file.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { backupConfig, folderKeys, inspectConfig, writeTrust } from '../lib/claude-config.mjs';

function setup(content) {
  const dir = mkdtempSync(join(tmpdir(), 'hub-d44-'));
  const file = join(dir, '.claude.json');
  const folder = join(dir, 'My Project');
  mkdirSync(folder);
  if (content !== undefined) {
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { dir, file, folder };
}

const keyOf = (folder) => folder.replaceAll('\\', '/');

describe('folderKeys', () => {
  it('names both drive letter spellings on Windows, because Claude Code keys are case-sensitive', () => {
    const keys = folderKeys('F:\\Goteav\\hub', 'win32');
    expect(keys).toContain('F:/Goteav/hub');
    expect(keys).toContain('f:/Goteav/hub');
    expect(keys.every((key) => !key.includes('\\'))).toBe(true);
  });

  it('leaves a POSIX path as it is', () => {
    expect(folderKeys('/home/me/repo/', 'linux')).toContain('/home/me/repo');
  });
});

describe('writeTrust', () => {
  it('sets the flag for this folder and keeps every other key', () => {
    const other = {
      hasTrustDialogAccepted: false,
      allowedTools: ['x'],
      lastCost: 1.5,
    };
    const { file, folder } = setup({
      userID: 'abc',
      numStartups: 42,
      nested: { deep: [1, 2, { three: 3 }] },
      projects: { '/some/other/folder': other },
    });
    expect(writeTrust(file, folder, process.platform).outcome).toBe('written');
    const after = JSON.parse(readFileSync(file, 'utf8'));
    expect(after.userID).toBe('abc');
    expect(after.numStartups).toBe(42);
    expect(after.nested).toEqual({ deep: [1, 2, { three: 3 }] });
    expect(after.projects['/some/other/folder']).toEqual(other);
    expect(after.projects[keyOf(folder)].hasTrustDialogAccepted).toBe(true);
  });

  it('keeps the fields an existing entry already has', () => {
    const { file, folder } = setup({ projects: {} });
    const key = keyOf(folder);
    const start = JSON.parse(readFileSync(file, 'utf8'));
    start.projects[key] = { allowedTools: ['Bash(ls)'], mcpServers: { a: { type: 'http' } } };
    writeFileSync(file, JSON.stringify(start));
    writeTrust(file, folder, process.platform);
    expect(JSON.parse(readFileSync(file, 'utf8')).projects[key]).toEqual({
      allowedTools: ['Bash(ls)'],
      mcpServers: { a: { type: 'http' } },
      hasTrustDialogAccepted: true,
    });
  });

  it('touches nothing when the folder is already trusted', () => {
    const { file, folder } = setup({ a: 1 });
    writeTrust(file, folder, process.platform);
    const before = readFileSync(file, 'utf8');
    expect(writeTrust(file, folder, process.platform).outcome).toBe('already');
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('leaves no temp file behind', () => {
    const { dir, file, folder } = setup({ a: 1 });
    writeTrust(file, folder, process.platform);
    expect(readdirSync(dir).filter((name) => name.includes('hub-tmp'))).toEqual([]);
  });

  it.each([
    ['an array at the top', '[1,2]'],
    ['not JSON', '{ this is not json'],
    ['projects as a list', { projects: [] }],
    ['projects as a string', { projects: 'x' }],
  ])('changes nothing and says so: %s', (_name, content) => {
    const { dir, file, folder } = setup(content);
    const before = readFileSync(file, 'utf8');
    const answer = writeTrust(file, folder, process.platform);
    expect(answer.outcome).toBe('shape_unexpected');
    expect(answer.problem).toBeTruthy();
    expect(readFileSync(file, 'utf8')).toBe(before);
    expect(readdirSync(dir).sort()).toEqual(['.claude.json', 'My Project'].sort());
  });

  it('changes nothing when the folder entry or its flag is an unexpected type', () => {
    const made = setup({ projects: {} });
    const key = keyOf(made.folder);
    for (const entry of ['text', { hasTrustDialogAccepted: 'yes' }]) {
      writeFileSync(made.file, JSON.stringify({ projects: { [key]: entry } }));
      const before = readFileSync(made.file, 'utf8');
      expect(writeTrust(made.file, made.folder, process.platform).outcome).toBe('shape_unexpected');
      expect(readFileSync(made.file, 'utf8')).toBe(before);
    }
  });

  it('a missing file is an unexpected shape, and creates nothing', () => {
    const { dir, file, folder } = setup();
    expect(writeTrust(file, folder, process.platform).outcome).toBe('shape_unexpected');
    expect(existsSync(file)).toBe(false);
    expect(readdirSync(dir)).toEqual(['My Project']);
  });
});

describe('backupConfig', () => {
  it('copies the file as it was, and keeps only the newest few of its own', () => {
    const { dir, file } = setup({ a: 1 });
    const unrelated = join(dir, '.claude.json.backup');
    writeFileSync(unrelated, 'not ours');
    const first = backupConfig(file, new Date('2026-11-06T10:00:00Z'));
    expect(JSON.parse(readFileSync(first, 'utf8'))).toEqual({ a: 1 });
    for (let index = 1; index <= 7; index += 1) {
      backupConfig(file, new Date(`2026-11-06T10:00:0${index}Z`));
    }
    const ours = readdirSync(dir).filter((name) => name.includes('hub-backup'));
    expect(ours).toHaveLength(5);
    expect(existsSync(first)).toBe(false);
    expect(existsSync(unrelated)).toBe(true);
  });
});

describe('inspectConfig', () => {
  it('reads without writing', () => {
    const { file, folder } = setup({ a: 1 });
    const before = readFileSync(file, 'utf8');
    expect(inspectConfig(file, folder, process.platform)).toMatchObject({ ok: true, trusted: false });
    expect(readFileSync(file, 'utf8')).toBe(before);
  });
});
