/**
 * @file The installer against a temp home, a recorded `claude` and a fake Hub. Nothing real is touched.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { doctor, init, link, serverEntry, TOKEN_ENV, uninstall } from '../lib/commands.mjs';

const TOKEN = 'hub_abcd1234_ThisIsTheSecretPartOfTheToken123';

function fakeSystem(overrides = {}) {
  const home = mkdtempSync(join(tmpdir(), 'hub-pack-'));
  const calls = [];
  const lines = [];
  const system = {
    platform: 'win32',
    home,
    env: {},
    out: (line) => lines.push(line),
    run(command, args) {
      calls.push([command, ...args]);
      return {
        status: 0,
        stdout: command === 'claude' && args[0] === 'plugin' ? 'hub@hub\n' : '2.1.0',
        stderr: '',
      };
    },
    async fetch(url) {
      const path = new URL(url).pathname;
      if (path === '/api/v1/workspaces') {
        return Response.json({ data: [{ slug: 'goteav' }, { slug: 'hub' }] });
      }
      if (path === '/api/v1/me/context') {
        return Response.json({ data: { project: 'goteav', text: 'x' } });
      }
      return Response.json({ data: {} });
    },
    ...overrides,
  };
  return { system, calls, lines, home };
}

describe('init', () => {
  let world;
  beforeEach(() => {
    world = fakeSystem();
  });

  it('stores the token in user scope and never prints it', async () => {
    await init(world.system, { token: TOKEN, url: 'http://localhost:7310/' });
    const config = JSON.parse(readFileSync(join(world.home, '.hub', 'config.json'), 'utf8'));
    expect(config).toMatchObject({ url: 'http://localhost:7310', token: TOKEN });
    expect(world.calls).toContainEqual(['setx', TOKEN_ENV, TOKEN]);
    expect(world.lines.join('\n')).not.toContain(TOKEN);
  });

  it('registers the server with a reference to the variable, not the token', async () => {
    await init(world.system, { token: TOKEN });
    const add = world.calls.find((call) => call[1] === 'mcp' && call[2] === 'add');
    expect(add).toContain('http://localhost:7310/mcp');
    expect(add).toContain(`Authorization: Bearer \${${TOKEN_ENV}}`);
    expect(add.join(' ')).not.toContain(TOKEN);
    expect(world.calls).toContainEqual(['claude', 'plugin', 'install', 'hub@hub', '--scope', 'user']);
  });

  it('refuses a malformed token or one Hub rejects, leaving nothing behind', async () => {
    await expect(init(world.system, { token: 'nope' })).rejects.toThrow(/does not look like/);
    const refused = fakeSystem({ fetch: async () => new Response('', { status: 401 }) });
    await expect(init(refused.system, { token: TOKEN })).rejects.toThrow(/401/);
    expect(existsSync(join(refused.home, '.hub', 'config.json'))).toBe(false);
    expect(refused.calls).toEqual([]);
  });

  it('on Unix writes a marked block once, however often it runs', async () => {
    const unix = fakeSystem({ platform: 'linux' });
    await init(unix.system, { token: TOKEN });
    await init(unix.system, { token: TOKEN });
    const profile = readFileSync(join(unix.home, '.profile'), 'utf8');
    expect(profile.match(/# hub:start/g)).toHaveLength(1);
    uninstall(unix.system);
    expect(readFileSync(join(unix.home, '.profile'), 'utf8')).not.toContain(TOKEN_ENV);
  });
});

describe('link', () => {
  async function linked() {
    const world = fakeSystem();
    await init(world.system, { token: TOKEN });
    const cwd = mkdtempSync(join(tmpdir(), 'hub-folder-'));
    return { ...world, cwd };
  }

  it('writes the header and a reference, keeping other servers, with no token in the file', async () => {
    const { system, cwd } = await linked();
    writeFileSync(join(cwd, '.mcp.json'), JSON.stringify({ mcpServers: { other: { type: 'stdio' } } }));
    await link(system, { slug: 'goteav', cwd });
    const raw = readFileSync(join(cwd, '.mcp.json'), 'utf8');
    expect(raw).not.toContain(TOKEN);
    expect(JSON.parse(raw).mcpServers).toEqual({
      other: { type: 'stdio' },
      hub: {
        type: 'http',
        url: 'http://localhost:7310/mcp',
        headers: { Authorization: `Bearer \${${TOKEN_ENV}}`, 'X-Hub-Project': 'goteav' },
      },
    });
  });

  it('refuses a project the member is not in', async () => {
    const { system, cwd } = await linked();
    await expect(link(system, { slug: 'other', cwd })).rejects.toThrow(/not in a project/);
    expect(existsSync(join(cwd, '.mcp.json'))).toBe(false);
  });

  it('asks for init first', async () => {
    const { system } = fakeSystem();
    await expect(link(system, { slug: 'goteav', cwd: tmpdir() })).rejects.toThrow(/init first/);
  });

  it('an entry with no project has no header', () => {
    expect(serverEntry('http://x', undefined).headers).not.toHaveProperty('X-Hub-Project');
  });
});

describe('doctor', () => {
  it('is green on a good machine', async () => {
    const world = fakeSystem();
    await init(world.system, { token: TOKEN });
    world.system.env[TOKEN_ENV] = TOKEN;
    expect(await doctor(world.system)).toBe(true);
    expect(world.lines.join('\n')).not.toContain(TOKEN);
  });

  it('says what is wrong, and fails', async () => {
    const world = fakeSystem();
    expect(await doctor(world.system)).toBe(false);
    expect(world.lines.join('\n')).toContain('✗ Config');
  });
});

describe('uninstall', () => {
  it('removes what init added', async () => {
    const world = fakeSystem();
    await init(world.system, { token: TOKEN });
    uninstall(world.system);
    expect(existsSync(join(world.home, '.hub'))).toBe(false);
    expect(world.calls).toContainEqual(['claude', 'plugin', 'uninstall', 'hub@hub', '--scope', 'user']);
    expect(world.calls).toContainEqual(['reg', 'delete', 'HKCU\\Environment', '/v', TOKEN_ENV, '/f']);
  });
});

describe('a device connected by the one command', () => {
  function connected() {
    const made = fakeSystem();
    const system = made.system ?? made;
    const hub = join(system.home, '.hub');
    mkdirSync(hub, { recursive: true });
    writeFileSync(
      join(hub, 'config.json'),
      JSON.stringify({ url: 'http://hub', token: TOKEN, device: true }),
    );
    writeFileSync(
      join(hub, 'device.json'),
      JSON.stringify({ url: 'http://hub', credential: 'hub_devi_credential' }),
    );
    return made;
  }

  it('link points at the button, and writes no .mcp.json naming a variable that does not exist', async () => {
    const made = connected();
    const system = made.system ?? made;
    await expect(link(system, { slug: 'goteav', cwd: system.home })).rejects.toThrow(/Link a folder/);
    expect(existsSync(join(system.home, '.mcp.json'))).toBe(false);
  });

  it('uninstall points at the command that also revokes the device', () => {
    const made = connected();
    const system = made.system ?? made;
    expect(() => uninstall(system)).toThrow(/Settings › Devices/);
    expect(existsSync(join(system.home, '.hub', 'device.json'))).toBe(true);
  });
});
