/**
 * @file The whole engine for real: this API, a real `hub-bridge` process, the real `claude` binary and real tools, in an isolated home, with a scripted stand-in for the model. It costs no usage.
 * @description On request, as it needs Claude Code on this machine: `E2E_REAL_CLAUDE=1 pnpm test:e2e chats-real-binary`. Every process gets a temp `HOME`, `USERPROFILE`, `CLAUDE_CONFIG_DIR` and bridge home, and every folder is temporary. The owner's Claude Code, bridge and Hub are not touched.
 * The isolated `settings.json` holds allow rules like the owner's (C1), to prove D41's list beats them. `E2E_REAL_MODEL=1` adds one small smoke with `--model haiku` on the owner's own sign-in, which needs their real Claude config and spends a little of their usage, so it is never on by default.
 */
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
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
import type { AddressInfo } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { ChatsService } from '@/modules/chats';
import { BridgeHub } from '@/modules/devices';

import { anAccount, Browser, join as joinProject, PASSWORD } from '../helpers/auth';
import { type ModelStep, type ScriptedModel, startScriptedModel } from '../helpers/scripted-model';
import { aProject } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

const ROOT = resolve(__dirname, '../../../..');
const BRIDGE_BIN = join(ROOT, 'packages/bridge/bin/hub-bridge.mjs');
const HELPER_BIN = join(ROOT, 'packages/bridge/bin/hub-mcp-headers.mjs');
const REAL_EXTENSIONS = join(homedir(), '.vscode', 'extensions');
const SECRET = `ghp_${'r'.repeat(40)}`;

/** Like the owner's 259 rules (C1): each of these would run with no prompt, if `ask` did not beat `allow`. */
const OWNER_ALLOW = [
  'Bash(rm *)',
  'Bash(mv *)',
  'Bash(git commit *)',
  'Bash(git checkout *)',
  'Bash(docker *)',
  'Bash(ping *)',
  'Bash(echo *)',
  'Bash(node *)',
  'Bash(cat *)',
];

async function until<T>(check: () => T | Promise<T>, timeoutMs = 90_000): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error('Timed out waiting');
}

const describeReal = process.env['E2E_REAL_CLAUDE'] ? describe : describe.skip;

