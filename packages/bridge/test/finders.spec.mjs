/**
 * @file Finding Claude Code and VS Code the way the spike found they must be found: newest copy, never `claude.cmd`, and VS Code from the registry.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  claudeOnPath,
  compareVersions,
  meetsMinimum,
  parseVersion,
  resolveClaude,
  updateHint,
} from '../lib/claude.mjs';
import { parseRegistryHandler, resolveVsCode } from '../lib/vscode.mjs';

function touch(path) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, '');
  return path;
}

function aMachine() {
  const home = mkdtempSync(join(tmpdir(), 'hub-find-'));
  const npm = join(home, 'npm');
  const shim = touch(join(npm, 'claude.cmd'));
  const npmExe = touch(join(npm, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'));
  const extensionExe = touch(
    join(
      home,
      '.vscode',
      'extensions',
      'anthropic.claude-code-2.1.318-win32-x64',
      'resources',
      'native-binary',
      'claude.exe',
    ),
  );
  const versions = new Map([
    [npmExe, '2.1.202 (Claude Code)\n'],
    [extensionExe, '2.1.318 (Claude Code)\n'],
  ]);
  const calls = [];
  return {
    shim,
    npmExe,
    extensionExe,
    calls,
    system: {
      platform: 'win32',
      home,
      env: { PATH: npm },
      async run(command, args) {
        calls.push([command, ...args]);
        return { status: 0, stdout: versions.get(command) ?? '', stderr: '' };
      },
    },
  };
}

describe('versions', () => {
  it('reads the version out of what Claude prints', () => {
    expect(parseVersion('2.1.318 (Claude Code)\n')).toBe('2.1.318');
    expect(parseVersion('nonsense')).toBeNull();
  });

  it('compares by number, not by text', () => {
    expect(compareVersions('2.1.318', '2.1.202')).toBeGreaterThan(0);
    expect(compareVersions('2.1.99', '2.1.100')).toBeLessThan(0);
    expect(compareVersions('2.1.318', '2.1.318')).toBe(0);
  });

  it('holds the minimum from S1 C3', () => {
    expect(meetsMinimum('2.1.202')).toBe(false);
    expect(meetsMinimum('2.1.318')).toBe(true);
    expect(meetsMinimum('2.2.0')).toBe(true);
  });
});

describe('resolveClaude', () => {
  it('picks the newest copy, and still reports what PATH gives (this machine: 2.1.202 and 2.1.318)', async () => {
    const machine = aMachine();
    const found = await resolveClaude(machine.system);
    expect(found.best).toEqual({ path: machine.extensionExe, version: '2.1.318' });
    expect(found.onPath).toEqual({ path: machine.npmExe, version: '2.1.202' });
  });

  it('resolves the npm shim to its real .exe and never runs the .cmd', async () => {
    const machine = aMachine();
    expect(claudeOnPath(machine.system)).toBe(machine.npmExe);
    await resolveClaude(machine.system);
    expect(machine.calls.flat().some((part) => /\.cmd$/.test(part))).toBe(false);
  });

  it('finds nothing on a machine with no Claude Code, and does not guess', async () => {
    const found = await resolveClaude({
      platform: 'win32',
      home: mkdtempSync(join(tmpdir(), 'hub-none-')),
      env: { PATH: '' },
      run: async () => ({ status: 127, stdout: '', stderr: '' }),
    });
    expect(found).toEqual({ best: null, copies: [], onPath: null });
  });

  it('names the update that fits where a copy lives', () => {
    expect(updateHint('C:\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe')).toContain(
      'npm install',
    );
    expect(updateHint('C:\\Users\\me\\.vscode\\extensions\\x\\claude.exe')).toContain('extension');
    expect(updateHint('/home/me/.local/bin/claude')).toBe('claude update');
  });
});

describe('resolveVsCode', () => {
  it('reads the real Code.exe from the registry handler', () => {
    expect(
      parseRegistryHandler(
        '    (Default)    REG_SZ    "C:\\Program Files\\Code\\Code.exe" --open-url -- "%1"\n',
      ),
    ).toBe('C:\\Program Files\\Code\\Code.exe');
    expect(parseRegistryHandler('ERROR')).toBeNull();
  });

  it('never looks at PATH on Windows, where `code` can be broken', async () => {
    const home = mkdtempSync(join(tmpdir(), 'hub-code-'));
    const exe = join(home, 'VS Code', 'Code.exe');
    const cmd = touch(join(home, 'VS Code', 'bin', 'code.cmd'));
    touch(join(home, '.vscode', 'extensions', 'anthropic.claude-code-2.1.318', 'x'));
    const brokenPath = join(home, 'broken');
    touch(join(brokenPath, 'code.cmd'));
    const found = await resolveVsCode({
      platform: 'win32',
      home,
      env: { PATH: brokenPath },
      run: async () => ({ status: 0, stdout: `(Default) REG_SZ "${exe}" --open-url -- "%1"\n`, stderr: '' }),
    });
    expect(found).toEqual({ found: true, code: cmd, program: exe, extension: true });
  });

  it('says not found when the registry has no handler', async () => {
    const found = await resolveVsCode({
      platform: 'win32',
      home: mkdtempSync(join(tmpdir(), 'hub-code-')),
      env: {},
      run: async () => ({ status: 1, stdout: '', stderr: '' }),
    });
    expect(found.found).toBe(false);
  });
});
