/**
 * @file Devices over real credentials and a real socket: pairing by browser approval, what a device credential may reach, MCP through it, revoke cutting a live bridge, and a real
 * `hub-bridge` process refusing a folder outside its allowlist. The bridge runs in a temp home with `claude` absent from its view, so nothing of the owner's is touched.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { WebSocket } from 'ws';

import { BridgeHub, PairingService } from '@/modules/devices';

import { anAccount, aToken, Browser, join as joinProject, PASSWORD } from '../helpers/auth';
import { aProject } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

const BRIDGE_BIN = resolve(__dirname, '../../../../packages/bridge/bin/hub-bridge.mjs');
const REVOKED = 4401;

interface Claimed {
  deviceId: string;
  credential: string;
  hookToken: string;
}

async function until(check: () => boolean | Promise<boolean>, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error('Timed out waiting');
}

describe('devices', () => {
  let app: INestApplication;
  let port: number;
  let hub: BridgeHub;
  let userId: string;
  let browser: Browser;
  let slug: string;
  const children: ChildProcess[] = [];
  const homes: string[] = [];
  const sockets: WebSocket[] = [];

  const prisma = () => maintenanceClients().prisma;
  const api = () => request(app.getHttpServer() as Parameters<typeof request>[0]);

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
    await joinProject(prisma(), project.id, userId, ['owner']);
    browser = new Browser(app);
    await browser.post('/auth/sign-in', { email: account.email, password: PASSWORD }).expect(200);
  });

  afterEach(() => {
    for (const child of children.splice(0)) child.kill();
    for (const socket of sockets.splice(0)) socket.terminate();
    for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
  });

  async function pair(name = 'Laptop'): Promise<Claimed> {
    const started = await api().post('/api/v1/pairing/start').send({ name, platform: 'win32' }).expect(201);
    const { deviceCode, userCode } = started.body.data as { deviceCode: string; userCode: string };
    await browser.post(`/pairing/${userCode}/approve`).expect(204);
    const polled = await api().post('/api/v1/pairing/poll').send({ deviceCode }).expect(200);
    return polled.body.data as Claimed;
  }

  function aSocket(credential: string | null): Promise<{ socket: WebSocket; closed: Promise<number> }> {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/bridge`, {
      headers: credential ? { authorization: `Bearer ${credential}` } : {},
    });
    sockets.push(socket);
    const closed = new Promise<number>((done) => socket.on('close', (code) => done(code)));
    return new Promise((done, fail) => {
      socket.once('open', () => done({ socket, closed }));
      socket.once('error', fail);
    });
  }

  /** A real bridge process in a temp home, with no way to find a real Claude Code. */
  function aBridge(deviceId: string, credential: string): string {
    const home = mkdtempSync(join(tmpdir(), 'hub-e2e-bridge-'));
    homes.push(home);
    mkdirSync(join(home, '.hub'), { recursive: true });
    writeFileSync(
      join(home, '.hub', 'device.json'),
      JSON.stringify({ url: `http://127.0.0.1:${port}`, deviceId, credential }),
    );
    const child = spawn(process.execPath, [BRIDGE_BIN, 'run'], {
      env: {
        PATH: '',
        SystemRoot: process.env['SystemRoot'],
        HOME: home,
        USERPROFILE: home,
        CLAUDE_CONFIG_DIR: join(home, 'claude'),
        HUB_BRIDGE_SKIP_LOGIN_START: '1',
      },
      stdio: 'ignore',
    });
    children.push(child);
    return home;
  }

  describe('pairing', () => {
    it('shows a short code, and a credential appears only after approval, and only once', async () => {
      const started = await api()
        .post('/api/v1/pairing/start')
        .send({ name: 'Laptop', platform: 'win32' })
        .expect(201);
      const { deviceCode, userCode, approveUrl } = started.body.data as Record<string, string>;
      expect(userCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(approveUrl).toContain(`/connect?code=${userCode}`);

      const pending = await api().post('/api/v1/pairing/poll').send({ deviceCode }).expect(200);
      expect(pending.body.data).toEqual({ status: 'pending' });

      const view = await browser.get(`/pairing/${userCode}`).expect(200);
      expect(view.body.data).toMatchObject({ name: 'Laptop', platform: 'win32', status: 'pending' });
      expect(JSON.stringify(view.body)).not.toContain(deviceCode);

      await browser.post(`/pairing/${userCode}/approve`).expect(204);
      const claimed = await api().post('/api/v1/pairing/poll').send({ deviceCode }).expect(200);
      expect(claimed.body.data.status).toBe('claimed');
      expect(claimed.body.data.credential).toMatch(/^hub_/);
      expect(claimed.body.data.hookToken).toMatch(/^hub_/);

      const again = await api().post('/api/v1/pairing/poll').send({ deviceCode }).expect(200);
      expect(again.body.data).toEqual({ status: 'claimed' });
    });

    it('stores only hashes', async () => {
      const started = await api()
        .post('/api/v1/pairing/start')
        .send({ name: 'Laptop', platform: 'win32' })
        .expect(201);
      const { deviceCode, userCode } = started.body.data as Record<string, string>;
      const row = await prisma().devicePairing.findUniqueOrThrow({ where: { userCode: userCode! } });
      expect(row.deviceCodeHash).not.toContain(deviceCode);
      await browser.post(`/pairing/${userCode}/approve`).expect(204);
      const polled = await api().post('/api/v1/pairing/poll').send({ deviceCode }).expect(200);
      const tokens = await prisma().apiToken.findMany({ where: { deviceId: polled.body.data.deviceId } });
      expect(tokens.map((token) => token.kind).sort()).toEqual(['device', 'hook']);
      expect(JSON.stringify(tokens)).not.toContain(polled.body.data.credential);
    });

    it('a refusal gives the device nothing', async () => {
      const started = await api()
        .post('/api/v1/pairing/start')
        .send({ name: 'Stranger', platform: 'linux' })
        .expect(201);
      const { deviceCode, userCode } = started.body.data as Record<string, string>;
      await browser.post(`/pairing/${userCode}/deny`).expect(204);
      const polled = await api().post('/api/v1/pairing/poll').send({ deviceCode }).expect(200);
      expect(polled.body.data).toEqual({ status: 'denied' });
      await browser.post(`/pairing/${userCode}/approve`).expect(409);
    });

    it('only a signed-in session can approve: no token, no device credential, no stranger', async () => {
      const { credential } = await pair();
      const started = await api()
        .post('/api/v1/pairing/start')
        .send({ name: 'Other', platform: 'win32' })
        .expect(201);
      const { userCode } = started.body.data as Record<string, string>;
      await api().post(`/api/v1/pairing/${userCode}/approve`).expect(401);
      await api()
        .post(`/api/v1/pairing/${userCode}/approve`)
        .set('authorization', `Bearer ${credential}`)
        .expect(403);
    });

    it('audits the approval and the pairing, with no secret in the rows', async () => {
      const { deviceId, credential, hookToken } = await pair();
      const rows = await prisma().auditLog.findMany({ where: { actorId: userId } });
      const actions = rows.map((row) => row.action);
      expect(actions).toEqual(expect.arrayContaining(['devices.pairing.approve', 'devices.pair']));
      expect(rows.find((row) => row.action === 'devices.pair')?.targetId).toBe(deviceId);
      const text = JSON.stringify(rows.map((row) => [row.action, row.summary, row.targetId]));
      expect(text).not.toContain(credential);
      expect(text).not.toContain(hookToken);
    });
  });

  describe('what a device credential reaches', () => {
    it('MCP and its own uninstall, and nothing else', async () => {
      const { credential } = await pair();
      const initialize = await api()
        .post('/mcp')
        .set('authorization', `Bearer ${credential}`)
        .set('accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'test', version: '0' },
          },
        });
      expect(initialize.status).toBe(200);
      for (const path of [
        '/api/v1/me/tokens',
        '/api/v1/me/devices',
        '/api/v1/workspaces',
        `/api/v1/workspaces/${slug}/cards`,
      ]) {
        const answer = await api().get(path).set('authorization', `Bearer ${credential}`);
        expect(answer.status).toBe(403);
        expect(answer.body.error.code).toBe('hub.identity.token_scope');
      }
    });

    it('the hook token reaches the hooks, and not MCP or the socket', async () => {
      const { hookToken } = await pair();
      await api().get('/api/v1/me/context').set('authorization', `Bearer ${hookToken}`).expect(200);
      await api().post('/mcp').set('authorization', `Bearer ${hookToken}`).send({}).expect(403);
      const { closed } = await aSocket(hookToken);
      expect(await closed).toBe(REVOKED);
    });

    it('pairing’s tokens stay out of Settings › Tokens', async () => {
      await pair();
      const tokens = await browser.get('/me/tokens').expect(200);
      expect(tokens.body.data).toEqual([]);
    });
  });

  describe('the socket', () => {
    it('refuses no credential, a wrong one and anything from a browser', async () => {
      const none = await aSocket(null);
      expect(await none.closed).toBe(REVOKED);
      const wrong = await aSocket(`hub_abcd1234_${'0'.repeat(80)}`);
      expect(await wrong.closed).toBe(REVOKED);
      const { credential } = await pair();
      const fromBrowser = new WebSocket(`ws://127.0.0.1:${port}/bridge`, {
        headers: { authorization: `Bearer ${credential}`, origin: 'http://evil.test' },
      });
      sockets.push(fromBrowser);
      await new Promise<void>((done) => fromBrowser.once('error', () => done()));
    });

    it('a hello makes the device online with its report, and a heartbeat keeps its time', async () => {
      const { deviceId, credential } = await pair();
      const { socket } = await aSocket(credential);
      const frames: Record<string, unknown>[] = [];
      socket.on('message', (data) =>
        frames.push(JSON.parse((data as Buffer).toString()) as Record<string, unknown>),
      );
      socket.send(
        JSON.stringify({
          type: 'hello',
          protocol: 1,
          status: { bridgeVersion: '0.1.0', claudeVersion: '2.1.318', vscodeFound: true },
          actions: ['turn.start'],
        }),
      );
      await until(() => frames.some((frame) => frame['type'] === 'welcome'));
      expect(hub.isOnline(deviceId)).toBe(true);
      const list = await browser.get('/me/devices').expect(200);
      expect(list.body.data[0]).toMatchObject({
        id: deviceId,
        online: true,
        claudeVersion: '2.1.318',
        bridgeVersion: '0.1.0',
      });
      expect(JSON.stringify(list.body)).not.toContain(credential);
      socket.close();
      await until(() => !hub.isOnline(deviceId));
    });

    it('an unsupported protocol is told so', async () => {
      const { credential } = await pair();
      const { socket, closed } = await aSocket(credential);
      socket.send(JSON.stringify({ type: 'hello', protocol: 999, status: {}, actions: [] }));
      expect(await closed).toBe(4426);
    });

    it('a bad frame is dropped, and the socket stays', async () => {
      const { deviceId, credential } = await pair();
      const { socket } = await aSocket(credential);
      socket.send('not json');
      socket.send(JSON.stringify({ type: 'nonsense' }));
      socket.send(JSON.stringify({ type: 'hello', protocol: 1, status: {}, actions: [] }));
      await until(() => hub.isOnline(deviceId));
    });

    it('a stream reaches `onEvent` in order, before its one result: what Slice 3 builds on', async () => {
      const { deviceId, credential } = await pair();
      const { socket } = await aSocket(credential);
      socket.on('message', (data) => {
        const frame = JSON.parse((data as Buffer).toString()) as { type: string; id: string };
        if (frame.type !== 'action') return;
        socket.send(JSON.stringify({ type: 'event', id: frame.id, seq: 0, kind: 'delta', data: 'a' }));
        socket.send(JSON.stringify({ type: 'event', id: frame.id, seq: 1, kind: 'delta', data: 'b' }));
        socket.send(JSON.stringify({ type: 'result', id: frame.id, ok: true, data: { done: true } }));
      });
      socket.send(JSON.stringify({ type: 'hello', protocol: 1, status: {}, actions: [] }));
      await until(() => hub.isOnline(deviceId));
      const seen: unknown[] = [];
      const result = await hub.request(
        deviceId,
        'turn.start',
        {},
        {
          timeoutMs: null,
          onEvent: (event) => seen.push(event.data),
        },
      );
      expect(result).toEqual({ done: true });
      expect(seen).toEqual(['a', 'b']);
    });

    it('a request to a device that goes away ends, and does not hang', async () => {
      const { deviceId, credential } = await pair();
      const { socket } = await aSocket(credential);
      socket.send(JSON.stringify({ type: 'hello', protocol: 1, status: {}, actions: [] }));
      await until(() => hub.isOnline(deviceId));
      const asked = hub.request(deviceId, 'turn.start', {}, { timeoutMs: null });
      socket.terminate();
      await expect(asked).rejects.toMatchObject({ code: 'hub.devices.offline' });
    });
  });

  describe('a real bridge process', () => {
    it('goes online, refuses a folder outside its allowlist, and revoke cuts it live', async () => {
      const { deviceId, credential } = await pair();
      const home = aBridge(deviceId, credential);
      const allowed = join(home, 'allowed');
      const outside = join(home, 'outside');
      mkdirSync(allowed);
      mkdirSync(outside);
      await until(() => hub.isOnline(deviceId));

      await prisma().workspace.update({ where: { slug }, data: { repoPaths: [allowed] } });
      await expect(hub.request(deviceId, 'turn.start', { folder: outside })).rejects.toMatchObject({
        code: 'hub.devices.refused',
        details: expect.objectContaining({ reason: 'folder_not_allowed' }) as unknown,
      });
      await expect(hub.request(deviceId, 'vscode.open', { folder: allowed })).rejects.toMatchObject({
        details: expect.objectContaining({ reason: 'not_implemented' }) as unknown,
      });
      await expect(hub.request(deviceId, 'vscode.open', { folder: outside })).rejects.toMatchObject({
        details: expect.objectContaining({ reason: 'folder_not_allowed' }) as unknown,
      });

      // An action outside the closed list never gets past the bridge either.
      await expect(
        hub.request(deviceId, 'shell.exec' as 'turn.start', { command: 'whoami' }),
      ).rejects.toMatchObject({ details: expect.objectContaining({ reason: 'unknown_action' }) as unknown });

      const child = children[0]!;
      const exited = new Promise<number | null>((done) => child.once('exit', done));
      await browser.delete(`/me/devices/${deviceId}`).expect(204);
      expect(hub.isOnline(deviceId)).toBe(false);
      expect(await exited).toBe(0);

      await expect(hub.request(deviceId, 'turn.start', { folder: allowed })).rejects.toMatchObject({
        code: 'hub.devices.offline',
      });
      await api().post('/mcp').set('authorization', `Bearer ${credential}`).send({}).expect(401);
      const again = await aSocket(credential);
      expect(await again.closed).toBe(REVOKED);
      const list = await browser.get('/me/devices').expect(200);
      expect(list.body.data).toEqual([]);
      const audit = await prisma().auditLog.findFirst({
        where: { action: 'devices.revoke', targetId: deviceId },
      });
      expect(audit).not.toBeNull();
    });

    it('the Link button: registers the folder, and takes it off if the device does not have it', async () => {
      const { deviceId, credential } = await pair();
      const home = aBridge(deviceId, credential);
      await until(() => hub.isOnline(deviceId));
      const missing = join(home, 'not-there');
      const refused = await browser.post(`/workspaces/${slug}/devices/${deviceId}/link`, { folder: missing });
      expect(refused.body.error?.code).toBe('hub.devices.folder_missing');
      const after = await prisma().workspace.findUniqueOrThrow({ where: { slug } });
      expect(after.repoPaths).toEqual([]);

      const folder = join(home, 'repo');
      mkdirSync(folder);
      // No Claude config in this home, so D44's own rule answers: the shape is not as expected, and nothing is written.
      const pressed = await browser
        .post(`/workspaces/${slug}/devices/${deviceId}/link`, { folder })
        .expect(200);
      expect(pressed.body.data).toMatchObject({
        outcome: 'shape_unexpected',
        project: slug,
        registered: true,
        backup: null,
      });
      expect(existsSync(join(home, 'claude', '.claude.json'))).toBe(false);
      const registered = await prisma().workspace.findUniqueOrThrow({ where: { slug } });
      expect(registered.repoPaths).toEqual([folder]);
      const audit = await prisma().auditLog.findFirst({
        where: { action: 'devices.link', targetId: deviceId },
      });
      expect(audit?.summary).toContain('shape_unexpected');
    });

    it('the Link button is session only, so no token and no agent can press it', async () => {
      const { deviceId, credential } = await pair();
      await api()
        .post(`/api/v1/workspaces/${slug}/devices/${deviceId}/link`)
        .set('authorization', `Bearer ${credential}`)
        .send({ folder: 'C:/x' })
        .expect(403);
    });

    it('someone else’s device answers not found', async () => {
      const { deviceId } = await pair();
      const other = await anAccount(prisma());
      const otherBrowser = new Browser(app);
      await otherBrowser.post('/auth/sign-in', { email: other.email, password: PASSWORD }).expect(200);
      await otherBrowser.delete(`/me/devices/${deviceId}`).expect(404);
      await otherBrowser.get(`/me/devices/${deviceId}/health`).expect(404);
    });

    it('the health panel asks the bridge, and stores what it says', async () => {
      const { deviceId, credential } = await pair();
      aBridge(deviceId, credential);
      await until(() => hub.isOnline(deviceId));
      const answer = await browser.get(`/me/devices/${deviceId}/health`).expect(200);
      const found = (answer.body.data.health as { id: string; ok: boolean }[]).find(
        (check) => check.id === 'claude_found',
      );
      expect(found).toBeDefined();
      expect(answer.body.data.healthAt).not.toBeNull();
      expect(JSON.stringify(answer.body)).not.toContain(credential);
    }, 150_000);
  });

  describe('MCP parity', () => {
    async function aClient(token: string): Promise<Client> {
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

    it('lists and revokes through the same service, with no credential in the answer', async () => {
      const { deviceId, credential } = await pair('Over MCP');
      const { token } = await aToken(prisma(), userId, 'mcp');
      const client = await aClient(token);
      const listed = textOf(await client.callTool({ name: 'list_devices', arguments: {} }));
      expect(listed).toContain('Over MCP');
      expect(listed).toContain(deviceId);
      expect(listed).not.toContain(credential);
      const revoked = textOf(
        await client.callTool({ name: 'revoke_device', arguments: { device: deviceId } }),
      );
      expect(revoked).toContain('Revoked');
      const row = await prisma().device.findUniqueOrThrow({ where: { id: deviceId } });
      expect(row.revokedAt).not.toBeNull();
      await client.close();
    });

    it('a device credential is enough for the tools: that is what Claude Code holds', async () => {
      const { credential } = await pair('Holds a credential');
      const client = await aClient(credential);
      const names = (await client.listTools()).tools.map((tool) => tool.name);
      expect(names).toEqual(expect.arrayContaining(['list_devices', 'revoke_device', 'fix_device']));
      expect(names.some((name) => /pair|link_folder|token|credential/.test(name))).toBe(false);
      const project = textOf(await client.callTool({ name: 'get_project', arguments: {} }));
      expect(project).toContain(slug);
      await client.close();
    });
  });

  describe('the main machine', () => {
    it('pairs with no browser step, for the owner, and audits it', async () => {
      const email = (await prisma().user.findUniqueOrThrow({ where: { id: userId } })).email;
      const issued = await app.get(PairingService, { strict: false }).pairDirect(email, 'MAIN-PC', 'win32');
      expect(issued.credential).toMatch(/^hub_/);
      const list = await browser.get('/me/devices').expect(200);
      expect(list.body.data[0]).toMatchObject({ id: issued.deviceId, name: 'MAIN-PC' });
      const audit = await prisma().auditLog.findFirst({
        where: { action: 'devices.pair', targetId: issued.deviceId },
      });
      expect(audit?.summary).toContain('start:local');
      expect(audit?.summary).not.toContain(issued.credential);
    });
  });

  describe('the one command', () => {
    it('serves a script and the bundle with no sign-in, and neither holds a secret', async () => {
      const list = await browser.get('/me/devices/connect-command').expect(200);
      expect(list.body.data.connect).toContain('/api/v1/connect/bootstrap');
      const script = await api().get('/api/v1/connect/bootstrap').expect(200);
      expect(script.text).toContain('hub-bridge.mjs');
      const bundle = await api().get('/api/v1/connect/bundle').expect(200);
      const files = bundle.body.files as { path: string; text: string }[];
      const paths = files.map((file) => file.path);
      expect(paths).toEqual(
        expect.arrayContaining([
          'bridge/bin/hub-bridge.mjs',
          'bridge/bin/hub-mcp-headers.mjs',
          'bridge/lib/connect.mjs',
          'team-pack/.claude-plugin/marketplace.json',
          'team-pack/plugin/hooks/hooks.json',
        ]),
      );
      expect(paths.some((path) => path.includes('/test/') || path.includes('node_modules'))).toBe(false);
      expect(JSON.stringify(files)).not.toMatch(/hub_[a-f0-9]{8}_[a-f0-9]{80}/);
    });
  });
});
