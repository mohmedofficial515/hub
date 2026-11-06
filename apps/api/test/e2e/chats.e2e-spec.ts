/**
 * @file Chats over real credentials, real SSE and a real socket, with a scripted device on the other end: turns, approvals, secrets, catch-up and everything around them.
 * @description The scripted device speaks the bridge's frames, so each rule here is tested without a model. `chats-real-binary.e2e-spec.ts` runs the real `hub-bridge` and the real binary.
 */
import http, { type ClientRequest } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { WebSocket } from 'ws';

import { ChatsService } from '@/modules/chats';
import { BridgeHub } from '@/modules/devices';

import { anAccount, aToken, Browser, join as joinProject, PASSWORD } from '../helpers/auth';
import { aProject } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

const SECRET = `ghp_${'s'.repeat(40)}`;
const SESSION = '22222222-2222-4222-8222-222222222222';
const FOLDER = 'C:/work/repo';

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

/** Stands where `hub-bridge` stands. Holds `turn.start` open until the test ends it. */
class ScriptedDevice {
  readonly actions: ActionFrame[] = [];
  private seq = 0;
  answers: Partial<Record<string, unknown>> = {
    'turn.answer': { accepted: true },
    'turn.stop': { stopped: true },
    'chat.close': { closed: true },
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
    const turns = this.of('turn.start');
    return turns[turns.length - 1]!;
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

describe('chats', () => {
  let app: INestApplication;
  let port: number;
  let hub: BridgeHub;
  let browser: Browser;
  let userId: string;
  let slug: string;
  let workspaceId: string;
  let deviceId: string;
  let credential: string;
  let device: ScriptedDevice;
  const sockets: WebSocket[] = [];
  const streams: ClientRequest[] = [];

  const prisma = () => maintenanceClients().prisma;
  const api = () => request(app.getHttpServer() as Parameters<typeof request>[0]);
  const base = () => `/workspaces/${slug}/chats`;

  beforeAll(async () => {
    ({ app } = await createTestApp({ realAuth: true }));
    await app.listen(0);
    port = (app.getHttpServer() as { address(): AddressInfo }).address().port;
    hub = app.get(BridgeHub, { strict: false });
  });

  async function pair(name = 'Laptop') {
    const started = await api().post('/api/v1/pairing/start').send({ name, platform: 'win32' }).expect(201);
    const { deviceCode, userCode } = started.body.data as { deviceCode: string; userCode: string };
    await browser.post(`/pairing/${userCode}/approve`).expect(204);
    const polled = await api().post('/api/v1/pairing/poll').send({ deviceCode }).expect(200);
    return polled.body.data as { deviceId: string; credential: string };
  }

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
    await prisma().workspace.update({ where: { id: project.id }, data: { repoPaths: [FOLDER] } });
    browser = new Browser(app);
    await browser.post('/auth/sign-in', { email: account.email, password: PASSWORD }).expect(200);
    ({ deviceId, credential } = await pair());
    device = await connectDevice(deviceId, credential);
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.terminate();
    for (const stream of streams.splice(0)) stream.destroy();
    // A turn still being recorded would race the next test's empty database.
    const chats = app.get(ChatsService, { strict: false });
    await until(() => chats.runningCount() === 0);
  });

  interface Frame {
    id?: string;
    event: string;
    data: { chatId?: string; seq?: number; event?: { kind: string } & Record<string, unknown> };
  }

  /** A real SSE connection, as one open browser tab. */
  function aTab(lastEventId?: string): Promise<{ frames: Frame[]; raw: () => string; close(): void }> {
    return new Promise((resolve, reject) => {
      const frames: Frame[] = [];
      let raw = '';
      let buffer = '';
      const stream = http.get(
        {
          port,
          path: `/api/v1/workspaces/${slug}/events/stream`,
          headers: {
            Cookie: browser.cookieHeader('/api/v1/workspaces'),
            accept: 'text/event-stream',
            ...(lastEventId ? { 'last-event-id': lastEventId } : {}),
          },
        },
        (response) => {
          response.setEncoding('utf8');
          if (response.statusCode !== 200) reject(new Error(String(response.statusCode)));
          response.on('data', (chunk: string) => {
            raw += chunk;
            buffer += chunk;
            for (;;) {
              const end = buffer.indexOf('\n\n');
              if (end === -1) break;
              const block = buffer.slice(0, end);
              buffer = buffer.slice(end + 2);
              const event = /^event: (.*)$/m.exec(block)?.[1];
              const data = /^data: (.*)$/m.exec(block)?.[1];
              const id = /^id: (.*)$/m.exec(block)?.[1];
              if (event && data) {
                frames.push({ event, data: JSON.parse(data) as Frame['data'], ...(id ? { id } : {}) });
              }
            }
          });
          // `: connected` is written once the channel is subscribed.
          void until(() => raw.includes(': connected')).then(() =>
            resolve({ frames, raw: () => raw, close: () => stream.destroy() }),
          );
        },
      );
      streams.push(stream);
      stream.on('error', () => undefined);
    });
  }

  describe('send to VS Code (docs/16 §8)', () => {
    const route = () => `${base()}/vscode`;
    const send = (extra: Record<string, unknown> = {}) =>
      browser.post(route(), { device: deviceId, folder: FOLDER, ...extra });
    const sent = () => device.of('vscode.open');

    beforeEach(() => {
      device.answers['vscode.open'] = { sent: true };
    });

    /** The device refuses the way `dispatch` does. */
    const refusedWith = (code: string) => {
      device.answers['vscode.open'] = undefined;
      device.socket.on('message', (data) => {
        const frame = JSON.parse((data as Buffer).toString()) as ActionFrame;
        if (frame.action !== 'vscode.open') return;
        device.socket.send(
          JSON.stringify({ type: 'result', id: frame.id, ok: false, error: { code, message: code } }),
        );
      });
    };

    it('sends the folder and the prompt the server built, and says sent', async () => {
      const created = await browser
        .post(`/workspaces/${slug}/cards`, {
          type: 'task',
          title: 'A task',
          detail: { specialty: 'backend' },
        })
        .expect(201);
      const key = created.body.data.key as string;
      const answer = await send({ cardKey: key }).expect(200);
      const prompt = `Work on ${key} in Hub. Read it with hub get_card first.`;
      expect(answer.body.data).toEqual({ sent: true, prompt });
      expect(sent().map((frame) => frame.args)).toEqual([{ folder: FOLDER, prompt }]);
      const audit = await prisma().auditLog.findFirst({ where: { workspaceId, action: 'chats.vscode' } });
      expect(audit?.summary).toContain('VS Code');
    });

    it('carries the chat’s title when there is no card', async () => {
      const chatId = await aChat({ title: 'Refunds & wallets' });
      const answer = await send({ chatId }).expect(200);
      expect(answer.body.data.prompt).toContain('Refunds & wallets');
    });

    it('with neither, the prompt names the folder', async () => {
      const answer = await send().expect(200);
      expect(answer.body.data.prompt).toContain(FOLDER);
    });

    it('a card that is not in this project asks nothing of the device', async () => {
      const refused = await send({ cardKey: 'NOPE-999' });
      expect(refused.status).toBe(404);
      expect(sent()).toEqual([]);
    });

    it('another member’s chat is not found, so its title cannot be read', async () => {
      const chatId = await aChat({ title: 'Mine' });
      await prisma().chat.update({
        where: { id: chatId },
        data: { userId: (await anAccount(prisma())).id },
      });
      const refused = await send({ chatId }).expect(404);
      expect(refused.body.error.code).toBe('hub.chats.not_found');
      expect(sent()).toEqual([]);
    });

    it('a folder not on the project’s list is the same refusal a new chat gets', async () => {
      const refused = await send({ folder: 'C:/elsewhere' }).expect(422);
      expect(refused.body.error.code).toBe('hub.chats.folder_not_allowed');
      expect(sent()).toEqual([]);
    });

    it('an offline device is refused', async () => {
      device.socket.terminate();
      await until(() => !hub.isOnline(deviceId));
      const refused = await send().expect(409);
      expect(refused.body.error.code).toBe('hub.devices.offline');
    });

    it('someone else’s device is not found', async () => {
      const refused = await send({ device: '33333333-3333-4333-8333-333333333333' }).expect(404);
      expect(refused.body.error.code).toBe('hub.devices.not_found');
    });

    it.each([
      ['vscode_missing', 422, 'hub.devices.vscode_missing'],
      ['folder_missing', 422, 'hub.devices.folder_missing'],
      ['folder_not_allowed', 422, 'hub.chats.folder_not_allowed'],
    ])('the bridge’s %s reaches the browser in its language', async (code, status, wanted) => {
      refusedWith(code);
      const refused = await send().set('Accept-Language', 'ar').expect(status);
      expect(refused.body.error.code).toBe(wanted);
      expect(refused.body.error.message).toMatch(/[\u0600-\u06FF]/);
    });
  });

  async function aChat(extra: Record<string, unknown> = {}): Promise<string> {
    const answer = await browser.post(base(), { device: deviceId, folder: FOLDER, ...extra }).expect(201);
    return answer.body.data.id as string;
  }

  /** A chat with a turn running on the scripted device. */
  async function aTurn(text = 'hello', extra: Record<string, unknown> = {}) {
    const chatId = await aChat();
    const before = device.of('turn.start').length;
    const sent = await browser.post(`${base()}/${chatId}/messages`, { text, ...extra }).expect(202);
    await until(() => device.of('turn.start').length > before);
    return { chatId, messageId: sent.body.data.messageId as string, turn: device.turn() };
  }

  const getChat = async (chatId: string) =>
    (await browser.get(`${base()}/${chatId}`).expect(200)).body.data as {
      lastSeq: number;
      sessionId: string | null;
      running: boolean;
      messages: {
        id: string;
        role: string;
        content: string;
        status: string | null;
        failure: string | null;
        truncated: boolean;
        model: string | null;
        usage: unknown;
        durationMs: number | null;
        plan: string | null;
        stages: { stage: string; state: string }[];
        changedFiles: { path: string }[];
        steps: { toolUseId: string; status: string; input: unknown; output: string | null }[];
        approvals: { id: string; status: string; command: string }[];
      }[];
    };

  const lastMessage = async (chatId: string) => (await getChat(chatId)).messages.at(-1)!;
  const untilEnded = (chatId: string) =>
    until(async () => {
      const message = await lastMessage(chatId);
      return message.status !== 'running' ? message : null;
    });

  const APPROVAL = {
    kind: 'approval.requested',
    approvalId: '33333333-3333-4333-8333-333333333333',
    toolUseId: 't1',
    toolName: 'Bash',
    command: 'git push origin main',
    category: 'push',
    input: { command: 'git push origin main' },
    effect: 'Pushes to a remote',
    expiresAt: '2030-01-01T00:00:00.000Z',
  };

  async function aPausedTurn() {
    const started = await aTurn();
    device.say(started.turn.id, { kind: 'tool.started', toolUseId: 't1', name: 'Bash' });
    device.say(started.turn.id, APPROVAL);
    await until(async () => (await lastMessage(started.chatId)).approvals.length === 1);
    return started;
  }

  describe('starting', () => {
    it('refuses a folder outside the allowlist, and writes nothing', async () => {
      const refused = await browser.post(base(), { device: deviceId, folder: 'C:/elsewhere' }).expect(422);
      expect(refused.body.error.code).toBe('hub.chats.folder_not_allowed');
      expect(await prisma().chat.count()).toBe(0);
    });

    it('a folder taken off the list after the chat started is refused at the next send', async () => {
      const chatId = await aChat();
      await prisma().workspace.update({ where: { id: workspaceId }, data: { repoPaths: [] } });
      const refused = await browser.post(`${base()}/${chatId}/messages`, { text: 'hi' }).expect(422);
      expect(refused.body.error.code).toBe('hub.chats.folder_not_allowed');
      expect(device.of('turn.start')).toEqual([]);
    });

    it('a revoked device is refused, for a new chat and for an old one', async () => {
      const chatId = await aChat();
      await browser.delete(`/me/devices/${deviceId}`).expect(204);
      const fresh = await browser.post(base(), { device: deviceId, folder: FOLDER }).expect(404);
      expect(fresh.body.error.code).toBe('hub.devices.not_found');
      const old = await browser.post(`${base()}/${chatId}/messages`, { text: 'hi' }).expect(404);
      expect(old.body.error.code).toBe('hub.devices.not_found');
    });

    it('an offline device is a clear error', async () => {
      const chatId = await aChat();
      device.socket.terminate();
      await until(() => !hub.isOnline(deviceId));
      const refused = await browser.post(`${base()}/${chatId}/messages`, { text: 'hi' }).expect(409);
      expect(refused.body.error.code).toBe('hub.devices.offline');
    });

    it('someone else’s chat is not found', async () => {
      const chatId = await aChat();
      const other = await anAccount(prisma());
      await joinProject(prisma(), workspaceId, other.id, ['owner']);
      const stranger = new Browser(app);
      await stranger.post('/auth/sign-in', { email: other.email, password: PASSWORD }).expect(200);
      await stranger.get(`${base()}/${chatId}`).expect(404);
    });

    it('a token cannot start a chat, send, stop or answer: session only', async () => {
      const chatId = await aChat();
      const { token } = await aToken(prisma(), userId, 'mcp');
      const asToken = (path: string, body: object) =>
        api().post(`/api/v1${path}`).set('authorization', `Bearer ${token}`).send(body);
      await asToken(base(), { device: deviceId, folder: FOLDER }).expect(403);
      await asToken(`${base()}/${chatId}/messages`, { text: 'hi' }).expect(403);
      await asToken(`${base()}/${chatId}/stop`, {}).expect(403);
      await asToken(`${base()}/${chatId}/approvals/${APPROVAL.approvalId}`, { decision: 'allow' }).expect(
        403,
      );
    });
  });

  describe('a turn', () => {
    it('carries the context as an explicit prefix, and the folder and options to the bridge', async () => {
      const { turn } = await aTurn('explain', {
        mode: 'plan',
        model: 'haiku',
        effort: 'high',
        context: {
          page: 'tasks',
          card: 'DEM-1',
          attachments: [
            { kind: 'doc', key: 'DEM-2' },
            { kind: 'file', path: 'src/a.ts' },
          ],
        },
      });
      expect(turn.args).toMatchObject({ folder: FOLDER, mode: 'plan', model: 'haiku', effort: 'high' });
      const prompt = String(turn.args['prompt']);
      for (const word of [slug, 'tasks', 'DEM-1', 'DEM-2', 'src/a.ts', 'explain']) {
        expect(prompt).toContain(word);
      }
    });

    it('streams in order to every open tab, and stores the same thing', async () => {
      const [one, two] = [await aTab(), await aTab()];
      const { chatId, turn } = await aTurn();
      device.say(turn.id, {
        kind: 'turn.session',
        sessionId: SESSION,
        model: 'claude-haiku',
        claudeVersion: '2.1.318',
        branch: 'main',
      });
      for (const word of ['one ', 'two ', 'three ', 'four ']) {
        device.say(turn.id, { kind: 'text.delta', text: word });
      }
      device.say(turn.id, { kind: 'tool.started', toolUseId: 't1', name: 'Read' });
      device.say(turn.id, { kind: 'tool.input', toolUseId: 't1', name: 'Read', input: { file_path: 'a' } });
      device.say(turn.id, { kind: 'tool.result', toolUseId: 't1', isError: false, output: 'contents' });
      device.say(turn.id, { kind: 'text.delta', text: 'five six seven ' });
      device.say(turn.id, { kind: 'stage', protocol: 'work', stage: 'verify', state: 'started' });
      device.end(turn.id, {
        status: 'done',
        durationMs: 1234,
        usage: { inputTokens: 3, outputTokens: 4 },
        changedFiles: [{ path: 'a.md', source: 'tool', additions: 2, deletions: 0 }],
      });
      const message = await untilEnded(chatId);
      const events = (tab: { frames: Frame[] }) =>
        tab.frames.filter((frame) => frame.event === 'chat.event' && frame.data.chatId === chatId);
      await until(() => events(one).some((frame) => frame.data.event?.kind === 'turn.ended'));
      await until(() => events(two).some((frame) => frame.data.event?.kind === 'turn.ended'));
      const seqs = events(one).map((frame) => frame.data.seq ?? 0);
      expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
      expect(new Set(seqs).size).toBe(seqs.length);
      expect(events(two).map((frame) => frame.data.seq)).toEqual(seqs);
      const text = events(one)
        .filter((frame) => frame.data.event?.kind === 'text.delta')
        .map((frame) => frame.data.event?.['text'])
        .join('');
      expect(text).toBe('one two three four five six seven ');
      expect(message.content).toBe(text);
      expect(message).toMatchObject({
        status: 'done',
        model: 'claude-haiku',
        durationMs: 1234,
        usage: { inputTokens: 3, outputTokens: 4 },
        changedFiles: [{ path: 'a.md', additions: 2 }],
        stages: [{ stage: 'verify', state: 'started' }],
      });
      expect(message.steps[0]).toMatchObject({
        status: 'done',
        output: 'contents',
        input: { file_path: 'a' },
      });
      const chat = await getChat(chatId);
      expect(chat.sessionId).toBe(SESSION);
      expect(chat.lastSeq).toBe(Math.max(...seqs));
    });

    it('a transient event does not move the stream’s cursor: cards still replay', async () => {
      const tab = await aTab();
      const { chatId, turn } = await aTurn();
      device.say(turn.id, { kind: 'turn.status', state: 'requesting' });
      await until(() => tab.frames.some((frame) => frame.data.event?.kind === 'turn.status'));
      const status = tab.frames.find((frame) => frame.data.event?.kind === 'turn.status');
      expect(status?.id).toBeUndefined();
      device.end(turn.id);
      await untilEnded(chatId);
    });

    it('one turn per chat: another send gets a clear error, even at the same moment', async () => {
      const { chatId, turn } = await aTurn();
      const again = await browser.post(`${base()}/${chatId}/messages`, { text: 'again' }).expect(409);
      expect(again.body.error.code).toBe('hub.chats.turn_running');
      device.end(turn.id);
      await untilEnded(chatId);
      const both = await Promise.all([
        browser.post(`${base()}/${chatId}/messages`, { text: 'a' }),
        browser.post(`${base()}/${chatId}/messages`, { text: 'b' }),
      ]);
      expect(both.map((answer) => answer.status).sort()).toEqual([202, 409]);
      await until(() => device.of('turn.start').length === 2);
      device.end(device.turn().id);
    });

    it('the next message resumes the session', async () => {
      const { chatId, turn } = await aTurn();
      device.say(turn.id, { kind: 'turn.session', sessionId: SESSION });
      device.end(turn.id);
      await untilEnded(chatId);
      await browser.post(`${base()}/${chatId}/messages`, { text: 'more' }).expect(202);
      await until(() => device.of('turn.start').length === 2);
      expect(device.turn().args['sessionId']).toBe(SESSION);
      device.end(device.turn().id);
    });

    it('signed out, a limit and a lost session are stored as the panel’s honest states', async () => {
      const signedOut = await aTurn();
      device.say(signedOut.turn.id, { kind: 'turn.session', sessionId: SESSION });
      device.say(signedOut.turn.id, { kind: 'text.delta', text: 'Not logged in · Please run /login' });
      device.end(signedOut.turn.id, { status: 'failed', failure: 'signed_out', message: 'Not logged in' });
      const message = await untilEnded(signedOut.chatId);
      expect(message).toMatchObject({ status: 'failed', failure: 'signed_out' });
      // It never became a conversation, so nothing tries to resume it.
      expect((await getChat(signedOut.chatId)).sessionId).toBeNull();

      const limited = await aTurn();
      device.say(limited.turn.id, { kind: 'limit', limit: { status: 'rejected', resetsAt: 1900000000 } });
      device.end(limited.turn.id, { status: 'failed', failure: 'rate_limited', resetsAt: 1900000000 });
      expect(await untilEnded(limited.chatId)).toMatchObject({
        failure: 'rate_limited',
        limit: { status: 'rejected', resetsAt: 1900000000 },
      });
    });

    it('drops a frame that is not a known event, and stores nothing of it', async () => {
      const { chatId, turn } = await aTurn();
      device.say(turn.id, { kind: 'stream_event', event: { raw: 'internal' } });
      device.end(turn.id);
      await untilEnded(chatId);
      const stored = JSON.stringify(await getChat(chatId));
      expect(stored).not.toContain('internal');
    });

    it('Plan’s proposed plan is stored on the turn', async () => {
      const { chatId, turn } = await aTurn();
      device.say(turn.id, { kind: 'plan.proposed', plan: '1. Do it' });
      device.end(turn.id);
      expect((await untilEnded(chatId)).plan).toBe('1. Do it');
    });

    it('stop asks the bridge, and a chat with nothing running says so', async () => {
      const { chatId, turn } = await aTurn();
      await browser.post(`${base()}/${chatId}/stop`).expect(204);
      expect(device.of('turn.stop')[0]?.args).toEqual({ chatId });
      device.end(turn.id, { status: 'stopped' });
      expect((await untilEnded(chatId)).status).toBe('stopped');
      const refused = await browser.post(`${base()}/${chatId}/stop`).expect(409);
      expect(refused.body.error.code).toBe('hub.chats.not_running');
    });

    it('the device going away marks the turn interrupted, ends its steps and its approval', async () => {
      const { chatId } = await aPausedTurn();
      device.socket.terminate();
      const message = await untilEnded(chatId);
      expect(message).toMatchObject({ status: 'interrupted', failure: 'device_offline' });
      expect(message.steps[0]?.status).toBe('cut_off');
      expect(message.approvals[0]?.status).toBe('stopped');
    });

    it('a restart marks what was running as cut off', async () => {
      const { chatId } = await aPausedTurn();
      await app.get(ChatsService, { strict: false }).onApplicationBootstrap();
      const message = await lastMessage(chatId);
      expect(message).toMatchObject({ status: 'interrupted', failure: 'cut_off' });
      expect(message.approvals[0]?.status).toBe('stopped');
    });
  });

  describe('approvals', () => {
    it('reach every open tab, with the exact command', async () => {
      const [one, two] = [await aTab(), await aTab()];
      await aPausedTurn();
      for (const tab of [one, two]) {
        const frame = await until(() =>
          tab.frames.find((item) => item.data.event?.kind === 'approval.requested'),
        );
        expect(frame.data.event).toMatchObject({ command: 'git push origin main', category: 'push' });
      }
    });

    it('Allow reaches the bridge, and is audited with the command, the answer and the device', async () => {
      const { chatId } = await aPausedTurn();
      await browser
        .post(`${base()}/${chatId}/approvals/${APPROVAL.approvalId}`, { decision: 'allow' })
        .expect(204);
      expect(device.of('turn.answer')[0]?.args).toEqual({
        chatId,
        approvalId: APPROVAL.approvalId,
        decision: 'allow',
      });
      const row = await prisma().auditLog.findFirstOrThrow({
        where: { action: 'chats.approval.allow', targetId: APPROVAL.approvalId },
      });
      expect(row.summary).toContain('git push origin main');
      expect(row.summary).toContain('allow');
      expect(row.summary).toContain('Laptop');
      expect(row.actorId).toBe(userId);
    });

    it('Deny reaches the bridge too', async () => {
      const { chatId } = await aPausedTurn();
      await browser
        .post(`${base()}/${chatId}/approvals/${APPROVAL.approvalId}`, { decision: 'deny' })
        .expect(204);
      expect(device.of('turn.answer')[0]?.args['decision']).toBe('deny');
      expect((await lastMessage(chatId)).approvals[0]?.status).toBe('denied');
    });

    it('the first answer wins, across two tabs answering at the same moment', async () => {
      const [one, two] = [await aTab(), await aTab()];
      const { chatId } = await aPausedTurn();
      await until(() => one.frames.some((frame) => frame.data.event?.kind === 'approval.requested'));
      await until(() => two.frames.some((frame) => frame.data.event?.kind === 'approval.requested'));
      const path = `${base()}/${chatId}/approvals/${APPROVAL.approvalId}`;
      const answers = await Promise.all([
        browser.post(path, { decision: 'allow' }),
        browser.post(path, { decision: 'deny' }),
      ]);
      expect(answers.map((answer) => answer.status).sort()).toEqual([204, 409]);
      const late = answers.find((answer) => answer.status === 409);
      expect(late?.body.error.code).toBe('hub.chats.approval_answered');
      expect(device.of('turn.answer')).toHaveLength(1);
      expect(
        await prisma().auditLog.count({
          where: { action: { startsWith: 'chats.approval' }, targetId: APPROVAL.approvalId },
        }),
      ).toBe(1);
    });

    it('a timeout from the bridge closes it as denied, is audited, and a late answer is refused', async () => {
      const { chatId, turn } = await aPausedTurn();
      device.say(turn.id, {
        kind: 'approval.resolved',
        approvalId: APPROVAL.approvalId,
        status: 'timed_out',
      });
      await until(async () => (await lastMessage(chatId)).approvals[0]?.status === 'timed_out');
      const late = await browser
        .post(`${base()}/${chatId}/approvals/${APPROVAL.approvalId}`, { decision: 'allow' })
        .expect(409);
      expect(late.body.error.code).toBe('hub.chats.approval_answered');
      expect(device.of('turn.answer')).toEqual([]);
      const row = await prisma().auditLog.findFirst({ where: { action: 'chats.approval.timed_out' } });
      expect(row?.summary).toContain('git push origin main');
    });

    it('if the bridge ended it first, the answer says so and the record stays honest', async () => {
      const { chatId } = await aPausedTurn();
      device.answers['turn.answer'] = { accepted: false };
      const answer = await browser
        .post(`${base()}/${chatId}/approvals/${APPROVAL.approvalId}`, { decision: 'allow' })
        .expect(409);
      expect(answer.body.error.code).toBe('hub.chats.approval_expired');
      expect((await lastMessage(chatId)).approvals[0]?.status).toBe('timed_out');
    });

    it('an approval that does not exist, or is not this chat’s, is not found', async () => {
      const { chatId } = await aPausedTurn();
      const other = await aChat();
      await browser
        .post(`${base()}/${other}/approvals/${APPROVAL.approvalId}`, { decision: 'allow' })
        .expect(404);
      await browser.post(`${base()}/${chatId}/approvals/not-a-uuid`, { decision: 'allow' }).expect(404);
      expect(device.of('turn.answer')).toEqual([]);
    });
  });

  describe('the secret filter', () => {
    it('refuses a secret in what the owner sends, and starts nothing', async () => {
      const chatId = await aChat();
      const refused = await browser
        .post(`${base()}/${chatId}/messages`, { text: `use ${SECRET}` })
        .expect(422);
      expect(refused.body.error.code).toBe('hub.security.secret_detected');
      expect(JSON.stringify(refused.body)).not.toContain(SECRET);
      expect(device.of('turn.start')).toEqual([]);
    });

    it('nothing stored or sent holds a secret: text split across pieces, tool input, output, a command', async () => {
      const tab = await aTab();
      const { chatId, turn } = await aTurn();
      device.say(turn.id, { kind: 'text.delta', text: 'see ' });
      device.say(turn.id, { kind: 'text.delta', text: SECRET.slice(0, 20) });
      device.say(turn.id, { kind: 'text.delta', text: `${SECRET.slice(20)} after that word` });
      device.say(turn.id, { kind: 'tool.started', toolUseId: 't1', name: 'Bash' });
      device.say(turn.id, {
        kind: 'tool.input',
        toolUseId: 't1',
        name: 'Bash',
        input: { command: `curl -H ${SECRET}` },
      });
      device.say(turn.id, {
        ...APPROVAL,
        command: `curl -H ${SECRET}`,
        input: { command: `curl -H ${SECRET}` },
      });
      device.say(turn.id, {
        kind: 'tool.result',
        toolUseId: 't1',
        isError: false,
        output: `Authorization: ${SECRET}`,
      });
      device.say(turn.id, { kind: 'plan.proposed', plan: `plan ${SECRET}` });
      device.say(turn.id, { kind: 'stage', protocol: 'work', stage: 'report', state: 'done', note: SECRET });
      device.end(turn.id, { status: 'failed', failure: 'unknown', message: `broke ${SECRET}` });
      const message = await untilEnded(chatId);
      await until(() => tab.raw().includes('turn.ended'));
      expect(message.content).toContain('see ');
      expect(message.content).toContain('after that word');
      const everything = JSON.stringify({
        api: await getChat(chatId),
        messages: await prisma().chatMessage.findMany(),
        steps: await prisma().chatStep.findMany(),
        approvals: await prisma().chatApproval.findMany(),
        audit: (await prisma().auditLog.findMany()).map((row) => row.summary),
        stream: tab.raw(),
      });
      expect(everything).not.toContain(SECRET);
      expect(everything).not.toContain(SECRET.slice(0, 20));
      expect(everything).toContain('secret removed by Hub');
    });

    it('caps what one message can store, with a clear marker', async () => {
      const { chatId, turn } = await aTurn();
      device.say(turn.id, { kind: 'tool.started', toolUseId: 't1', name: 'Read' });
      device.say(turn.id, {
        kind: 'tool.result',
        toolUseId: 't1',
        isError: false,
        output: 'o '.repeat(40_000),
      });
      for (let index = 0; index < 11; index += 1) {
        device.say(turn.id, { kind: 'text.delta', text: 'w '.repeat(10_000) });
      }
      device.end(turn.id);
      const message = await untilEnded(chatId);
      expect(message.content.length).toBeLessThan(200_100);
      expect(message.truncated).toBe(true);
      expect(message.content).toContain('truncated by Hub');
      expect(message.steps[0]?.output?.length).toBeLessThan(40_100);
      expect(message.steps[0]?.output).toContain('truncated by Hub');
    }, 60_000);
  });

  describe('catching up', () => {
    it('a device away during the turn reads all it missed, and the waiting approval, then continues', async () => {
      const first = await aTab();
      const { chatId, turn } = await aTurn();
      device.say(turn.id, { kind: 'text.delta', text: 'said while connected and more words here ' });
      await until(() => first.frames.some((frame) => frame.data.event?.kind === 'text.delta'));
      const cursor = first.frames.filter((frame) => frame.id).at(-1)?.id;
      first.close();

      device.say(turn.id, { kind: 'text.delta', text: 'said while away and more words ' });
      device.say(turn.id, { kind: 'tool.started', toolUseId: 't1', name: 'Bash' });
      device.say(turn.id, APPROVAL);
      await until(async () => (await lastMessage(chatId)).approvals.length === 1);

      const again = await aTab(cursor);
      const nudge = await until(() =>
        again.frames.find((frame) => frame.event === 'chat.changed' && frame.data.chatId === chatId),
      );
      expect(nudge.data).toMatchObject({ chatId });
      const snapshot = await getChat(chatId);
      const message = snapshot.messages.at(-1)!;
      expect(message.content).toContain('said while connected');
      expect(message.content).toContain('said while away');
      expect(message.approvals[0]).toMatchObject({ status: 'pending', command: 'git push origin main' });
      expect(snapshot.running).toBe(true);

      device.say(turn.id, { kind: 'text.delta', text: 'after the return and more words here ' });
      const next = await until(() => again.frames.find((frame) => frame.event === 'chat.event'));
      expect(next.data.seq).toBeGreaterThan(snapshot.lastSeq);
      device.end(turn.id);
      await untilEnded(chatId);
    });
  });

  describe('flexibility', () => {
    it('retry sends the same words again as a new turn', async () => {
      const { chatId, turn } = await aTurn('do the thing');
      device.end(turn.id, { status: 'failed', failure: 'unknown' });
      await untilEnded(chatId);
      await browser.post(`${base()}/${chatId}/retry`, {}).expect(202);
      await until(() => device.of('turn.start').length === 2);
      expect(String(device.turn().args['prompt'])).toContain('do the thing');
      device.end(device.turn().id);
      const chat = await getChat(chatId);
      expect(chat.messages.filter((message) => message.role === 'user')).toHaveLength(2);
    });

    it('branch makes a new chat with the words so far, and its first turn is told them', async () => {
      const { chatId, turn } = await aTurn('first question');
      device.say(turn.id, { kind: 'turn.session', sessionId: SESSION });
      device.say(turn.id, { kind: 'text.delta', text: 'first answer here now ok ' });
      device.end(turn.id);
      const answered = await untilEnded(chatId);
      const made = await browser.post(`${base()}/${chatId}/branch`, { message: answered.id }).expect(201);
      const branched = made.body.data as { id: string; parentChatId: string; sessionId: string | null };
      expect(branched).toMatchObject({ parentChatId: chatId, parentMessageId: answered.id, sessionId: null });
      const copy = await getChat(branched.id);
      expect(copy.messages.map((message) => message.content)).toEqual([
        'first question',
        'first answer here now ok ',
      ]);
      await browser.post(`${base()}/${branched.id}/messages`, { text: 'second question' }).expect(202);
      await until(() => device.of('turn.start').length === 2);
      const prompt = String(device.turn().args['prompt']);
      expect(prompt).toContain('first answer here');
      expect(prompt).toContain('second question');
      expect(device.turn().args['sessionId']).toBeUndefined();
      device.end(device.turn().id);
      await untilEnded(branched.id);
    });

    it('pin sorts first, delete hides and refuses sends, restore brings it back: nothing is hard deleted', async () => {
      const older = await aChat({ title: 'older' });
      const newer = await aChat({ title: 'newer' });
      await browser.patch(`${base()}/${older}`, { pinned: true }).expect(200);
      const listed = await browser.get(base()).expect(200);
      expect((listed.body.data as { id: string }[])[0]?.id).toBe(older);

      await browser.delete(`${base()}/${newer}`).expect(204);
      const shown = await browser.get(base()).expect(200);
      expect((shown.body.data as { id: string }[]).map((chat) => chat.id)).toEqual([older]);
      const deleted = await browser.get(`${base()}?deleted=true`).expect(200);
      expect((deleted.body.data as { id: string }[]).map((chat) => chat.id)).toEqual([newer]);
      await browser.post(`${base()}/${newer}/messages`, { text: 'hi' }).expect(404);
      expect(await prisma().chat.count()).toBe(2);

      await browser.post(`${base()}/${newer}/restore`).expect(200);
      expect((await browser.get(base()).expect(200)).body.data).toHaveLength(2);
      expect(
        await prisma().auditLog.count({ where: { action: { in: ['chats.delete', 'chats.restore'] } } }),
      ).toBe(2);
    });

    it('delete stops a running turn first', async () => {
      const { chatId, turn } = await aTurn();
      await browser.delete(`${base()}/${chatId}`).expect(204);
      expect(device.of('turn.stop')).toHaveLength(1);
      expect(device.of('chat.close')).toHaveLength(1);
      device.end(turn.id, { status: 'stopped' });
    });

    it('exports Markdown from what is stored, leaving out what the engine did not report', async () => {
      const { chatId, turn } = await aTurn('my question');
      device.say(turn.id, { kind: 'text.delta', text: 'my answer is this one ' });
      device.say(turn.id, { kind: 'tool.started', toolUseId: 't1', name: 'Read' });
      device.end(turn.id, { changedFiles: [{ path: 'a.md', source: 'tool' }], status: 'done' });
      await untilEnded(chatId);
      const answer = await browser.get(`${base()}/${chatId}/export`).expect(200);
      const { markdown, fileName } = answer.body.data as { markdown: string; fileName: string };
      expect(fileName).toMatch(/\.md$/);
      for (const word of ['my question', 'my answer', 'Read', 'a.md', FOLDER, 'Laptop']) {
        expect(markdown).toContain(word);
      }
      expect(markdown).not.toContain('Branch:');
      expect(markdown).not.toContain('+0');
    });

    it('a diff comes through the bridge, read only, with the filter applied', async () => {
      const chatId = await aChat();
      device.answers['chat.diff'] = {
        path: 'a.md',
        diff: `+${SECRET}\n+fine`,
        truncated: false,
        available: true,
      };
      const answer = await browser.get(`${base()}/${chatId}/diff?path=a.md`).expect(200);
      expect(answer.body.data.diff).toContain('+fine');
      expect(JSON.stringify(answer.body)).not.toContain(SECRET);
      expect(device.of('chat.diff')[0]?.args).toEqual({ folder: FOLDER, path: 'a.md' });
    });

    it('the engine’s state comes from the device', async () => {
      device.answers['engine.status'] = {
        found: true,
        version: '2.1.318',
        inRange: true,
        testedRange: { min: '2.1.318', max: '2.1.318' },
        message: null,
        signedIn: false,
        effortSupported: true,
        modelSupported: true,
        canRun: true,
        warning: null,
        checkedAt: '2026-11-06T10:00:00.000Z',
        live: 0,
      };
      const answer = await browser.get(`${base()}/engine?device=${deviceId}`).expect(200);
      expect(answer.body.data).toMatchObject({ signedIn: false, inRange: true });
    });

    it('prompt templates are per project, refuse a secret, and delete softly', async () => {
      const path = `/workspaces/${slug}/prompt-templates`;
      const made = await browser.post(path, { title: 'Review', body: 'Review this' }).expect(201);
      const id = made.body.data.id as string;
      await browser.put(`${path}/${id}`, { title: 'Review', body: 'Review it' }).expect(200);
      const refused = await browser.post(path, { title: 'Bad', body: SECRET }).expect(422);
      expect(refused.body.error.code).toBe('hub.security.secret_detected');
      expect((await browser.get(path).expect(200)).body.data[0]).toMatchObject({ body: 'Review it' });
      await browser.delete(`${path}/${id}`).expect(204);
      expect((await browser.get(path).expect(200)).body.data).toEqual([]);
      expect(await prisma().chatPromptTemplate.count()).toBe(1);
    });
  });

  describe('MCP', () => {
    async function aClient(): Promise<Client> {
      const { token } = await aToken(prisma(), userId, 'mcp');
      const client = new Client({ name: 'test', version: '0' });
      await client.connect(
        new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
          requestInit: { headers: { Authorization: `Bearer ${token}`, 'X-Hub-Project': slug } },
        }),
      );
      return client;
    }
    const textOf = (answer: unknown) =>
      (answer as { content: { text: string }[] }).content.map((part) => part.text).join('\n');

    it('offers reading and tidying, and nothing that starts a chat or answers an approval', async () => {
      const client = await aClient();
      const names = (await client.listTools()).tools.map((tool) => tool.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'list_chats',
          'get_chat',
          'export_chat',
          'update_chat',
          'delete_chat',
          'restore_chat',
          'report_stage',
          'save_prompt_template',
        ]),
      );
      expect(
        names.filter((name) => /^(start|send|create|retry|stop|answer|approve)_?.*chat/.test(name)),
      ).toEqual([]);
      expect(names.filter((name) => /approval/.test(name))).toEqual([]);
      await client.close();
    });

    it('the same services answer it', async () => {
      const chatId = await aChat({ title: 'Over MCP' });
      const client = await aClient();
      expect(textOf(await client.callTool({ name: 'list_chats', arguments: {} }))).toContain('Over MCP');
      await client.callTool({ name: 'update_chat', arguments: { chat: chatId, pinned: true } });
      expect((await getChat(chatId)) as unknown as { pinned: boolean }).toMatchObject({ pinned: true });
      await client.callTool({ name: 'delete_chat', arguments: { chat: chatId } });
      await client.callTool({ name: 'restore_chat', arguments: { chat: chatId } });
      expect(textOf(await client.callTool({ name: 'get_chat', arguments: { chat: chatId } }))).toContain(
        'Over MCP',
      );
      await client.close();
    });

    it('update_chat cannot widen a chat: its mode is the owner’s', async () => {
      const chatId = await aChat({ mode: 'ask' });
      const client = await aClient();
      await client.callTool({
        name: 'update_chat',
        arguments: { chat: chatId, mode: 'execute', title: 'Renamed' },
      });
      expect((await getChat(chatId)) as unknown as { mode: string; title: string }).toMatchObject({
        mode: 'ask',
        title: 'Renamed',
      });
      await client.close();
    });

    it('the engine’s skills and servers land on the turn, and a turn with none stays null', async () => {
      const { chatId, turn } = await aTurn();
      device.say(turn.id, {
        kind: 'turn.session',
        sessionId: SESSION,
        skills: ['hub:work'],
        mcpServers: ['hub', SECRET],
      });
      device.end(turn.id);
      const facts = await until(async () => {
        const chat = (await getChat(chatId)) as unknown as {
          messages: { engineFacts: { skills: string[]; mcpServers: string[] } | null }[];
        };
        return chat.messages.at(-1)?.engineFacts;
      });
      expect(facts.skills).toEqual(['hub:work']);
      expect(facts.mcpServers[0]).toBe('hub');
      expect(JSON.stringify(facts)).not.toContain(SECRET);
      await until(async () => !(await getChat(chatId)).running);

      const second = await browser.post(`${base()}/${chatId}/messages`, { text: 'again' }).expect(202);
      const id = second.body.data.messageId as string;
      await until(() => device.of('turn.start').length > 1);
      device.say(device.turn().id, { kind: 'turn.session', sessionId: SESSION });
      device.end(device.turn().id);
      const row = await until(async () => {
        const stored = await prisma().chatMessage.findFirst({ where: { workspaceId, id } });
        return stored?.status === 'done' ? stored : null;
      });
      expect(row.engineFacts).toBeNull();
    });

    it('a token cannot send to VS Code: the route is web only', async () => {
      const { token } = await aToken(prisma(), userId, 'mcp');
      await api()
        .post(`/api/v1${base()}/vscode`)
        .set('Authorization', `Bearer ${token}`)
        .send({ device: deviceId, folder: FOLDER })
        .expect(403);
      expect(device.of('vscode.open')).toEqual([]);
    });

    it('report_stage refuses a stage of another protocol', async () => {
      const client = await aClient();
      const fine = await client.callTool({
        name: 'report_stage',
        arguments: { protocol: 'work', stage: 'verify', state: 'started' },
      });
      expect(textOf(fine)).toContain('verify');
      const wrong = (await client.callTool({
        name: 'report_stage',
        arguments: { protocol: 'doc', stage: 'verify', state: 'started' },
      })) as { isError?: boolean };
      expect(wrong.isError).toBe(true);
      await client.close();
    });
  });
});
