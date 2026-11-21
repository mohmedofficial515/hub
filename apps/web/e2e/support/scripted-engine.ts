/**
 * @file The real engine under a browser test: a paired device, a real `hub-bridge`, the real `claude` binary and real tools, in an isolated home, against the throwaway stack, with a scripted stand-in for the model. It costs no usage and makes no model call.
 * @description Nothing of the owner's is touched: the bridge gets a temp `HOME`, `USERPROFILE`, `CLAUDE_CONFIG_DIR` and bridge home, and the folder is a temp Git repository with a temp bare `origin`, so a real `git push` works. The folder goes on the project's list for the test and comes off after. The binary is linked from the VS Code extension, read only.
 * A test takes the `engine` fixture from here instead of `test` from `hub.ts`, and it closes in teardown whatever the test did. `pnpm test:e2e:web --grep scripted` is the proof (`specs/scripted-engine.spec.ts`).
 *
 * ```ts
 * import { hold, text, tool } from '../support/fake-model';
 * import { expect, scriptedEngineAvailable, test } from '../support/scripted-engine';
 *
 * test.skip(!scriptedEngineAvailable(), 'Needs the Claude Code extension on this machine');
 *
 * test('a push pauses', async ({ engine, owner, page }) => {
 *   const chat = await owner.post<{ id: string }>(`workspaces/${owner.ws}/chats`, {
 *     device: engine.deviceId,
 *     folder: engine.folder,
 *   });
 *   engine.script(
 *     text('Pushing now. ', { chunks: 3, delayMs: 200 }),
 *     tool('Bash', { command: 'git push origin main', description: 'push' }),
 *     text('Pushed. '),
 *   );
 *   // Drive the page, or POST chats/{id}/messages, then answer the approval the panel shows.
 * });
 * ```
 *
 * Steps are in `fake-model.ts`: `text`, `tool` (`Bash`, `AskUserQuestion`, `mcp__hub__report_work`, `mcp__hub__report_stage`, `mcp__hub__propose_doc`, `mcp__hub__save_doc`, `mcp__hub__propose_plan` and any other), `hold` (stays open for Stop), `overloaded` (a 529, so the turn shows `retrying` once and takes the next step), `unauthorized` (a 401), or a function for a step that needs an id made earlier. `engine.script` sets the next turn. An empty script just ends the turn.
 * `goOffline` and `goOnline` stop and restart the bridge. `signOut` makes the honest state read signed out on both of its sources: the next turn ends `signed_out`, and `GET chats/engine` says `signedIn: false`. `signIn` puts both back. Pass `{ plugin: true }` to `startScriptedEngine` for the real `/hub:*` skills, which takes some seconds more.
 *
 * The web build bakes the API's address into its rewrites, so a run with `E2E_SKIP_BUILD=1` must use the ports it was built with.
 */
