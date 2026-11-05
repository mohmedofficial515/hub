/**
 * @file A fake outside world for the bridge's tests: a temp home, recorded programs, a fake Hub. Nothing real is touched: no Claude Code, no registry, no scheduled task.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CREDENTIAL = `hub_abcd1234_${'c'.repeat(80)}`;
export const HOOK_TOKEN = `hub_efef5678_${'h'.repeat(80)}`;
export const URL = 'http://hub.test:7310';

/**
 * `claude` here keeps its config file the way the real one does for the commands the bridge uses, because the tests read that file afterwards.
 */
export function fakeSystem(overrides = {}) {
  const home = mkdtempSync(join(tmpdir(), 'hub-bridge-'));
  const configDir = join(home, 'claude-config');
  mkdirSync(configDir, { recursive: true });
  const configFile = join(configDir, '.claude.json');
  writeFileSync(configFile, JSON.stringify({ userID: 'keep-me', numStartups: 7, projects: {} }, null, 2));
  const claudePath = join(home, '.local', 'bin', 'claude.exe');
  mkdirSync(join(home, '.local', 'bin'), { recursive: true });
  writeFileSync(claudePath, '');

  const calls = [];
  const lines = [];
  const detached = [];
  const plugins = [];
  const readConfig = () => JSON.parse(readFileSync(configFile, 'utf8'));
  const writeConfig = (value) => writeFileSync(configFile, JSON.stringify(value, null, 2));

  function claude(args, options) {
    const line = args.join(' ');
    if (line === '--version')
      return { status: 0, stdout: `${system.claudeVersion} (Claude Code)\n`, stderr: '' };
    if (line === 'auth status') {
      return { status: 0, stdout: JSON.stringify({ loggedIn: system.signedIn }), stderr: '' };
    }
    if (args[0] === 'mcp' && args[1] === 'add-json') {
      if (system.mcpFails) return { status: 1, stdout: '', stderr: `broke with ${CREDENTIAL}` };
      const scope = args[args.indexOf('--scope') + 1];
      const entry = JSON.parse(args[3]);
      const config = readConfig();
      if (scope === 'user') config.mcpServers = { ...config.mcpServers, hub: entry };
      else {
        const key = options.cwd.replaceAll('\\', '/');
        config.projects = { ...config.projects };
        config.projects[key] = {
          allowedTools: [],
          ...config.projects[key],
          mcpServers: { hub: entry },
        };
      }
      writeConfig(config);
      return { status: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'mcp' && args[1] === 'remove') {
      const config = readConfig();
      if (args[args.indexOf('--scope') + 1] === 'user') delete config.mcpServers?.hub;
      else delete config.projects?.[options.cwd.replaceAll('\\', '/')]?.mcpServers?.hub;
      writeConfig(config);
      return { status: 0, stdout: '', stderr: '' };
    }
    if (line === 'plugin list --json') return { status: 0, stdout: JSON.stringify(plugins), stderr: '' };
    if (line.startsWith('plugin install')) {
      plugins.push({ id: 'hub@hub', enabled: true });
      return { status: 0, stdout: '', stderr: '' };
    }
    if (line.startsWith('plugin uninstall')) {
      plugins.length = 0;
      return { status: 0, stdout: '', stderr: '' };
    }
    return { status: 0, stdout: '', stderr: '' };
  }

  const system = {
    platform: 'win32',
    home,
    hostname: 'TEST-PC',
    env: { CLAUDE_CONFIG_DIR: configDir, PATH: '', HUB_BRIDGE_NO_BROWSER: '1' },
    nodePath: 'C:\\Program Files\\nodejs\\node.exe',
    claudeVersion: '2.1.318',
    signedIn: true,
    mcpFails: false,
    registryHandler: '"C:\\nowhere\\Code.exe" --open-url -- "%1"',
    taskRegistered: false,
    taskRefused: false,
    calls,
    lines,
    detached,
    configFile,
    claudePath,
    readConfig,
    writeConfig,
    out: (line) => lines.push(line),
    sleep: async () => {},
    fetch: async () => {
      throw new Error('No fetch in this test');
    },
    spawnDetached(command, args) {
      detached.push([command, ...args]);
      return 4242;
    },
    async run(command, args, options = {}) {
      calls.push({ command, args, cwd: options.cwd });
      if (command === claudePath) return claude(args, options);
      if (command === 'reg.exe' && args[0] === 'query' && args[1].startsWith('HKCR')) {
        return { status: 0, stdout: `(Default)    REG_SZ    ${system.registryHandler}\n`, stderr: '' };
      }
      if (command === 'schtasks.exe' && args[0] === '/Create') {
        if (system.taskRefused) return { status: 1, stdout: '', stderr: 'Access is denied.' };
        system.taskRegistered = true;
        return { status: 0, stdout: '', stderr: '' };
      }
      if (command === 'schtasks.exe' && args[0] === '/Query') {
        return { status: system.taskRegistered ? 0 : 1, stdout: '', stderr: '' };
      }
      if (command === 'schtasks.exe' && args[0] === '/Delete') {
        system.taskRegistered = false;
        return { status: 0, stdout: '', stderr: '' };
      }
      if (command === 'reg.exe' && args[0] === 'add') {
        system.taskRegistered = true;
        return { status: 0, stdout: '', stderr: '' };
      }
      if (command === 'reg.exe') return { status: 1, stdout: '', stderr: '' };
      return { status: 0, stdout: '', stderr: '' };
    },
    ...overrides,
  };
  return system;
}

/** A Hub that answers pairing, and says whether a credential is still good. */
export function fakeHub(system, { answers = [], credentialGood = true } = {}) {
  const requests = [];
  const queue = [...answers];
  const hub = { requests, credentialGood };
  system.fetch = async (url, init = {}) => {
    requests.push({ url, method: init.method, body: init.body, authorization: init.headers?.authorization });
    const json = (status, body) => new Response(JSON.stringify(body), { status });
    if (url.endsWith('/mcp')) return json(hub.credentialGood ? 200 : 401, {});
    if (url.endsWith('/api/v1/pairing/start')) {
      return json(201, {
        data: {
          deviceCode: 'd'.repeat(43),
          userCode: 'ABCD-EFGH',
          approveUrl: 'http://hub.test:7300/connect?code=ABCD-EFGH',
          expiresInSeconds: 600,
          pollSeconds: 3,
        },
      });
    }
    if (url.endsWith('/api/v1/pairing/poll')) {
      return json(200, { data: queue.shift() ?? { status: 'pending' } });
    }
    if (url.endsWith('/api/v1/bridge/self')) return new Response(null, { status: 204 });
    return json(404, {});
  };
  return hub;
}

export const CLAIMED = {
  status: 'claimed',
  deviceId: 'dev-1',
  credential: CREDENTIAL,
  hookToken: HOOK_TOKEN,
};

export function aFolder(system, name = 'project') {
  const folder = join(system.home, name);
  mkdirSync(folder, { recursive: true });
  return folder;
}

export function exists(path) {
  return existsSync(path);
}
