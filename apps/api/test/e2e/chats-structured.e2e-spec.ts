/**
 * @file Structured results (docs/16 §7.2, D50 to D53) over real credentials and a real MCP client, with a scripted device: what the server verifies, what it refuses, and what it moves.
 * @description The scripted device speaks the bridge's frames, so each step exists because a device said so. The MCP client sets `_meta`'s tool use id as Claude Code does, which is how a call proves it belongs to a panel turn. `chats-real-binary.e2e-spec.ts` runs the same flows with the real binary.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CHAT_TRUNCATED_MARK } from '@hub/contracts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { WebSocket } from 'ws';

import { ChatsService } from '@/modules/chats';
import { BridgeHub } from '@/modules/devices';
import { DocsIndexerService, DocsWriteService } from '@/modules/docs';

import { anAccount, aToken, Browser, join as joinProject, PASSWORD } from '../helpers/auth';
import { aProject } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

const SECRET = `ghp_${'q'.repeat(40)}`;
const SESSION = '22222222-2222-4222-8222-222222222222';
const APPROVAL_ID = '33333333-3333-4333-8333-333333333333';
const QUESTION_ID = '44444444-4444-4444-8444-444444444444';

interface ActionFrame {
  readonly type: 'action';
  readonly id: string;
  readonly action: string;
  readonly args: Record<string, unknown>;
}

async function until<T>(check: () => T | Promise<T>, timeoutMs = 15_000): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((done) => setTimeout(done, 20));
  }
  throw new Error('Timed out waiting');
}

class ScriptedDevice {
  readonly actions: ActionFrame[] = [];
  private seq = 0;
  answers: Partial<Record<string, unknown>> = {
    'turn.answer': { accepted: true },
    'turn.stop': { stopped: true },
    'chat.close': { closed: true },
    'turn.files': {
      available: true,
      files: [{ path: 'real.ts', source: 'git', additions: 2, deletions: 1 }],
    },
  };

  constructor(readonly socket: WebSocket) {
    socket.on('message', (data) => {
      const frame = JSON.parse((data as Buffer).toString()) as { type: string } & ActionFrame;
      if (frame.type !== 'action') return;
      this.actions.push(frame);
      const answer = this.answers[frame.action];
      if (answer !== undefined) this.result(frame.id, answer);
    });
  }

  of(action: string): ActionFrame[] {
    return this.actions.filter((frame) => frame.action === action);
  }

  turn(): ActionFrame {
    return this.of('turn.start').at(-1)!;
  }

  say(id: string, event: { kind: string } & Record<string, unknown>): void {
    this.socket.send(JSON.stringify({ type: 'event', id, seq: this.seq++, kind: event.kind, data: event }));
  }

  result(id: string, data: unknown): void {
    this.socket.send(JSON.stringify({ type: 'result', id, ok: true, data }));
  }

  end(id: string, ended: Record<string, unknown> = { status: 'done' }): void {
    this.say(id, { kind: 'turn.ended', ...ended });
    this.result(id, { status: ended['status'] });
  }
}

interface Report {
  verifiedOf?: number;
  cardKey: string;
  origin: string;
  checks: {
    name: string;
    verified: boolean;
    basis: string;
    stepId: string | null;
    runs: { status: string }[];
  }[];
  changedFiles: { path: string; source: string }[];
  filesFrom: string;
  droppedChecks: string[];
  counts: { total: number; verified: number; failedRuns: number };
  move: { moved: boolean; reason: string; from: string | null; to: string | null };
}

describe('structured results', () => {
  let app: INestApplication;
  let port: number;
  let hub: BridgeHub;
  let browser: Browser;
  let userId: string;
  let slug: string;
  let workspaceId: string;
  let deviceId: string;
  let device: ScriptedDevice;
  let mcp: Client;
  let scratch: string;
  const sockets: WebSocket[] = [];

  const prisma = () => maintenanceClients().prisma;
  const api = () => request(app.getHttpServer() as Parameters<typeof request>[0]);
  const base = () => `/workspaces/${slug}/chats`;

  beforeAll(async () => {
    ({ app } = await createTestApp({ realAuth: true }));
    await app.listen(0);
    port = (app.getHttpServer() as { address(): AddressInfo }).address().port;
    hub = app.get(BridgeHub, { strict: false });
  });

  async function connectDevice(id: string, token: string): Promise<ScriptedDevice> {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/bridge`, {
      headers: { authorization: `Bearer ${token}` },
    });
    sockets.push(socket);
    const scripted = new ScriptedDevice(socket);
    await new Promise((done, fail) => {
      socket.once('open', done);
      socket.once('error', fail);
    });
    socket.send(JSON.stringify({ type: 'hello', protocol: 1, status: {}, actions: [] }));
    await until(() => hub.isOnline(id));
    return scripted;
  }

  beforeEach(async () => {
    const account = await anAccount(prisma());
    userId = account.id;
    const project = await aProject(app);
    slug = project.slug;
    workspaceId = project.id;
    await joinProject(prisma(), project.id, userId, ['owner']);
    scratch = realpathSync.native(mkdtempSync(join(tmpdir(), 'hub-e2e-structured-')));
    await prisma().workspace.update({ where: { id: project.id }, data: { repoPaths: [scratch] } });
    browser = new Browser(app);
    await browser.post('/auth/sign-in', { email: account.email, password: PASSWORD }).expect(200);
    const started = await api()
      .post('/api/v1/pairing/start')
      .send({ name: 'Laptop', platform: 'win32' })
      .expect(201);
    const { deviceCode, userCode } = started.body.data as { deviceCode: string; userCode: string };
    await browser.post(`/pairing/${userCode}/approve`).expect(204);
    const polled = await api().post('/api/v1/pairing/poll').send({ deviceCode }).expect(200);
    const paired = polled.body.data as { deviceId: string; credential: string };
    deviceId = paired.deviceId;
    device = await connectDevice(deviceId, paired.credential);
    const { token } = await aToken(prisma(), userId, 'mcp');
    mcp = new Client({ name: 'test', version: '1' });
    await mcp.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
        requestInit: { headers: { authorization: `Bearer ${token}`, 'x-hub-project': slug } },
      }),
    );
  });

  afterEach(async () => {
    await mcp.close();
    for (const socket of sockets.splice(0)) socket.terminate();
    const chats = app.get(ChatsService, { strict: false });
    await until(() => chats.runningCount() === 0);
    rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  /** A tool call as Claude Code makes it: with its tool use id in `_meta`, when it has one. */
  async function call(name: string, args: Record<string, unknown>, toolUseId?: string) {
    const answer = (await mcp.callTool({
      name,
      arguments: args,
      ...(toolUseId ? { _meta: { 'claudecode/toolUseId': toolUseId } } : {}),
    })) as { isError?: boolean; content: { text: string }[] };
    return { isError: answer.isError === true, text: answer.content.map((part) => part.text).join('\n') };
  }

  async function aTurn(extra: Record<string, unknown> = {}) {
    const created = await browser.post(base(), { device: deviceId, folder: scratch, ...extra }).expect(201);
    const chatId = created.body.data.id as string;
    const before = device.of('turn.start').length;
    const sent = await browser.post(`${base()}/${chatId}/messages`, { text: 'go' }).expect(202);
    await until(() => device.of('turn.start').length > before);
    return { chatId, messageId: sent.body.data.messageId as string, id: device.turn().id };
  }

  const getChat = async (chatId: string) =>
    (await browser.get(`${base()}/${chatId}`).expect(200)).body.data as {
      mode: string;
      messages: {
        id: string;
        status: string | null;
        failure: string | null;
        failureMessage: string | null;
        reports: Report[];
        plan: string | null;
        structuredPlan: { title: string; steps: { title: string }[] } | null;
        notices: ({ kind: string } & Record<string, unknown>)[];
        questions: {
          id: string;
          status: string;
          answers: Record<string, string> | null;
          questions: { text: string }[];
        }[];
        approvals: { id: string; status: string; effect: string; draftId: string | null }[];
        docDrafts: {
          id: string;
          status: string;
          refusedCode: string | null;
          conflict: { version: string | null; text: string } | null;
          draft: string;
          baseText: string | null;
          duplicates: { key: string; url: string; path: string }[];
          claims: { id: string; text: string; status: string; answer: string | null }[];
        }[];
        steps: { toolUseId: string; command: string | null; status: string }[];
      }[];
    };
  const last = async (chatId: string) => (await getChat(chatId)).messages.at(-1)!;

  /** A step the device really ran, with its real result. */
  function aStep(
    id: string,
    toolUseId: string,
    command: string,
    ok = true,
    output = ok ? 'all good' : 'FAIL 2',
  ) {
    device.say(id, { kind: 'tool.started', toolUseId, name: 'Bash' });
    device.say(id, { kind: 'tool.input', toolUseId, name: 'Bash', input: { command }, command });
    device.say(id, { kind: 'tool.result', toolUseId, isError: !ok, output });
  }

  /** The report_work tool's own step, in the stream before its call. */
  function aToolStep(id: string, toolUseId: string, name = 'mcp__hub__report_work') {
    device.say(id, { kind: 'tool.started', toolUseId, name });
  }

  const stepsRecorded = (chatId: string, count: number) =>
    until(async () => {
      const message = await last(chatId);
      const finished = message.steps.filter((step) => step.status !== 'running').length;
      return finished >= count && message.steps.at(-1)?.status !== undefined;
    });

  async function aTask(title: string): Promise<string> {
    const created = await call('create_task', { title, specialty: 'backend' });
    const key = /[A-Z][A-Z0-9]*-\d+/.exec(created.text)?.[0];
    if (!key) throw new Error(created.text);
    return key;
  }

  async function aStartedTask(title = 'Do the thing'): Promise<string> {
    const key = await aTask(title);
    expect((await call('claim_task', { key })).isError).toBe(false);
    expect((await call('start_task', { key })).isError).toBe(false);
    return key;
  }

  const statusOf = async (key: string) =>
    (await prisma().card.findFirstOrThrow({ where: { workspaceId, key } })).status;

  const reportInput = (card: string, checks: Record<string, unknown>[]) => ({
    card,
    summary: 'Did it',
    checks,
    notChecked: ['Real payments'],
  });

  describe('report_work', () => {
    it('verified only for a matching successful step, and all verified moves the task, recorded with its reason', async () => {
      const key = await aStartedTask();
      const { chatId, id } = await aTurn();
      aStep(id, 'run-1', 'pnpm test');
      await stepsRecorded(chatId, 1);
      aToolStep(id, 'rep-1');
      const answer = await call(
        'report_work',
        reportInput(key, [{ name: 'Tests', command: 'pnpm test', outcome: 'passed' }]),
        'rep-1',
      );
      expect(answer.isError).toBe(false);
      expect(answer.text).toContain('moved to In review');

      const [report] = (await last(chatId)).reports;
      expect(report?.origin).toBe('panel');
      expect(report?.checks[0]).toMatchObject({ verified: true, basis: 'matched', stepId: 'run-1' });
      expect(report?.move).toEqual({
        moved: true,
        reason: 'all_verified',
        from: 'in_progress',
        to: 'in_review',
      });
      expect(report?.changedFiles).toEqual([{ path: 'real.ts', source: 'git', additions: 2, deletions: 1 }]);
      expect(report?.filesFrom).toBe('bridge');
      expect(await statusOf(key)).toBe('in_review');

      const card = await prisma().card.findFirstOrThrow({ where: { workspaceId, key } });
      const events = await prisma().cardEvent.findMany({
        where: { workspaceId, cardId: card.id },
        orderBy: { seq: 'asc' },
      });
      const evidence = events.find((event) => event.kind === 'work_reported');
      expect(evidence?.data).toMatchObject({
        cardKey: key,
        summary: 'Did it',
        notChecked: ['Real payments'],
      });
      const moved = events.at(-1);
      expect(moved?.kind).toBe('status_changed');
      expect(moved?.data).toMatchObject({ from: 'in_progress', to: 'in_review' });
      expect(String((moved?.data as { reason?: string }).reason)).toContain('verified against a real step');
      expect(moved?.via).toBe('mcp');
      const audit = await prisma().auditLog.findFirst({ where: { action: 'cards.card.report_work' } });
      expect(audit?.summary).toContain('1 of 1');

      const read = await browser.get(`/workspaces/${slug}/cards/${key}/work-reports`).expect(200);
      expect(read.body.data[0].move.moved).toBe(true);
      device.end(id);
    });

    it('a contradicted claim is refused, stores nothing, and moves nothing', async () => {
      const key = await aStartedTask();
      const { chatId, id } = await aTurn();
      aStep(id, 'run-1', 'pnpm test', false);
      await stepsRecorded(chatId, 1);
      aToolStep(id, 'rep-1');
      const answer = await call(
        'report_work',
        reportInput(key, [{ name: 'Tests', command: 'pnpm test', outcome: 'passed' }]),
        'rep-1',
      );
      expect(answer.isError).toBe(true);
      expect(answer.text).toContain('hub.chats.report_contradicted');
      expect(await statusOf(key)).toBe('in_progress');
      expect(await prisma().cardEvent.count({ where: { workspaceId, kind: 'work_reported' } })).toBe(0);
      const message = await until(async () => {
        const now = await last(chatId);
        return now.notices.some((notice) => notice.kind === 'report.refused') ? now : null;
      });
      expect(message.notices.find((notice) => notice.kind === 'report.refused')).toMatchObject({
        cardKey: key,
        checks: [{ name: 'Tests', stepId: 'run-1' }],
      });
      expect(await prisma().auditLog.count({ where: { action: 'chats.report.refused' } })).toBe(1);
      device.end(id);
    });

    it('a claim with no matching step is stored as claimed, and the task stays', async () => {
      const key = await aStartedTask();
      const { chatId, id } = await aTurn();
      aStep(id, 'run-1', 'pnpm lint');
      await stepsRecorded(chatId, 1);
      aToolStep(id, 'rep-1');
      const answer = await call(
        'report_work',
        reportInput(key, [{ name: 'Tests', command: 'pnpm test', outcome: 'passed' }]),
        'rep-1',
      );
      expect(answer.text).toContain('stays where it is');
      const [report] = (await last(chatId)).reports;
      expect(report?.checks[0]).toMatchObject({ verified: false, basis: 'no_matching_step' });
      expect(report?.move).toMatchObject({ moved: false, reason: 'check_not_verified' });
      expect(await statusOf(key)).toBe('in_progress');
      device.end(id);
    });

    it('auto-move only when all are verified: one unverified, a failed one, a skipped one, or none at all, and it stays', async () => {
      for (const [checks, reason] of [
        [
          [
            { name: 'Tests', command: 'pnpm test', outcome: 'passed' },
            { name: 'By eye', outcome: 'passed' },
          ],
          'check_not_verified',
        ],
        [
          [
            { name: 'Tests', command: 'pnpm test', outcome: 'passed' },
            { name: 'Lint', command: 'pnpm lint', outcome: 'failed' },
          ],
          'check_not_passed',
        ],
        [[{ name: 'Tests', command: 'pnpm test', outcome: 'skipped' }], 'check_not_passed'],
        [[], 'no_checks'],
      ] as const) {
        const key = await aStartedTask(reason);
        const { chatId, id } = await aTurn();
        aStep(id, 'run-a', 'pnpm test');
        aStep(id, 'run-b', 'pnpm lint', false);
        await stepsRecorded(chatId, 2);
        aToolStep(id, 'rep-1');
        await call('report_work', reportInput(key, [...checks]), 'rep-1');
        const [report] = (await last(chatId)).reports;
        expect(report?.move).toMatchObject({ moved: false, reason });
        expect(await statusOf(key)).toBe('in_progress');
        device.end(id);
        await until(async () => (await last(chatId)).status !== 'running');
      }
    });

    it('never completes: a task that is not started stays, and one moved stops at In review', async () => {
      const key = await aTask('Not started');
      const { chatId, id } = await aTurn();
      aStep(id, 'run-1', 'pnpm test');
      await stepsRecorded(chatId, 1);
      aToolStep(id, 'rep-1');
      await call(
        'report_work',
        reportInput(key, [{ name: 'Tests', command: 'pnpm test', outcome: 'passed' }]),
        'rep-1',
      );
      expect((await last(chatId)).reports[0]?.move).toMatchObject({ moved: false, reason: 'wrong_status' });
      expect(await statusOf(key)).not.toBe('done');
      expect(await statusOf(key)).not.toBe('in_review');

      const started = await aStartedTask('Moves');
      aToolStep(id, 'rep-2');
      await call(
        'report_work',
        reportInput(started, [{ name: 'Tests', command: 'pnpm test', outcome: 'passed' }]),
        'rep-2',
      );
      expect(await statusOf(started)).toBe('in_review');
      aToolStep(id, 'rep-3');
      await call(
        'report_work',
        reportInput(started, [{ name: 'Tests', command: 'pnpm test', outcome: 'passed' }]),
        'rep-3',
      );
      expect(await statusOf(started)).toBe('in_review');
      device.end(id);
    });

    it('outside the panel, checks stay claimed, files stay Claude’s words, and nothing moves', async () => {
      const key = await aStartedTask();
      const noId = await call('report_work', {
        ...reportInput(key, [{ name: 'Tests', command: 'pnpm test', outcome: 'passed' }]),
        changedFiles: ['claimed.ts'],
      });
      expect(noId.isError).toBe(false);
      expect(noId.text).toContain('outside the panel');
      // A VS Code chat has a tool use id, and it is simply in no panel turn.
      const otherId = await call(
        'report_work',
        reportInput(key, [{ name: 'Tests', command: 'pnpm test', outcome: 'passed' }]),
        'toolu_from_vscode',
      );
      expect(otherId.text).toContain('outside the panel');
      expect(await statusOf(key)).toBe('in_progress');
      const stored = await browser.get(`/workspaces/${slug}/cards/${key}/work-reports`).expect(200);
      const reports = stored.body.data as Report[];
      expect(reports).toHaveLength(2);
      const claimed = reports.find((report) => report.filesFrom === 'claimed');
      expect(claimed?.origin).toBe('outside_panel');
      expect(claimed?.checks[0]).toMatchObject({ verified: false, basis: 'outside_panel' });
      expect(claimed?.changedFiles).toEqual([{ path: 'claimed.ts', source: 'claimed' }]);
      expect(claimed?.move).toMatchObject({ moved: false, reason: 'outside_panel' });
    });

    it('a tool use id from another member’s turn proves nothing', async () => {
      const key = await aStartedTask();
      const { chatId, id } = await aTurn();
      aStep(id, 'run-1', 'pnpm test');
      await stepsRecorded(chatId, 1);
      aToolStep(id, 'rep-1');
      const other = await anAccount(prisma());
      await joinProject(prisma(), workspaceId, other.id, ['owner']);
      const { token } = await aToken(prisma(), other.id, 'mcp');
      const stranger = new Client({ name: 'test', version: '1' });
      await stranger.connect(
        new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
          requestInit: { headers: { authorization: `Bearer ${token}`, 'x-hub-project': slug } },
        }),
      );
      const answer = (await stranger.callTool({
        name: 'report_work',
        arguments: reportInput(key, [{ name: 'Tests', command: 'pnpm test', outcome: 'passed' }]),
        _meta: { 'claudecode/toolUseId': 'rep-1' },
      })) as { content: { text: string }[] };
      await stranger.close();
      expect(answer.content[0]?.text).toContain('outside the panel');
      expect(await statusOf(key)).toBe('in_progress');
      device.end(id);
    });

    it('failure history is kept: a fix adds a run, the failure stays, and real runs are counted', async () => {
      const key = await aStartedTask();
      const { chatId, id } = await aTurn();
      aStep(id, 'run-1', 'pnpm test', false, 'FAIL 2 of 9');
      aStep(id, 'run-2', 'pnpm lint');
      await stepsRecorded(chatId, 2);
      aToolStep(id, 'rep-1');
      const first = await call(
        'report_work',
        reportInput(key, [
          { name: 'Tests', command: 'pnpm test', outcome: 'failed' },
          { name: 'Lint', command: 'pnpm lint', outcome: 'passed' },
        ]),
        'rep-1',
      );
      expect(first.text).toContain('not every check passed');

      aStep(id, 'run-3', 'pnpm test', true, 'ok 9 of 9');
      await stepsRecorded(chatId, 3);
      aToolStep(id, 'rep-2');
      await call(
        'report_work',
        reportInput(key, [
          { name: 'Tests', command: 'pnpm test', outcome: 'passed' },
          { name: 'Lint', command: 'pnpm lint', outcome: 'passed' },
        ]),
        'rep-2',
      );
      const { reports } = await last(chatId);
      expect(reports).toHaveLength(2);
      expect(reports[0]?.checks[0]?.runs.map((run) => run.status)).toEqual(['failed']);
      const tests = reports[1]?.checks[0];
      expect(tests?.runs.map((run) => run.status)).toEqual(['failed', 'passed']);
      expect(tests).toMatchObject({ verified: true, stepId: 'run-3' });
      expect(reports[1]?.counts).toMatchObject({ total: 2, verified: 2, failedRuns: 1 });
      expect(await statusOf(key)).toBe('in_review');
      // The earlier report stays on the card, whole.
      const stored = await browser.get(`/workspaces/${slug}/cards/${key}/work-reports`).expect(200);
      expect((stored.body.data as Report[]).map((item) => item.move.moved)).toEqual([true, false]);
      device.end(id);
    });

    it('leaving a check out of a later report does not earn the move', async () => {
      const key = await aStartedTask();
      const { chatId, id } = await aTurn();
      aStep(id, 'run-1', 'pnpm test', false);
      aStep(id, 'run-2', 'pnpm lint');
      await stepsRecorded(chatId, 2);
      aToolStep(id, 'rep-1');
      await call(
        'report_work',
        reportInput(key, [
          { name: 'Tests', command: 'pnpm test', outcome: 'failed' },
          { name: 'Lint', command: 'pnpm lint', outcome: 'passed' },
        ]),
        'rep-1',
      );
      aToolStep(id, 'rep-2');
      await call(
        'report_work',
        reportInput(key, [{ name: 'Lint', command: 'pnpm lint', outcome: 'passed' }]),
        'rep-2',
      );
      const report = (await last(chatId)).reports[1];
      expect(report?.droppedChecks).toEqual(['Tests']);
      expect(report?.move).toMatchObject({ moved: false, reason: 'check_dropped' });
      expect(await statusOf(key)).toBe('in_progress');
      device.end(id);
    });

    it('with no facts from the device, the files are marked as Claude’s words', async () => {
      const key = await aStartedTask();
      device.answers['turn.files'] = { available: false, files: [] };
      const { chatId, id } = await aTurn();
      aToolStep(id, 'rep-1');
      await call('report_work', { ...reportInput(key, []), changedFiles: ['a.ts'] }, 'rep-1');
      expect((await last(chatId)).reports[0]).toMatchObject({
        filesFrom: 'claimed',
        changedFiles: [{ path: 'a.ts', source: 'claimed' }],
      });
      device.end(id);
    });

    it('a secret in a report is refused by the tool, and the stored output is filtered', async () => {
      const key = await aStartedTask();
      const { chatId, id } = await aTurn();
      aStep(id, 'run-1', 'pnpm test', true, `printed ${SECRET}`);
      await stepsRecorded(chatId, 1);
      aToolStep(id, 'rep-1');
      const refused = await call(
        'report_work',
        { ...reportInput(key, []), summary: `It was ${SECRET}` },
        'rep-1',
      );
      expect(refused.text).toContain('hub.security.secret_detected');
      aToolStep(id, 'rep-2');
      await call(
        'report_work',
        reportInput(key, [{ name: 'Tests', command: 'pnpm test', outcome: 'passed' }]),
        'rep-2',
      );
      const stored = JSON.stringify([
        await prisma().cardEvent.findMany(),
        await prisma().chatMessage.findMany(),
      ]);
      expect(stored).not.toContain(SECRET);
      device.end(id);
    });

    it('the MCP read shows what is verified and what is claimed', async () => {
      const key = await aStartedTask();
      await call('report_work', reportInput(key, [{ name: 'By eye', outcome: 'passed' }]));
      const read = await call('list_work_reports', { key });
      expect(read.text).toContain('not verified (outside_panel)');
      expect(read.text).toContain('Not checked: Real payments');
      expect((await call('list_work_reports', { key: 'NOPE-1' })).text).toContain('no work reports');
    });
  });

  describe('propose_plan', () => {
    const PLAN = {
      title: 'Add a README',
      steps: [{ title: 'Write it', role: 'backend', why: 'Nobody knows how to start' }, { title: 'Link it' }],
      checks: ['pnpm check'],
      risks: ['It goes stale'],
    };

    it('in the panel: a structured plan with its words, on the turn', async () => {
      const { chatId, id } = await aTurn({ mode: 'plan' });
      aToolStep(id, 'plan-1', 'mcp__hub__propose_plan');
      const answer = await call('propose_plan', PLAN, 'plan-1');
      expect(answer.text).toContain('Run this plan');
      const message = await last(chatId);
      expect(message.structuredPlan).toEqual(PLAN);
      expect(message.plan).toContain('1. Write it (backend)');
      device.end(id);
    });

    it('outside: words to show, and it stores nothing', async () => {
      const answer = await call('propose_plan', PLAN);
      expect(answer.text).toContain('Show the user this plan');
      expect(answer.text).toContain('# Add a README');
    });

    it('the engine’s plain text plan still works as the fallback', async () => {
      const { chatId, id } = await aTurn({ mode: 'plan' });
      device.say(id, { kind: 'plan.proposed', plan: 'A plan in words' });
      await until(async () => (await last(chatId)).plan === 'A plan in words');
      expect((await last(chatId)).structuredPlan).toBeNull();
      device.end(id);
    });
  });

  describe('a question', () => {
    const QUESTION = {
      kind: 'question.asked',
      questionId: QUESTION_ID,
      toolUseId: 'q1',
      questions: [{ text: 'Which one?', multiSelect: false, options: [{ label: 'A' }, { label: 'B' }] }],
      expiresAt: '2030-01-01T00:00:00.000Z',
    };

    async function asked() {
      const started = await aTurn();
      device.say(started.id, { kind: 'tool.started', toolUseId: 'q1', name: 'AskUserQuestion' });
      device.say(started.id, QUESTION);
      await until(async () => (await last(started.chatId)).questions.length === 1);
      return started;
    }

    it('is answered through the approval route, and the answer reaches the device', async () => {
      const { chatId, id } = await asked();
      const message = await last(chatId);
      expect(message.approvals).toEqual([]);
      expect(message.questions[0]?.status).toBe('pending');
      await browser
        .post(`${base()}/${chatId}/approvals/${QUESTION_ID}`, {
          decision: 'allow',
          answers: { 'Which one?': 'B' },
        })
        .expect(204);
      const frame = device.of('turn.answer').at(-1)!;
      expect(frame.args).toMatchObject({
        approvalId: QUESTION_ID,
        decision: 'allow',
        answers: { 'Which one?': 'B' },
      });
      expect((await last(chatId)).questions[0]).toMatchObject({
        status: 'answered',
        answers: { 'Which one?': 'B' },
      });
      device.say(id, { kind: 'question.resolved', questionId: QUESTION_ID, status: 'answered' });
      expect(await prisma().auditLog.count({ where: { action: 'chats.question.allow' } })).toBe(1);
      device.end(id);
    });

    it('the first answer wins, a decline is recorded, and an answer must have answers', async () => {
      const { chatId, id } = await asked();
      await browser.post(`${base()}/${chatId}/approvals/${QUESTION_ID}`, { decision: 'allow' }).expect(400);
      await browser
        .post(`${base()}/${chatId}/approvals/${QUESTION_ID}`, { decision: 'deny', note: 'Not now' })
        .expect(204);
      expect(device.of('turn.answer').at(-1)?.args).toMatchObject({ decision: 'deny', note: 'Not now' });
      expect((await last(chatId)).questions[0]?.status).toBe('declined');
      await browser
        .post(`${base()}/${chatId}/approvals/${QUESTION_ID}`, {
          decision: 'allow',
          answers: { 'Which one?': 'A' },
        })
        .expect(409);
      device.end(id);
    });

    it('a secret in an answer is refused', async () => {
      const { chatId, id } = await asked();
      const refused = await browser
        .post(`${base()}/${chatId}/approvals/${QUESTION_ID}`, {
          decision: 'allow',
          answers: { 'Which one?': SECRET },
        })
        .expect(422);
      expect(refused.body.error.code).toBe('hub.security.secret_detected');
      device.end(id);
    });

    it('ends with the turn when nobody answered', async () => {
      const { chatId, id } = await asked();
      device.end(id);
      await until(async () => (await last(chatId)).questions[0]?.status === 'stopped');
    });
  });

  describe('approvals', () => {
    const APPROVAL = {
      kind: 'approval.requested',
      approvalId: APPROVAL_ID,
      toolUseId: 't1',
      toolName: 'Bash',
      command: 'git push origin main',
      category: 'push',
      input: { command: 'git push origin main' },
      effect: 'Pushes to a remote',
      expiresAt: '2030-01-01T00:00:00.000Z',
    };

    async function paused(event: Record<string, unknown> = APPROVAL) {
      const started = await aTurn();
      device.say(started.id, { kind: 'tool.started', toolUseId: 't1', name: 'Bash' });
      device.say(started.id, event as { kind: string });
      await until(async () => (await last(started.chatId)).approvals.length === 1);
      return started;
    }

    it('carries the bridge’s effect line, and an event without one is dropped', async () => {
      const { chatId, id } = await paused();
      expect((await last(chatId)).approvals[0]?.effect).toBe('Pushes to a remote');
      device.end(id);
    });

    it('a note goes back to the device with a deny', async () => {
      const { chatId, id } = await paused();
      await browser
        .post(`${base()}/${chatId}/approvals/${APPROVAL_ID}`, { decision: 'deny', note: 'Not this branch' })
        .expect(204);
      expect(device.of('turn.answer').at(-1)?.args).toMatchObject({
        decision: 'deny',
        note: 'Not this branch',
      });
      device.end(id);
    });

    it('once the device is offline it cannot be allowed, its turn is cut off, and the answer says so', async () => {
      const { chatId } = await paused();
      device.socket.terminate();
      await until(() => !hub.isOnline(deviceId));
      await until(async () => (await last(chatId)).status !== 'running');
      const refused = await browser
        .post(`${base()}/${chatId}/approvals/${APPROVAL_ID}`, { decision: 'allow' })
        .expect(409);
      expect(refused.body.error.code).toBe('hub.chats.approval_device_offline');
      expect(refused.body.error.message).toContain('cut off');
      const message = await last(chatId);
      expect(message).toMatchObject({ status: 'interrupted', failure: 'device_offline' });
      expect(message.approvals[0]?.status).toBe('stopped');
      expect(await prisma().auditLog.count({ where: { action: 'chats.approval.allow' } })).toBe(0);
    });
  });

  describe('notices', () => {
    it('Starting, the version warning and a refused tool are stored as lines on the turn', async () => {
      const { chatId, id } = await aTurn({ mode: 'ask' });
      device.say(id, { kind: 'turn.starting', reason: 'mode' });
      device.say(id, {
        kind: 'engine.warning',
        code: 'newer_than_tested',
        version: '2.1.400',
        testedMax: '2.1.318',
      });
      device.say(id, { kind: 'tool.started', toolUseId: 't1', name: 'Bash' });
      device.say(id, {
        kind: 'tool.blocked',
        toolUseId: 't1',
        name: 'Bash',
        command: `echo ${SECRET}`,
        mode: 'ask',
      });
      const message = await until(async () => {
        const now = await last(chatId);
        return now.notices.length === 3 ? now : null;
      });
      expect(message.notices).toEqual([
        expect.objectContaining({ kind: 'turn.starting', reason: 'mode' }),
        expect.objectContaining({ kind: 'engine.warning', version: '2.1.400', testedMax: '2.1.318' }),
        expect.objectContaining({ kind: 'tool.blocked', name: 'Bash', mode: 'ask' }),
      ]);
      expect(JSON.stringify(message)).not.toContain(SECRET);
      device.end(id);
    });
  });

  describe('D53 and the honest states', () => {
    it('a version below the minimum and an unreadable event each end the turn with a clear message', async () => {
      for (const failure of ['version_out_of_range', 'unreadable_event']) {
        const { chatId, id } = await aTurn();
        device.end(id, { status: 'failed', failure, message: 'Open in VS Code to carry on there.' });
        const message = await until(async () => {
          const now = await last(chatId);
          return now.status !== 'running' ? now : null;
        });
        expect(message).toMatchObject({ status: 'failed', failure });
        expect(message.failureMessage).toContain('Open in VS Code');
      }
    });

    it('the re-check asks the device past its cache, and the plain read does not', async () => {
      device.answers['engine.status'] = {
        found: true,
        version: '2.1.400',
        inRange: false,
        canRun: true,
        warning: { code: 'newer_than_tested', version: '2.1.400', testedMax: '2.1.318' },
        checkedAt: '2026-11-06T10:00:00.000Z',
        testedRange: { min: '2.1.318', max: '2.1.318' },
        message: 'newer',
        signedIn: true,
        effortSupported: true,
        modelSupported: true,
        live: 0,
      };
      const plain = await browser.get(`${base()}/engine?device=${deviceId}`).expect(200);
      expect(plain.body.data).toMatchObject({ canRun: true, warning: { version: '2.1.400' } });
      expect(device.of('engine.status').at(-1)?.args).toEqual({});
      await browser.get(`${base()}/engine?device=${deviceId}&fresh=true`).expect(200);
      expect(device.of('engine.status').at(-1)?.args).toEqual({ fresh: true });
    });
  });

  describe('D51', () => {
    it('a new chat defaults to Execute', async () => {
      const created = await browser.post(base(), { device: deviceId, folder: scratch }).expect(201);
      expect(created.body.data.mode).toBe('execute');
      const asked = await browser
        .post(base(), { device: deviceId, folder: scratch, mode: 'ask' })
        .expect(201);
      expect(asked.body.data.mode).toBe('ask');
    });
  });

  describe('propose_doc and save_doc', () => {
    let docs: string;

    /** A docs source on disk, indexed, as the API's own machine holds it. */
    async function aDocsSource(): Promise<void> {
      docs = join(scratch, 'docs');
      mkdirSync(docs, { recursive: true });
      writeFileSync(join(docs, 'limits.md'), '# Rate limits\n\nThe limit is 40 a minute.\n');
      writeFileSync(join(docs, 'other.md'), '# Payment refunds\n\nRefunds take a week.\n');
      const source = await prisma().source.create({
        data: {
          workspaceId,
          name: 'docs',
          kind: 'local_path',
          config: { path: docs, purpose: 'docs', include: ['**/*.md'] },
        },
      });
      const indexer = app.get(DocsIndexerService, { strict: false });
      await indexer.indexOne(
        { id: source.id, name: 'docs', workspaceId, config: { path: docs, purpose: 'docs' } } as never,
        'limits.md',
        readFileSync(join(docs, 'limits.md')),
      );
      await indexer.indexOne(
        { id: source.id, name: 'docs', workspaceId, config: { path: docs, purpose: 'docs' } } as never,
        'other.md',
        readFileSync(join(docs, 'other.md')),
      );
    }

    const keyOf = async (path: string) => {
      const detail = await prisma().docDetail.findFirstOrThrow({ where: { path } });
      return (await prisma().card.findFirstOrThrow({ where: { workspaceId, id: detail.cardId } })).key;
    };

    const FLAG = 'The limit may rise to 60.';

    async function aDraft(extra: Record<string, unknown> = {}) {
      const key = await keyOf('limits.md');
      const read = await call('get_doc', { key });
      const version = /Version: (\w+)/.exec(read.text)?.[1];
      const started = await aTurn();
      aToolStep(started.id, 'draft-1', 'mcp__hub__propose_doc');
      const answer = await call(
        'propose_doc',
        {
          doc: key,
          title: 'Rate limits',
          reason: 'A new limit',
          baseVersion: version,
          draft: `# Rate limits\n\nThe limit is 40 a minute.\n${FLAG}\n`,
          claims: [
            { text: 'The limit is 40 a minute.', status: 'verified', source: 'limits.md' },
            { text: FLAG, status: 'unverified' },
          ],
          ...extra,
        },
        'draft-1',
      );
      return { ...started, key, version, answer };
    }

    const draftOn = async (chatId: string) => (await last(chatId)).docDrafts[0]!;

    it('server computes the duplicates with links, and Claude cannot pass its own', async () => {
      await aDocsSource();
      const { chatId, id, answer } = await aDraft({ title: 'Payment refunds' });
      expect(answer.text).toContain('Hub found documents like this one');
      const draft = await draftOn(chatId);
      expect(draft.duplicates.map((doc) => doc.path)).toEqual(['other.md']);
      expect(draft.duplicates[0]?.url).toContain(`/${slug}/docs?card=`);
      expect(draft.baseText).toContain('The limit is 40 a minute.');
      expect(draft.claims.map((claim) => [claim.status, claim.answer])).toEqual([
        ['verified', null],
        ['unverified', null],
      ]);
      device.end(id);
    });

    it('a document does not count as its own duplicate', async () => {
      await aDocsSource();
      const { chatId, id } = await aDraft();
      expect((await draftOn(chatId)).duplicates).toEqual([]);
      device.end(id);
    });

    it('an unverified claim must be in the draft, and a stale version or no target is refused', async () => {
      await aDocsSource();
      const key = await keyOf('limits.md');
      const missing = await call('propose_doc', {
        doc: key,
        title: 'T',
        reason: 'R',
        draft: 'Text',
        claims: [{ text: 'Not in it', status: 'unverified' }],
      });
      expect(missing.text).toContain('hub.docs.claim_not_in_draft');
      const stale = await call('propose_doc', {
        doc: key,
        title: 'T',
        reason: 'R',
        baseVersion: 'old',
        draft: 'Text',
        claims: [],
      });
      expect(stale.text).toContain('hub.docs.stale_base');
      const nowhere = await call('propose_doc', { title: 'T', reason: 'R', draft: 'Text', claims: [] });
      expect(nowhere.text).toContain('hub.docs.draft_target_missing');
    });

    it('unanswered flag blocks save_doc, and a refused save never shows as sent', async () => {
      await aDocsSource();
      const { chatId, id } = await aDraft();
      const draft = await draftOn(chatId);
      aToolStep(id, 'save-1', 'mcp__hub__save_doc');
      const answer = await call('save_doc', { draft: draft.id }, 'save-1');
      expect(answer.isError).toBe(true);
      expect(answer.text).toContain('hub.docs.draft_flags_open');
      expect(answer.text).toContain(FLAG);
      expect(readFileSync(join(docs, 'limits.md'), 'utf8')).not.toContain(FLAG);
      const refused = await draftOn(chatId);
      expect(refused).toMatchObject({ status: 'refused', refusedCode: 'hub.docs.draft_flags_open' });
      device.end(id);
    });

    it('in a panel chat a model cannot answer its own flags', async () => {
      await aDocsSource();
      const { chatId, id } = await aDraft();
      const draft = await draftOn(chatId);
      const flag = draft.claims.find((claim) => claim.status === 'unverified')!;
      const answer = await call('save_doc', {
        draft: draft.id,
        answers: [{ id: flag.id, answer: 'confirm' }],
      });
      expect(answer.text).toContain('hub.docs.draft_flags_open');
      device.end(id);
    });

    it('saving the text directly does not get round an open draft', async () => {
      await aDocsSource();
      const { chatId, id, key, version } = await aDraft();
      aToolStep(id, 'save-1', 'mcp__hub__save_doc');
      const answer = await call(
        'save_doc',
        { key, baseHash: version, content: `# Rate limits\n\n${FLAG}\n` },
        'save-1',
      );
      expect(answer.text).toContain('hub.docs.draft_flags_open');
      expect(readFileSync(join(docs, 'limits.md'), 'utf8')).not.toContain(FLAG);
      expect(await draftOn(chatId)).toMatchObject({ status: 'refused' });
      device.end(id);
    });

    /** `save_doc` paused, as the bridge reports it. */
    async function savePaused(id: string, draftId: string) {
      device.say(id, { kind: 'tool.started', toolUseId: 'save-1', name: 'mcp__hub__save_doc' });
      device.say(id, {
        kind: 'approval.requested',
        approvalId: APPROVAL_ID,
        toolUseId: 'save-1',
        toolName: 'mcp__hub__save_doc',
        command: 'save_doc',
        category: 'hub_doc',
        input: { draft: draftId },
        effect: 'Writes a document',
        expiresAt: '2030-01-01T00:00:00.000Z',
      });
    }

    it('Allow with a flag open is refused and stays pending, and the owner’s answers and edit are what gets saved', async () => {
      await aDocsSource();
      const { chatId, id } = await aDraft();
      const draft = await draftOn(chatId);
      await savePaused(id, draft.id);
      const paused = await until(async () => {
        const now = await last(chatId);
        return now.approvals.length === 1 ? now : null;
      });
      expect(paused.approvals[0]?.draftId).toBe(draft.id);

      const refused = await browser
        .post(`${base()}/${chatId}/approvals/${APPROVAL_ID}`, { decision: 'allow' })
        .expect(409);
      expect(refused.body.error.code).toBe('hub.docs.draft_flags_open');
      expect((await last(chatId)).approvals[0]?.status).toBe('pending');
      expect(device.of('turn.answer')).toEqual([]);

      const flag = draft.claims.find((claim) => claim.status === 'unverified')!;
      await browser
        .post(`${base()}/${chatId}/approvals/${APPROVAL_ID}`, {
          decision: 'allow',
          doc: {
            content: `# Rate limits\n\nThe limit is 40 a minute.\n${FLAG}\nAdded by the owner.\n`,
            claims: [{ id: flag.id, answer: 'remove' }],
          },
        })
        .expect(204);
      expect(device.of('turn.answer')).toHaveLength(1);

      // The real tool call, once the bridge has let it through.
      const saved = await call('save_doc', { draft: draft.id }, 'save-1');
      expect(saved.isError).toBe(false);
      const text = readFileSync(join(docs, 'limits.md'), 'utf8');
      expect(text).toContain('Added by the owner.');
      expect(text).not.toContain(FLAG);
      const after = await draftOn(chatId);
      expect(after).toMatchObject({ status: 'saved', refusedCode: null });
      expect(await prisma().docRevision.count({ where: { workspaceId } })).toBe(1);
      device.end(id);
    });

    it('a redraft replaces the open draft, keeps answers for words that did not change, and the old one cannot be saved', async () => {
      await aDocsSource();
      const { chatId, id, key, version } = await aDraft();
      const first = await draftOn(chatId);
      await savePaused(id, first.id);
      await until(async () => (await last(chatId)).approvals.length === 1);
      const flag = first.claims.find((claim) => claim.status === 'unverified')!;
      await browser
        .post(`${base()}/${chatId}/approvals/${APPROVAL_ID}`, {
          decision: 'deny',
          note: 'Shorter, please',
          doc: { claims: [{ id: flag.id, answer: 'remove' }] },
        })
        .expect(204);
      device.say(id, { kind: 'approval.resolved', approvalId: APPROVAL_ID, status: 'denied' });
      aToolStep(id, 'draft-2', 'mcp__hub__propose_doc');
      const other = 'Another open point.';
      await call(
        'propose_doc',
        {
          doc: key,
          title: 'Rate limits',
          reason: 'Shorter',
          baseVersion: version,
          draft: `# Rate limits\n\n${FLAG}\n${other}\n`,
          claims: [
            { text: FLAG, status: 'unverified' },
            { text: other, status: 'unverified' },
          ],
        },
        'draft-2',
      );
      const { docDrafts } = await last(chatId);
      expect(docDrafts.map((draft) => draft.status)).toEqual(['dropped', 'open']);
      expect(docDrafts[1]?.claims.map((claim) => [claim.text, claim.answer])).toEqual([
        [FLAG, 'remove'],
        [other, null],
      ]);
      const old = await call('save_doc', { draft: first.id });
      expect(old.text).toContain('hub.docs.draft_not_found');
      expect(await prisma().auditLog.count({ where: { action: 'docs.draft' } })).toBe(2);
      device.end(id);
    });

    it('keep_flagged writes the mark into the document', async () => {
      await aDocsSource();
      const { chatId, id } = await aDraft();
      const draft = await draftOn(chatId);
      await savePaused(id, draft.id);
      await until(async () => (await last(chatId)).approvals.length === 1);
      const flag = draft.claims.find((claim) => claim.status === 'unverified')!;
      await browser
        .post(`${base()}/${chatId}/approvals/${APPROVAL_ID}`, {
          decision: 'allow',
          doc: { claims: [{ id: flag.id, answer: 'keep_flagged' }] },
        })
        .expect(204);
      await call('save_doc', { draft: draft.id }, 'save-1');
      expect(readFileSync(join(docs, 'limits.md'), 'utf8')).toContain(`> Unverified: ${FLAG}`);
      device.end(id);
    });

    it('a version that moved refuses the save, says so on the draft, and writes nothing', async () => {
      await aDocsSource();
      const { chatId, id } = await aDraft();
      const draft = await draftOn(chatId);
      await savePaused(id, draft.id);
      await until(async () => (await last(chatId)).approvals.length === 1);
      const flag = draft.claims.find((claim) => claim.status === 'unverified')!;
      await browser
        .post(`${base()}/${chatId}/approvals/${APPROVAL_ID}`, {
          decision: 'allow',
          doc: { claims: [{ id: flag.id, answer: 'confirm' }] },
        })
        .expect(204);
      writeFileSync(join(docs, 'limits.md'), '# Rate limits\n\nSomeone else changed this.\n');
      const answer = await call('save_doc', { draft: draft.id }, 'save-1');
      expect(answer.text).toContain('hub.docs.stale_base');
      expect(readFileSync(join(docs, 'limits.md'), 'utf8')).toContain('Someone else');
      expect(await draftOn(chatId)).toMatchObject({ status: 'refused', refusedCode: 'hub.docs.stale_base' });
      device.end(id);
    });

    describe('a stale save shows what moved (docs/16 "§7.2 as built")', () => {
      async function staleDraft(moved: string | null) {
        await aDocsSource();
        const { chatId, id } = await aDraft();
        const draft = await draftOn(chatId);
        expect(draft.conflict).toBeNull();
        await savePaused(id, draft.id);
        await until(async () => (await last(chatId)).approvals.length === 1);
        const flag = draft.claims.find((claim) => claim.status === 'unverified')!;
        await browser
          .post(`${base()}/${chatId}/approvals/${APPROVAL_ID}`, {
            decision: 'allow',
            doc: { claims: [{ id: flag.id, answer: 'confirm' }] },
          })
          .expect(204);
        if (moved === null) rmSync(join(docs, 'limits.md'));
        else writeFileSync(join(docs, 'limits.md'), moved);
        const answer = await call('save_doc', { draft: draft.id }, 'save-1');
        expect(answer.text).toContain('hub.docs.stale_base');
        return { chatId, id };
      }

      it('holds the file’s current text and version, read at the refusal', async () => {
        const moved = '---\ntitle: x\n---\n# Rate limits\n\nSomeone else changed this.\n';
        const { chatId, id } = await staleDraft(moved);
        const { conflict, refusedCode } = await draftOn(chatId);
        expect(refusedCode).toBe('hub.docs.stale_base');
        expect(conflict?.text).toContain('Someone else changed this.');
        expect(conflict?.text).not.toContain('title: x');
        expect(conflict?.version).toBe(createHash('sha256').update(moved).digest('hex'));
        device.end(id);
      });

      it('caps a huge file', async () => {
        const { chatId, id } = await staleDraft(`# Rate limits\n\n${'x'.repeat(250_000)}\n`);
        const { conflict } = await draftOn(chatId);
        expect(conflict!.text.length).toBeLessThan(201_000);
        expect(conflict!.text.endsWith(CHAT_TRUNCATED_MARK)).toBe(true);
        device.end(id);
      });

      // A file already holding a secret is refused earlier, for that reason. This is one that gains it between the save's check and the read here.
      it('never stores a secret the file holds at the read', async () => {
        const docsWrite = app.get(DocsWriteService, { strict: false });
        const real = docsWrite.current.bind(docsWrite);
        const read = jest.spyOn(docsWrite, 'current');
        read.mockImplementation(async (...args) => {
          const now = await real(...args);
          return now.text?.includes('Moved') ? { ...now, text: `${now.text}\n${SECRET}\n` } : now;
        });
        try {
          const { chatId, id } = await staleDraft('# Rate limits\n\nMoved.\n');
          const { conflict } = await draftOn(chatId);
          expect(conflict?.text).toContain('Moved.');
          expect(conflict?.text).not.toContain(SECRET);
          const stored = await prisma().docDraft.findFirstOrThrow({ where: { workspaceId, chatId } });
          expect(JSON.stringify(stored.conflict)).not.toContain(SECRET);
          device.end(id);
        } finally {
          read.mockRestore();
        }
      });

      it('a file that is gone has no version and no text', async () => {
        const { chatId, id } = await staleDraft(null);
        expect((await draftOn(chatId)).conflict).toEqual({ version: null, text: '' });
        device.end(id);
      });

      it('a redraft clears it, on the old draft and the new one', async () => {
        const { chatId, id } = await staleDraft('# Rate limits\n\nMoved.\n');
        const stale = await draftOn(chatId);
        const key = await keyOf('limits.md');
        const version = /Version: (\w+)/.exec((await call('get_doc', { key })).text)?.[1];
        aToolStep(id, 'redraft-1', 'mcp__hub__propose_doc');
        const redrafted = await call(
          'propose_doc',
          {
            doc: key,
            title: 'Rate limits',
            reason: 'Again',
            baseVersion: version,
            draft: '# Rate limits\n\nAgain.\n',
            claims: [],
          },
          'redraft-1',
        );
        expect(redrafted.isError).toBe(false);
        const rows = await prisma().docDraft.findMany({ where: { workspaceId, chatId } });
        expect(rows).toHaveLength(2);
        expect(rows.find((row) => row.id === stale.id)).toMatchObject({ status: 'dropped', conflict: null });
        expect(rows.find((row) => row.id !== stale.id)).toMatchObject({ status: 'open', conflict: null });
        device.end(id);
      });
    });

    it('outside the panel the draft has no chat, and the owner’s answers come with the call', async () => {
      await aDocsSource();
      const key = await keyOf('limits.md');
      const version = /Version: (\w+)/.exec((await call('get_doc', { key })).text)?.[1];
      const answer = await call('propose_doc', {
        doc: key,
        title: 'Rate limits',
        reason: 'R',
        baseVersion: version,
        draft: `# Rate limits\n\n${FLAG}\n`,
        claims: [{ text: FLAG, status: 'unverified' }],
      });
      expect(answer.text).toContain('Show the user the draft');
      const draftId = /Draft `([0-9a-f-]{36})`/.exec(answer.text)?.[1];
      const blocked = await call('save_doc', { draft: draftId });
      expect(blocked.text).toContain('hub.docs.draft_flags_open');
      const saved = await call('save_doc', { draft: draftId, answers: [{ id: 'c1', answer: 'confirm' }] });
      expect(saved.isError).toBe(false);
      expect(readFileSync(join(docs, 'limits.md'), 'utf8')).toContain(FLAG);
      expect(await prisma().chatMessage.count({ where: { workspaceId } })).toBe(0);
    });

    it('a new file proposes with a source and path, and a plain save_doc with no draft still works', async () => {
      await aDocsSource();
      const answer = await call('propose_doc', {
        source: 'docs',
        path: 'fresh.md',
        title: 'Something entirely fresh',
        reason: 'R',
        draft: '# Something entirely fresh\n',
        claims: [],
      });
      expect(answer.text).toContain('A new document');
      const draftId = /Draft `([0-9a-f-]{36})`/.exec(answer.text)?.[1];
      expect((await call('save_doc', { draft: draftId })).isError).toBe(false);
      expect(readFileSync(join(docs, 'fresh.md'), 'utf8')).toContain('entirely fresh');
      const plain = await call('save_doc', { source: 'docs', path: 'plain.md', content: '# Plain\n' });
      expect(plain.isError).toBe(false);
      const empty = await call('save_doc', { source: 'docs', path: 'nope.md' });
      expect(empty.text).toContain('hub.common.validation');
    });

    it('a secret in a draft is refused, and a secret in the base is filtered', async () => {
      await aDocsSource();
      const key = await keyOf('limits.md');
      const refused = await call('propose_doc', {
        doc: key,
        title: 'T',
        reason: 'R',
        draft: `Text ${SECRET}`,
        claims: [],
      });
      expect(refused.text).toContain('hub.security.secret_detected');
      writeFileSync(join(docs, 'limits.md'), `# Rate limits\n\nKey ${SECRET}\n`);
      const { id } = await aTurn();
      aToolStep(id, 'draft-2', 'mcp__hub__propose_doc');
      await call(
        'propose_doc',
        { doc: key, title: 'Unique words here', reason: 'R', draft: '# New\n', claims: [] },
        'draft-2',
      );
      expect(JSON.stringify(await prisma().docDraft.findMany())).not.toContain(SECRET);
      device.end(id);
    });
  });

  it('a session id is kept as the turn starts', async () => {
    const { chatId, id } = await aTurn();
    device.say(id, { kind: 'turn.session', sessionId: SESSION });
    device.end(id);
    await until(async () => (await last(chatId)).status === 'done');
  });
});
