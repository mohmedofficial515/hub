/**
 * @file The one command and its uninstall, against a temp home, a recorded Claude Code and a fake Hub.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  appMatchesCheckout,
  connect,
  connectionState,
  copyFromCheckout,
  uninstall,
} from '../lib/connect.mjs';
import { windowsTaskXml } from '../lib/login-start.mjs';
import { hubPaths, readJson } from '../lib/paths.mjs';
import { CLAIMED, CREDENTIAL, exists, fakeHub, fakeSystem, HOOK_TOKEN, URL } from './helpers.mjs';

function allOutput(system) {
  return JSON.stringify([system.lines, system.calls]);
}

describe('connect', () => {
  it('pairs through the browser, then installs everything, and says each thing it changed', async () => {
    const system = fakeSystem();
    fakeHub(system, { answers: [{ status: 'pending' }, { status: 'approved' }, CLAIMED] });
    await connect(system, { url: URL });
    const paths = hubPaths(system);
    const text = system.lines.join('\n');
    expect(text).toContain('ABCD-EFGH');
    expect(text).toContain('Paired this device');
    expect(text).toContain('MCP server "hub"');
    expect(text).toContain('hub plugin');
    expect(text).toContain('Started the bridge');
    expect(readJson(paths.device)).toMatchObject({ url: URL, deviceId: 'dev-1', credential: CREDENTIAL });
    expect(readJson(paths.config)).toMatchObject({ url: URL, token: HOOK_TOKEN });
    expect(system.detached[0]).toEqual([system.nodePath, paths.bridgeBin, 'run']);
    expect(system.taskRegistered).toBe(true);
  });

  it('registers MCP at user scope with headersHelper in the form the spike proved, and no env var', async () => {
    const system = fakeSystem();
    fakeHub(system, { answers: [CLAIMED] });
    await connect(system, { url: URL });
    const entry = system.readConfig().mcpServers.hub;
    expect(entry.url).toBe(`${URL}/mcp`);
    expect(entry.headersHelper).toBe(`"${system.nodePath}" "${hubPaths(system).helperBin}"`);
    expect(entry.headers).toBeUndefined();
    expect(allOutput(system)).not.toContain('setx');
    expect(allOutput(system)).not.toContain('HUB_MCP_BEARER');
  });

  it('no credential reaches the output or an argument, and the two tokens stay in their own files', async () => {
    const system = fakeSystem();
    fakeHub(system, { answers: [CLAIMED] });
    await connect(system, { url: URL });
    expect(allOutput(system)).not.toContain(CREDENTIAL);
    expect(allOutput(system)).not.toContain(HOOK_TOKEN);
    expect(JSON.stringify(system.readConfig())).not.toContain('hub_abcd1234');
    const paths = hubPaths(system);
    expect(readFileSync(paths.config, 'utf8')).not.toContain(CREDENTIAL);
    expect(readFileSync(paths.device, 'utf8')).not.toContain(HOOK_TOKEN);
  });

  it('is safe to run again: no second pairing and no second install', async () => {
    const system = fakeSystem();
    const hub = fakeHub(system, { answers: [CLAIMED] });
    await connect(system, { url: URL });
    const pairedOnce = hub.requests.filter((r) => r.url.endsWith('/pairing/start')).length;
    const configBefore = readFileSync(system.configFile, 'utf8');
    system.lines.length = 0;
    system.calls.length = 0;
    await connect(system, { url: URL });
    expect(hub.requests.filter((r) => r.url.endsWith('/pairing/start'))).toHaveLength(pairedOnce);
    expect(readFileSync(system.configFile, 'utf8')).toBe(configBefore);
    expect(system.lines.join('\n')).toContain('already paired');
    expect(system.lines.join('\n')).not.toContain('MCP server "hub"');
    expect(system.calls.some((call) => call.args[0] === 'mcp')).toBe(false);
  });

  it('a revoked device pairs again', async () => {
    const system = fakeSystem();
    const hub = fakeHub(system, { answers: [CLAIMED, { ...CLAIMED, deviceId: 'dev-2' }] });
    await connect(system, { url: URL });
    hub.credentialGood = false;
    await connect(system, { url: URL });
    expect(readJson(hubPaths(system).device).deviceId).toBe('dev-2');
  });

  it('a refusal in the browser changes nothing', async () => {
    const system = fakeSystem();
    fakeHub(system, { answers: [{ status: 'denied' }] });
    await expect(connect(system, { url: URL })).rejects.toThrow(/refused/);
    expect(exists(hubPaths(system).device)).toBe(false);
    expect(system.readConfig().mcpServers).toBeUndefined();
    expect(system.detached).toEqual([]);
  });

  it('an expired code changes nothing', async () => {
    const system = fakeSystem();
    fakeHub(system, { answers: [{ status: 'expired' }] });
    await expect(connect(system, { url: URL })).rejects.toThrow(/expired/);
    expect(exists(hubPaths(system).device)).toBe(false);
  });

  it('the main machine passes credentials and sees no browser step', async () => {
    const system = fakeSystem();
    const hub = fakeHub(system);
    await connect(system, { url: URL, credentials: CLAIMED });
    expect(hub.requests.some((r) => r.url.includes('pairing'))).toBe(false);
    expect(readJson(hubPaths(system).device).credential).toBe(CREDENTIAL);
    expect(allOutput(system)).not.toContain(CREDENTIAL);
  });

  it('with no Claude Code it still pairs and starts the bridge, and says what is missing', async () => {
    const system = fakeSystem();
    fakeHub(system, { answers: [CLAIMED] });
    writeFileSync(system.claudePath, '');
    const run = system.run;
    system.run = async (command, args, options) =>
      command === system.claudePath ? { status: 127, stdout: '', stderr: '' } : run(command, args, options);
    await connect(system, { url: URL });
    expect(system.lines.join('\n')).toContain('Claude Code was not found');
    expect(system.detached).toHaveLength(1);
  });

  it('falls back to the per-user Run key when a scheduled task is refused', async () => {
    const system = fakeSystem();
    system.taskRefused = true;
    fakeHub(system, { answers: [CLAIMED] });
    await connect(system, { url: URL });
    expect(system.lines.join('\n')).toContain('Run key');
    const add = system.calls.find((call) => call.command === 'reg.exe' && call.args[0] === 'add');
    expect(add.args[1]).toMatch(/^HKCU/);
    expect(add.args.join(' ')).toContain('run');
  });

  it('asks for no admin rights in the task it writes, and starts with no window', () => {
    const xml = windowsTaskXml('PC\\me', 'C:\\node.exe', 'C:\\Users\\me & co\\bridge.mjs');
    expect(xml).toContain('<RunLevel>LeastPrivilege</RunLevel>');
    expect(xml).toContain('<LogonType>InteractiveToken</LogonType>');
    expect(xml).toContain('<UserId>PC\\me</UserId>');
    expect(xml).toContain('--headless');
    expect(xml).toContain('me &amp; co');
  });

  it('skips the start at login in an isolated test, so no scheduled task is ever touched', async () => {
    const system = fakeSystem();
    system.env.HUB_BRIDGE_SKIP_LOGIN_START = '1';
    fakeHub(system, { answers: [CLAIMED] });
    await connect(system, { url: URL });
    expect(system.calls.some((call) => call.command === 'schtasks.exe')).toBe(false);
  });
});

describe('connectionState', () => {
  it('tells paired from complete, for the main machine', async () => {
    const system = fakeSystem();
    fakeHub(system, { answers: [CLAIMED] });
    expect(await connectionState(system, URL)).toEqual({ paired: false, complete: false });
    await connect(system, { url: URL });
    mkdirSync(join(hubPaths(system).app, 'bridge', 'bin'), { recursive: true });
    writeFileSync(hubPaths(system).bridgeBin, '');
    expect(await connectionState(system, URL)).toEqual({ paired: true, complete: true });
    const config = system.readConfig();
    delete config.mcpServers.hub;
    system.writeConfig(config);
    expect(await connectionState(system, URL)).toEqual({ paired: true, complete: false });
  });

  it('a different Hub is not this pairing', async () => {
    const system = fakeSystem();
    fakeHub(system, { answers: [CLAIMED] });
    await connect(system, { url: URL });
    expect((await connectionState(system, 'http://other:7310')).paired).toBe(false);
  });
});

describe('copyFromCheckout', () => {
  it('takes the bridge and the plugin, and leaves tests behind', () => {
    const system = fakeSystem();
    const packages = join(import.meta.dirname, '..', '..');
    copyFromCheckout(system, packages);
    const { app, bridgeBin, helperBin, marketplace } = hubPaths(system);
    expect(exists(bridgeBin)).toBe(true);
    expect(exists(helperBin)).toBe(true);
    expect(exists(join(marketplace, '.claude-plugin', 'marketplace.json'))).toBe(true);
    expect(exists(join(marketplace, 'plugin', 'hooks', 'hooks.json'))).toBe(true);
    expect(exists(join(app, 'bridge', 'test'))).toBe(false);
    expect(appMatchesCheckout(system, packages)).toBe(true);
    writeFileSync(join(app, 'bridge', 'lib', 'protocol.mjs'), '// older');
    expect(appMatchesCheckout(system, packages)).toBe(false);
  });
});

describe('uninstall', () => {
  it('takes everything back, revokes the device and removes each folder’s server', async () => {
    const system = fakeSystem();
    const hub = fakeHub(system, { answers: [CLAIMED] });
    await connect(system, { url: URL });
    const folder = mkdtempSync(join(tmpdir(), 'hub-link-'));
    const { recordLink } = await import('../lib/links.mjs');
    recordLink(system, folder, [folder.replaceAll('\\', '/')]);
    system.calls.length = 0;
    await uninstall(system);
    const paths = hubPaths(system);
    expect(exists(paths.root)).toBe(false);
    expect(system.readConfig().mcpServers.hub).toBeUndefined();
    expect(system.taskRegistered).toBe(false);
    const self = hub.requests.find((r) => r.url.endsWith('/bridge/self'));
    expect(self.method).toBe('DELETE');
    expect(system.calls.find((c) => c.args.includes('local'))?.cwd).toBe(folder.replaceAll('\\', '/'));
    expect(system.calls.some((c) => c.args.join(' ') === 'plugin uninstall hub@hub --scope user')).toBe(true);
    expect(system.readConfig().userID).toBe('keep-me');
  });

  it('still cleans up when Hub is off, and tells the owner to revoke by hand', async () => {
    const system = fakeSystem();
    fakeHub(system, { answers: [CLAIMED] });
    await connect(system, { url: URL });
    system.fetch = async () => {
      throw new Error('down');
    };
    await uninstall(system);
    expect(system.lines.join('\n')).toContain('revoke this device in Settings');
    expect(exists(hubPaths(system).root)).toBe(false);
  });
});
