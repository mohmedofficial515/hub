/**
 * @file `plugin.sync` (docs/16 §11, D64): the bridge writes Hub's plugin as its marketplace and has Claude Code take that version, on a fake system.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { dispatch } from '../lib/actions.mjs';
import { checkFiles } from '../lib/plugin-sync.mjs';
import { fakeSystem, URL } from './helpers.mjs';

const VERSION = '0.1.0-sync.0123456789ab';

const files = (version = VERSION, body = 'Do the thing.') => [
  {
    path: '.claude-plugin/marketplace.json',
    text: JSON.stringify({ name: 'hub', plugins: [{ name: 'hub', source: './plugin', version }] }),
  },
  { path: 'plugin/.claude-plugin/plugin.json', text: JSON.stringify({ name: 'hub', version }) },
  { path: 'plugin/skills/tidy/SKILL.md', text: `---\nname: tidy\ndescription: Tidy up.\n---\n\n${body}\n` },
];

const context = (system) => ({ system, url: URL, folders: () => [] });
const sync = (system, args) => dispatch({ action: 'plugin.sync', args }, context(system), () => {});
const market = (system) => join(system.home, '.hub', 'app', 'team-pack');
const claudeCalls = (system) =>
  system.calls.filter((call) => call.command === system.claudePath).map((call) => call.args.join(' '));

describe('plugin.sync', () => {
  it('installs the plugin where it has none, from the files Hub sent', async () => {
    const system = fakeSystem();
    const answer = await sync(system, { version: VERSION, files: files() });
    expect(answer).toEqual({ ok: true, data: { outcome: 'installed', version: VERSION } });
    expect(readFileSync(join(market(system), 'plugin', 'skills', 'tidy', 'SKILL.md'), 'utf8')).toContain(
      'Do the thing.',
    );
    expect(system.plugins).toEqual([{ id: 'hub@hub', enabled: true, version: VERSION }]);
  });

  it("updates an installed plugin to the new version, and keeps the team pack's package.json", async () => {
    const system = fakeSystem();
    mkdirSync(market(system), { recursive: true });
    writeFileSync(join(market(system), 'package.json'), '{"name":"@hub/team-pack"}');
    writeFileSync(join(market(system), 'stale.txt'), 'old');
    system.plugins.push({ id: 'hub@hub', enabled: true, version: '0.1.0' });
    const answer = await sync(system, { version: VERSION, files: files() });
    expect(answer.data).toEqual({ outcome: 'updated', version: VERSION });
    expect(claudeCalls(system)).toContain('plugin marketplace update hub');
    expect(claudeCalls(system)).toContain('plugin update hub@hub --scope user --json');
    expect(existsSync(join(market(system), 'package.json'))).toBe(true);
    expect(existsSync(join(market(system), 'stale.txt'))).toBe(false);
  });

  it('runs nothing more when the device already has that version', async () => {
    const system = fakeSystem();
    system.plugins.push({ id: 'hub@hub', enabled: true, version: VERSION });
    const answer = await sync(system, { version: VERSION, files: files() });
    expect(answer.data).toEqual({ outcome: 'up_to_date', version: VERSION });
    expect(claudeCalls(system).some((line) => line.startsWith('plugin update'))).toBe(false);
  });

  it('a plugin the owner turned off stays off, and still takes the new text', async () => {
    const system = fakeSystem();
    system.plugins.push({ id: 'hub@hub', enabled: false, version: '0.1.0' });
    const answer = await sync(system, { version: VERSION, files: files() });
    expect(answer.data.outcome).toBe('updated');
    expect(system.plugins[0]).toMatchObject({ enabled: false, version: VERSION });
    expect(claudeCalls(system).some((line) => line.startsWith('plugin install'))).toBe(false);
  });

  it('says so when Claude Code could not update, with its words', async () => {
    const system = fakeSystem();
    system.plugins.push({ id: 'hub@hub', enabled: true, version: '0.1.0' });
    system.pluginUpdateFails = true;
    const answer = await sync(system, { version: VERSION, files: files() });
    expect(answer).toMatchObject({ ok: false, error: { code: 'failed' } });
    expect(answer.error.message).toContain('update broke');
  });

  it('refuses a bad version, and any path outside the plugin', async () => {
    const system = fakeSystem();
    expect((await sync(system, { version: 'latest', files: files() })).error.code).toBe('bad_arguments');
    for (const path of [
      '../evil.txt',
      'plugin/../../evil',
      '/etc/passwd',
      'C:\\evil',
      'bridge/lib/x.mjs',
      'plugin//x',
      'plugin/',
    ]) {
      expect(() => checkFiles([...files(), { path, text: 'x' }])).toThrow();
    }
    expect(() => checkFiles(files().filter((file) => !file.path.startsWith('.claude-plugin')))).toThrow();
    expect(existsSync(join(system.home, 'evil.txt'))).toBe(false);
  });

  it('one sync at a time: two in a row both finish, and the last version wins', async () => {
    const system = fakeSystem();
    const second = '0.1.0-sync.ba9876543210';
    const [a, b] = await Promise.all([
      sync(system, { version: VERSION, files: files(VERSION, 'first') }),
      sync(system, { version: second, files: files(second, 'second') }),
    ]);
    expect(a.data.version).toBe(VERSION);
    expect(b.data).toEqual({ outcome: 'updated', version: second });
    expect(readFileSync(join(market(system), 'plugin', 'skills', 'tidy', 'SKILL.md'), 'utf8')).toContain(
      'second',
    );
  });
});
