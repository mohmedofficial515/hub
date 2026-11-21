/**
 * @file The chat contract's pure parts: the stream redactor, the caps, the prompt prefix, the suggestions and the event schema.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  APPROVAL_EFFECTS,
  capText,
  CHAT_TRUNCATED_MARK,
  chatToMarkdown,
  contextPrefix,
  historyPrefix,
  HUB_SKILLS,
  isCoreSkill,
  stageFitsProtocol,
  suggestedPrompts,
  TURN_EVENT_KINDS,
  turnEventSchema,
  turnPrompt,
  VSCODE_LINK_PREFIX,
  VSCODE_PROMPT_CHARS,
  vscodeLink,
  vscodeOpenSchema,
  vscodePrompt,
} from './index';
import { createStreamRedactor, findSecret, redactDeep, redactSecrets } from './secret-patterns';

const TOKEN = `ghp_${'a'.repeat(40)}`;
const stream = (pieces: string[]) => {
  const redactor = createStreamRedactor();
  return pieces.map((piece) => redactor.push(piece)).join('') + redactor.end();
};

describe('redaction', () => {
  it('removes every pattern and leaves the words around it', () => {
    const clean = redactSecrets(`before ${TOKEN} after`);
    expect(clean).toContain('before ');
    expect(clean).toContain(' after');
    expect(findSecret(clean)).toBeNull();
    expect(clean).not.toContain(TOKEN);
  });

  it('walks a JSON value, keys included', () => {
    const value = redactDeep({ command: `curl -H ${TOKEN}`, list: [TOKEN], count: 3 }) as Record<
      string,
      unknown
    >;
    expect(JSON.stringify(value)).not.toContain(TOKEN);
    expect(value['count']).toBe(3);
  });

  it('a private key block goes whole, not just its first line', () => {
    const text = 'x -----BEGIN PRIVATE KEY-----\nabc\ndef\n-----END PRIVATE KEY----- y';
    const clean = redactSecrets(text);
    expect(clean).not.toContain('abc');
    expect(clean).toContain(' y');
  });
});

describe('the stream redactor', () => {
  it('catches a secret split across any two pieces', () => {
    for (let at = 1; at < TOKEN.length; at += 7) {
      const out = stream(['see ', TOKEN.slice(0, at), TOKEN.slice(at), ' end of it']);
      expect(out).not.toContain(TOKEN.slice(4));
      expect(out).toContain('see ');
      expect(out).toContain('end of it');
    }
  });

  it('catches a key and value that arrive as separate words', () => {
    const value = 'b'.repeat(40);
    const out = stream(['the token', ' = ', value, ' and more words follow here']);
    expect(out).not.toContain(value);
  });

  it('holds an open key block until its end, and removes it', () => {
    const out = stream([
      '-----BEGIN PRIVATE ',
      'KEY-----\nsecretline\n',
      'second\n-----END PRIVATE KEY-----',
      ' done now ok ok',
    ]);
    expect(out).not.toContain('secretline');
    expect(out).not.toContain('second');
    expect(out).toContain('done now');
  });

  it('keeps ordinary text whole and in order', () => {
    const words = Array.from({ length: 50 }, (_, index) => `word${index} `);
    expect(stream(words)).toBe(words.join(''));
  });

  it('does not hold ordinary text for long: a few words back at most', () => {
    const redactor = createStreamRedactor();
    const shown = redactor.push('one two three four five six seven ');
    expect(shown.startsWith('one two three')).toBe(true);
  });

  it('lets a very long run with no spaces go, so it cannot hold forever', () => {
    const redactor = createStreamRedactor();
    expect(redactor.push('z'.repeat(20_000)).length).toBeGreaterThan(10_000);
  });
});

describe('caps', () => {
  it('marks what it cut', () => {
    expect(capText('abc', 10)).toEqual({ text: 'abc', truncated: false });
    const cut = capText('abcdef', 3);
    expect(cut.truncated).toBe(true);
    expect(cut.text).toBe(`abc${CHAT_TRUNCATED_MARK}`);
  });
});

describe('prompts', () => {
  it('names the project, page and every attachment', () => {
    const prefix = contextPrefix({
      project: 'demo',
      page: 'tasks',
      card: 'DEM-1',
      attachments: [
        { kind: 'card', key: 'DEM-2' },
        { kind: 'doc', key: 'DEM-3' },
        { kind: 'file', path: 'src/a.ts' },
      ],
    });
    for (const word of ['demo', 'tasks', 'DEM-1', 'DEM-2', 'DEM-3', 'src/a.ts']) {
      expect(prefix).toContain(word);
    }
  });

  it('a branch carries the earlier words, bounded', () => {
    const prefix = historyPrefix([{ role: 'user', content: 'x'.repeat(50_000) }]);
    expect(prefix.length).toBeLessThan(21_000);
  });
});

describe('suggestedPrompts', () => {
  const roles = ['owner'] as const;
  const base = { ownerRole: null, assigneeId: null, createdById: null, archivedAt: null, detail: null };
  const ids = (input: Parameters<typeof suggestedPrompts>[0]) =>
    suggestedPrompts(input).map((item) => item.id);

  it('an open decision offers Decide, and a decided one does not', () => {
    const open = { ...base, key: 'D-1', type: 'decision' as const, status: 'open' };
    expect(ids({ page: 'decisions', card: open, roles, memberId: 'me' })[0]).toBe('decide_card');
    const decided = { ...open, status: 'decided' };
    expect(ids({ page: 'decisions', card: decided, roles, memberId: 'me' })).not.toContain('decide_card');
  });

  it('a task that can start offers the work protocol with its key', () => {
    const task = {
      ...base,
      key: 'T-1',
      type: 'task' as const,
      status: 'ready',
      detail: { specialty: 'backend' },
    };
    const [first] = suggestedPrompts({ page: 'tasks', card: task, roles, memberId: 'me' });
    expect(first).toEqual({
      id: 'work_card',
      key: 'T-1',
      skill: 'hub:work',
      mode: 'execute',
      onPress: 'run',
    });
  });

  it('a suggestion says whether it runs, and only a read-only one or a stated skill does (D51)', () => {
    const task = {
      ...base,
      key: 'T-1',
      type: 'task' as const,
      status: 'ready',
      detail: { specialty: 'backend' },
    };
    const all = suggestedPrompts({ page: 'tasks', card: task, roles, memberId: 'me' });
    for (const item of all) {
      if (item.onPress === 'run' && item.mode === 'execute') expect(item.skill).toBeDefined();
    }
    expect(suggestedPrompts({ page: 'planning', card: null, roles, memberId: 'me' })[0]).toMatchObject({
      id: 'plan_topic',
      onPress: 'fill',
    });
  });

  it('review needs Execute, since Ask cannot run a check, and only fills the composer (review M10)', () => {
    const task = {
      ...base,
      key: 'T-4',
      type: 'task' as const,
      status: 'in_review',
      assigneeId: 'me',
      detail: { specialty: 'backend' },
    };
    const review = suggestedPrompts({ page: 'tasks', card: task, roles: ['owner'], memberId: 'me' }).find(
      (item) => item.id === 'review_card',
    );
    expect(review).toMatchObject({ mode: 'execute', onPress: 'fill' });
  });

  it('a doc offers the document protocol', () => {
    const doc = { ...base, key: 'D-2', type: 'doc' as const, status: 'current' };
    expect(ids({ page: 'docs', card: doc, roles, memberId: 'me' })).toEqual(
      expect.arrayContaining(['improve_doc', 'find_doc_gaps']),
    );
  });

  it('a deleted card offers only what the page does', () => {
    const task = { ...base, key: 'T-2', type: 'task' as const, status: 'ready', archivedAt: '2026-11-06' };
    expect(ids({ page: 'today', card: task, roles, memberId: 'me' })).toEqual([
      'summarize_today',
      'suggest_next',
      'whats_next',
    ]);
  });

  it('changes with the page, and stays short', () => {
    expect(ids({ page: 'today', card: null, roles, memberId: 'me' })).toContain('summarize_today');
    expect(ids({ page: 'docs', card: null, roles, memberId: 'me' })).toContain('find_docs');
    const task = { ...base, key: 'T-3', type: 'task' as const, status: 'ready' };
    expect(suggestedPrompts({ page: 'tasks', card: task, roles, memberId: 'me' }).length).toBeLessThanOrEqual(
      4,
    );
  });
});

describe('turnPrompt', () => {
  it('puts the context first, and after a slash command, so the command stays one', () => {
    expect(turnPrompt('[ctx]\n\n', '', 'hello')).toBe('[ctx]\n\nhello');
    expect(turnPrompt('[ctx]\n\n', '', '/hub:work T-1')).toBe('/hub:work T-1\n\n[ctx]');
  });
});

describe('turn events', () => {
  it('has the small stable list, and refuses a raw shape', () => {
    expect(TURN_EVENT_KINDS).toEqual(
      expect.arrayContaining([
        'turn.session',
        'text.delta',
        'tool.started',
        'approval.requested',
        'turn.ended',
      ]),
    );
    expect(turnEventSchema.safeParse({ kind: 'stream_event', event: {} }).success).toBe(false);
    expect(turnEventSchema.safeParse({ kind: 'text.delta', text: 'a' }).success).toBe(true);
  });

  it('has the structured results, and a plan may be words alone', () => {
    expect(TURN_EVENT_KINDS).toEqual(
      expect.arrayContaining([
        'turn.starting',
        'engine.warning',
        'tool.blocked',
        'question.asked',
        'question.resolved',
        'work.reported',
        'report.refused',
        'doc.draft',
        'doc.draft.updated',
      ]),
    );
    expect(turnEventSchema.safeParse({ kind: 'plan.proposed', plan: 'words' }).success).toBe(true);
    expect(
      turnEventSchema.safeParse({
        kind: 'plan.proposed',
        plan: 'words',
        structured: { title: 'T', steps: [{ title: 'S' }] },
      }).success,
    ).toBe(true);
  });

  it('an approval carries its effect line', () => {
    const base = {
      kind: 'approval.requested',
      approvalId: 'a',
      toolUseId: 't',
      toolName: 'Bash',
      command: 'x',
      category: 'push',
      input: {},
      expiresAt: 'x',
    };
    expect(turnEventSchema.safeParse(base).success).toBe(false);
    expect(turnEventSchema.safeParse({ ...base, effect: APPROVAL_EFFECTS.push }).success).toBe(true);
  });

  it('a stage must belong to its protocol', () => {
    expect(stageFitsProtocol({ protocol: 'work', stage: 'verify' })).toBe(true);
    expect(stageFitsProtocol({ protocol: 'doc', stage: 'verify' })).toBe(false);
  });
});

describe('HUB_SKILLS', () => {
  it("lists exactly what Hub's own skills offer a person to type", () => {
    const root = resolve(__dirname, '../../team-pack/plugin/skills');
    // Skills the owner adds on the Skills page live beside these, and reach the slash menu from the engine's own list (D64).
    const invocable = readdirSync(root)
      .filter((name) => isCoreSkill(name))
      .filter((name) => /^user-invocable: true\r?$/m.test(readFileSync(join(root, name, 'SKILL.md'), 'utf8')))
      .map((name) => `/hub:${name}`);
    expect([...HUB_SKILLS].sort()).toEqual(invocable.sort());
    expect(invocable).not.toContain('/hub:guide');
  });
});

describe('Send to VS Code (docs/16 §8)', () => {
  const folder = 'C:/work/repo';

  it('carries the card key, so Claude reads the rest through Hub', () => {
    expect(vscodePrompt({ cardKey: 'GTV-123', chatTitle: 'Ignored', folder })).toBe(
      'Work on GTV-123 in Hub. Read it with hub get_card first.',
    );
  });

  it('carries the chat title when there is no card, on one line', () => {
    const prompt = vscodePrompt({ chatTitle: ' الدفع\n\n  & refunds ', folder });
    expect(prompt).toContain('الدفع & refunds');
    expect(prompt).not.toContain('\n');
    expect(prompt).not.toContain(folder);
  });

  it('names the folder when there is neither, including a blank title', () => {
    expect(vscodePrompt({ folder })).toContain(folder);
    expect(vscodePrompt({ chatTitle: '   ', folder })).toContain(folder);
  });

  it('is capped, and a cut never leaves half a character that a link could not encode', () => {
    for (const padding of ['', 'x']) {
      const prompt = vscodePrompt({ chatTitle: `${padding}${'😀'.repeat(400)}`, folder });
      expect(prompt.length).toBeLessThanOrEqual(VSCODE_PROMPT_CHARS);
      expect(() => vscodeLink(prompt)).not.toThrow();
    }
  });

  it('builds the only link there is, with everything encoded', () => {
    const words = 'افتح GTV-1 & اقرأ?';
    const link = vscodeLink(words);
    expect(link).toBe(`vscode://anthropic.claude-code/open?prompt=${encodeURIComponent(words)}`);
    expect(link.startsWith(VSCODE_LINK_PREFIX)).toBe(true);
    expect(link.slice(VSCODE_LINK_PREFIX.length)).not.toMatch(/[& ?]/);
  });

  it('takes a uuid device and an absolute folder, and a card key only in its own shape', () => {
    const device = '11111111-1111-4111-8111-111111111111';
    expect(vscodeOpenSchema.safeParse({ device, folder }).success).toBe(true);
    expect(vscodeOpenSchema.safeParse({ device, folder: 'relative/path' }).success).toBe(false);
    expect(vscodeOpenSchema.safeParse({ device: 'x', folder }).success).toBe(false);
    expect(vscodeOpenSchema.safeParse({ device, folder, cardKey: 'not a key' }).success).toBe(false);
  });
});

describe('chatToMarkdown', () => {
  it('writes the facts and the words, and nothing the chat does not have', () => {
    const text = chatToMarkdown({
      id: 'c',
      deviceId: 'd',
      deviceName: 'PC',
      deviceOnline: true,
      deviceRevoked: false,
      folder: 'C:/x',
      branch: null,
      mode: 'ask',
      model: null,
      effort: null,
      sessionId: null,
      title: 'Title',
      pinned: false,
      parentChatId: null,
      parentMessageId: null,
      running: false,
      lastSeq: 0,
      createdAt: '2026-11-06T00:00:00Z',
      updatedAt: '2026-11-06T00:00:00Z',
      deletedAt: null,
      messages: [],
    });
    expect(text).toContain('# Title');
    expect(text).not.toContain('Branch');
    expect(text).not.toContain('Session');
  });
});
