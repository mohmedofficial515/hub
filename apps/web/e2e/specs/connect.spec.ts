/**
 * @file The whole of Slice 1 for real, in an isolated home: one command → approve in the browser → `claude mcp list` shows Hub connected through `headersHelper` → a real tool call through the real binary →
 * the Link button → a chat in that folder lands on the right project → run it again, nothing changes → uninstall, nothing left. `pnpm start:local`'s step too.
 * @description On request, as it needs Claude Code on this machine: `E2E_PACK=1 pnpm test:e2e:web --grep "one command"`. Every process gets a temp `HOME`, `USERPROFILE` and `CLAUDE_CONFIG_DIR`, with
 * `HUB_BRIDGE_SKIP_LOGIN_START=1`, so the owner's Claude Code and login tasks are not touched. There is no sign-in there, so `ANTHROPIC_BASE_URL` points the real binary at `fake-model.ts`: no model call happens.
 */
import { type ChildProcess, execFile, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { startFakeModel } from '../support/fake-model';
import { expect, test, view, word, words } from '../support/hub';
import { API_URL } from '../support/ports';
import { shared } from '../support/state';

const ROOT = resolve(__dirname, '../../../..');
const REAL_EXTENSIONS = join(homedir(), '.vscode', 'extensions');

test.skip(!process.env['E2E_PACK'], 'Needs Claude Code on this machine: E2E_PACK=1');

interface Isolated {
  home: string;
  configDir: string;
  env: NodeJS.ProcessEnv;
}

/** A home with no Claude config at all. Only the newest extension binary is visible, through a link. */
function anIsolatedHome(): Isolated {
  const home = mkdtempSync(join(tmpdir(), 'hub-e2e-connect-'));
  const configDir = join(home, 'claude-config');
  mkdirSync(configDir);
  const extension = readdirSync(REAL_EXTENSIONS)
    .filter((name) => name.startsWith('anthropic.claude-code-'))
    .sort()
    .at(-1);
  if (!extension) throw new Error('No Claude Code extension on this machine');
  mkdirSync(join(home, '.vscode', 'extensions'), { recursive: true });
  symlinkSync(join(REAL_EXTENSIONS, extension), join(home, '.vscode', 'extensions', extension), 'junction');
  const env = { NODE_ENV: 'test' } as NodeJS.ProcessEnv;
  for (const [key, value] of Object.entries(process.env)) {
    if (!/^(CLAUDE|ANTHROPIC)/i.test(key)) env[key] = value;
  }
  Object.assign(env, {
    HOME: home,
    USERPROFILE: home,
    CLAUDE_CONFIG_DIR: configDir,
    HUB_BRIDGE_NO_BROWSER: '1',
    HUB_BRIDGE_SKIP_LOGIN_START: '1',
  });
  return { home, configDir, env };
}

function claudeBinary(home: string): string {
  const extensions = join(home, '.vscode', 'extensions');
  const [name] = readdirSync(extensions);
  return join(extensions, name!, 'resources', 'native-binary', 'claude.exe');
}

function runClaude(
  iso: Isolated,
  args: string[],
  cwd: string,
  extraEnv: Record<string, string> = {},
  input = '',
) {
  return new Promise<{ status: number; stdout: string; stderr: string }>((done) => {
    const child = execFile(
      claudeBinary(iso.home),
      args,
      {
        cwd,
        env: { ...iso.env, ...extraEnv },
        windowsHide: true,
        timeout: 120_000,
        maxBuffer: 20_000_000,
      },
      (error, stdout, stderr) =>
        done({ status: error ? ((error as { code?: number }).code ?? 1) : 0, stdout, stderr }),
    );
    child.stdin?.end(input);
  });
}

function aShellRun(iso: Isolated, shell: 'powershell' | 'cmd', command: string) {
  const args =
    shell === 'powershell'
      ? ['-NoProfile', '-NonInteractive', '-Command', command]
      : ['/d', '/s', '/c', `"${command}"`];
  const child: ChildProcess = spawn(shell === 'powershell' ? 'powershell.exe' : 'cmd.exe', args, {
    env: iso.env,
    windowsHide: true,
    windowsVerbatimArguments: shell === 'cmd',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (chunk) => (output += String(chunk)));
  child.stderr?.on('data', (chunk) => (output += String(chunk)));
  // `exit`, not `close`: on Windows the detached bridge inherits this pipe's handle, so the pipe stays open for as long as the bridge runs.
  const finished = new Promise<number | null>((done) =>
    child.on('exit', (code) => setTimeout(() => done(code), 300)),
  );
  return { output: () => output, finished };
}

const readConfig = (iso: Isolated) =>
  JSON.parse(readFileSync(join(iso.configDir, '.claude.json'), 'utf8')) as {
    mcpServers?: Record<string, { url: string; headersHelper?: string; headers?: Record<string, string> }>;
    projects?: Record<
      string,
      { hasTrustDialogAccepted?: boolean; mcpServers?: Record<string, { headers?: Record<string, string> }> }
    >;
  };

function stopBridge(iso: Isolated) {
  const file = join(iso.home, '.hub', 'bridge.pid');
  if (!existsSync(file)) return;
  const { pid } = JSON.parse(readFileSync(file, 'utf8')) as { pid: number };
  spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
}

test.describe('the one command', () => {
  test.setTimeout(Number(process.env['E2E_CONNECT_TIMEOUT'] ?? 420_000));

  test('connect, tool call, Link, chat in the folder, run again, uninstall', async ({
    page,
    locale,
    owner,
    ws,
  }) => {
    test.skip(process.platform !== 'win32', 'The Windows path is the one under test');
    const iso = anIsolatedHome();
    const settings = words(locale, 'settings');
    const auth = words(locale, 'auth');
    const suffix = `${locale}${Date.now().toString(36).slice(-5)}`;
    try {
      const commands = await owner.get<{ connect: string; uninstall: string }>('me/devices/connect-command');

      // 1. One command, in a real PowerShell. It waits at the browser step.
      const first = aShellRun(iso, 'powershell', commands.connect);
      await expect
        .poll(() => /[A-Z2-9]{4}-[A-Z2-9]{4}/.exec(first.output())?.[0], { timeout: 60_000 })
        .toBeTruthy();
      const code = /[A-Z2-9]{4}-[A-Z2-9]{4}/.exec(first.output())![0];

      // 2. Approve, signed in.
      await page.goto(`/${locale}/connect?code=${code}`);
      await page.getByRole('button', { name: word(auth, 'connect.approve') }).click();
      await expect(page.getByRole('heading', { name: word(auth, 'connect.approvedTitle') })).toBeVisible();
      expect(await first.finished).toBe(0);
      const said = first.output();
      expect(said).toContain('Paired this device');
      expect(said).toContain('headersHelper');
      expect(said).toContain('hub plugin');
      expect(said).not.toMatch(/hub_[a-f0-9]{8}_/);

      // 3. Claude Code's own view: connected, through headersHelper, with no token in its config and no variable.
      const config = readConfig(iso);
      const entry = config.mcpServers?.['hub'];
      expect(entry?.url).toBe(`${API_URL}/mcp`);
      expect(entry?.headersHelper).toContain('hub-mcp-headers.mjs');
      expect(entry?.headers).toBeUndefined();
      expect(readFileSync(join(iso.configDir, '.claude.json'), 'utf8')).not.toMatch(/hub_[a-f0-9]{8}_/);
      expect(iso.env['HUB_MCP_BEARER']).toBeUndefined();
      const listed = await runClaude(iso, ['mcp', 'list'], iso.home);
      expect(listed.stdout).toMatch(/hub: .*Connected/);
      const plugins = await runClaude(iso, ['plugin', 'list', '--json'], iso.home);
      expect(plugins.stdout).toContain('hub@hub');

      // 4. The page shows it online, with the real Claude Code version.
      await page.goto(view(locale, ws, 'settings', 'tab=devices'));
      const list =
        await owner.get<{ id: string; online: boolean; claudeVersion: string | null }[]>('me/devices');
      const device = list.find((row) => row.online);
      expect(device?.claudeVersion).toMatch(/^2\.\d+\.\d+/);
      const card = page.locator(`[data-row="${device!.id}"]`);
      await expect(card.getByText(word(settings, 'devices.checks.mcp_server.ok'))).toBeVisible({
        timeout: 90_000,
      });
      await expect(card.getByText(word(settings, 'devices.checks.plugin.ok'))).toBeVisible();
      await expect(card.getByText(word(settings, 'devices.checks.claude_signed_in.bad'))).toBeVisible();

      // 5. A project that is not the owner's default, and a folder for it.
      const slug = `link-${suffix}`;
      await owner.post('workspaces', {
        slug,
        name: `Link ${suffix}`,
        keyPrefix: `L${suffix
          .slice(-3)
          .toUpperCase()
          .replace(/[^A-Z]/g, 'X')}`,
      });
      const folder = join(iso.home, 'work', 'My Repo');
      mkdirSync(folder, { recursive: true });

      // 6. The real binary calls a real tool, with no folder link yet: it lands on the default project.
      const before = readConfig(iso) as Record<string, unknown>;
      const model = await startFakeModel('mcp__hub__create_task', {
        title: 'Made through headersHelper',
        specialty: 'backend',
      });
      const chat = (cwd: string) =>
        runClaude(
          iso,
          ['-p', '--output-format', 'stream-json', '--verbose', '--allowedTools', 'mcp__hub__create_task'],
          cwd,
          {
            ANTHROPIC_BASE_URL: model.url,
            ANTHROPIC_API_KEY: 'not-a-real-key',
            ENABLE_TOOL_SEARCH: 'false',
            MCP_CONNECTION_NONBLOCKING: '0',
          },
          'go',
        );
      const unlinkedRun = await chat(iso.home);
      expect(model.offered()).toContain('mcp__hub__create_task');
      expect(model.toolResults().join(' ')).toContain('Made through headersHelper');

      // 7. The Link button, in the browser.
      await page.goto(view(locale, slug, 'settings', 'tab=general'));
      await page.locator('#link-folder').fill(folder);
      await page.getByRole('button', { name: word(settings, 'general.link.action') }).click();
      await expect(page.getByRole('status').filter({ hasText: slug })).toBeVisible({ timeout: 60_000 });

      const linkedConfig = readConfig(iso);
      const key = folder.replaceAll('\\', '/');
      expect(linkedConfig.projects?.[key]?.hasTrustDialogAccepted).toBe(true);
      expect(linkedConfig.projects?.[key]?.mcpServers?.['hub']?.headers?.['X-Hub-Project']).toBe(slug);
      const lowerDrive = key[0]!.toLowerCase() + key.slice(1);
      expect(linkedConfig.projects?.[lowerDrive]?.hasTrustDialogAccepted).toBe(true);
      for (const [name, value] of Object.entries(before)) {
        if (name !== 'projects') expect((linkedConfig as Record<string, unknown>)[name]).toBeDefined();
        void value;
      }
      const backups = readdirSync(iso.configDir).filter((name) => name.includes('hub-backup'));
      expect(backups).toHaveLength(1);
      const project = await owner.get<{ repoPaths: string[] }>(`workspaces/${slug}`);
      expect(project.repoPaths).toContain(folder);

      // 8. A chat in that folder reaches the right project, with nothing in the folder and no dialog.
      const linkedRun = await chat(folder);
      expect(readdirSync(folder)).toEqual([]);
      const cards = await owner.get<{ key: string; title: string }[]>(`workspaces/${slug}/cards?type=task`);
      expect(
        cards.some((row) => row.title === 'Made through headersHelper'),
        `${linkedRun.stdout.slice(-600)} ${linkedRun.stderr.slice(0, 300)} ${unlinkedRun.stderr.slice(0, 200)}`,
      ).toBe(true);
      await model.close();

      // 9. Run the command again, in cmd: nothing changes.
      const configBefore = readFileSync(join(iso.configDir, '.claude.json'), 'utf8');
      const again = aShellRun(iso, 'cmd', commands.connect);
      expect(await again.finished).toBe(0);
      expect(again.output()).toContain('already paired');
      expect(again.output()).not.toContain('Paired this device');
      const stripVolatile = (text: string) => {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        return JSON.stringify([parsed['mcpServers'], parsed['projects']]);
      };
      expect(stripVolatile(readFileSync(join(iso.configDir, '.claude.json'), 'utf8'))).toBe(
        stripVolatile(configBefore),
      );

      // 10. A second press of Link: nothing changes.
      await page.goto(view(locale, slug, 'settings', 'tab=general'));
      await page.locator('#link-folder').fill(folder);
      await page.getByRole('button', { name: word(settings, 'general.link.action') }).click();
      await expect(page.getByRole('status').filter({ hasText: slug })).toBeVisible({ timeout: 60_000 });
      expect(readdirSync(iso.configDir).filter((name) => name.includes('hub-backup'))).toHaveLength(1);

      // 11. Uninstall: Hub is gone from Claude Code and from this device, and the device is revoked.
      const removed = aShellRun(iso, 'powershell', commands.uninstall);
      expect(await removed.finished).toBe(0);
      expect(existsSync(join(iso.home, '.hub'))).toBe(false);
      const afterList = await runClaude(iso, ['mcp', 'list'], iso.home);
      expect(afterList.stdout).not.toMatch(/hub: /);
      const afterPlugins = await runClaude(iso, ['plugin', 'list', '--json'], iso.home);
      expect(afterPlugins.stdout).not.toContain('hub@hub');
      const rows = await owner.get<{ id: string }[]>('me/devices');
      expect(rows.some((row) => row.id === device!.id)).toBe(false);
    } finally {
      stopBridge(iso);
      rmSync(iso.home, { recursive: true, force: true });
    }
  });

  test("start:local's step connects the main machine, says what changed, and later says nothing changed", async ({
    owner,
    locale,
  }) => {
    test.skip(locale !== 'en' || process.platform !== 'win32', 'Once is enough');
    const iso = anIsolatedHome();
    const stackEnv = shared().apiEnv;
    const script = pathToFileURL(join(ROOT, 'scripts', 'connect-main-machine.mjs')).href;
    const runStep = () =>
      new Promise<{ status: number | null; output: string }>((done) => {
        const child = spawn(
          process.execPath,
          [
            '-e',
            `import(${JSON.stringify(script)}).then(({connectMainMachine})=>connectMainMachine({root:${JSON.stringify(ROOT)},apiUrl:${JSON.stringify(API_URL)},say:(l)=>process.stdout.write(l+'\\n')})).then((a)=>{process.stdout.write(JSON.stringify(a)+'\\n');process.exit(0)})`,
          ],
          { env: { ...iso.env, ...stackEnv }, cwd: dirname(ROOT), windowsHide: true },
        );
        let output = '';
        child.stdout.on('data', (chunk) => (output += String(chunk)));
        child.stderr.on('data', (chunk) => (output += String(chunk)));
        child.on('close', (status) => done({ status, output }));
      });
    try {
      const firstRun = await runStep();
      expect(firstRun.status, firstRun.output).toBe(0);
      expect(firstRun.output).toContain('first run');
      expect(firstRun.output).toContain('Paired this device');
      expect(firstRun.output).toContain('"status":"changed"');
      expect(firstRun.output).not.toMatch(/hub_[a-f0-9]{8}_/);
      const list = await owner.get<{ name: string; online: boolean }[]>('me/devices');
      await expect
        .poll(async () => (await owner.get<{ online: boolean }[]>('me/devices')).some((row) => row.online), {
          timeout: 30_000,
        })
        .toBe(true);
      expect(list.length).toBeGreaterThan(0);

      const secondRun = await runStep();
      expect(secondRun.output).toContain('nothing changed');
      expect(secondRun.output).toContain('"status":"connected"');
      const listed = await runClaude(iso, ['mcp', 'list'], iso.home);
      expect(listed.stdout).toMatch(/hub: .*Connected/);
    } finally {
      stopBridge(iso);
      rmSync(iso.home, { recursive: true, force: true });
    }
  });
});
