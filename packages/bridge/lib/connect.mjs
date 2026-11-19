/**
 * @file The one command (docs/16 §5, D42): pair, then install the bridge, the MCP server and the plugin. Safe to run again. `uninstall` takes it all back.
 * @description Pairing opens the browser, and the owner approves there. The main machine skips that: `pnpm start:local` passes credentials on stdin, never in an argument, because arguments show in process lists.
 * Every line of output says what changed, so nothing happens to the owner's Claude Code silently. A credential is never printed, and an error from a child process is shown only after masking it.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { resolveClaude } from './claude.mjs';
import { signedIn } from './health.mjs';
import { installMcpServer, installPlugin, pluginIsInstalled, userServerIsRight } from './install.mjs';
import { readLinks } from './links.mjs';
import { isLoginStartRegistered, registerLoginStart, removeLoginStart } from './login-start.mjs';
import { hubPaths, readJson, writePrivateJson } from './paths.mjs';
import { runningBridgePid, stopRunningBridge } from './service.mjs';

const PACK_VERSION = '0.1.0';

function mask(text, device) {
  let masked = text;
  for (const secret of [device?.credential, device?.hookToken]) {
    if (secret) masked = masked.replaceAll(secret, '<credential>');
  }
  return masked;
}

/** Copies the bridge and the plugin out of a checkout, for the main machine. A new device gets them from Hub's bundle instead. */
export function copyFromCheckout(system, packages) {
  const { app } = hubPaths(system);
  rmSync(app, { recursive: true, force: true });
  const copies = [
    ['bridge', ['bin', 'lib', 'package.json']],
    ['team-pack', ['.claude-plugin', 'plugin', 'package.json']],
  ];
  for (const [part, entries] of copies) {
    mkdirSync(join(app, part), { recursive: true });
    for (const entry of entries) {
      cpSync(join(packages, part, entry), join(app, part, entry), { recursive: true });
    }
  }
}

function sameTree(left, right) {
  if (!existsSync(right)) return false;
  if (statSync(left).isFile()) return readFileSync(left, 'utf8') === readFileSync(right, 'utf8');
  return readdirSync(left).every((name) => sameTree(join(left, name), join(right, name)));
}

/** Whether `~/.hub/app` already holds this checkout's bridge, so a pull reaches the main machine on its next start. */
export function appMatchesCheckout(system, packages) {
  const bridge = join(hubPaths(system).app, 'bridge');
  return ['bin', 'lib'].every((entry) => sameTree(join(packages, 'bridge', entry), join(bridge, entry)));
}

