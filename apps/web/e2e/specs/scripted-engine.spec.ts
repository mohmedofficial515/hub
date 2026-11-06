/**
 * @file The scripted engine itself, driven by the API only: the real bridge and binary against the throwaway stack, with no model call. It proves what the panel's browser specs rely on.
 * @description `pnpm test:e2e:web --grep scripted`. Needs the Claude Code extension on this machine, and skips without it.
 */
import { execFileSync } from 'node:child_process';

import { hold, overloaded, text, tool, unauthorized } from '../support/fake-model';
import type { Rest } from '../support/hub';
import {
  expect,
  recordedBridges,
  type ScriptedEngine,
  scriptedEngineAvailable,
  test,
} from '../support/scripted-engine';

test.skip(!scriptedEngineAvailable(), 'Needs the Claude Code extension on this machine');

interface Message {
  id: string;
  role: string;
  content: string;
  status: string | null;
  failure: string | null;
  engineFacts: { skills: string[]; mcpServers: string[] } | null;
  steps: { name: string; status: string; command: string | null; output: string | null }[];
  approvals: { id: string; status: string; command: string; category: string; effect: string }[];
  questions: { id: string; status: string; questions: { text: string }[] }[];
  stages: { stage: string; state: string }[];
}
interface Chat {
  id: string;
  running: boolean;
  deviceOnline: boolean;
  messages: Message[];
}
interface Engine {
  signedIn: boolean | null;
  canRun: boolean;
}

function chatOf(owner: Rest, engine: ScriptedEngine, mode = 'execute') {
  const base = `workspaces/${owner.ws}/chats`;
  return {
    start: () => owner.post<{ id: string }>(base, { device: engine.deviceId, folder: engine.folder, mode }),
    send: (id: string, words: string) => owner.post(`${base}/${id}/messages`, { text: words }),
    read: (id: string) => owner.get<Chat>(`${base}/${id}`),
    last: async (id: string) => (await owner.get<Chat>(`${base}/${id}`)).messages.at(-1)!,
    answer: (id: string, approval: string, body: Record<string, unknown>) =>
      owner.post(`${base}/${id}/approvals/${approval}`, body),
    stop: (id: string) => owner.post(`${base}/${id}/stop`),
    engine: () => owner.get<Engine>(`${base}/engine?device=${engine.deviceId}&fresh=true`),
  };
}

const LONG = { timeout: 60_000, intervals: [200] };