import { type ChildProcess, execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { type ScriptedModel, type ScriptStep, startScriptedModel } from './fake-model';
import { expect, type Rest, test as hubTest } from './hub';
import { API_URL } from './ports';
import { BRIDGE_PIDS_FILE } from './state';

const ROOT = resolve(__dirname, '../../../..');
const BRIDGE_BIN = join(ROOT, 'packages/bridge/bin/hub-bridge.mjs');
const HELPER_BIN = join(ROOT, 'packages/bridge/bin/hub-mcp-headers.mjs');
const TEAM_PACK = join(ROOT, 'packages/team-pack');
const REAL_EXTENSIONS = join(homedir(), '.vscode', 'extensions');
const WAIT_MS = 60_000;
const FAKE_KEY = 'not-a-real-key';
/** What a person's rules commonly let run, so a plain command does not pause. D41's list still beats them. */
const DEFAULT_ALLOW = ['Bash(echo *)', 'Bash(node *)', 'Bash(git status)', 'Bash(git log *)'];

export interface ScriptedEngineOptions {
  /** The device's name in Hub, when this is the worker's first on this project. */
  readonly name?: string;
  /** The isolated `settings.json`'s allow rules. */
  readonly allow?: readonly string[];
  /** Installs the real plugin in the isolated home, for `/hub:work` and the rest. */
  readonly plugin?: boolean;
  /** More variables for the bridge, such as `HUB_BRIDGE_APPROVAL_TIMEOUT_MS`. */
  readonly env?: Readonly<Record<string, string>>;
}

export interface ScriptedEngine {
  readonly deviceId: string;
  /** The temp Git repository, already on the project's list. */
  readonly folder: string;
  /** What the binary asked and was told. */
  readonly model: ScriptedModel;
  /** Sets what the next turn does. */
  script(...steps: ScriptStep[]): void;
  /** Stops the bridge and waits until Hub says the device is offline. A running turn ends `interrupted`. */
  goOffline(): Promise<void>;
  goOnline(): Promise<void>;
  signOut(): void;
  signIn(): void;
  close(): Promise<void>;
}

function newestExtension(): string | null {
  if (!existsSync(REAL_EXTENSIONS)) return null;
  return (
    readdirSync(REAL_EXTENSIONS)
      .filter((name) => name.startsWith('anthropic.claude-code-'))
      .sort()
      .at(-1) ?? null
  );
}

/** The real binary comes from the VS Code extension, so a machine without it skips these tests. */
export const scriptedEngineAvailable = (): boolean => newestExtension() !== null;

async function until<T>(check: () => T | Promise<T>, what: string): Promise<NonNullable<T>> {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

function killTree(pid: number): void {
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(pid);
  } catch {
    /* Already gone. */
  }
}

/** The bridges a test started and has not stopped. */
export function recordedBridges(): number[] {
  if (!existsSync(BRIDGE_PIDS_FILE)) return [];
  return readFileSync(BRIDGE_PIDS_FILE, 'utf8')
    .split('\n')
    .map(Number)
    .filter((pid) => pid > 0);
}

function forgetBridge(pid: number): void {
  const left = recordedBridges().filter((known) => known !== pid);
  writeFileSync(BRIDGE_PIDS_FILE, left.map((known) => `${known}\n`).join(''));
}

/** A number alone proves nothing, as an ended process's number gets reused. Only this repository's own bridge counts, which the owner's, running from `~/.hub`, is not. */
function isThisRepositorysBridge(pid: number): boolean {
  const answer =
    process.platform === 'win32'
      ? spawnSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`,
          ],
          { encoding: 'utf8', windowsHide: true },
        )
      : spawnSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' });
  return answer.stdout.includes(BRIDGE_BIN);
}

/** For the run's teardown: a worker that died skipped its fixture's, and a bridge left running retries for ever. */
export function stopLeftoverBridges(): void {
  for (const pid of recordedBridges()) {
    if (isThisRepositorysBridge(pid)) killTree(pid);
  }
  rmSync(BRIDGE_PIDS_FILE, { force: true });
}

interface Paired {
  readonly deviceId: string;
  readonly credential: string;
}

const paired = new Map<string, Paired>();

/** Pairing is limited to 10 a minute, and a test takes less than six seconds. So a worker keeps one device per project, and each test gets a new home for it. A worker that restarts pairs again, and waits out the limit if it must. */
async function pairedDevice(rest: Rest, name: string): Promise<Paired> {
  const known = paired.get(rest.ws);
  if (known) return known;
  const started = await pairingStart(rest, name);
  await rest.post(`pairing/${started.userCode}/approve`);
  const device = await rest.post<Paired>('pairing/poll', { deviceCode: started.deviceCode });
  paired.set(rest.ws, device);
  return device;
}

async function pairingStart(rest: Rest, name: string): Promise<{ deviceCode: string; userCode: string }> {
  for (;;) {
    const answer = await rest.context.post('/api/v1/pairing/start', {
      data: { name, platform: process.platform },
      headers: { 'X-Requested-With': 'hub' },
    });
    const body = (await answer.json()) as {
      data: { deviceCode: string; userCode: string };
      error?: { details?: { retryAfterSec?: number } };
    };
    if (answer.ok()) return body.data;
    if (answer.status() !== 429) throw new Error(`pairing/start: ${answer.status()}`);
    await new Promise((done) => setTimeout(done, ((body.error?.details?.retryAfterSec ?? 5) + 1) * 1000));
  }
}

/** A repository with one commit, and a bare `origin` beside it so a push has somewhere real to go. */
function aRepository(scratch: string): string {
  const folder = join(scratch, 'repo');
  const remote = join(scratch, 'origin.git');
  mkdirSync(folder);
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.email=t@example.test', '-c', 'user.name=t', ...args], {
      cwd: folder,
      stdio: 'ignore',
    });
  git('init', '-q', '-b', 'main');
  writeFileSync(join(folder, 'README.md'), '# A test repository\n');
  git('add', '.');
  git('commit', '-q', '-m', 'first');
  execFileSync('git', ['init', '-q', '--bare', remote], { stdio: 'ignore' });
  git('remote', 'add', 'origin', remote);
  return folder;
}

export async function startScriptedEngine(
  rest: Rest,
  options: ScriptedEngineOptions = {},
): Promise<ScriptedEngine> {
  const extension = newestExtension();
  if (!extension) throw new Error('No Claude Code extension on this machine');

  // The long form: Claude Code compares paths with the folder it resolved, and the temp folder's default spelling can hold a short name.
  const scratch = realpathSync.native(mkdtempSync(join(tmpdir(), 'hub-e2e-engine-')));
  const home = join(scratch, 'home');
  const configDir = join(home, 'claude-config');
  const hubRoot = join(home, '.hub');
  const helper = join(hubRoot, 'app', 'bridge', 'bin', 'hub-mcp-headers.mjs');
  const extensionLink = join(home, '.vscode', 'extensions', extension);
  mkdirSync(dirname(helper), { recursive: true });
  mkdirSync(configDir, { recursive: true });
  mkdirSync(dirname(extensionLink), { recursive: true });
  cpSync(HELPER_BIN, helper);
  symlinkSync(join(REAL_EXTENSIONS, extension), extensionLink, 'junction');

  const model = await startScriptedModel();
  const folder = aRepository(scratch);
  const project = await rest.get<{ repoPaths: string[] }>(`workspaces/${rest.ws}`);
  const setFolders = async (repoPaths: string[]) => {
    const answer = await rest.context.patch(`/api/v1/workspaces/${rest.ws}`, {
      data: { repoPaths },
      headers: { 'X-Requested-With': 'hub' },
    });
    if (!answer.ok()) throw new Error(`Setting folders: ${answer.status()} ${await answer.text()}`);
  };
  await setFolders([...project.repoPaths, folder]);

  const { deviceId, credential } = await pairedDevice(rest, options.name ?? 'Scripted');

  writeFileSync(join(hubRoot, 'device.json'), JSON.stringify({ url: API_URL, deviceId, credential }));
  writeFileSync(
    join(configDir, '.claude.json'),
    JSON.stringify({
      mcpServers: {
        hub: {
          type: 'http',
          url: `${API_URL}/mcp`,
          headersHelper: `"${process.execPath}" "${helper}"`,
          headers: { 'X-Hub-Project': rest.ws },
        },
      },
    }),
  );
  /** `claude auth status`, which is what `signedIn` reads, says signed in with a helper. The helper is what `signOut` takes away. */
  const writeSettings = (signedIn: boolean) =>
    writeFileSync(
      join(configDir, 'settings.json'),
      JSON.stringify({
        permissions: { allow: options.allow ?? DEFAULT_ALLOW },
        ...(signedIn ? { apiKeyHelper: `"${process.execPath}" -e "console.log('${FAKE_KEY}')"` } : {}),
      }),
    );
  writeSettings(true);

  const clean = {} as NodeJS.ProcessEnv;
  for (const [key, value] of Object.entries(process.env)) {
    if (!/^(CLAUDE|ANTHROPIC)/i.test(key)) clean[key] = value;
  }
  const isolated: NodeJS.ProcessEnv = {
    ...clean,
    HOME: home,
    USERPROFILE: home,
    CLAUDE_CONFIG_DIR: configDir,
  };

  if (options.plugin) {
    const binary = join(extensionLink, 'resources', 'native-binary', 'claude.exe');
    const run = (...args: string[]) =>
      execFileSync(binary, args, { cwd: home, env: isolated, stdio: 'ignore' });
    run('plugin', 'marketplace', 'add', TEAM_PACK);
    run('plugin', 'install', 'hub@hub', '--scope', 'user');
  }

  const isOnline = async () => {
    const devices = await rest.get<{ id: string; online: boolean }[]>('me/devices');
    return devices.find((device) => device.id === deviceId)?.online === true;
  };

  let child: ChildProcess | null = null;
  async function goOnline(): Promise<void> {
    child = spawn(process.execPath, [BRIDGE_BIN, 'run'], {
      env: {
        ...isolated,
        HUB_BRIDGE_SKIP_LOGIN_START: '1',
        HUB_BRIDGE_CLAUDE_ENV: JSON.stringify({
          ANTHROPIC_BASE_URL: model.url,
          ANTHROPIC_API_KEY: FAKE_KEY,
          // The binary retries a 401 for minutes with its own backoff, so a test would wait that long to see signed out. One retry still shows `retrying`.
          CLAUDE_CODE_MAX_RETRIES: '1',
        }),
        ...options.env,
      },
      stdio: 'ignore',
      windowsHide: true,
    });
    if (child.pid) {
      mkdirSync(dirname(BRIDGE_PIDS_FILE), { recursive: true });
      appendFileSync(BRIDGE_PIDS_FILE, `${child.pid}\n`);
    }
    await until(isOnline, 'the device to come online');
  }

  async function goOffline(): Promise<void> {
    if (child?.pid) {
      killTree(child.pid);
      forgetBridge(child.pid);
    }
    child = null;
    await until(async () => !(await isOnline()), 'the device to go offline');
  }

  await goOnline();
  return {
    deviceId,
    folder,
    model,
    script: (...steps) => model.script(...steps),
    goOffline,
    goOnline,
    signOut() {
      writeSettings(false);
      model.rejectAll(true);
    },
    signIn() {
      writeSettings(true);
      model.rejectAll(false);
    },
    async close() {
      // Offline for certain: the next test's bridge must not read this one's socket as its own.
      await goOffline().catch(() => undefined);
      await model.close();
      await setFolders(project.repoPaths).catch(() => undefined);
      // The link first, so removing the folder never reaches the real extension.
      rmSync(extensionLink, { recursive: true, force: true });
      try {
        rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        /* A file a process that just ended still holds. It is only a temp folder. */
      }
    },
  };
}

/** `hub.ts`'s `test`, with `engine`. A test that does not ask for it starts nothing. */
export const test = hubTest.extend<{ engine: ScriptedEngine }>({
  engine: async ({ owner }, use) => {
    const engine = await startScriptedEngine(owner);
    try {
      await use(engine);
    } finally {
      await engine.close();
    }
  },
});

export { expect };
