/**
 * @file Where things live on a device. Everything of Hub's is under `~/.hub`, so uninstalling is one folder.
 * @description The device credential has its own file, separate from `config.json`, because the plugin's hooks read that one and must get only the hook token.
 */
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function hubPaths(system) {
  const root = join(system.home, '.hub');
  return {
    root,
    device: join(root, 'device.json'),
    config: join(root, 'config.json'),
    links: join(root, 'links.json'),
    pid: join(root, 'bridge.pid'),
    log: join(root, 'bridge.log'),
    chat: join(root, 'chat'),
    app: join(root, 'app'),
    bridgeBin: join(root, 'app', 'bridge', 'bin', 'hub-bridge.mjs'),
    helperBin: join(root, 'app', 'bridge', 'bin', 'hub-mcp-headers.mjs'),
    marketplace: join(root, 'app', 'team-pack'),
  };
}

/** Claude Code's global config. Internal to Claude Code, and the bridge reaches it only for D44 and to see whether `hub` is registered. */
export function claudeConfigFile(system) {
  const dir = system.env.CLAUDE_CONFIG_DIR;
  return dir ? join(dir, '.claude.json') : join(system.home, '.claude.json');
}

export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** A file only this user should read. `mode` does nothing on Windows, where the user profile's own permissions do this job. */
export function writePrivateJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* Windows: nothing to do. */
  }
}