test.describe('the scripted engine', () => {
  test.setTimeout(150_000);

  test('text arrives as it streams, a real push pauses, Allow runs it, and the turn ends', async ({
    engine,
    owner,
  }) => {
    const chats = chatOf(owner, engine);
    const { id } = await chats.start();
    engine.script(
      text('Pushing the branch to its remote now, as you asked. ', { chunks: 8, delayMs: 300 }),
      tool('Bash', { command: 'git push origin main', description: 'push' }),
      text('Pushed it. '),
    );
    await chats.send(id, 'push it');

    let seenPart = false;
    await expect
      .poll(async () => {
        const reply = await chats.last(id);
        if (reply.status === 'running' && reply.content.length > 0 && !reply.approvals.length)
          seenPart = true;
        return reply.approvals.length;
      }, LONG)
      .toBe(1);
    expect(seenPart).toBe(true);

    const paused = await chats.last(id);
    expect(paused.content).toContain('Pushing the branch');
    expect(paused.status).toBe('running');
    const [approval] = paused.approvals;
    expect(approval).toMatchObject({
      status: 'pending',
      command: 'git push origin main',
      category: 'push',
      effect: 'Pushes to a remote',
    });
    expect(() =>
      execFileSync('git', ['-C', `${engine.folder}/../origin.git`, 'rev-parse', 'main'], {
        stdio: 'ignore',
      }),
    ).toThrow();

    await chats.answer(id, approval!.id, { decision: 'allow' });
    await expect.poll(async () => (await chats.last(id)).status, LONG).toBe('done');

    const reply = await chats.last(id);
    expect(reply.content).toContain('Pushed it.');
    expect(reply.approvals[0]?.status).toBe('allowed');
    expect(reply.steps[0]).toMatchObject({ name: 'Bash', status: 'done' });
    // The real command ran: the bare remote now has the branch.
    expect(
      execFileSync('git', ['-C', `${engine.folder}/../origin.git`, 'rev-parse', 'main'], {
        encoding: 'utf8',
      }).trim(),
    ).toMatch(/^[0-9a-f]{40}$/);
    // S1 said `init` carries these. Here they are from the real binary.
    expect(reply.engineFacts?.mcpServers).toContain('hub');
    expect(Array.isArray(reply.engineFacts?.skills)).toBe(true);
    await expect.poll(async () => (await chats.read(id)).running, LONG).toBe(false);
  });

  test('a plain command runs with no pause, and Hub’s own tools reach the real API', async ({
    engine,
    owner,
  }) => {
    const chats = chatOf(owner, engine);
    const { id } = await chats.start();
    engine.script(
      tool('Bash', { command: 'node --version', description: 'version' }),
      tool('mcp__hub__report_stage', { protocol: 'work', stage: 'verify', state: 'done' }),
      text('All checked. '),
    );
    await chats.send(id, 'check');
    await expect.poll(async () => (await chats.last(id)).status, LONG).toBe('done');
    const reply = await chats.last(id);
    expect(reply.approvals).toEqual([]);
    expect(reply.steps.map((step) => [step.name, step.status])).toEqual([
      ['Bash', 'done'],
      ['mcp__hub__report_stage', 'done'],
    ]);
    expect(reply.stages).toEqual([expect.objectContaining({ stage: 'verify', state: 'done' })]);
  });

  test('a question waits for its answer, and the answer reaches the model', async ({ engine, owner }) => {
    const chats = chatOf(owner, engine);
    const { id } = await chats.start();
    const question = 'Which storage?';
    engine.script(
      tool('AskUserQuestion', {
        questions: [
          {
            question,
            header: 'Storage',
            multiSelect: false,
            options: [
              { label: 'Postgres', description: 'Already here' },
              { label: 'Redis', description: 'Faster' },
            ],
          },
        ],
      }),
      text('Going with it. '),
    );
    await chats.send(id, 'ask me');
    await expect.poll(async () => (await chats.last(id)).questions.length, LONG).toBe(1);
    const asked = (await chats.last(id)).questions[0]!;
    await chats.answer(id, asked.id, { decision: 'allow', answers: { [question]: 'Redis' } });
    await expect.poll(async () => (await chats.last(id)).status, LONG).toBe('done');
    expect(engine.model.lastConversation()).toContain('Redis');
  });

  test('hold keeps the turn open with its words shown, until Stop', async ({ engine, owner }) => {
    const chats = chatOf(owner, engine);
    const { id } = await chats.start();
    engine.script(text('Working on it for a good long while now. '), hold());
    await chats.send(id, 'take your time');
    await expect.poll(async () => (await chats.last(id)).content, LONG).toContain('Working on it');
    expect((await chats.last(id)).status).toBe('running');
    await chats.stop(id);
    await expect.poll(async () => (await chats.last(id)).status, LONG).toBe('stopped');
  });

  test('offline: a running turn is cut off, a send is refused, and back online it works', async ({
    engine,
    owner,
  }) => {
    const chats = chatOf(owner, engine);
    const { id } = await chats.start();
    engine.script(hold());
    await chats.send(id, 'wait');
    await expect.poll(async () => (await chats.read(id)).running, LONG).toBe(true);

    // A stopped bridge is forgotten, so teardown never acts on its number once Windows reuses it.
    expect(recordedBridges()).toHaveLength(1);
    await engine.goOffline();
    expect(recordedBridges()).toEqual([]);
    await expect.poll(async () => (await chats.last(id)).status, LONG).toBe('interrupted');
    expect(await chats.last(id)).toMatchObject({ failure: 'device_offline' });
    expect((await chats.read(id)).deviceOnline).toBe(false);
    await expect(chats.send(id, 'again')).rejects.toThrow(/hub\.devices\.offline/);

    await engine.goOnline();
    engine.script(text('Back again now. '));
    await chats.send(id, 'are you there?');
    await expect.poll(async () => (await chats.last(id)).status, LONG).toBe('done');
    expect((await chats.last(id)).content).toContain('Back again');
  });

  test('an overloaded model is retried, and the turn goes on', async ({ engine, owner }) => {
    const chats = chatOf(owner, engine);
    const { id } = await chats.start();
    const before = engine.model.requests();
    engine.script(overloaded(), text('Got through. '));
    await chats.send(id, 'try');
    await expect.poll(async () => (await chats.last(id)).status, LONG).toBe('done');
    expect((await chats.last(id)).content).toContain('Got through');
    expect(engine.model.requests() - before).toBeGreaterThanOrEqual(2);
  });

  test('one 401 from the script ends the turn signed out, like the real API', async ({ engine, owner }) => {
    const chats = chatOf(owner, engine);
    const { id } = await chats.start();
    engine.script(unauthorized(), unauthorized());
    await chats.send(id, 'hello');
    await expect.poll(async () => (await chats.last(id)).status, LONG).toBe('failed');
    expect((await chats.last(id)).failure).toBe('signed_out');
  });

  test('signed out reads the way the panel needs, and signing in clears it', async ({ engine, owner }) => {
    const chats = chatOf(owner, engine);
    expect((await chats.engine()).signedIn).toBe(true);
    const { id } = await chats.start();

    engine.signOut();
    await chats.send(id, 'hello');
    await expect.poll(async () => (await chats.last(id)).status, LONG).toBe('failed');
    expect((await chats.last(id)).failure).toBe('signed_out');
    expect((await chats.engine()).signedIn).toBe(false);

    engine.signIn();
    expect((await chats.engine()).signedIn).toBe(true);
    engine.script(text('Signed in again. '));
    await chats.send(id, 'hello again');
    await expect.poll(async () => (await chats.last(id)).status, LONG).toBe('done');
  });
});