describeReal('chats with the real binary', () => {
  jest.setTimeout(240_000);

  let app: INestApplication;
  let port: number;
  let hub: BridgeHub;
  let browser: Browser;
  let userId: string;
  let slug: string;
  let workspaceId: string;
  let scratch: string;
  let model: ScriptedModel;
  const bridges: { child: ChildProcess; home: string }[] = [];

  const prisma = () => maintenanceClients().prisma;
  const api = () => request(app.getHttpServer() as Parameters<typeof request>[0]);
  const base = () => `/workspaces/${slug}/chats`;

  beforeAll(async () => {
    ({ app } = await createTestApp({ realAuth: true }));
    await app.listen(0);
    port = (app.getHttpServer() as { address(): AddressInfo }).address().port;
    hub = app.get(BridgeHub, { strict: false });
  });

  beforeEach(async () => {
    const account = await anAccount(prisma());
    userId = account.id;
    const project = await aProject(app);
    slug = project.slug;
    workspaceId = project.id;
    await joinProject(prisma(), project.id, userId, ['owner']);
    browser = new Browser(app);
    await browser.post('/auth/sign-in', { email: account.email, password: PASSWORD }).expect(200);
    // The long form: Claude Code compares paths with the folder it resolved, and the temp folder's default spelling has a short name in it.
    scratch = realpathSync.native(mkdtempSync(join(tmpdir(), 'hub-e2e-real-')));
    model = await startScriptedModel();
  });

  afterEach(async () => {
    for (const { child } of bridges.splice(0)) {
      if (child.pid) {
        try {
          execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        } catch {
          /* Already gone. */
        }
      }
    }
    const chats = app.get(ChatsService, { strict: false });
    await until(() => chats.runningCount() === 0, 30_000);
    await model.close();
    rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  async function pair(name: string) {
    const started = await api().post('/api/v1/pairing/start').send({ name, platform: 'win32' }).expect(201);
    const { deviceCode, userCode } = started.body.data as { deviceCode: string; userCode: string };
    await browser.post(`/pairing/${userCode}/approve`).expect(204);
    const polled = await api().post('/api/v1/pairing/poll').send({ deviceCode }).expect(200);
    return polled.body.data as { deviceId: string; credential: string };
  }

  function linkExtension(home: string): void {
    const extension = readdirSync(REAL_EXTENSIONS)
      .filter((name) => name.startsWith('anthropic.claude-code-'))
      .sort()
      .at(-1);
    if (!extension) throw new Error('No Claude Code extension on this machine');
    mkdirSync(join(home, '.vscode', 'extensions'), { recursive: true });
    symlinkSync(join(REAL_EXTENSIONS, extension), join(home, '.vscode', 'extensions', extension), 'junction');
  }

  /** A paired device with a real bridge, in a home of its own. */
  async function aDevice(options: { env?: Record<string, string>; signedIn?: boolean } = {}) {
    const { deviceId, credential } = await pair('Real');
    const home = join(scratch, 'home');
    const configDir = join(home, 'claude-config');
    const hubRoot = join(home, '.hub');
    const helper = join(hubRoot, 'app', 'bridge', 'bin', 'hub-mcp-headers.mjs');
    mkdirSync(join(hubRoot, 'app', 'bridge', 'bin'), { recursive: true });
    mkdirSync(configDir, { recursive: true });
    cpSync(HELPER_BIN, helper);
    linkExtension(home);
    const url = `http://127.0.0.1:${port}`;
    writeFileSync(join(hubRoot, 'device.json'), JSON.stringify({ url, deviceId, credential }));
    writeFileSync(join(configDir, 'settings.json'), JSON.stringify({ permissions: { allow: OWNER_ALLOW } }));
    writeFileSync(
      join(configDir, '.claude.json'),
      JSON.stringify({
        mcpServers: {
          hub: {
            type: 'http',
            url: `${url}/mcp`,
            headersHelper: `"${process.execPath}" "${helper}"`,
            headers: { 'X-Hub-Project': slug },
          },
        },
      }),
    );
    const clean: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (!/^(CLAUDE|ANTHROPIC)/i.test(key)) clean[key] = value;
    }
    const child = spawn(process.execPath, [BRIDGE_BIN, 'run'], {
      env: {
        ...clean,
        HOME: home,
        USERPROFILE: home,
        CLAUDE_CONFIG_DIR: configDir,
        HUB_BRIDGE_SKIP_LOGIN_START: '1',
        ...(options.signedIn === false
          ? {}
          : {
              HUB_BRIDGE_CLAUDE_ENV: JSON.stringify({
                ANTHROPIC_BASE_URL: model.url,
                ANTHROPIC_API_KEY: 'not-a-real-key',
              }),
            }),
        ...options.env,
      },
      stdio: 'ignore',
      windowsHide: true,
    });
    bridges.push({ child, home });
    await until(() => hub.isOnline(deviceId));
    return { deviceId, home };
  }

  /** A folder that is a Git repository with one commit, registered on the project. */
  async function aRepo(name = 'repo'): Promise<string> {
    const folder = join(scratch, name);
    mkdirSync(folder);
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.email=t@example.test', '-c', 'user.name=t', ...args], {
        cwd: folder,
        stdio: 'ignore',
      });
    git('init', '-q', '-b', 'main');
    writeFileSync(join(folder, 'target.txt'), 'keep me\n');
    writeFileSync(join(folder, 'other.txt'), 'other\n');
    git('add', '.');
    git('commit', '-q', '-m', 'first');
    const row = await prisma().workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    await prisma().workspace.update({
      where: { id: workspaceId },
      data: { repoPaths: [...row.repoPaths, folder] },
    });
    return folder;
  }

  async function aChat(deviceId: string, folder: string, mode = 'execute'): Promise<string> {
    const answer = await browser.post(base(), { device: deviceId, folder, mode }).expect(201);
    return answer.body.data.id as string;
  }

  interface Stored {
    role: string;
    id: string;
    content: string;
    status: string | null;
    failure: string | null;
    failureMessage: string | null;
    model: string | null;
    claudeVersion: string | null;
    usage: { outputTokens?: number } | null;
    durationMs: number | null;
    plan: string | null;
    stages: { stage: string; state: string }[];
    changedFiles: { path: string; source: string; additions?: number; deletions?: number }[];
    steps: { name: string; status: string; input: unknown; output: string | null; decision: string | null }[];
    approvals: { id: string; status: string; command: string; category: string; toolName: string }[];
  }

  const getChat = async (chatId: string) =>
    (await browser.get(`${base()}/${chatId}`).expect(200)).body.data as {
      sessionId: string | null;
      lastSeq: number;
      branch: string | null;
      messages: Stored[];
    };

  /**
   * Sends and waits for the end, answering each paused call with `answer`. Answers what paused.
   * Returns the stored reply and every approval it raised.
   */
  async function turn(
    chatId: string,
    text: string,
    answer: (approval: Stored['approvals'][number]) => 'allow' | 'deny' | 'wait' = () => 'deny',
    extra: Record<string, unknown> = {},
  ): Promise<Stored> {
    await browser.post(`${base()}/${chatId}/messages`, { text, ...extra }).expect(202);
    const answered = new Set<string>();
    return until(async () => {
      const reply = (await getChat(chatId)).messages.at(-1)!;
      for (const approval of reply.approvals) {
        if (approval.status !== 'pending' || answered.has(approval.id)) continue;
        const decision = answer(approval);
        if (decision === 'wait') continue;
        answered.add(approval.id);
        await browser.post(`${base()}/${chatId}/approvals/${approval.id}`, { decision });
      }
      return reply.status !== 'running' ? reply : null;
    });
  }

  const bash = (command: string): ModelStep => ({ tool: 'Bash', input: { command, description: 'test' } });
  const powershell = (command: string): ModelStep => ({ tool: 'PowerShell', input: { command } });

  describe('a turn', () => {
    it('streams, resumes in one live process with the permission tool on, and keeps the same session', async () => {
      const { deviceId } = await aDevice();
      const folder = await aRepo();
      const chatId = await aChat(deviceId, folder);

      model.script({ text: 'The first answer has several words in it. ' });
      const first = await turn(chatId, 'first question');
      expect(first.status).toBe('done');
      expect(first.content).toBe('The first answer has several words in it. ');
      expect(first.claudeVersion).toMatch(/^2\./);
      const chat = await getChat(chatId);
      expect(chat.sessionId).toMatch(/^[0-9a-f-]{36}$/);
      expect(chat.branch).toBe('main');
      expect(first.usage?.outputTokens).toBeGreaterThan(0);

      model.script({ text: 'The second answer is here now. ' });
      const second = await turn(chatId, 'second question');
      expect(second.content).toBe('The second answer is here now. ');
      expect(model.lastConversation()).toContain('first question');
      expect(model.lastConversation()).toContain('The first answer');
      expect((await getChat(chatId)).sessionId).toBe(chat.sessionId);
    });

    it('--resume with stream-json input and the permission tool: a new process keeps the context', async () => {
      const { deviceId } = await aDevice({ env: { HUB_BRIDGE_IDLE_MS: '500' } });
      const folder = await aRepo();
      const chatId = await aChat(deviceId, folder);
      model.script({ text: 'Remembering the word teal now. ' });
      await turn(chatId, 'remember teal');
      const { sessionId } = await getChat(chatId);
      // The idle window ends and stdin closes, so the next message has to resume.
      await new Promise((done) => setTimeout(done, 3_000));
      model.script({ text: 'The word was teal as you said. ' });
      const again = await turn(chatId, 'what was the word?');
      expect(again.status).toBe('done');
      expect(model.lastConversation()).toContain('remember teal');
      expect((await getChat(chatId)).sessionId).toBe(sessionId);
    });

    it('Write inside the folder goes ahead, and the turn names the file with real counts and a diff', async () => {
      const { deviceId } = await aDevice();
      const folder = await aRepo();
      const chatId = await aChat(deviceId, folder);
      model.script({ tool: 'Write', input: { file_path: join(folder, 'made.md'), content: 'one\ntwo\n' } });
      const reply = await turn(chatId, 'write it');
      expect(reply.approvals).toEqual([]);
      expect(readFileSync(join(folder, 'made.md'), 'utf8')).toBe('one\ntwo\n');
      expect(reply.changedFiles).toEqual([
        expect.objectContaining({ path: 'made.md', source: 'tool', additions: 2, deletions: 0 }),
      ]);
      const diff = await browser.get(`${base()}/${chatId}/diff?path=made.md`).expect(200);
      expect(diff.body.data.available).toBe(true);
      expect(diff.body.data.diff).toContain('+two');
      const refused = await browser.get(`${base()}/${chatId}/diff?path=../outside.md`).expect(200);
      expect(refused.body.data.available).toBe(false);
    });

    it('stores a command’s output through the secret filter', async () => {
      const { deviceId } = await aDevice();
      const folder = await aRepo();
      const chatId = await aChat(deviceId, folder);
      model.script(bash(`echo ${SECRET}`));
      const reply = await turn(chatId, 'print it');
      expect(reply.steps[0]?.status).toBe('done');
      const stored = JSON.stringify([
        await prisma().chatStep.findMany(),
        await prisma().chatMessage.findMany(),
      ]);
      expect(stored).not.toContain(SECRET);
    });
  });

  describe('D41: what pauses', () => {
    const PAUSES: [string, string, ModelStep][] = [
      ['delete: rm', 'delete', bash('rm target.txt')],
      ['delete: rmdir', 'delete', bash('rmdir emptydir')],
      ['delete: git rm', 'delete', bash('git rm target.txt')],
      ['delete: git clean', 'delete', bash('git clean -fd')],
      ['delete through a variable', 'delete', bash('FOO=bar rm target.txt')],
      ['delete after another command', 'delete', bash('ls && rm target.txt')],
      ['delete inside bash -c', 'delete', bash('bash -c "rm target.txt"')],
      ['move: mv', 'move', bash('mv target.txt moved.txt')],
      ['commit', 'commit', bash('git commit --allow-empty -m x')],
      ['push', 'push', bash('git push origin main')],
      ['push with -C', 'push', bash('git -C . push origin main')],
      ['branch', 'branch', bash('git branch feature-x')],
      ['switch', 'branch', bash('git switch -c feature-y')],
      ['checkout', 'branch', bash('git checkout -b feature-z')],
      ['worktree', 'worktree', bash('git worktree add ../wt')],
      ['docker', 'docker', bash('docker ps')],
      ['deploy: psync', 'deploy', bash('psync up')],
      ['a deploy script', 'deploy', bash('./deploy.sh')],
      ['an unknown command', 'other', bash('./unknown.sh')],
      ['PowerShell delete', 'delete', powershell('Remove-Item target.txt')],
      ['PowerShell move', 'move', powershell('Move-Item target.txt moved.txt')],
      ['PowerShell git', 'push', powershell('git push origin main')],
      ['PowerShell docker', 'docker', powershell('docker ps')],
      ['PowerShell deploy', 'deploy', powershell('psync up')],
    ];

    it('every named class pauses even under the owner’s allow rules, and a denial runs nothing', async () => {
      const { deviceId } = await aDevice();
      const folder = await aRepo();
      mkdirSync(join(folder, 'emptydir'));
      writeFileSync(join(folder, 'deploy.sh'), '#!/bin/sh\necho ran > ran.txt\n');
      const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: folder }).toString().trim();
      const branches = () => execFileSync('git', ['branch', '--list'], { cwd: folder }).toString();
      const headBefore = head();
      const branchesBefore = branches();
      const chatId = await aChat(deviceId, folder);
      model.script(...PAUSES.map(([, , step]) => step));
      const reply = await turn(chatId, 'try them all');
      expect(reply.status).toBe('done');
      const seen = reply.approvals.map((item) => [item.command, item.category]);
      const wanted = PAUSES.map(([, category, step]) => [
        (step as unknown as { input: { command: string } }).input.command,
        category,
      ]);
      expect(seen).toEqual(wanted);
      expect(reply.approvals.every((item) => item.status === 'denied')).toBe(true);
      expect(readFileSync(join(folder, 'target.txt'), 'utf8')).toBe('keep me\n');
      expect(existsSync(join(folder, 'moved.txt'))).toBe(false);
      expect(existsSync(join(folder, 'emptydir'))).toBe(true);
      expect(existsSync(join(folder, 'ran.txt'))).toBe(false);
      expect(existsSync(join(scratch, 'wt'))).toBe(false);
      expect(head()).toBe(headBefore);
      expect(branches()).toBe(branchesBefore);
      expect(reply.steps.every((step) => step.status === 'error')).toBe(true);
    });

    it('Allow once lets one rm run, and the next still pauses', async () => {
      const { deviceId } = await aDevice();
      const folder = await aRepo();
      const chatId = await aChat(deviceId, folder);
      model.script(bash('rm target.txt'), bash('rm other.txt'));
      const reply = await turn(chatId, 'delete', (item) =>
        item.command === 'rm target.txt' ? 'allow' : 'deny',
      );
      expect(reply.approvals.map((item) => item.status)).toEqual(['allowed', 'denied']);
      expect(existsSync(join(folder, 'target.txt'))).toBe(false);
      expect(existsSync(join(folder, 'other.txt'))).toBe(true);
    });

    it('a command the owner allows and the list does not name runs with no prompt (C1)', async () => {
      const { deviceId } = await aDevice();
      const folder = await aRepo();
      const chatId = await aChat(deviceId, folder);
      model.script(bash('node --version'), bash('git status'), {
        tool: 'Read',
        input: { file_path: join(folder, 'other.txt') },
      });
      const reply = await turn(chatId, 'look');
      expect(reply.approvals).toEqual([]);
      expect(reply.steps.map((step) => step.status)).toEqual(['done', 'done', 'done']);
    });

    it('a timeout denies: the bridge answers, and the command never runs', async () => {
      const { deviceId } = await aDevice({ env: { HUB_BRIDGE_APPROVAL_TIMEOUT_MS: '2000' } });
      const folder = await aRepo();
      const chatId = await aChat(deviceId, folder);
      model.script(bash('rm target.txt'));
      const reply = await turn(chatId, 'delete', () => 'wait');
      expect(reply.status).toBe('done');
      expect(reply.approvals[0]?.status).toBe('timed_out');
      expect(existsSync(join(folder, 'target.txt'))).toBe(true);
      const row = await prisma().auditLog.findFirst({ where: { action: 'chats.approval.timed_out' } });
      expect(row?.summary).toContain('rm target.txt');
    });
  });

  describe('D46 and sensitive Hub tools', () => {
    it('update_project pauses: denied changes nothing, allowed widens the folders. Reads do not pause', async () => {
      const { deviceId } = await aDevice();
      const folder = await aRepo();
      const widened = join(scratch, 'widened');
      const before = (await prisma().workspace.findUniqueOrThrow({ where: { id: workspaceId } })).repoPaths;
      const chatId = await aChat(deviceId, folder);
      const update = {
        tool: 'mcp__hub__update_project',
        input: { repoPaths: [...before, widened] },
      };
      model.script({ tool: 'mcp__hub__get_project', input: {} }, update, update);
      let asked = 0;
      const reply = await turn(chatId, 'widen', () => {
        asked += 1;
        return asked === 1 ? 'deny' : 'allow';
      });
      expect(reply.approvals.map((item) => [item.toolName, item.category, item.status])).toEqual([
        ['mcp__hub__update_project', 'hub_project', 'denied'],
        ['mcp__hub__update_project', 'hub_project', 'allowed'],
      ]);
      expect(reply.steps[0]).toMatchObject({ name: 'mcp__hub__get_project', status: 'done' });
      const after = await prisma().workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      expect(after.repoPaths).toContain(widened);
    });

    it('save_doc pauses too, and a plain Hub write does not, so /hub:work can leave evidence', async () => {
      const { deviceId } = await aDevice();
      const folder = await aRepo();
      const chatId = await aChat(deviceId, folder);
      model.script(
        { tool: 'mcp__hub__save_doc', input: { source: 'nope', path: 'a.md', content: '# A\n' } },
        {
          tool: 'mcp__hub__report_stage',
          input: { protocol: 'work', stage: 'verify', state: 'failed', note: 'red' },
        },
        { tool: 'mcp__hub__create_idea', input: { title: 'From the chat' } },
      );
      const reply = await turn(chatId, 'go');
      expect(reply.approvals.map((item) => [item.toolName, item.category])).toEqual([
        ['mcp__hub__save_doc', 'hub_doc'],
      ]);
      expect(reply.stages).toEqual([expect.objectContaining({ stage: 'verify', state: 'failed' })]);
      expect(await prisma().card.count({ where: { workspaceId, type: 'idea' } })).toBe(1);
    });
  });

  describe('Ask and Plan are read only', () => {
    it('Ask reads, and nothing writes: not under the owner’s allow rules, and with no prompt', async () => {
      const { deviceId } = await aDevice();
      const folder = await aRepo();
      const chatId = await aChat(deviceId, folder, 'ask');
      model.script(
        { tool: 'Read', input: { file_path: join(folder, 'other.txt') } },
        { tool: 'mcp__hub__get_project', input: {} },
        { tool: 'Write', input: { file_path: join(folder, 'made.md'), content: 'x' } },
        {
          tool: 'Edit',
          input: { file_path: join(folder, 'other.txt'), old_string: 'other', new_string: 'x' },
        },
        bash('rm target.txt'),
        bash("node -e \"require('fs').writeFileSync('made2.md','x')\""),
        powershell('Remove-Item target.txt'),
        { tool: 'mcp__hub__create_idea', input: { title: 'Nope' } },
        { tool: 'mcp__hub__update_project', input: { name: 'Changed' } },
      );
      const reply = await turn(chatId, 'look only');
      expect(reply.approvals).toEqual([]);
      expect(reply.steps.map((step) => [step.name, step.status])).toEqual([
        ['Read', 'done'],
        ['mcp__hub__get_project', 'done'],
        ['Write', 'error'],
        ['Edit', 'error'],
        ['Bash', 'error'],
        ['Bash', 'error'],
        ['PowerShell', 'error'],
        ['mcp__hub__create_idea', 'error'],
        ['mcp__hub__update_project', 'error'],
      ]);
      expect(existsSync(join(folder, 'made.md'))).toBe(false);
      expect(existsSync(join(folder, 'made2.md'))).toBe(false);
      expect(existsSync(join(folder, 'target.txt'))).toBe(true);
      expect(await prisma().card.count({ where: { workspaceId, type: 'idea' } })).toBe(0);
    });

    it('a tool of another MCP server stays out in Ask, even when the owner allows it', async () => {
      const { deviceId, home } = await aDevice();
      const folder = await aRepo();
      const marker = join(scratch, 'other-tool-ran.txt');
      const server = join(home, 'other-server.mjs');
      writeFileSync(
        server,
        [
          `import { writeFileSync } from 'node:fs';`,
          `import { createInterface } from 'node:readline';`,
          `const send = (m) => process.stdout.write(JSON.stringify(m) + '\\n');`,
          `createInterface({ input: process.stdin }).on('line', (line) => {`,
          `  const m = JSON.parse(line);`,
          `  if (m.method === 'initialize') send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: m.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'other', version: '1' } } });`,
          `  else if (m.method === 'tools/list') send({ jsonrpc: '2.0', id: m.id, result: { tools: [{ name: 'change', description: 'Changes something', inputSchema: { type: 'object' } }] } });`,
          `  else if (m.method === 'tools/call') { writeFileSync(${JSON.stringify(marker)}, 'ran'); send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'ran' }] } }); }`,
          `  else if (m.id !== undefined) send({ jsonrpc: '2.0', id: m.id, result: {} });`,
          `});`,
        ].join('\n'),
      );
      const configDir = join(home, 'claude-config');
      const config = JSON.parse(readFileSync(join(configDir, '.claude.json'), 'utf8')) as {
        mcpServers: Record<string, object>;
      };
      config.mcpServers['other'] = { type: 'stdio', command: process.execPath, args: [server] };
      writeFileSync(join(configDir, '.claude.json'), JSON.stringify(config));
      writeFileSync(
        join(configDir, 'settings.json'),
        JSON.stringify({ permissions: { allow: [...OWNER_ALLOW, 'mcp__other__change'] } }),
      );

      const execute = await aChat(deviceId, folder);
      model.script({ tool: 'mcp__other__change', input: {} });
      const allowed = await turn(execute, 'change it');
      expect(allowed.steps[0]?.status).toBe('done');
      expect(existsSync(marker)).toBe(true);
      rmSync(marker);

      const ask = await aChat(deviceId, folder, 'ask');
      model.script({ tool: 'mcp__other__change', input: {} });
      const refused = await turn(ask, 'change it');
      expect(refused.steps[0]?.status).toBe('error');
      expect(existsSync(marker)).toBe(false);
    });

    it('Plan refuses writes, and its proposed plan lands on the turn', async () => {
      const { deviceId } = await aDevice();
      const folder = await aRepo();
      const chatId = await aChat(deviceId, folder, 'plan');
      model.script(
        { tool: 'Write', input: { file_path: join(folder, 'made.md'), content: 'x' } },
        bash('rm target.txt'),
        { tool: 'ExitPlanMode', input: { plan: '# The plan\n1. Do the thing' } },
      );
      const reply = await turn(chatId, 'plan it');
      expect(reply.approvals).toEqual([]);
      expect(reply.plan).toContain('Do the thing');
      expect(existsSync(join(folder, 'made.md'))).toBe(false);
      expect(existsSync(join(folder, 'target.txt'))).toBe(true);
    });
  });

  describe('stop', () => {
    function survivors(marker: string): string[] {
      const out = execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${marker}*' -and $_.Name -ne 'powershell.exe' } | ForEach-Object { $_.Name + ' ' + $_.ProcessId }`,
        ],
        { encoding: 'utf8' },
      );
      return out
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }

    it('during a long command: stopped, with no surviving children, and the chat resumes', async () => {
      const { deviceId, home } = await aDevice();
      const folder = await aRepo();
      const chatId = await aChat(deviceId, folder);
      model.script(bash('ping -n 97 127.0.0.1'));
      await browser.post(`${base()}/${chatId}/messages`, { text: 'wait' }).expect(202);
      await until(() => survivors('-n 97 127.0.0.1').length > 0);
      expect(survivors(join(home, '.hub', 'chat').replaceAll('\\', '\\')).length).toBeGreaterThan(0);

      await browser.post(`${base()}/${chatId}/stop`).expect(204);
      const reply = await until(async () => {
        const last = (await getChat(chatId)).messages.at(-1)!;
        return last.status !== 'running' ? last : null;
      }, 30_000);
      expect(reply.status).toBe('stopped');
      await until(
        () => survivors('-n 97 127.0.0.1').length === 0 && survivors(join(home, '.hub', 'chat')).length === 0,
        20_000,
      );

      model.script({ text: 'Back again after the stop now. ' });
      const again = await turn(chatId, 'are you there?');
      expect(again.status).toBe('done');
      expect(model.lastConversation()).toContain('wait');
    });

    it('during a waiting approval: denied, stopped, and nothing ran', async () => {
      const { deviceId, home } = await aDevice();
      const folder = await aRepo();
      const chatId = await aChat(deviceId, folder);
      model.script(bash('rm target.txt'));
      await browser.post(`${base()}/${chatId}/messages`, { text: 'delete' }).expect(202);
      await until(async () => (await getChat(chatId)).messages.at(-1)?.approvals.length === 1);
      await browser.post(`${base()}/${chatId}/stop`).expect(204);
      const reply = await until(async () => {
        const last = (await getChat(chatId)).messages.at(-1)!;
        return last.status !== 'running' ? last : null;
      }, 30_000);
      expect(reply.status).toBe('stopped');
      expect(reply.approvals[0]?.status).toBe('stopped');
      expect(existsSync(join(folder, 'target.txt'))).toBe(true);
      await until(() => survivors(join(home, '.hub', 'chat')).length === 0, 20_000);
    });
  });

  describe('honest states', () => {
    it('signed out is read from the engine, with no retry and no credential read', async () => {
      const { deviceId } = await aDevice({ signedIn: false });
      const folder = await aRepo();
      const chatId = await aChat(deviceId, folder);
      const reply = await turn(chatId, 'hello');
      expect(reply).toMatchObject({ status: 'failed', failure: 'signed_out' });
      expect(reply.content).toContain('/login');
      expect((await getChat(chatId)).sessionId).toBeNull();
      const engine = await browser.get(`${base()}/engine?device=${deviceId}`).expect(200);
      expect(engine.body.data).toMatchObject({ found: true, inRange: true, signedIn: false });
    });

    it('a real bridge refuses a folder outside its allowlist, even if the API were to ask', async () => {
      const { deviceId } = await aDevice();
      const folder = await aRepo();
      await expect(
        hub.request(deviceId, 'turn.start', {
          chatId: '11111111-1111-4111-8111-111111111111',
          folder: join(scratch, 'elsewhere'),
          prompt: 'x',
          mode: 'execute',
        }),
      ).rejects.toMatchObject({
        details: expect.objectContaining({ reason: 'folder_not_allowed' }) as unknown,
      });
      expect(folder).toBeTruthy();
    });

    it('a revoked device stops its turn, and its bridge exits leaving nothing', async () => {
      const { deviceId, home } = await aDevice();
      const folder = await aRepo();
      const chatId = await aChat(deviceId, folder);
      model.script(bash('rm target.txt'));
      await browser.post(`${base()}/${chatId}/messages`, { text: 'delete' }).expect(202);
      await until(async () => (await getChat(chatId)).messages.at(-1)?.approvals.length === 1);
      await browser.delete(`/me/devices/${deviceId}`).expect(204);
      const reply = await until(async () => {
        const last = (await getChat(chatId)).messages.at(-1)!;
        return last.status !== 'running' ? last : null;
      }, 30_000);
      expect(reply).toMatchObject({ status: 'interrupted', failure: 'device_offline' });
      expect(existsSync(join(folder, 'target.txt'))).toBe(true);
      const refused = await browser.post(`${base()}/${chatId}/messages`, { text: 'again' }).expect(404);
      expect(refused.body.error.code).toBe('hub.devices.not_found');
      expect(existsSync(join(home, '.hub'))).toBe(true);
    });
  });

  // ── One small real call, on the owner's own sign-in ─────────────────────────────────────────────

  const itRealModel = process.env['E2E_REAL_MODEL'] ? it : it.skip;

  itRealModel('a very small smoke with the real model: stream, approval, resume', async () => {
    const sum = (path: string) =>
      existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : 'none';
    const settingsFile = join(homedir(), '.claude', 'settings.json');
    const before = sum(settingsFile);
    // A temp bridge home. Claude Code itself must use the real config, because that is where its sign-in is.
    const { deviceId, credential } = await pair('Smoke');
    const root = join(scratch, 'bridge-root');
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, 'device.json'),
      JSON.stringify({ url: `http://127.0.0.1:${port}`, deviceId, credential }),
    );
    const clean: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (!/^(CLAUDE|ANTHROPIC)/i.test(key)) clean[key] = value;
    }
    const child = spawn(process.execPath, [BRIDGE_BIN, 'run'], {
      env: { ...clean, HUB_BRIDGE_ROOT: root, HUB_BRIDGE_SKIP_LOGIN_START: '1' },
      stdio: 'ignore',
      windowsHide: true,
    });
    bridges.push({ child, home: root });
    await until(() => hub.isOnline(deviceId));
    const folder = await aRepo('smoke');
    const chatId = await aChat(deviceId, folder);
    const options = { model: 'haiku', effort: 'low' };

    const first = await turn(chatId, 'Reply with exactly: PLUM', () => 'deny', options);
    expect(first.status).toBe('done');
    expect(first.content).toContain('PLUM');
    expect(first.model).toMatch(/haiku/);
    const { sessionId } = await getChat(chatId);

    const paused = await turn(
      chatId,
      'Run this exact command with the Bash tool and nothing else: rm target.txt',
      () => 'allow',
      options,
    );
    expect(paused.approvals[0]).toMatchObject({ status: 'allowed', category: 'delete' });
    expect(paused.approvals[0]?.command).toContain('rm');
    expect(existsSync(join(folder, 'target.txt'))).toBe(false);

    const resumed = await turn(
      chatId,
      'What exact word did I ask you to reply with first? One word.',
      () => 'deny',
      options,
    );
    expect(resumed.status).toBe('done');
    expect(resumed.content).toContain('PLUM');
    expect((await getChat(chatId)).sessionId).toBe(sessionId);

    const planned = await turn(
      chatId,
      'Propose a one-line plan to add a README. Do not explore first.',
      () => 'deny',
      { ...options, mode: 'plan' },
    );
    expect(planned.status).toBe('done');
    expect(planned.approvals).toEqual([]);
    expect(`${planned.plan ?? ''}${planned.content}`).toMatch(/README/i);
    expect(existsSync(join(folder, 'README.md'))).toBe(false);
    expect(sum(settingsFile)).toBe(before);
  });
});
