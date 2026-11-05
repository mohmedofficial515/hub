/**
 * @file The closed list and the folder rule, and the Link button's action against a recorded Claude Code and a temp config.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { dispatch } from '../lib/actions.mjs';
import { folderKeys } from '../lib/claude-config.mjs';
import { hubPaths } from '../lib/paths.mjs';
import { aFolder, CREDENTIAL, fakeSystem, URL } from './helpers.mjs';

function contextFor(system, folders = []) {
  return { system, url: URL, folders: () => folders };
}

const noEmit = () => {};

describe('the closed list', () => {
  it('refuses any action not on it, including names an object would answer to', async () => {
    const system = fakeSystem();
    for (const action of ['shell.exec', 'run', 'constructor', '__proto__', 'toString', '']) {
      const answer = await dispatch({ action, args: {} }, contextFor(system), noEmit);
      expect(answer).toMatchObject({ ok: false, error: { code: 'unknown_action' } });
    }
    expect(system.calls).toEqual([]);
  });

  it('a turn inside an allowed folder is the Slice 3 extension point, and starts nothing yet', async () => {
    const system = fakeSystem();
    const folder = aFolder(system);
    const answer = await dispatch(
      { action: 'turn.start', args: { folder } },
      contextFor(system, [{ path: folder, project: 'demo' }]),
      noEmit,
    );
    expect(answer).toMatchObject({ ok: false, error: { code: 'not_implemented' } });
    expect(system.calls).toEqual([]);
  });

  it('refuses a folder outside the allowlist before any handler runs', async () => {
    const system = fakeSystem();
    const allowed = aFolder(system, 'allowed');
    const outside = aFolder(system, 'outside');
    for (const action of ['turn.start', 'vscode.open', 'folder.link']) {
      const answer = await dispatch(
        { action, args: { folder: outside, project: 'demo' } },
        contextFor(system, [{ path: allowed, project: 'demo' }]),
        noEmit,
      );
      expect(answer).toMatchObject({ ok: false, error: { code: 'folder_not_allowed' } });
    }
    expect(system.calls).toEqual([]);
  });

  it('refuses a fix that is not on the list: a name never becomes a command', async () => {
    const system = fakeSystem();
    const answer = await dispatch(
      { action: 'health.fix', args: { fix: 'rm -rf /' } },
      contextFor(system),
      noEmit,
    );
    expect(answer).toMatchObject({ ok: false, error: { code: 'not_fixable' } });
    expect(system.calls).toEqual([]);
  });

  it('refuses arguments of the wrong shape', async () => {
    const system = fakeSystem();
    const answer = await dispatch({ action: 'turn.start', args: ['x'] }, contextFor(system), noEmit);
    expect(answer).toMatchObject({ ok: false, error: { code: 'bad_arguments' } });
  });
});

describe('folder.link (D44)', () => {
  function linked() {
    const system = fakeSystem();
    const folder = aFolder(system, 'My Project');
    const context = contextFor(system, [{ path: folder, project: 'demo' }]);
    const press = () =>
      dispatch({ action: 'folder.link', args: { folder, project: 'demo' } }, context, noEmit);
    return { system, folder, context, press, key: folder.replaceAll('\\', '/') };
  }

  it('on the press: trusts this folder, gives it `hub` on this project, and keeps a backup', async () => {
    const { system, press, key } = linked();
    const before = readFileSync(system.configFile, 'utf8');
    const answer = await press();
    expect(answer).toMatchObject({ ok: true, data: { outcome: 'linked' } });
    const config = system.readConfig();
    expect(config.projects[key].hasTrustDialogAccepted).toBe(true);
    expect(config.projects[key].mcpServers.hub.headers['X-Hub-Project']).toBe('demo');
    expect(config.projects[key].mcpServers.hub.headersHelper).toContain('hub-mcp-headers.mjs');
    expect(config.userID).toBe('keep-me');
    expect(config.numStartups).toBe(7);
    expect(readFileSync(answer.data.backup, 'utf8')).toBe(before);
  });

  it('writes both drive spellings of the one folder, and no other folder', async () => {
    const { system, press, folder } = linked();
    await press();
    const keys = Object.keys(system.readConfig().projects);
    expect(keys.sort()).toEqual(folderKeys(folder, 'win32').sort());
    expect(keys.every((name) => name.endsWith('/My Project'))).toBe(true);
    expect(keys.length).toBeGreaterThanOrEqual(2);
  });

  it('a second press changes nothing and takes no second backup', async () => {
    const { system, press } = linked();
    await press();
    const before = readFileSync(system.configFile, 'utf8');
    const backups = readdirSync(dirname(system.configFile)).filter((name) =>
      name.includes('hub-backup'),
    ).length;
    const answer = await press();
    expect(answer).toMatchObject({ ok: true, data: { outcome: 'already_linked', backup: null } });
    expect(readFileSync(system.configFile, 'utf8')).toBe(before);
    expect(
      readdirSync(dirname(system.configFile)).filter((name) => name.includes('hub-backup')),
    ).toHaveLength(backups);
  });

  it('an unexpected shape changes nothing at all, and Claude Code is not even run', async () => {
    const { system, press } = linked();
    writeFileSync(system.configFile, JSON.stringify({ projects: ['surprise'] }));
    const before = readFileSync(system.configFile, 'utf8');
    const answer = await press();
    expect(answer).toMatchObject({ ok: true, data: { outcome: 'shape_unexpected', backup: null } });
    expect(readFileSync(system.configFile, 'utf8')).toBe(before);
    expect(system.calls).toEqual([]);
    expect(readdirSync(dirname(system.configFile)).filter((name) => name.includes('hub-backup'))).toEqual([]);
  });

  it('a folder that is not on this device is reported missing', async () => {
    const system = fakeSystem();
    const folder = join(system.home, 'not-here');
    const answer = await dispatch(
      { action: 'folder.link', args: { folder, project: 'demo' } },
      contextFor(system, [{ path: folder, project: 'demo' }]),
      noEmit,
    );
    expect(answer).toMatchObject({ ok: false, error: { code: 'folder_missing' } });
  });

  it('a folder registered on another project is refused for this one', async () => {
    const system = fakeSystem();
    const folder = aFolder(system);
    const answer = await dispatch(
      { action: 'folder.link', args: { folder, project: 'theirs' } },
      contextFor(system, [{ path: folder, project: 'mine' }]),
      noEmit,
    );
    expect(answer).toMatchObject({ ok: false, error: { code: 'folder_not_allowed' } });
  });

  it('if Claude Code refuses the server, trust is not written', async () => {
    const { system, press, key } = linked();
    system.mcpFails = true;
    const answer = await press();
    expect(answer).toMatchObject({ ok: true, data: { outcome: 'mcp_failed' } });
    expect(system.readConfig().projects[key]?.hasTrustDialogAccepted).toBeUndefined();
    expect(JSON.stringify(answer)).not.toContain(CREDENTIAL);
  });

  it('remembers the folder for uninstall, with no secret in that file', async () => {
    const { system, press, folder } = linked();
    await press();
    const text = readFileSync(hubPaths(system).links, 'utf8');
    expect(JSON.parse(text)[0].folder).toBe(folder);
    expect(text).not.toContain('hub_');
  });
});

describe('health', () => {
  it('reports a Claude Code below the minimum, with its fix, and never opens a credential file', async () => {
    const system = fakeSystem();
    system.claudeVersion = '2.1.202';
    const answer = await dispatch({ action: 'health.check', args: {} }, contextFor(system), noEmit);
    expect(answer.ok).toBe(true);
    const version = answer.data.find((check) => check.id === 'claude_version');
    expect(version).toMatchObject({ ok: false, level: 'error', detail: '2.1.202', hint: 'claude update' });
    expect(JSON.stringify(system.calls)).not.toContain('.credentials');
  });

  it('offers Fix only for what Hub can fix', async () => {
    const system = fakeSystem();
    const { data } = await dispatch({ action: 'health.check', args: {} }, contextFor(system), noEmit);
    const byId = Object.fromEntries(data.map((check) => [check.id, check]));
    expect(byId.mcp_server.fix).toBe('mcp_server');
    expect(byId.plugin.fix).toBe('plugin');
    expect(byId.login_start.fix).toBe('login_start');
    expect(byId.claude_version.fix).toBeNull();
    expect(byId.vscode.level).toBe('warn');
  });

  it('a Fix runs, and the next report shows it fixed', async () => {
    const system = fakeSystem();
    const fixed = await dispatch(
      { action: 'health.fix', args: { fix: 'mcp_server' } },
      contextFor(system),
      noEmit,
    );
    expect(fixed.ok).toBe(true);
    expect(fixed.data.find((check) => check.id === 'mcp_server')).toMatchObject({ ok: true, fix: null });
    expect(system.readConfig().mcpServers.hub.url).toBe(`${URL}/mcp`);
  });

  it('reads sign-in only from `claude auth status`', async () => {
    const system = fakeSystem();
    system.signedIn = false;
    const { data } = await dispatch({ action: 'health.check', args: {} }, contextFor(system), noEmit);
    expect(data.find((check) => check.id === 'claude_signed_in')).toMatchObject({
      ok: false,
      hint: 'claude auth login',
    });
  });
});
