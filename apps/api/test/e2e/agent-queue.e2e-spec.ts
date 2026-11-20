/**
 * @file The agent queue (docs/16 §9) over real credentials and a real socket, with a scripted device on the other end: starting, limits, holds, approvals, the inbox, usage limits, sign-in, order, and restarts.
 * @description The clock is the test's, and the tick is called by hand (`QUEUE_MODE=inline` keeps the timer off), so each rule is tested at the moment it matters. The browser gate, on the real bridge and binary, is `apps/web/e2e/specs/agent-queue.spec.ts`.
 */
import type { AddressInfo } from 'node:net';

import { worktreeFolderFor } from '@hub/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { WebSocket } from 'ws';

import { type FakeClock } from '@/infra/clock/clock';
import { AgentQueueDispatcher } from '@/modules/agent-queue';
import { ChatsService } from '@/modules/chats';
import { BridgeHub } from '@/modules/devices';

import { anAccount, aToken, Browser, join as joinProject, PASSWORD } from '../helpers/auth';
import { aProject } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

const FOLDER = 'C:/work/repo';
const OTHER = 'C:/work/other';
const ENGINE = {
  found: true,
  version: '2.1.318',
  inRange: true,
  testedRange: { min: '2.1.300', max: '2.1.318' },
  message: null,
  canRun: true,
  warning: null,
  checkedAt: '2026-11-05T09:00:00.000Z',
  signedIn: true,
  effortSupported: true,
  modelSupported: true,
  live: 0,
};

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

/** An answer that refuses, as the bridge does with a `Refusal`. */
const refuse = (code: string, message = code) => ({ refused: { code, message } });

/** Stands where `hub-bridge` stands. Holds each `turn.start` open until the test ends it. An answer may be a function of the action's args. */
class ScriptedDevice {
  readonly actions: ActionFrame[] = [];
  private seq = 0;
  answers: Partial<Record<string, unknown>> = {
    'turn.answer': { accepted: true },
    'turn.stop': { stopped: true },
    'chat.close': { closed: true },
    'engine.status': ENGINE,
  };

  constructor(readonly socket: WebSocket) {
    socket.on('message', (data) => {
      const frame = JSON.parse((data as Buffer).toString()) as { type: string } & ActionFrame;
      if (frame.type !== 'action') return;
      this.actions.push(frame);
      const scripted = this.answers[frame.action];
      const answer =
        typeof scripted === 'function' ? (scripted as (args: unknown) => unknown)(frame.args) : scripted;
      if (answer && typeof answer === 'object' && 'refused' in answer) {
        const { code, message } = (answer as { refused: { code: string; message: string } }).refused;
        this.socket.send(
          JSON.stringify({ type: 'result', id: frame.id, ok: false, error: { code, message } }),
        );
      } else if (answer !== undefined) {
        this.result(frame.id, answer);
      }
    });
  }

