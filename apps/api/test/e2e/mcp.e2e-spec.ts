/**
 * @file The live proof (docs/15 §1 and §7): a real MCP HTTP client over a real API token drives Hub, and each change
 * reaches a real SSE listener within a second. Then what MCP must refuse: no token, a cookie, a hook token, a secret,
 * another member's project, and what the member's roles do not allow.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import http, { type ClientRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';

import { aMember, aWorkspace } from '../factories';
import { aToken } from '../helpers/auth';
import { db } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';

type ToolAnswer = { isError?: boolean; content: { type: string; text: string }[] };

interface Connection {
  readonly client: Client;
  call(name: string, args?: Record<string, unknown>, meta?: Record<string, unknown>): Promise<ToolAnswer>;
  ok(name: string, args?: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}

describe('MCP over HTTP', () => {
  let app: INestApplication;
  let port: number;
  const openStreams: ClientRequest[] = [];
  const connections: Connection[] = [];

  beforeAll(async () => {
    ({ app } = await createTestApp({ realAuth: true }));
    await app.listen(0);
    port = (app.getHttpServer() as { address(): AddressInfo }).address().port;
  });

  afterEach(async () => {
    for (const request of openStreams.splice(0)) request.destroy();
    await Promise.all(connections.splice(0).map((connection) => connection.close()));
  });

  async function connect(token: string, headers: Record<string, string> = {}): Promise<Connection> {
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${token}`, ...headers } },
    });
    const client = new Client({ name: 'e2e', version: '1' });
    await client.connect(transport);
    const call: Connection['call'] = async (name, args = {}, meta) =>
      (await client.callTool({ name, arguments: args, ...(meta ? { _meta: meta } : {}) })) as ToolAnswer;
    const connection: Connection = {
      client,
      call,
      ok: async (name, args) => {
        const answer = await call(name, args);
        const text = answer.content[0]?.text ?? '';
        if (answer.isError) throw new Error(`${name}: ${text}`);
        return text;
      },
      close: () => client.close(),
    };
    connections.push(connection);
    return connection;
  }

  /** A project with a member holding a real token. TOTP is treated as enrolled, because this is not about it. */
  async function setup(roles: Parameters<typeof aMember>[2] = ['owner', 'pm']) {
    const workspace = await aWorkspace(db());
    const user = await aMember(db(), workspace.id, roles);
    await db().user.update({
      where: { id: user.id },
      data: { totpEnabledAt: new Date(), defaultWorkspaceId: workspace.id },
    });
    const { token } = await aToken(db(), user.id);
    return { workspace, user, token };
  }

  /** A real SSE listener, on the same route the web uses. Resolves when an event of this card arrives. */
  function listen(slug: string, token: string) {
    const frames: { event: string; data: Record<string, unknown>; at: number }[] = [];
    const waiters: (() => void)[] = [];
    return new Promise<{
      until(predicate: (data: Record<string, unknown>, event: string) => boolean): Promise<number>;
    }>((resolve, reject) => {
      const request = http.get(
        {
          port,
          host: '127.0.0.1',
          path: `/api/v1/workspaces/${slug}/events/stream`,
          headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' },
        },
        (response) => {
          if (response.statusCode !== 200) reject(new Error(`stream ${String(response.statusCode)}`));
          response.setEncoding('utf8');
          let buffer = '';
          response.on('data', (chunk: string) => {
            buffer += chunk;
            const parts = buffer.split('\n\n');
            buffer = parts.pop() ?? '';
            for (const part of parts) {
              const fields = Object.fromEntries(
                part
                  .split('\n')
                  .filter((line) => !line.startsWith(':') && line.includes(': '))
                  .map((line) => [line.slice(0, line.indexOf(': ')), line.slice(line.indexOf(': ') + 2)]),
              ) as { event?: string; data?: string };
              if (fields.event && fields.data) {
                frames.push({
                  event: fields.event,
                  data: JSON.parse(fields.data) as Record<string, unknown>,
                  at: performance.now(),
                });
                for (const waiter of waiters.splice(0)) waiter();
              }
            }
          });
          // Give the subscriber a moment before the first write.
          setTimeout(
            () =>
              resolve({
                until: (predicate) =>
                  new Promise<number>((done, fail) => {
                    const timer = setTimeout(
                      () => fail(new Error(`no event in 1 s: ${JSON.stringify(frames)}`)),
                      1000,
                    );
                    const check = () => {
                      const found = frames.find((frame) => predicate(frame.data, frame.event));
                      if (found) {
                        clearTimeout(timer);
                        done(found.at);
                      } else waiters.push(check);
                    };
                    check();
                  }),
              }),
            150,
          );
        },
      );
      request.on('error', (error) => {
        if (!request.destroyed) reject(error);
      });
      openStreams.push(request);
    });
  }

  const keyIn = (text: string) => /\b[A-Z]{2,6}-\d+\b/.exec(text)?.[0] ?? '';

  describe('the transport', () => {
    it('lists every tool with its hints, and prompts and resources', async () => {
      const { token } = await setup();
      const { client } = await connect(token);
      const { tools } = await client.listTools();
      expect(tools.length).toBeGreaterThan(90);
      const decide = tools.find((tool) => tool.name === 'decide');
      expect(decide?.annotations?.destructiveHint).toBe(true);
      expect(decide?.description).toMatch(/confirm with the user/i);
      expect(tools.find((tool) => tool.name === 'list_tasks')?.annotations?.readOnlyHint).toBe(true);
      expect(Object.keys((tools[0]?.inputSchema.properties ?? {}) as object)).toContain('project');

      const { prompts } = await client.listPrompts();
      expect(prompts.map((prompt) => prompt.name)).toEqual(
        expect.arrayContaining([
          'start',
          'next',
          'done',
          'decision',
          'need',
          'adr',
          'weekly',
          'release-notes',
        ]),
      );
      const start = await client.getPrompt({ name: 'start' });
      expect(JSON.stringify(start.messages)).toContain('Never send a secret');

      const { resources } = await client.listResources();
      expect(resources.map((resource) => resource.uri)).toEqual(
        expect.arrayContaining(['hub://decisions/open', 'hub://handoffs/pending', 'hub://brief/today']),
      );
    });

    it('refuses no token with WWW-Authenticate, and answers 405 to GET and DELETE', async () => {
      const { token } = await setup();
      const url = `http://127.0.0.1:${port}/mcp`;
      const none = await fetch(url, {
        method: 'POST',
        body: '{}',
        headers: { 'content-type': 'application/json' },
      });
      expect(none.status).toBe(401);
      expect(none.headers.get('www-authenticate')).toContain('Bearer');
      for (const method of ['GET', 'DELETE']) {
        const answer = await fetch(url, { method, headers: { authorization: `Bearer ${token}` } });
        expect(answer.status).toBe(405);
      }
    });

    it('refuses a hook token, which may only reach capture routes', async () => {
      const { user } = await setup();
      const hook = await aToken(db(), user.id, 'hook');
      const answer = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        body: '{}',
        headers: { authorization: `Bearer ${hook.token}`, 'content-type': 'application/json' },
      });
      expect(answer.status).toBe(403);
    });
  });

  describe('the owner’s demo, each change reaching the page within a second', () => {
    it('create, edit, decide, delete, restore, plan to tasks, create project', async () => {
      const { workspace, token } = await setup();
      const hub = await connect(token);
      const stream = await listen(workspace.slug, token);

      const timed = async (name: string, args: Record<string, unknown>, kind?: string) => {
        const started = performance.now();
        const text = await hub.ok(name, args);
        const key = keyIn(text);
        const at = await stream.until((data) => data['key'] === key && (!kind || data['kind'] === kind));
        expect(at - started).toBeLessThan(1000);
        return { text, key };
      };

      const task = await timed('create_task', { title: 'Real task', specialty: 'backend', priority: 'P1' });
      expect(task.text).toContain('Created');
      expect(task.text).toContain(`/${workspace.slug}/tasks?card=${task.key}`);
      expect(task.text).toContain('status: backlog');

      const edited = await timed('update_task', {
        key: task.key,
        title: 'Real task, edited',
        effort: 'S',
        acceptance: 'It works',
      });
      expect(edited.text).toContain('Real task, edited');

      const decision = await timed('request_decision', {
        title: 'Which one?',
        kind: 'product',
        question: 'A or B?',
        deciderRole: 'owner',
        options: [{ title: 'A' }, { title: 'B' }],
      });
      const sheet = await hub.ok('get_decision', { key: decision.key });
      const optionId = /`([a-z0-9-]+)`/.exec(sheet)?.[1] ?? '';
      const decided = await timed(
        'decide',
        { key: decision.key, optionId, rationale: 'A is simpler' },
        'decided',
      );
      expect(decided.text).toContain('status: decided');

      const deleted = await timed('delete_card', { key: task.key, reason: 'by mistake' }, 'archived');
      expect(deleted.text).toContain('restore_card');
      expect(await hub.ok('list_cards', { q: 'edited' })).not.toContain(task.key);
      expect(await hub.ok('list_deleted')).toContain(task.key);
      await timed('restore_card', { key: task.key }, 'restored');
      expect(await hub.ok('list_cards', { type: ['task'] })).toContain(task.key);

      const plan = await timed('create_plan', {
        title: 'The plan',
        body: '# Plan\nDo it.',
        steps: [{ title: 'Step one', role: 'backend' }, { title: 'Step two' }],
      });
      const tasks = await timed('plan_to_tasks', { key: plan.key }, 'plan_to_tasks');
      expect(tasks.text).toContain('status: in_progress');
      const reread = await hub.ok('get_plan', { key: plan.key });
      expect(reread).toMatch(/Step one · backend · [A-Z]+-\d+/);
      expect(await hub.ok('list_tasks', { status: ['backlog', 'ready'] })).toContain('Step two');

      const slug = `made-${Date.now().toString(36).slice(-6)}`;
      const project = await hub.ok('create_project', {
        name: 'Test',
        slug,
        keyPrefix: `T${Date.now().toString(36).toUpperCase().replace(/\d/g, 'X').slice(-3)}`,
        description: 'Made from a chat',
      });
      expect(project).toContain('You are its owner');
      expect(await hub.ok('list_projects')).toContain(slug);
      const inProject = await hub.ok('create_task', { title: 'There', specialty: 'ops', project: slug });
      expect(inProject).toContain(`project: ${slug}`);
    });

    it('Claude writes a plan’s phases with create_plan and update_plan, and get_plan reads the steps under them', async () => {
      const { token } = await setup();
      const hub = await connect(token);
      const key = keyIn(
        await hub.ok('create_plan', {
          title: 'Phased plan',
          body: 'Why',
          phases: [{ id: 'p0', title: 'Setup' }],
          steps: [{ title: 'Decide', phaseId: 'p0' }, { title: 'Loose step' }],
        }),
      );
      let sheet = await hub.ok('get_plan', { key });
      expect(sheet).toContain('### Phase 0: Setup · id p0');
      expect(sheet).toMatch(/### No phase\n2\. \[ \] Loose step/);

      await hub.ok('update_plan', {
        key,
        phases: [
          { id: 'p0', title: 'Setup' },
          { id: 'p1', title: 'Build', note: 'Frontend' },
        ],
        steps: [
          { id: 's1', title: 'Decide', phaseId: 'p0' },
          { id: 's2', title: 'Loose step', phaseId: 'p1' },
        ],
      });
      sheet = await hub.ok('get_plan', { key });
      expect(sheet).toContain('### Phase 1: Build (Frontend) · id p1');
      expect(sheet).not.toContain('### No phase');

      expect(await hub.ok('list_plan_runs', { key })).toBe(`${key} has no runs.`);
      const refused = await hub.call('update_plan', { key, phases: [{ id: 'p0', title: 'Setup' }] });
      expect(refused.isError).toBe(true);
      expect(refused.content[0]?.text).toContain('Build');
    });

    it('Claude attaches a screenshot to a step from a file in a project folder, and nothing outside one', async () => {
      const { workspace, token } = await setup();
      const folder = mkdtempSync(join(tmpdir(), 'hub-evidence-'));
      const outside = mkdtempSync(join(tmpdir(), 'hub-outside-'));
      // A 1×1 PNG.
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );
      writeFileSync(join(folder, 'after.png'), png);
      writeFileSync(join(outside, 'after.png'), png);
      await db().workspace.update({ where: { id: workspace.id }, data: { repoPaths: [folder] } });
      const hub = await connect(token);
      const key = keyIn(
        await hub.ok('create_plan', { title: 'With evidence', steps: [{ title: 'Screens' }] }),
      );

      const done = await hub.ok('add_step_evidence', {
        key,
        step: 1,
        kind: 'after',
        caption: 'The new screens',
        path: join(folder, 'after.png'),
      });
      expect(done).toContain('Attached after evidence to step 1');
      const sheet = await hub.ok('get_plan', { key });
      expect(sheet).toMatch(/Evidence: after · The new screens \(attachment [0-9a-f-]{36}\)/);
      const card = await db().card.findFirstOrThrow({
        where: { workspaceId: workspace.id, key },
        include: { plan: true },
      });
      expect((card.plan?.steps as { evidence?: { via: string }[] }[])[0]?.evidence?.[0]?.via).toBe('mcp');

      const refused = await hub.call('add_step_evidence', {
        key,
        step: 1,
        kind: 'after',
        path: join(outside, 'after.png'),
      });
      expect(refused.isError).toBe(true);
      expect(refused.content[0]?.text).toContain('project');
      const relative = await hub.call('add_step_evidence', {
        key,
        step: 1,
        kind: 'after',
        path: '../after.png',
      });
      expect(relative.isError).toBe(true);
    });

    it('Claude asks for a plan’s explainer and attaches the film Hams made: video, poster, captions, chapters by phase', async () => {
      const { workspace, token } = await setup();
      // What plan-film exports, made here: no Gemini request, no render. The clip is known by its bytes, the poster is drawn by sharp.
      const folder = mkdtempSync(join(tmpdir(), 'hub-hams-'));
      writeFileSync(
        join(folder, 'plan-explainer.mp4'),
        Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom', 'latin1'), Buffer.alloc(256)]),
      );
      writeFileSync(
        join(folder, 'plan-explainer-poster.jpg'),
        await sharp({ create: { width: 320, height: 180, channels: 3, background: '#224488' } })
          .jpeg()
          .toBuffer(),
      );
      writeFileSync(
        join(folder, 'plan-explainer.ar.vtt'),
        ['WEBVTT', '', '1', '00:00:00.000 --> 00:00:02.000', 'دي الخطة', ''].join('\n'),
      );
      writeFileSync(join(folder, 'notes.vtt'), 'not captions');
      await db().workspace.update({ where: { id: workspace.id }, data: { repoPaths: [folder] } });
      const hub = await connect(token);
      const key = keyIn(
        await hub.ok('create_plan', {
          title: 'Filmed plan',
          phases: [
            { id: 'p0', title: 'Setup' },
            { id: 'p1', title: 'Build' },
          ],
          steps: [{ title: 'Decide', phaseId: 'p0' }],
        }),
      );
      const files = {
        video: join(folder, 'plan-explainer.mp4'),
        poster: join(folder, 'plan-explainer-poster.jpg'),
        captions: join(folder, 'plan-explainer.ar.vtt'),
      };
      const chapters = [
        { phase: null, title: 'Intro', start: 0 },
        { phase: 0, start: 14.64 },
        { phase: 1, start: 32.09 },
        { phase: 7, start: 50 },
      ];
      const early = await hub.call('attach_plan_explainer', { key, revision: 1, chapters, ...files });
      expect(early.content[0]?.text).toContain('hub.plans.explainer_not_requested');

      await hub.ok('request_plan_explainer', { key, voice: 'google', googleVoice: 'Charon' });
      const stale = await hub.call('attach_plan_explainer', { key, revision: 2, chapters, ...files });
      expect(stale.content[0]?.text).toContain('hub.plans.explainer_stale');
      const badCaptions = await hub.call('attach_plan_explainer', {
        key,
        revision: 1,
        chapters,
        ...files,
        captions: join(folder, 'notes.vtt'),
      });
      expect(badCaptions.content[0]?.text).toContain('hub.plans.explainer_captions');

      expect(
        await hub.ok('attach_plan_explainer', {
          key,
          revision: 1,
          chapters,
          ...files,
          hamsProject: {
            id: 'plan-gtv472-20261119',
            url: 'http://127.0.0.1:4700/projects/plan-gtv472-20261119',
          },
        }),
      ).toContain('Attached the explainer video to');
      const card = await db().card.findFirstOrThrow({
        where: { workspaceId: workspace.id, key },
        include: { plan: true },
      });
      const explainer = card.plan?.explainer as {
        status: string;
        chapters: { phaseId: string | null }[];
        attachmentId: string;
        captionsId: string;
        posterId: string;
        request: { voice: string; dialect: string };
      };
      expect(explainer).toMatchObject({ status: 'ready', request: { voice: 'google', dialect: 'egyptian' } });
      expect(explainer.chapters.map((chapter) => chapter.phaseId)).toEqual([null, 'p0', 'p1', null]);
      const kinds = await db().cardAttachment.findMany({
        where: { cardId: card.id },
        select: { kind: true, mime: true },
      });
      expect(kinds.map((row) => `${row.kind} ${row.mime}`).sort()).toEqual([
        'explainer video/mp4',
        'explainer_captions text/vtt',
        'explainer_poster image/jpeg',
      ]);

      // Asked again and attached again: the first film is removed once the new one is in.
      await hub.ok('request_plan_explainer', { key });
      await hub.ok('attach_plan_explainer', { key, revision: 1, chapters, video: files.video });
      expect(await db().cardAttachment.findUnique({ where: { id: explainer.attachmentId } })).toBeNull();
      expect(await db().cardAttachment.findUnique({ where: { id: explainer.captionsId } })).toBeNull();
      expect(await db().cardAttachment.count({ where: { cardId: card.id } })).toBe(1);
    });

    it('records the agent as the actor, through the same path as the web', async () => {
      const { workspace, token } = await setup();
      const hub = await connect(token);
      const key = keyIn(await hub.ok('create_task', { title: 'Who did it', specialty: 'qa' }));
      const event = await db().cardEvent.findFirst({
        where: { workspaceId: workspace.id, card: { key } },
      });
      expect(event).toMatchObject({ actorKind: 'agent', via: 'mcp' });
      const audit = await db().auditLog.findFirst({
        where: { workspaceId: workspace.id, targetId: key },
      });
      expect(audit?.via).toBe('mcp');
    });
  });

  describe('which project', () => {
    it('argument, then header, then default; another project answers not found', async () => {
      const { workspace, user, token } = await setup();
      const other = await aWorkspace(db());
      await db().membership.create({
        data: { workspaceId: other.id, userId: user.id, roles: ['backend'] },
      });
      const stranger = await aWorkspace(db());

      const plain = await connect(token);
      expect(await plain.ok('get_project_brief')).toContain(`slug \`${workspace.slug}\``);
      expect(await plain.ok('get_project_brief', { project: other.slug })).toContain(
        `slug \`${other.slug}\``,
      );

      const linked = await connect(token, { 'X-Hub-Project': other.slug });
      expect(await linked.ok('get_project_brief')).toContain(`slug \`${other.slug}\``);
      expect(await linked.ok('get_project_brief', { project: workspace.slug })).toContain(
        `slug \`${workspace.slug}\``,
      );

      const refused = await plain.call('get_project', { project: stranger.slug });
      expect(refused.isError).toBe(true);
      expect(refused.content[0]?.text).toContain('hub.workspaces.not_found');

      await plain.ok('switch_project', { slug: other.slug });
      expect(await plain.ok('get_project_brief')).toContain(`slug \`${other.slug}\``);
    });
  });

  describe('what it refuses', () => {
    it('a secret in any field, naming the pattern and never the value', async () => {
      const { token } = await setup();
      const hub = await connect(token);
      const value = 'AKIAIOSFODNN7EXAMPLE';
      const answer = await hub.call('create_task', {
        title: 'Keep this',
        specialty: 'ops',
        body: `the key is ${value}`,
      });
      expect(answer.isError).toBe(true);
      expect(answer.content[0]?.text).toContain('hub.security.secret_detected');
      expect(answer.content[0]?.text).not.toContain(value);
    });

    it('a source secret, which only the web takes', async () => {
      const { token } = await setup();
      const hub = await connect(token);
      const answer = await hub.call('add_source', {
        kind: 'local_path',
        name: 'docs',
        config: { path: 'F:/x', purpose: 'docs' },
        secret: 'something',
      });
      expect(answer.isError).toBe(true);
      const { tools } = await hub.client.listTools();
      expect(tools.map((tool) => tool.name).filter((name) => name.includes('token'))).toEqual([]);
    });

    it('what the member’s roles do not allow, with the same code as the web', async () => {
      const lead = await setup();
      const member = await aMember(db(), lead.workspace.id, ['qa']);
      await db().user.update({ where: { id: member.id }, data: { defaultWorkspaceId: lead.workspace.id } });
      const { token } = await aToken(db(), member.id);
      const leadHub = await connect(lead.token);
      const key = keyIn(
        await leadHub.ok('request_decision', {
          title: 'Only the owner',
          kind: 'product',
          question: 'Q?',
          deciderRole: 'owner',
          options: [
            { id: 'a', title: 'A' },
            { id: 'b', title: 'B' },
          ],
        }),
      );
      const qa = await connect(token);
      const answer = await qa.call('decide', { key, optionId: 'a', rationale: 'no' });
      expect(answer.isError).toBe(true);
      expect(answer.content[0]?.text).toContain('hub.decisions.not_decider');
      const invite = await qa.call('invite_member', { email: 'x@example.test', roles: ['qa'] });
      expect(invite.isError).toBe(true);
      expect(invite.content[0]?.text).toContain('hub.common.forbidden');
      for (const [name, args] of [
        ['change_member_roles', { userId: member.id, roles: ['owner'] }],
        ['update_settings', { key: 'needs.stale_days', value: 1 }],
        ['read_audit', {}],
        ['update_project', { status: 'closed' }],
      ] as const) {
        const refused = await qa.call(name, args);
        expect(refused.content[0]?.text).toContain('hub.common.forbidden');
      }
    });

    it('replays a create with the same tool use id, and runs one with none twice', async () => {
      const { workspace, token } = await setup();
      const hub = await connect(token);
      const args = { title: 'Once', specialty: 'ops' };
      const meta = { 'claudecode/toolUseId': 'toolu_same' };
      const first = await hub.call('create_task', args, meta);
      const second = await hub.call('create_task', args, meta);
      expect(keyIn(second.content[0]?.text ?? '')).toBe(keyIn(first.content[0]?.text ?? ''));
      expect(second.content[0]?.text).toContain('Already done');
      await hub.ok('create_task', args);
      const count = await db().card.count({ where: { workspaceId: workspace.id, title: 'Once' } });
      expect(count).toBe(2);
    });
  });

  it('saves a brief narrative and shows it in the brief resource, weekly only for owner and pm', async () => {
    const { token } = await setup();
    const hub = await connect(token);
    expect(await hub.ok('save_brief', { narrative: 'Today we ship.' })).toContain('morning brief');
    const brief = await hub.client.readResource({ uri: 'hub://brief/today' });
    expect(JSON.stringify(brief.contents)).toContain('Today we ship.');
    expect(await hub.ok('save_brief', { kind: 'weekly', narrative: 'This week.' })).toContain('weekly brief');
    const qa = await setup(['qa']);
    const refused = await (await connect(qa.token)).call('save_brief', { kind: 'weekly', narrative: 'No.' });
    expect(refused.content[0]?.text).toContain('hub.common.forbidden');
  });

  it('reads an indexed document, and starts source runs only for those allowed', async () => {
    const { workspace, token } = await setup();
    const source = await db().source.create({
      data: {
        workspaceId: workspace.id,
        kind: 'local_path',
        name: 'docs',
        config: { path: 'F:/nowhere', purpose: 'docs' },
      },
    });
    const hub = await connect(token);
    const none = await hub.ok('search_docs', { query: 'nothing here' });
    expect(none).toContain('No documents match');
    expect((await hub.call('get_doc', {})).isError).toBe(true);
    expect((await hub.call('rescan_lab')).content[0]?.text).toContain('hub.redesign.lab_unavailable');
    const qa = await setup(['qa']);
    await db().membership.create({ data: { workspaceId: workspace.id, userId: qa.user.id, roles: ['qa'] } });
    const refused = await (
      await connect(qa.token)
    ).call('run_source', {
      sourceId: source.id,
      project: workspace.slug,
    });
    expect(refused.content[0]?.text).toContain('hub.common.forbidden');
  });

  it('a change on the web is visible to the next tool call', async () => {
    const { workspace, token } = await setup();
    const hub = await connect(token);
    const key = keyIn(await hub.ok('create_task', { title: 'Before', specialty: 'ops' }));
    await fetch(`http://127.0.0.1:${port}/api/v1/workspaces/${workspace.slug}/cards/${key}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'After' }),
    });
    expect(await hub.ok('get_card', { key })).toContain('After');
    const resource = await hub.client.readResource({ uri: `hub://card/${key}` });
    expect(JSON.stringify(resource.contents)).toContain('After');
  });
});
