/**
 * @file Finding the official Claude Code binary (docs/16 S1 Q1, C3).
 * @description Several copies can exist at once: on this machine `claude` on PATH is 2.1.202 and the VS Code extension holds 2.1.318. The bridge asks each one its
 * version and uses the newest. It never goes through `claude.cmd`, because that needs a shell: the npm shim only forwards to a real `.exe`, so it resolves that.
 * Nothing here reads a credential file, and sign-in is asked of `claude auth status`.
 */
import { existsSync, readdirSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

/** Below this, `-p` lacks what the bridge relies on (docs/16 S1). */
export const CLAUDE_MIN_VERSION = '2.1.318';
/**
 * The newest version the chat engine was tested on (docs/16 §13, S1 Q6: `--bare` may become the default for `-p`). Widen it only after running the real-binary suite on the new version.
 * `HUB_CLAUDE_MAX_VERSION` on the bridge lets the owner try a newer one without a Hub update, knowingly.
 */
export const CLAUDE_MAX_VERSION = '2.1.318';

export function parseVersion(text) {
  return /(\d+\.\d+\.\d+)/.exec(text ?? '')?.[1] ?? null;
}

export function compareVersions(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

const pathOf = (env) => env.PATH ?? env.Path ?? env.path ?? '';
const NPM_EXE = ['node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'];

/** What `claude` on PATH really is: the `.exe` itself or behind the npm shim. Null when PATH has none that can run with no shell. */
export function claudeOnPath(system) {
  for (const folder of pathOf(system.env).split(delimiter).filter(Boolean)) {
    if (system.platform !== 'win32') {
      const plain = join(folder, 'claude');
      if (existsSync(plain)) return plain;
      continue;
    }
    const exe = join(folder, 'claude.exe');
    if (existsSync(exe)) return exe;
    if (existsSync(join(folder, 'claude.cmd'))) {
      const shimTarget = join(folder, ...NPM_EXE);
      if (existsSync(shimTarget)) return shimTarget;
    }
  }
  return null;
}

function extensionBinaries(system) {
  const name = system.platform === 'win32' ? 'claude.exe' : 'claude';
  const found = [];
  for (const root of ['.vscode', '.vscode-insiders']) {
    const extensions = join(system.home, root, 'extensions');
    if (!existsSync(extensions)) continue;
    for (const entry of readdirSync(extensions)) {
      if (!entry.startsWith('anthropic.claude-code-')) continue;
      const binary = join(extensions, entry, 'resources', 'native-binary', name);
      if (existsSync(binary)) found.push(binary);
    }
  }
  return found;
}

export function claudeCandidates(system) {
  const name = system.platform === 'win32' ? 'claude.exe' : 'claude';
  const known = [
    claudeOnPath(system),
    join(system.home, '.local', 'bin', name),
    join(system.home, '.claude', 'local', name),
    ...(system.env.APPDATA ? [join(system.env.APPDATA, 'npm', ...NPM_EXE)] : []),
    ...extensionBinaries(system),
  ];
  return [...new Set(known.filter((path) => path && existsSync(path)))];
}

/** Every copy with its version, newest first, and which one PATH gives the owner's own terminal. */
export async function resolveClaude(system) {
  const copies = [];
  for (const path of claudeCandidates(system)) {
    const answer = await system.run(path, ['--version'], { timeoutMs: 20_000 });
    const version = answer.status === 0 ? parseVersion(answer.stdout) : null;
    if (version) copies.push({ path, version });
  }
  copies.sort((a, b) => compareVersions(b.version, a.version));
  const onPathFile = claudeOnPath(system);
  return {
    best: copies[0] ?? null,
    copies,
    onPath: copies.find((copy) => copy.path === onPathFile) ?? null,
  };
}

export function inTestedRange(version, env = {}) {
  const max = parseVersion(env.HUB_CLAUDE_MAX_VERSION) ?? CLAUDE_MAX_VERSION;
  return compareVersions(version, CLAUDE_MIN_VERSION) >= 0 && compareVersions(version, max) <= 0;
}

export function meetsMinimum(version) {
  return compareVersions(version, CLAUDE_MIN_VERSION) >= 0;
}

/** The command that updates a copy, by where it lives. Shown to the owner, never run by Hub. */
export function updateHint(path) {
  if (/node_modules[\\/]@anthropic-ai/.test(path)) return 'npm install -g @anthropic-ai/claude-code@latest';
  if (/\.vscode/.test(dirname(path))) return 'Update the Claude Code extension in VS Code';
  return 'claude update';
}