  turns(): ActionFrame[] {
    return this.actions.filter((frame) => frame.action === 'turn.start');
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

interface Run {
  id: string;
  title: string;
  state: string;
  worktree: { folder: string; branch: string; base: string; removed: boolean } | null;
  dirtyFiles: number | null;
  allowDirty: boolean;
  stored: string;
  hold: string | null;
  chatId: string | null;
  summary: string | null;
  failure: string | null;
  waitingOn: { command: string } | null;
  changedFiles: { path: string }[];
  runAt: string | null;
  repeat: { day: string; time: string } | null;
}
interface Queue {
  state: {
    paused: boolean;
    pausedReason: string | null;
    resumesAt: string | null;
    usedToday: number;
    running: number;
    timezone: string;
  };
  runs: Run[];
}

describe('the agent queue', () => {
  let app: INestApplication;
  let clock: FakeClock;
  let port: number;
  let browser: Browser;
  let userId: string;
  let email: string;
  let slug: string;
  let workspaceId: string;
  let deviceId: string;
  let credential: string;
  let device: ScriptedDevice;
  const sockets: WebSocket[] = [];

  const prisma = () => maintenanceClients().prisma;
  const api = () => request(app.getHttpServer() as Parameters<typeof request>[0]);
  const base = () => `/workspaces/${slug}/queue`;
  const tick = () => app.get(AgentQueueDispatcher, { strict: false }).tickAll();

  async function boot() {
    ({ app, clock } = await createTestApp({ realAuth: true }));
    await app.listen(0);
    port = (app.getHttpServer() as { address(): AddressInfo }).address().port;
  }

  beforeAll(boot);

  async function pair() {
    const started = await api()
      .post('/api/v1/pairing/start')
      .send({ name: 'Main', platform: 'win32' })
      .expect(201);
    const { deviceCode, userCode } = started.body.data as { deviceCode: string; userCode: string };
    await browser.post(`/pairing/${userCode}/approve`).expect(204);
    const polled = await api().post('/api/v1/pairing/poll').send({ deviceCode }).expect(200);
    return polled.body.data as { deviceId: string; credential: string };
  }

  /** `actions`: what the device says it can do. None, as an older bridge, keeps every run on its folder (docs/16 §9.2). */
  async function connectDevice(actions: string[] = []): Promise<ScriptedDevice> {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/bridge`, {
      headers: { authorization: `Bearer ${credential}` },
    });
    sockets.push(socket);
    const scripted = new ScriptedDevice(socket);
    await new Promise((done, fail) => {
      socket.once('open', done);
      socket.once('error', fail);
    });
    socket.send(JSON.stringify({ type: 'hello', protocol: 1, status: {}, actions }));
    const hub = app.get(BridgeHub, { strict: false });
    await until(() => hub.isOnline(deviceId));
    return scripted;
  }

  async function signIn() {
    browser = new Browser(app);
    await browser.post('/auth/sign-in', { email, password: PASSWORD }).expect(200);
  }

  beforeEach(async () => {
    const account = await anAccount(prisma());
    userId = account.id;
    email = account.email;
    const project = await aProject(app);
    slug = project.slug;
    workspaceId = project.id;
    await joinProject(prisma(), project.id, userId, ['owner']);
    await prisma().workspace.update({ where: { id: project.id }, data: { repoPaths: [FOLDER, OTHER] } });
    clock.set(new Date('2026-11-05T09:00:00.000Z'));
    await signIn();
    ({ deviceId, credential } = await pair());
    device = await connectDevice();
    // The machine's own zone differs between machines; the tests name theirs.
    await settings({ timezone: 'UTC' });
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.terminate();
    const chats = app.get(ChatsService, { strict: false });
    await until(() => chats.runningCount() === 0);
  });

  async function aTask(title = 'Tidy the README'): Promise<string> {
    const created = await browser
      .post(`/workspaces/${slug}/cards`, { type: 'task', title, detail: { specialty: 'backend' } })
      .expect(201);
    return created.body.data.key as string;
  }

  async function addRun(body: Record<string, unknown>): Promise<Run> {
    const answer = await browser
      .post(`${base()}/runs`, { device: deviceId, folder: FOLDER, when: { kind: 'now' }, ...body })
      .expect(201);
    return answer.body.data as Run;
  }

  const read = async (): Promise<Queue> => (await browser.get(base()).expect(200)).body.data as Queue;
  const runOf = async (id: string): Promise<Run> => (await read()).runs.find((run) => run.id === id)!;
  const settings = (body: Record<string, unknown>) => browser.patch(`${base()}/settings`, body).expect(200);

  it('an explainer run makes a plan’s video in its folder with the film stages, only once one was asked for', async () => {
    const created = await browser
      .post(`/workspaces/${slug}/cards`, {
        type: 'plan',
        title: 'Video plan',
        detail: { steps: [{ title: 'One' }] },
      })
      .expect(201);
    const key = created.body.data.key as string;
    // Nothing asked for yet: there is nothing to make.
    await browser
      .post(`${base()}/runs`, {
        device: deviceId,
        folder: FOLDER,
        when: { kind: 'now' },
        source: 'explainer',
        cardKey: key,
      })
      .expect(409)
      .expect(({ body }) => expect(body.error.code).toBe('hub.plans.explainer_not_requested'));
    await browser
      .post(`/workspaces/${slug}/plans/${key}/explainer`, {
        voice: 'google',
        googleVoice: 'Kore',
        aspect: 'portrait',
      })
      .expect(200);
    const run = await addRun({ source: 'explainer', cardKey: key });
    expect(run.title).toBe('Video plan · video');
    await until(() => device.turns().length === 1);
    const prompt = String(device.turns()[0]!.args['prompt']);
    expect(prompt).toContain(
      `Make the explainer video of plan ${key} (revision 1) with Hams' plan-film engine`,
    );
    expect(prompt).toContain('voice google (Gemini TTS), voice Kore');
    expect(prompt).toContain('aspect portrait');
    expect(prompt).toContain('protocol film');
    device.end(device.turns()[0]!.id, { status: 'done', changedFiles: [] });
    await until(async () => ((await runOf(run.id)).state === 'done' ? true : null));
  });

  it('Run now on a task starts a panel chat turn in Execute with the work protocol, and its result lands on the run', async () => {
    const key = await aTask();
    const run = await addRun({ source: 'task', cardKey: key });
    await until(() => device.turns().length === 1);
    const turn = device.turns()[0]!;
    expect(turn.args['mode']).toBe('execute');
    expect(turn.args['folder']).toBe(FOLDER);
    expect(String(turn.args['prompt'])).toMatch(new RegExp(`^/hub:work ${key}\\n`));
    expect(String(turn.args['prompt'])).toContain(`Open card: ${key}`);
    const running = await runOf(run.id);
    expect(running.state).toBe('running');
    expect(running.chatId).toBeTruthy();

    device.say(turn.id, { kind: 'text.delta', text: 'Tidied the README and ran the lint. ' });
    device.end(turn.id, {
      status: 'done',
      changedFiles: [{ path: 'README.md', source: 'git', additions: 3, deletions: 1 }],
    });
    const done = await until(async () => {
      const now = await runOf(run.id);
      return now.state === 'done' ? now : null;
    });
    expect(done.summary).toContain('Tidied the README');
    expect(done.changedFiles.map((file) => file.path)).toEqual(['README.md']);
    // The task never completes by itself (D52): with no verified report it has not moved.
    const card = await browser.get(`/workspaces/${slug}/cards/${key}`).expect(200);
    expect(card.body.data.status).not.toBe('done');
  });

  it('a scheduled run waits for its local time, survives a restart, and starts as a missed run when the device is back', async () => {
    await settings({ timezone: 'Europe/Istanbul' });
    // 12:00 in Istanbul now; 13:00 is 10:00 UTC.
    const run = await addRun({
      source: 'prompt',
      prompt: 'Summarise the open needs',
      when: { kind: 'once', date: '2026-11-05', time: '13:00' },
    });
    expect(run.state).toBe('scheduled');
    expect(run.runAt).toBe('2026-11-05T10:00:00.000Z');
    await tick();
    expect(device.turns()).toHaveLength(0);

    // The API goes away before the time and comes back after it.
    for (const socket of sockets.splice(0)) socket.terminate();
    await app.close();
    await boot();
    clock.set(new Date('2026-11-05T10:30:00.000Z'));
    await signIn();
    device = await connectDevice();
    await until(() => device.turns().length === 1);
    expect(device.turns()[0]!.args['prompt']).toContain('Summarise the open needs');
    expect((await runOf(run.id)).state).toBe('running');
    device.end(device.turns()[0]!.id);
    await until(async () => (await runOf(run.id)).state === 'done');
  });

  it('a run cut off by a restart is interrupted, and nothing starts it again', async () => {
    const run = await addRun({ source: 'prompt', prompt: 'Long work' });
    await until(() => device.turns().length === 1);
    for (const socket of sockets.splice(0)) socket.terminate();
    await until(
      async () => (await prisma().agentRun.findUnique({ where: { id: run.id } }))?.state !== 'running',
    );
    await app.close();
    await boot();
    await signIn();
    device = await connectDevice();
    await tick();
    const after = await runOf(run.id);
    expect(after.state).toBe('interrupted');
    expect(device.turns()).toHaveLength(0);
  });

  it('an approval pauses the run: it waits, reaches the inbox, and keeps its folder', async () => {
    await settings({ maxConcurrent: 2 });
    const first = await addRun({ source: 'prompt', prompt: 'Push the branch' });
    await until(() => device.turns().length === 1);
    const turn = device.turns()[0]!;
    device.say(turn.id, { kind: 'tool.started', toolUseId: 'toolu_push', name: 'Bash' });
    device.say(turn.id, {
      kind: 'approval.requested',
      approvalId: '33333333-3333-4333-8333-333333333333',
      toolUseId: 'toolu_push',
      toolName: 'Bash',
      command: 'git push origin main',
      category: 'push',
      effect: 'Pushes to a remote',
      input: { command: 'git push origin main' },
      expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
    });
    const waiting = await until(async () => {
      const now = await runOf(first.id);
      return now.state === 'waiting' ? now : null;
    });
    expect(waiting.waitingOn?.command).toBe('git push origin main');
    const inbox = await until(async () => {
      const items = await prisma().notification.findMany({ where: { workspaceId, userId } });
      return (
        items.find((item) => (item.data as { i18n?: { key?: string } }).i18n?.key === 'run_waiting') ?? null
      );
    });
    expect((inbox.data as { link?: { view: string } }).link?.view).toBe('queue');

    // A second run in the same folder waits, even with room for two.
    const second = await addRun({ source: 'prompt', prompt: 'Lint' });
    await tick();
    expect(device.turns()).toHaveLength(1);
    expect((await runOf(second.id)).hold).toBe('folder_busy');
    // In another folder it may start.
    const third = await addRun({ source: 'prompt', prompt: 'Elsewhere', folder: OTHER });
    await until(() => device.turns().length === 2);
    expect((await runOf(third.id)).state).toBe('running');
    for (const each of device.turns()) device.end(each.id);
  });

  it('holds runs at the limits: one at a time, runs per day, quiet hours and pause all', async () => {
    const first = await addRun({ source: 'prompt', prompt: 'One' });
    await until(() => device.turns().length === 1);
    const second = await addRun({ source: 'prompt', prompt: 'Two', folder: OTHER });
    await tick();
    expect((await runOf(second.id)).hold).toBe('concurrency');
    device.end(device.turns()[0]!.id);
    await until(() => device.turns().length === 2);
    device.end(device.turns()[1]!.id);
    await until(async () => (await runOf(second.id)).state === 'done');
    expect((await runOf(first.id)).state).toBe('done');

    await settings({ perDay: 2 });
    const third = await addRun({ source: 'prompt', prompt: 'Three' });
    await tick();
    expect((await runOf(third.id)).hold).toBe('daily_limit');
    expect((await read()).state.usedToday).toBe(2);

    await settings({ perDay: 10, quietHours: { from: '08:00', to: '10:00' } });
    await tick();
    expect((await runOf(third.id)).hold).toBe('quiet_hours');

    await browser.post(`${base()}/pause`, { paused: true }).expect(200);
    await settings({ quietHours: null });
    await tick();
    expect((await runOf(third.id)).hold).toBe('paused_all');
    expect(device.turns()).toHaveLength(2);
    await browser.post(`${base()}/pause`, { paused: false }).expect(200);
    await until(() => device.turns().length === 3);
    device.end(device.turns()[2]!.id);
  });

  it('the usage limit pauses the queue and says when; it continues once at that time, with no retry', async () => {
    const run = await addRun({ source: 'prompt', prompt: 'Big job' });
    await until(() => device.turns().length === 1);
    const resetsAt = Math.floor(new Date('2026-11-05T12:00:00.000Z').getTime() / 1000);
    device.end(device.turns()[0]!.id, { status: 'failed', failure: 'rate_limited', resetsAt });
    await until(async () => (await read()).state.paused);
    const queue = await read();
    expect(queue.state.pausedReason).toBe('usage_limit');
    expect(queue.state.resumesAt).toBe('2026-11-05T12:00:00.000Z');
    expect((await runOf(run.id)).state).toBe('failed');

    const next = await addRun({ source: 'prompt', prompt: 'After the limit' });
    await tick();
    expect((await runOf(next.id)).hold).toBe('usage_limit');
    expect(device.turns()).toHaveLength(1);
    // The failed run is not tried again; the next one starts once the limit resets.
    clock.set(new Date('2026-11-05T12:01:00.000Z'));
    await signIn();
    await tick();
    await until(() => device.turns().length === 2);
    expect(device.turns()[1]!.args['prompt']).toContain('After the limit');
    expect((await read()).state.paused).toBe(false);
    device.end(device.turns()[1]!.id);
  });

  it('signed out puts the run back in line and the queue waits, saying why', async () => {
    const run = await addRun({ source: 'prompt', prompt: 'Needs a sign-in' });
    await until(() => device.turns().length === 1);
    device.end(device.turns()[0]!.id, { status: 'failed', failure: 'signed_out' });
    const back = await until(async () => {
      const now = await runOf(run.id);
      return now.stored === 'queued' ? now : null;
    });
    expect(back.hold).toBe('signed_out');
    expect(back.chatId).toBeNull();
    await tick();
    expect(device.turns()).toHaveLength(1);
  });

  it('starts in the owner’s order, and a paused run waits until resumed', async () => {
    await browser.post(`${base()}/pause`, { paused: true }).expect(200);
    const a = await addRun({ source: 'prompt', prompt: 'A' });
    const b = await addRun({ source: 'prompt', prompt: 'B' });
    await browser.post(`${base()}/order`, { ids: [b.id, a.id] }).expect(200);
    await browser.post(`${base()}/runs/${b.id}/pause`).expect(200);
    expect((await runOf(b.id)).state).toBe('paused');
    await browser.post(`${base()}/pause`, { paused: false }).expect(200);
    await until(() => device.turns().length === 1);
    expect(device.turns()[0]!.args['prompt']).toContain('A');
    device.end(device.turns()[0]!.id);
    await until(async () => (await runOf(a.id)).state === 'done');
    await browser.post(`${base()}/runs/${b.id}/resume`).expect(200);
    await until(() => device.turns().length === 2);
    expect(device.turns()[1]!.args['prompt']).toContain('B');
    device.end(device.turns()[1]!.id);
  });

  it('cancel stops a running run; a weekly run leaves next week’s copy as it starts', async () => {
    const run = await addRun({ source: 'prompt', prompt: 'Stop me' });
    await until(() => device.turns().length === 1);
    await browser.post(`${base()}/runs/${run.id}/cancel`).expect(200);
    await until(() => device.actions.some((frame) => frame.action === 'turn.stop'));
    device.end(device.turns()[0]!.id, { status: 'stopped' });
    await until(() => app.get(ChatsService, { strict: false }).runningCount() === 0);
    expect((await runOf(run.id)).state).toBe('cancelled');

    // Thursday 09:00 UTC; weekly on Thursday at 09:30.
    const weekly = await addRun({
      source: 'prompt',
      prompt: 'Weekly tidy',
      when: { kind: 'weekly', day: 'THU', time: '09:30' },
    });
    expect(weekly.repeat).toEqual({ day: 'THU', time: '09:30' });
    clock.set(new Date('2026-11-05T09:31:00.000Z'));
    await signIn();
    await tick();
    await until(() => device.turns().length === 2);
    const copies = (await read()).runs.filter((each) => each.repeat && each.state === 'scheduled');
    expect(copies.map((copy) => copy.runAt)).toEqual(['2026-11-12T09:30:00.000Z']);
    device.end(device.turns()[1]!.id);
  });

  it('a run must be on the project’s folders and an open task; a token cannot add one', async () => {
    await browser
      .post(`${base()}/runs`, {
        source: 'prompt',
        prompt: 'x',
        device: deviceId,
        folder: 'D:/elsewhere',
        when: { kind: 'now' },
      })
      .expect(422);
    const key = await aTask();
    await browser.post(`/workspaces/${slug}/tasks/${key}/cancel`, { reason: 'not needed' });
    const card = await browser.get(`/workspaces/${slug}/cards/${key}`).expect(200);
    if (card.body.data.status === 'cancelled') {
      await browser
        .post(`${base()}/runs`, {
          source: 'task',
          cardKey: key,
          device: deviceId,
          folder: FOLDER,
          when: { kind: 'now' },
        })
        .expect(422);
    }
    const { token } = await aToken(prisma(), userId, 'mcp');
    await api()
      .post(`/api/v1${base()}/runs`)
      .set('authorization', `Bearer ${token}`)
      .send({ source: 'prompt', prompt: 'x', device: deviceId, folder: FOLDER, when: { kind: 'now' } })
      .expect(403);
    await api().get(`/api/v1${base()}`).set('authorization', `Bearer ${token}`).expect(200);
  });

  // ── D58 to D60 ────────────────────────────────────────────────────────────────────────────────

  interface Decision {
    id: string;
    kind: string;
    command: string;
    category: string;
    folder: string;
    why: string | null;
    answers: { question: string; answer: string }[];
    followChatId: string | null;
  }

  it('automatic refuses a push, records it as a pending item with its folder and reason, and never waits (D58)', async () => {
    const run = await addRun({ source: 'prompt', prompt: 'Ship the fix', mode: 'automatic' });
    expect((run as Run & { mode: string }).mode).toBe('automatic');
    await until(() => device.turns().length === 1);
    const turn = device.turns()[0]!;
    expect(turn.args['runMode']).toBe('automatic');
    expect(turn.args['untimed']).toBeUndefined();
    expect(String(turn.args['prompt'])).toContain('Run mode: automatic');
    device.say(turn.id, { kind: 'tool.started', toolUseId: 'toolu_q', name: 'AskUserQuestion' });
    device.say(turn.id, {
      kind: 'auto.decision',
      decisionId: '44444444-4444-4444-8444-444444444444',
      toolUseId: 'toolu_q',
      decision: 'answered',
      toolName: 'question',
      command: 'Which store?',
      category: 'other',
      input: {},
      effect: '',
      questions: [
        { text: 'Which store?', multiSelect: false, options: [{ label: 'Postgres (Recommended)' }] },
      ],
      answers: { 'Which store?': 'Postgres (Recommended)' },
    });
    device.say(turn.id, { kind: 'tool.started', toolUseId: 'toolu_push', name: 'Bash' });
    device.say(turn.id, {
      kind: 'auto.decision',
      decisionId: '55555555-5555-4555-8555-555555555555',
      toolUseId: 'toolu_push',
      decision: 'skipped',
      toolName: 'Bash',
      command: 'git push origin main',
      category: 'push',
      input: { command: 'git push origin main', description: 'Publish the fix' },
      effect: 'Pushes to a remote',
    });
    // Nothing waits on the owner: the run is still running, not waiting.
    await until(
      async () =>
        (await prisma().chatApproval.count({ where: { chatId: turn.args['chatId'] as string } })) === 2,
    );
    expect((await runOf(run.id)).state).toBe('running');
    device.say(turn.id, { kind: 'text.delta', text: 'Fixed it. The push waits for the owner.' });
    device.end(turn.id);
    const done = await until(async () => {
      const now = (await runOf(run.id)) as Run & { decisions: Decision[] };
      return now.state === 'done' ? now : null;
    });
    expect(done.decisions.map((decision) => decision.kind)).toEqual(['answered', 'skipped']);
    expect(done.decisions[0]!.answers).toEqual([
      { question: 'Which store?', answer: 'Postgres (Recommended)' },
    ]);
    const pending = done.decisions[1]!;
    expect(pending).toMatchObject({
      command: 'git push origin main',
      category: 'push',
      folder: FOLDER,
      why: 'Publish the fix',
      followChatId: null,
    });
    const notices = await prisma().notification.findMany({ where: { workspaceId, userId } });
    expect(
      notices.some((item) => (item.data as { i18n?: { key?: string } }).i18n?.key === 'run_waiting'),
    ).toBe(false);

    // Run it later: a new chat on that folder, in the panel's own mode, so D41 still asks.
    const later = await browser.post(`${base()}/runs/${run.id}/pending/${pending.id}/run`).expect(200);
    await until(() => device.turns().length === 2);
    const follow = device.turns()[1]!;
    expect(follow.args['folder']).toBe(FOLDER);
    expect(follow.args['runMode']).toBeUndefined();
    expect(follow.args['untimed']).toBeUndefined();
    expect(String(follow.args['prompt'])).toContain('git push origin main');
    expect(later.body.data.chatId).toBe(follow.args['chatId']);
    const after = (await runOf(run.id)) as Run & { decisions: Decision[] };
    expect(after.decisions[1]!.followChatId).toBe(follow.args['chatId']);
    // An answered question is not a pending item.
    await browser.post(`${base()}/runs/${run.id}/pending/${done.decisions[0]!.id}/run`).expect(404);
    device.end(follow.id);
  });

  it('With my approval waits with no time limit for a queued run, and the mode of a run not started can change (D58)', async () => {
    await browser.post(`${base()}/pause`, { paused: true }).expect(200);
    const run = await addRun({ source: 'prompt', prompt: 'Careful work', mode: 'automatic' });
    const changed = await browser.post(`${base()}/runs/${run.id}/mode`, { mode: 'approval' }).expect(200);
    expect(changed.body.data.mode).toBe('approval');
    await browser.post(`${base()}/pause`, { paused: false }).expect(200);
    await until(() => device.turns().length === 1);
    const turn = device.turns()[0]!;
    expect(turn.args['runMode']).toBe('approval');
    expect(turn.args['untimed']).toBe(true);
    await browser.post(`${base()}/runs/${run.id}/mode`, { mode: 'automatic' }).expect(409);
    device.end(turn.id);
  });

  it('a run with extra folders holds all of them, and a folder not on the project is refused (D59)', async () => {
    await settings({ maxConcurrent: 3 });
    await addRun({ source: 'prompt', prompt: 'Across both', extraFolders: [OTHER] });
    await until(() => device.turns().length === 1);
    expect(device.turns()[0]!.args['addDirs']).toEqual([OTHER]);
    expect(String(device.turns()[0]!.args['prompt'])).toContain(`Also work in: ${OTHER}`);
    const blocked = await addRun({ source: 'prompt', prompt: 'In the extra folder', folder: OTHER });
    await tick();
    expect(device.turns()).toHaveLength(1);
    expect((await runOf(blocked.id)).hold).toBe('folder_busy');
    await browser
      .post(`${base()}/runs`, {
        source: 'prompt',
        prompt: 'x',
        device: deviceId,
        folder: FOLDER,
        extraFolders: ['D:/elsewhere'],
        when: { kind: 'now' },
      })
      .expect(422);
    await browser
      .post(`${base()}/runs`, {
        source: 'prompt',
        prompt: 'x',
        device: deviceId,
        folder: FOLDER,
        extraFolders: [FOLDER],
        when: { kind: 'now' },
      })
      .expect(400);
    await browser.post(`${base()}/runs/${blocked.id}/cancel`).expect(200);
    device.end(device.turns()[0]!.id);
  });

  it('a run carries each of its roles into the prompt, and a task brings its own role by default (D60)', async () => {
    await settings({ maxConcurrent: 2 });
    const run = await addRun({ source: 'prompt', prompt: 'Build the page', roles: ['backend', 'frontend'] });
    expect((run as Run & { roles: string[] }).roles).toEqual(['backend', 'frontend']);
    await until(() => device.turns().length === 1);
    const prompt = String(device.turns()[0]!.args['prompt']);
    expect(prompt).toContain('Role: Backend (backend).');
    expect(prompt).toContain('Role: Frontend (frontend).');
    device.end(device.turns()[0]!.id);

    const created = await browser
      .post(`/workspaces/${slug}/cards`, {
        type: 'task',
        title: 'QA pass',
        ownerRole: 'qa',
        detail: { specialty: 'qa' },
      })
      .expect(201);
    const task = await addRun({ source: 'task', cardKey: created.body.data.key, folder: OTHER });
    expect((task as Run & { roles: string[] }).roles).toEqual(['qa']);
    await until(() => device.turns().length === 2);
    expect(String(device.turns()[1]!.args['prompt'])).toContain('Role: QA (qa).');
    device.end(device.turns()[1]!.id);
  });

  describe('isolation (docs/16 §9.2)', () => {
    const COPY_ACTIONS = ['folder.status', 'worktree.prepare', 'worktree.remove'];
    const prepared = (args: unknown) => {
      const { folder, key } = args as { folder: string; key: string };
      return {
        folder: worktreeFolderFor(folder, key),
        branch: `hub/${key.toLowerCase()}`,
        base: 'abc1234',
        baseBranch: 'main',
        reused: false,
        linked: 1,
      };
    };

    it('runs each task in its own copy of the repository, so two tasks on one repository run together', async () => {
      device = await connectDevice(COPY_ACTIONS);
      device.answers['worktree.prepare'] = prepared;
      await settings({ maxConcurrent: 2 });
      const [first, second] = [await aTask('One'), await aTask('Two')];
      const one = await addRun({ source: 'task', cardKey: first });
      const two = await addRun({ source: 'task', cardKey: second });
      await tick();
      await until(() => device.turns().length === 2);
      const folders = device.turns().map((turn) => turn.args['folder']);
      expect(folders.sort()).toEqual(
        [worktreeFolderFor(FOLDER, first), worktreeFolderFor(FOLDER, second)].sort(),
      );
      expect(device.turns().every((turn) => turn.args['isolated'] === true)).toBe(true);
      expect(
        device.actions.filter((frame) => frame.action === 'worktree.prepare').map((frame) => frame.args),
      ).toEqual(
        expect.arrayContaining([
          { folder: FOLDER, key: first },
          { folder: FOLDER, key: second },
        ]),
      );
      expect((await runOf(one.id)).worktree).toEqual({
        folder: worktreeFolderFor(FOLDER, first),
        branch: `hub/${first.toLowerCase()}`,
        base: 'abc1234',
        removed: false,
      });
      expect((await runOf(two.id)).state).toBe('running');
      for (const turn of device.turns()) device.end(turn.id);
    });

    it('works in the folder itself when it is no repository top, and waits on changes not committed until the owner lets it', async () => {
      device = await connectDevice(COPY_ACTIONS);
      device.answers['worktree.prepare'] = refuse(
        'not_a_repository',
        'This folder is inside a repository, not its top folder.',
      );
      device.answers['folder.status'] = { repository: true, changed: 2, branch: 'main' };
      const run = await addRun({ source: 'prompt', prompt: 'Tidy up' });
      await tick();
      await tick();
      const held = await runOf(run.id);
      expect(held).toMatchObject({
        state: 'next',
        hold: 'folder_dirty',
        dirtyFiles: 2,
        allowDirty: false,
        worktree: null,
      });
      expect(device.turns()).toEqual([]);

      await browser.post(`${base()}/runs/${run.id}/allow-dirty`).expect(200);
      await tick();
      await until(() => device.turns().length === 1);
      const turn = device.turns()[0]!;
      expect(turn.args['folder']).toBe(FOLDER);
      expect(turn.args['isolated']).toBeUndefined();
      expect(await runOf(run.id)).toMatchObject({ state: 'running', allowDirty: true, dirtyFiles: null });
      device.end(turn.id);
    });

    it('a folder the owner commits lets a held run go by itself; folder isolation never makes a copy', async () => {
      device = await connectDevice(COPY_ACTIONS);
      await settings({ isolation: 'folder' });
      device.answers['folder.status'] = { repository: true, changed: 1, branch: 'main' };
      const run = await addRun({ source: 'prompt', prompt: 'Tidy up' });
      await tick();
      expect((await runOf(run.id)).hold).toBe('folder_dirty');
      device.answers['folder.status'] = { repository: true, changed: 0, branch: 'main' };
      await tick();
      await until(() => device.turns().length === 1);
      expect(device.turns()[0]!.args['folder']).toBe(FOLDER);
      expect(device.actions.some((frame) => frame.action === 'worktree.prepare')).toBe(false);
      expect((await read()).state).toMatchObject({ running: 1 });
      device.end(device.turns()[0]!.id);
    });

    it("removes an ended run's copy and keeps its branch, refusing while the copy holds changes not committed", async () => {
      device = await connectDevice(COPY_ACTIONS);
      device.answers['worktree.prepare'] = prepared;
      const key = await aTask();
      const run = await addRun({ source: 'task', cardKey: key });
      await tick();
      await until(() => device.turns().length === 1);
      await browser.post(`${base()}/runs/${run.id}/worktree/remove`).expect(409);
      device.end(device.turns()[0]!.id);
      await until(async () => ((await runOf(run.id)).state === 'done' ? true : null));

      device.answers['worktree.remove'] = refuse('worktree_dirty');
      const refused = await browser.post(`${base()}/runs/${run.id}/worktree/remove`).expect(409);
      expect(refused.body.error.code).toBe('hub.queue.worktree_dirty');
      expect((await runOf(run.id)).worktree?.removed).toBe(false);

      device.answers['worktree.remove'] = { branch: `hub/${key.toLowerCase()}` };
      const removed = await browser.post(`${base()}/runs/${run.id}/worktree/remove`).expect(200);
      expect(removed.body.data.worktree).toMatchObject({ removed: true, branch: `hub/${key.toLowerCase()}` });
      expect(device.actions.filter((frame) => frame.action === 'worktree.remove').at(-1)?.args).toEqual({
        folder: worktreeFolderFor(FOLDER, key),
      });
      const again = await browser.post(`${base()}/runs/${run.id}/worktree/remove`).expect(409);
      expect(again.body.error.code).toBe('hub.queue.no_worktree');
    });

    it('an older bridge that cannot make a copy keeps runs on their folder, as before', async () => {
      const run = await addRun({ source: 'prompt', prompt: 'Tidy up' });
      await tick();
      await until(() => device.turns().length === 1);
      expect(device.turns()[0]!.args['folder']).toBe(FOLDER);
      expect(
        device.actions.some(
          (frame) => frame.action === 'worktree.prepare' || frame.action === 'folder.status',
        ),
      ).toBe(false);
      expect((await runOf(run.id)).worktree).toBeNull();
      device.end(device.turns()[0]!.id);
    });
  });
});
