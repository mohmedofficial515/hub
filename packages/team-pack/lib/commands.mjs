/**
 * @file `init`, `doctor`, `uninstall`, `link`: the team pack's installer (docs/05 §3.8, docs/15 §5).
 * @description No token ever lands in a file meant for Git. The token lives in user scope: `~/.hub/config.json` for the
 * hooks and the `HUB_MCP_BEARER` user environment variable for Claude Code. `.mcp.json` holds only `${HUB_MCP_BEARER}`,
 * which Claude Code expands when it connects, so a linked folder's file is safe to commit. Everything from outside
 * arrives through `system`, so tests run without Claude Code, a registry write or a network.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOKEN_ENV = 'HUB_MCP_BEARER';
export const DEFAULT_URL = 'http://localhost:7310';
const TOKEN_PATTERN = /^hub_[A-Za-z0-9]{8}_[A-Za-z0-9_-]{16,}$/;
const PROFILE_START = '# hub:start';
const PROFILE_END = '# hub:end';

const packRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function quote(arg) {
  return /[\s"&|<>^]/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg;
}

/** The real outside world. */
export function realSystem() {
  return {
    platform: platform(),
    home: homedir(),
    env: process.env,
    fetch: globalThis.fetch,
    out: (line) => process.stdout.write(`${line}\n`),
    run(command, args) {
      // `claude` is a .cmd on some Windows installs, which needs a shell, and a shell needs quoting.
      const shell = process.platform === 'win32';
      const result = spawnSync(command, shell ? args.map(quote) : args, {
        encoding: 'utf8',
        shell,
        windowsHide: true,
        timeout: 60_000,
      });
      return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
    },
  };
}

const configPath = (system) => join(system.home, '.hub', 'config.json');

function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function loadConfig(system) {
  return readJsonFile(configPath(system));
}

function saveConfig(system, config) {
  mkdirSync(dirname(configPath(system)), { recursive: true });
  writeFileSync(configPath(system), JSON.stringify(config, null, 2), { mode: 0o600 });
}

/** The token must never reach the screen, a log or an error. */
function mask(text, token) {
  return token ? text.replaceAll(token, '<token>') : text;
}

