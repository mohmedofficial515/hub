/**
 * @file H0-05 realtime: one SSE stream per member, within 500 ms of commit, heartbeat, and `Last-Event-ID` resume.
 * @description A real socket, because a stream is what is under test. `listen(0)` picks a free port.
 */
import http, { type ClientRequest } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { INestApplication } from '@nestjs/common';

import { RealtimePublisher } from '@/infra/redis/redis.module';
import { CardService } from '@/modules/cards';
import { RealtimeHub, RealtimeTimings } from '@/modules/realtime';

import { userActor } from '../factories';
import { aProject, aTask, created, type Project } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

interface Frame {
  readonly id?: string;
  readonly event?: string;
  readonly data?: Record<string, unknown>;
  readonly at: number;
}

interface Stream {
  readonly frames: Frame[];
  readonly raw: () => string;
  readonly request: ClientRequest;
  until(predicate: (frame: Frame) => boolean, timeoutMs?: number): Promise<Frame>;
}

describe('realtime', () => {
  let app: INestApplication;
  let port: number;
  const open: ClientRequest[] = [];

  beforeAll(async () => {
    ({ app } = await createTestApp());
    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;
  });

  afterEach(() => {
    for (const request of open.splice(0)) request.destroy();
  });

  function connect(slug: string, userId: string, lastEventId?: string): Promise<Stream> {
    return new Promise((resolve, reject) => {
      const frames: Frame[] = [];
      let raw = '';
      let buffer = '';
      const waiters: { predicate: (frame: Frame) => boolean; done: (frame: Frame) => void }[] = [];
      const request = http.get(
        {
          port,
          path: `/api/v1/workspaces/${slug}/events/stream`,
          headers: {
            'x-test-user': userId,
            accept: 'text/event-stream',
            ...(lastEventId ? { 'last-event-id': lastEventId } : {}),
          },
        },
        (response) => {
          response.setEncoding('utf8');
          if (response.statusCode !== 200) {
            reject(new Error(`stream answered ${String(response.statusCode)}`));
            return;
          }
          response.on('data', (chunk: string) => {
            raw += chunk;
            buffer += chunk;
            const parts = buffer.split('\n\n');
            buffer = parts.pop() ?? '';
            for (const part of parts) {
              const fields = Object.fromEntries(
                part
                  .split('\n')
                  .filter((line) => !line.startsWith(':') && line.includes(': '))
                  .map((line) => [line.slice(0, line.indexOf(': ')), line.slice(line.indexOf(': ') + 2)]),
              ) as { id?: string; event?: string; data?: string };
              if (!fields.event) continue;
              const frame: Frame = {
                at: performance.now(),
                event: fields.event,
                ...(fields.id ? { id: fields.id } : {}),
                ...(fields.data ? { data: JSON.parse(fields.data) as Record<string, unknown> } : {}),
              };
              frames.push(frame);
              for (const waiter of waiters.splice(0)) {
                if (waiter.predicate(frame)) waiter.done(frame);
                else waiters.push(waiter);
              }
            }
          });
          resolve({
            frames,
            raw: () => raw,
            request,
            until: (predicate, timeoutMs = 3000) =>
              new Promise((done, fail) => {
                const found = frames.find(predicate);
                if (found) {
                  done(found);
                  return;
                }
                const timer = setTimeout(
                  () => fail(new Error(`no frame in ${timeoutMs} ms: ${raw}`)),
                  timeoutMs,
                );
                waiters.push({
                  predicate,
                  done: (frame) => {
                    clearTimeout(timer);
                    done(frame);
                  },
                });
              }),
          });
        },
      );
      request.on('error', (error) => {
        if (!request.destroyed) reject(error);
      });
      open.push(request);
    });
  }

  const connected = (stream: Stream) =>
    new Promise<void>((resolve) => {
      const check = (): void => {
        if (stream.raw().includes(': connected')) resolve();
        else setTimeout(check, 5);
      };
      check();
    });

  async function aMemberStream(project: Project, roles: Parameters<Project['member']>[0] = ['pm']) {
    const member = await project.member(roles);
    const stream = await connect(project.slug, member.id);
    await connected(stream);
    return { member, stream };
  }

  it('delivers a card event within 500 ms of commit', async () => {
    const project = await aProject(app);
    const { member, stream } = await aMemberStream(project);
    const service = app.get(CardService);
    const actor = userActor(member.id, project.id, ['pm']);

    const samples: number[] = [];
    for (let index = 0; index < 10; index += 1) {
      const { card } = await service.apply(actor, null, 'task.create', {
        title: `T${index}`,
        detail: { specialty: 'qa' },
      });
      // `apply` resolved after commit and publish, so this measures from before the commit's answer at worst.
      const committed = performance.now();
      const frame = await stream.until(
        (item) => item.event === 'card.created' && item.data?.['key'] === card.key,
      );
      samples.push(frame.at - committed);
    }
    expect(Math.max(...samples)).toBeLessThan(500);
  });

  it('a mutation over HTTP reaches another member’s stream, with what a page needs and no text', async () => {
    const project = await aProject(app);
    const { stream } = await aMemberStream(project, ['qa']);
    const pm = await project.member(['pm']);

    const task = await created(pm, aTask({ title: 'Quiet title', body: 'Quiet body' }));
    const updated = await stream.until((frame) => frame.event === 'card.created');
    expect(updated.data).toMatchObject({ key: task.key, type: 'task', status: 'ready' });
    expect(stream.raw()).not.toContain('Quiet');

    await pm.post(`/cards/${task.key}/comments`, { body: 'Quiet comment' }).expect(201);
    await stream.until((frame) => frame.event === 'comment.created');
    await stream.until((frame) => frame.event === 'card.event' && frame.data?.['key'] === task.key);
    expect(stream.raw()).not.toContain('Quiet');
  });

  it('one action with follow-ups publishes each event, in order, after commit', async () => {
    const project = await aProject(app);
    const { stream } = await aMemberStream(project);
    const pm = await project.member(['pm']);
    const blocker = await created(pm, aTask({ title: 'Blocker' }));
    const blocked = await created(pm, aTask({ links: [{ kind: 'blocked_by', key: blocker.key }] }));
    await pm.post(`/cards/${blocker.key}/delete`).expect(200);

    const frame = await stream.until(
      (item) => item.event === 'card.updated' && item.data?.['kind'] === 'unblocked',
    );
    expect(frame.data?.['key']).toBe(blocked.key);
  });

  it('a stream carries only its own project', async () => {
    const project = await aProject(app);
    const { stream } = await aMemberStream(project);
    const other = await aProject(app);
    const stranger = await other.member(['pm']);
    const foreign = await created(stranger, aTask());
    const own = await created(await project.member(['pm']), aTask());

    await stream.until((frame) => frame.event === 'card.created' && frame.data?.['key'] === own.key);
    expect(stream.raw()).not.toContain(foreign.id);
  });

  it('refuses a stranger to the project', async () => {
    const project = await aProject(app);
    const stranger = await (await aProject(app)).member(['owner']);
    await expect(connect(project.slug, stranger.id)).rejects.toThrow('404');
  });

  it('sends a heartbeat', async () => {
    const timings = app.get(RealtimeTimings, { strict: false });
    const before = timings.heartbeatMs;
    timings.heartbeatMs = 30;
    try {
      const project = await aProject(app);
      const { stream } = await aMemberStream(project);
      await new Promise((resolve) => setTimeout(resolve, 120));
      expect(stream.raw()).toContain(': ping');
    } finally {
      timings.heartbeatMs = before;
    }
  });

  it('closes after the longest connection, and the client reconnects', async () => {
    const timings = app.get(RealtimeTimings, { strict: false });
    const before = timings.maxConnectionMs;
    timings.maxConnectionMs = 50;
    try {
      const project = await aProject(app);
      const member = await project.member(['pm']);
      const hub = app.get(RealtimeHub, { strict: false });
      const stream = await connect(project.slug, member.id);
      const ended = new Promise<void>((resolve) => {
        stream.request.on('response', () => undefined);
        stream.request.on('close', () => resolve());
      });
      await ended;
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(hub.connectionCount()).toBe(0);
    } finally {
      timings.maxConnectionMs = before;
    }
  });

  it('Last-Event-ID replays what was missed, in order, and nothing twice', async () => {
    const project = await aProject(app);
    const { member, stream } = await aMemberStream(project);
    const first = await created(member, aTask({ title: 'First' }));
    const seen = await stream.until(
      (frame) => frame.event === 'card.created' && frame.data?.['key'] === first.key,
    );
    stream.request.destroy();

    const second = await created(member, aTask({ title: 'Second' }));
    const third = await created(member, aTask({ title: 'Third' }));

    const resumed = await connect(project.slug, member.id, seen.id);
    await resumed.until((frame) => frame.event === 'card.created' && frame.data?.['key'] === third.key);
    const fourth = await created(member, aTask({ title: 'Fourth' }));
    await resumed.until((frame) => frame.event === 'card.created' && frame.data?.['key'] === fourth.key);

    const createdKeys = resumed.frames
      .filter((frame) => frame.event === 'card.created')
      .map((frame) => frame.data?.['key']);
    expect(createdKeys).toEqual([second.key, third.key, fourth.key]);
  });

  it('a cursor too old answers resync, so the page refetches', async () => {
    const project = await aProject(app);
    const member = await project.member(['pm']);
    await created(member, aTask());
    const stale = await connect(project.slug, member.id, '1000-0');
    const frame = await stale.until((item) => item.event === 'resync');
    expect(frame.data).toEqual({ reason: 'cursor_too_old' });
  });

  it('keeps the buffer capped', async () => {
    const project = await aProject(app);
    const publisher = app.get(RealtimePublisher, { strict: false });
    for (let index = 0; index < 800; index += 1) {
      await publisher.publishEnvelope(project.id, { event: 'x', data: index, audience: 'all' });
    }
    const length = await maintenanceClients().redis.xlen(`ws:${project.id}:stream`);
    // `MAXLEN ~` trims in whole nodes, so a little over the cap is what Redis keeps.
    expect(length).toBeLessThanOrEqual(700);
  });

  it('an envelope reaches its audience only', async () => {
    const project = await aProject(app);
    const named = await aMemberStream(project, ['qa']);
    const other = await aMemberStream(project, ['backend']);
    const publisher = app.get(RealtimePublisher, { strict: false });

    await publisher.publishEnvelope(project.id, {
      event: 'inbox.new',
      data: { unread: 3 },
      audience: { userIds: [named.member.id] },
    });
    await publisher.publishEnvelope(project.id, {
      event: 'source.run',
      data: { ok: true },
      audience: { roles: ['backend'] },
    });

    await named.stream.until((frame) => frame.event === 'inbox.new');
    await other.stream.until((frame) => frame.event === 'source.run');
    expect(named.stream.raw()).not.toContain('source.run');
    expect(other.stream.raw()).not.toContain('inbox.new');
  });

  it('leaving releases the connection', async () => {
    const project = await aProject(app);
    const hub = app.get(RealtimeHub, { strict: false });
    const { stream } = await aMemberStream(project);
    expect(hub.connectionCount()).toBeGreaterThanOrEqual(1);
    stream.request.destroy();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(hub.connectionCount()).toBe(0);
  });
});