/** Whether Hub still accepts this credential: the same call Claude Code makes first. */
export async function credentialWorks(system, url, credential) {
  const response = await system.fetch(`${url}/mcp`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${credential}`,
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
        clientInfo: { name: 'hub-bridge', version: PACK_VERSION },
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}

export async function openBrowser(system, url) {
  if (system.env.HUB_BRIDGE_NO_BROWSER === '1') return;
  if (!/^https?:\/\/[\w.:\-[\]/]+(\?code=[A-Z0-9-]+)?$/.test(url)) return;
  // No shell: rundll32 takes the URL as one argument, where `start` would go through cmd.
  if (system.platform === 'win32') await system.run('rundll32.exe', ['url.dll,FileProtocolHandler', url]);
  else if (system.platform === 'darwin') await system.run('open', [url]);
  else await system.run('xdg-open', [url]);
}

async function apiPost(system, url, path, body) {
  const response = await system.fetch(`${url}/api/v1/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const parsed = await response.json().catch(() => null);
  if (!response.ok) throw new Error(parsed?.error?.message ?? `Hub answered ${response.status}`);
  return parsed.data;
}

/** The browser step. Answers the claimed credentials, or throws what the owner should read. */
export async function pairInBrowser(system, url) {
  const started = await apiPost(system, url, 'pairing/start', {
    name: system.hostname,
    platform: system.platform,
  });
  system.out('');
  system.out(`Approve this device in your browser. The code is:  ${started.userCode}`);
  system.out(`If no page opened, go to ${started.approveUrl}`);
  system.out('');
  await openBrowser(system, started.approveUrl);
  const deadline = Date.now() + started.expiresInSeconds * 1000;
  while (Date.now() < deadline) {
    await system.sleep(started.pollSeconds * 1000);
    let answer;
    try {
      answer = await apiPost(system, url, 'pairing/poll', { deviceCode: started.deviceCode });
    } catch {
      continue; // A dropped request is not an answer.
    }
    if (answer.status === 'claimed' && answer.credential) return answer;
    if (answer.status === 'denied')
      throw new Error('The device was refused in the browser. Nothing changed.');
    if (answer.status === 'expired' || answer.status === 'claimed') break;
  }
  throw new Error('The code expired before it was approved. Run the command again. Nothing changed.');
}

function startBridge(system) {
  const paths = hubPaths(system);
  return system.spawnDetached(system.nodePath, [paths.bridgeBin, 'run']);
}

/** Starts the bridge unless it is already up. Answers whether it had to. */
export function ensureBridgeRunning(system) {
  if (runningBridgePid(system)) return false;
  startBridge(system);
  return true;
}

/** For a bridge Hub does not see: ends the one running, if any, and starts a fresh one. Answers whether one was running. */
export async function restartBridge(system) {
  const wasRunning = Boolean(runningBridgePid(system));
  await stopRunningBridge(system);
  startBridge(system);
  return wasRunning;
}

/**
 * Asks Hub, with the device credential, whether it accepts it and holds this device's bridge right now. One request.
 * Answers null when this Hub has no such route yet, so the caller can fall back to `credentialWorks`.
 */
export async function bridgeSelf(system, url, credential) {
  const response = await system.fetch(`${url}/api/v1/bridge/self`, {
    method: 'GET',
    headers: { authorization: `Bearer ${credential}`, accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 401 || response.status === 403) return { paired: false, online: false };
  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  const online = body?.data?.online;
  return { paired: true, online: online === true };
}

/**
 * What this device already has, for a quick answer on each `pnpm start:local`. No secret leaves this function.
 * `online` is whether Hub sees the bridge connected, or null when it could not tell: a live process alone does not mean a connected bridge.
 */
export async function connectionState(system, url) {
  const paths = hubPaths(system);
  const device = readJson(paths.device);
  let paired = false;
  let online = null;
  if (device?.credential && device.url === url) {
    try {
      const self = await bridgeSelf(system, url, device.credential);
      if (self) ({ paired, online } = self);
      else paired = await credentialWorks(system, url, device.credential);
    } catch {
      paired = false;
    }
  }
  return {
    paired,
    online,
    complete: paired && existsSync(paths.bridgeBin) && userServerIsRight(system, url),
  };
}

/**
 * The whole connect. `options.credentials` is the main machine's already-issued set; without it the browser step runs when this device has no working credential.
 * Answers `{ changed: string[] }`, also printed line by line.
 */
export async function connect(system, options) {
  const url = options.url.replace(/\/+$/, '');
  const paths = hubPaths(system);
  const changed = [];
  const say = (line) => {
    changed.push(line);
    system.out(`  ${line}`);
  };
  mkdirSync(paths.root, { recursive: true });

  system.out('Connecting this device to Hub.');
  const existing = readJson(paths.device);
  let working = false;
  if (existing?.credential && existing.url === url && !options.credentials) {
    working = await credentialWorks(system, url, existing.credential);
  }
  let device = existing;
  if (!working) {
    const issued = options.credentials ?? (await pairInBrowser(system, url));
    device = {
      url,
      deviceId: issued.deviceId,
      credential: issued.credential,
      name: system.hostname,
    };
    writePrivateJson(paths.device, device);
    writePrivateJson(paths.config, { url, token: issued.hookToken, packVersion: PACK_VERSION, device: true });
    say(`Paired this device as "${system.hostname}", and saved its credentials in ${paths.root}.`);
  } else {
    system.out('  This device is already paired.');
  }

  const claude = await resolveClaude(system);
  if (claude.best) {
    try {
      const server = await installMcpServer(system, claude.best.path, url);
      if (server.changed) {
        say(`Claude Code: set the MCP server "hub" at user scope to ${url}/mcp, using headersHelper.`);
      }
      const plugin = await installPlugin(system, claude.best.path);
      if (plugin.changed)
        say(
          'Claude Code: installed the hub plugin at user scope (/hub:start, /hub:next, /hub:done, /hub:ask, /hub:plan, session hooks).',
        );
    } catch (error) {
      system.out(`  ${mask(String(error.message), device)}`);
      system.out('  Settings › Devices shows this, with a Fix button.');
    }
    if (claude.onPath && claude.onPath.version !== claude.best.version) {
      system.out(
        `  Note: "claude" in your terminal is ${claude.onPath.version}, and the bridge uses ${claude.best.version}.`,
      );
    }
    if (!(await signedIn(system, claude.best.path))) {
      system.out('  Note: Claude Code is not signed in here. Run: claude auth login');
    }
  } else {
    system.out('  Claude Code was not found. Install it, then press Fix in Settings › Devices.');
  }

  if (!(await isLoginStartRegistered(system)) || options.forceLoginStart) {
    const login = await registerLoginStart(system, system.nodePath, paths.bridgeBin);
    if (login.ok) say(`The bridge now starts when you log in: ${login.how}. No admin rights used.`);
    else system.out(`  Could not set the start at login: ${login.how}`);
  }

  await stopRunningBridge(system);
  const pid = startBridge(system);
  say(`Started the bridge (process ${pid}).`);
  return { changed };
}

/** The clean uninstall. Hub's own files go with `~/.hub`. Trust a press accepted stays, as a dialog the owner had accepted would. */
export async function uninstall(system) {
  const paths = hubPaths(system);
  const device = readJson(paths.device);
  system.out('Removing Hub from this device.');
  if (device?.credential) {
    try {
      const response = await system.fetch(`${device.url}/api/v1/bridge/self`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${device.credential}` },
        signal: AbortSignal.timeout(10_000),
      });
      system.out(response.ok ? '  Revoked this device in Hub.' : '  Hub already had this device revoked.');
    } catch {
      system.out('  Hub could not be reached: revoke this device in Settings › Devices.');
    }
  }
  await stopRunningBridge(system);
  await removeLoginStart(system);
  system.out('  Stopped the bridge and removed its start at login.');
  const { best } = await resolveClaude(system);
  if (best) {
    for (const link of readLinks(system)) {
      for (const cwd of link.keys ?? []) {
        await system.run(best.path, ['mcp', 'remove', 'hub', '--scope', 'local'], { cwd });
      }
    }
    await system.run(best.path, ['mcp', 'remove', 'hub', '--scope', 'user']);
    await system.run(best.path, ['plugin', 'uninstall', 'hub@hub', '--scope', 'user']);
    await system.run(best.path, ['plugin', 'marketplace', 'remove', 'hub']);
    system.out('  Removed the MCP server and the plugin from Claude Code.');
  }
  rmSync(paths.root, { recursive: true, force: true });
  system.out(`  Removed ${paths.root}.`);
  system.out('  Folders you linked stay trusted in Claude Code, as if you had accepted the dialog yourself.');
}

/** `hub-bridge status`. No secret, ever. */
export async function status(system) {
  const paths = hubPaths(system);
  const device = readJson(paths.device);
  const claudePath = (await resolveClaude(system)).best?.path;
  const answer = {
    paired: Boolean(device?.credential),
    url: device?.url ?? null,
    deviceId: device?.deviceId ?? null,
    running: Boolean(runningBridgePid(system)),
    plugin: claudePath ? await pluginIsInstalled(system, claudePath) : false,
    mcpServer: device?.url ? userServerIsRight(system, device.url) : false,
    loginStart: await isLoginStartRegistered(system),
  };
  return answer;
}