async function context(system, url, token) {
  const response = await system.fetch(`${url}/api/v1/me/context`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Hub answered ${response.status}: check the token and the URL`);
  const { data } = await response.json();
  return data;
}

const PROFILE_FILES = ['.profile', '.bashrc', '.zshrc'];

function setUserEnv(system, value) {
  if (system.platform === 'win32') {
    const result = system.run('setx', [TOKEN_ENV, value]);
    if (result.status !== 0) throw new Error('setx failed: could not set the user environment variable');
    return;
  }
  const block = `${PROFILE_START}\nexport ${TOKEN_ENV}="${value}"\n${PROFILE_END}\n`;
  for (const name of PROFILE_FILES) {
    const path = join(system.home, name);
    if (!existsSync(path) && name !== '.profile') continue;
    const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
    writeFileSync(path, `${stripProfileBlock(current)}${block}`, { mode: 0o600 });
  }
}

function stripProfileBlock(text) {
  return text.replace(new RegExp(`${PROFILE_START}[\\s\\S]*?${PROFILE_END}\\n?`, 'g'), '');
}

function removeUserEnv(system) {
  if (system.platform === 'win32') {
    system.run('reg', ['delete', 'HKCU\\Environment', '/v', TOKEN_ENV, '/f']);
    return;
  }
  for (const name of PROFILE_FILES) {
    const path = join(system.home, name);
    if (existsSync(path)) writeFileSync(path, stripProfileBlock(readFileSync(path, 'utf8')));
  }
}

/** What goes in `.mcp.json` and the user-scope server: a reference to the token, never the token. */
export function serverEntry(url, slug) {
  return {
    type: 'http',
    url: `${url}/mcp`,
    headers: {
      Authorization: `Bearer \${${TOKEN_ENV}}`,
      ...(slug ? { 'X-Hub-Project': slug } : {}),
    },
  };
}

function claude(system, args) {
  return system.run('claude', args);
}

function installPlugin(system) {
  claude(system, ['plugin', 'marketplace', 'add', packRoot]);
  return claude(system, ['plugin', 'install', 'hub@hub', '--scope', 'user']);
}

function registerUserServer(system, url) {
  claude(system, ['mcp', 'remove', 'hub', '--scope', 'user']);
  return claude(system, [
    'mcp',
    'add',
    '--transport',
    'http',
    '--scope',
    'user',
    'hub',
    `${url}/mcp`,
    '--header',
    `Authorization: Bearer \${${TOKEN_ENV}}`,
  ]);
}

export async function init(system, options) {
  const url = (options.url ?? system.env.HUB_URL ?? DEFAULT_URL).replace(/\/+$/, '');
  const token = options.token;
  if (!token) throw new Error(`Pass the token: init --token hub_… (create one in Hub, Settings › Tokens)`);
  if (!TOKEN_PATTERN.test(token))
    throw new Error('That does not look like a Hub token (hub_<prefix>_<secret>)');

  const { project } = await context(system, url, token);
  system.out(`✓ Token works. Default project: ${project ?? 'none yet'}`);

  saveConfig(system, { url, token, packVersion: '0.1.0' });
  system.out(`✓ Saved ${configPath(system)}`);

  setUserEnv(system, token);
  system.out(`✓ Set the user environment variable ${TOKEN_ENV}`);

  const plugin = installPlugin(system);
  if (plugin.status !== 0) throw new Error(`Plugin install failed: ${mask(plugin.stderr, token)}`);
  system.out('✓ Installed the hub plugin (/hub:ask, /hub:plan, session hooks)');

  const server = registerUserServer(system, url);
  if (server.status !== 0) throw new Error(`Adding the MCP server failed: ${mask(server.stderr, token)}`);
  system.out(`✓ Added the MCP server "hub" at ${url}/mcp`);

  system.out(
    'Open a new terminal, so that Claude Code sees the variable. Then run: npx @hub/team-pack doctor',
  );
  system.out('In a project folder, run: npx @hub/team-pack link <slug>');
}

/** Writes this folder's `.mcp.json`. Other servers in it stay as they are. */
export async function link(system, options) {
  const slug = options.slug;
  if (!slug || !/^[a-z0-9-]{2,32}$/.test(slug)) throw new Error('Usage: link <slug>');
  const config = loadConfig(system);
  if (!config?.token) throw new Error('Run init first');

  const response = await system.fetch(`${config.url}/api/v1/workspaces`, {
    headers: { authorization: `Bearer ${config.token}`, 'x-requested-with': 'hub' },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Hub answered ${response.status}`);
  const { data } = await response.json();
  const slugs = data.map((project) => project.slug);
  if (!slugs.includes(slug))
    throw new Error(`You are not in a project "${slug}". Yours: ${slugs.join(', ')}`);

  const path = join(options.cwd, '.mcp.json');
  const current = existsSync(path) ? readJsonFile(path) : {};
  if (current === null) throw new Error(`${path} is not valid JSON; fix it first`);
  const next = {
    ...current,
    mcpServers: { ...current.mcpServers, hub: serverEntry(config.url, slug) },
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  if (readFileSync(path, 'utf8').includes(config.token)) {
    rmSync(path);
    throw new Error('Refused to keep a file holding the token');
  }
  system.out(`✓ This folder is on project "${slug}". ${path} holds no token, so it is safe to commit.`);
  system.out('The next chat here asks to approve the "hub" server once. Approve it.');
}

export async function doctor(system, options = {}) {
  const checks = [];
  const check = (name, ok, detail = '') => {
    checks.push({ name, ok });
    system.out(`${ok ? '✓' : '✗'} ${name}${detail ? `: ${detail}` : ''}`);
  };
  const config = loadConfig(system);
  check('Config', Boolean(config?.token), config ? configPath(system) : 'run init');
  const url = config?.url ?? DEFAULT_URL;
  const token = config?.token;
  try {
    const health = await system.fetch(`${url}/api/v1/health/live`, { signal: AbortSignal.timeout(3000) });
    check('Hub reachable', health.ok, url);
  } catch {
    check('Hub reachable', false, `${url}: is it running?`);
  }
  if (token) {
    try {
      const { project } = await context(system, url, token);
      check('Token', true, `active project: ${project ?? 'none'}`);
    } catch (error) {
      check('Token', false, mask(String(error.message), token));
    }
    try {
      const response = await system.fetch(`${url}/mcp`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'hub-doctor', version: '0.1.0' },
          },
        }),
        signal: AbortSignal.timeout(5000),
      });
      check('MCP endpoint', response.ok, `${url}/mcp answered ${response.status}`);
    } catch {
      check('MCP endpoint', false, `${url}/mcp`);
    }
  }
  check(
    'Variable in this terminal',
    Boolean(system.env[TOKEN_ENV]),
    system.env[TOKEN_ENV] ? TOKEN_ENV : `open a new terminal, or run init (${TOKEN_ENV})`,
  );
  const version = claude(system, ['--version']);
  check('Claude Code', version.status === 0, version.stdout.trim());
  if (version.status === 0) {
    const plugins = claude(system, ['plugin', 'list']);
    check('Plugin', plugins.status === 0 && /hub@hub/.test(plugins.stdout), 'hub@hub');
    const server = claude(system, ['mcp', 'get', 'hub']);
    check('MCP server registered', server.status === 0, 'hub');
  }
  const outbox = join(system.home, '.hub', 'outbox');
  const pending = existsSync(outbox) ? readdirSync(outbox) : [];
  if (options.flush && pending.length > 0) {
    const { send } = await import('../plugin/hooks/session-end-send.mjs');
    for (const name of pending) await send(join(outbox, name));
  }
  const left = existsSync(outbox) ? readdirSync(outbox).length : 0;
  check('Session reports all sent', left === 0, left > 0 ? `${left} waiting; doctor --flush sends them` : '');
  return checks.every((item) => item.ok);
}

export function uninstall(system) {
  claude(system, ['mcp', 'remove', 'hub', '--scope', 'user']);
  claude(system, ['plugin', 'uninstall', 'hub@hub', '--scope', 'user']);
  claude(system, ['plugin', 'marketplace', 'remove', 'hub']);
  removeUserEnv(system);
  rmSync(join(system.home, '.hub'), { recursive: true, force: true });
  system.out(
    '✓ Removed the plugin, the MCP server, the variable and ~/.hub. Linked folders keep their .mcp.json.',
  );
}
