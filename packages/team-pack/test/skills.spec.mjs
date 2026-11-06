/**
 * @file The plugin's skills: the two protocols of docs/16 §7.1 say what they must, and every Hub tool a skill names exists.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SKILLS = join(import.meta.dirname, '..', 'plugin', 'skills');
const skill = (name) => readFileSync(join(SKILLS, name, 'SKILL.md'), 'utf8');
const toolTable = readFileSync(
  join(import.meta.dirname, '..', '..', 'contracts', 'src', 'mcp', 'tools.ts'),
  'utf8',
);
const TOOLS = new Set([...toolTable.matchAll(/^ {2}(\w+): \{$/gm)].map((match) => match[1]));
const frontMatter = (text) => /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';

describe('the skills', () => {
  const names = readdirSync(SKILLS);

  it('name themselves, and only name tools that exist', () => {
    expect(TOOLS.size).toBeGreaterThan(50);
    for (const name of names) {
      const text = skill(name);
      expect(frontMatter(text)).toContain(`name: ${name}`);
      for (const [, tool] of text.matchAll(/`hub\.(\w+)/g)) {
        expect([name, tool, TOOLS.has(tool)]).toEqual([name, tool, true]);
      }
    }
  });

  it('every one a person starts keeps the no-secrets rule', () => {
    for (const name of names) {
      const text = skill(name);
      if (frontMatter(text).includes('user-invocable: true')) expect(text).toMatch(/Never send a secret/);
    }
  });
});

describe('/hub:work', () => {
  const text = skill('work');

  it('is started with a card, and reports each stage for the live checklist', () => {
    expect(frontMatter(text)).toContain('user-invocable: true');
    expect(text).toContain('$ARGUMENTS');
    expect(text).toContain('hub.report_stage');
    for (const stage of ['understand', 'plan', 'execute', 'verify', 'report']) {
      expect(text).toContain(`(\`${stage}\`)`);
    }
  });

  it('reports through report_work, with no Markdown comment, and never completes the task', () => {
    expect(text).toContain('hub.report_work');
    expect(text).not.toContain('hub.comment');
    for (const part of ['summary', 'checks', 'changedFiles', 'notChecked']) expect(text).toContain(part);
    expect(text).toContain('Never call `hub.complete_task`');
  });

  it("says out loud that it starts the task, and that the move is Hub's (review B2, D52)", () => {
    expect(text).toContain('What this does to the card');
    expect(text).toContain('Starting the task now');
    expect(text).toContain('Hub moves the task to In review by itself');
    expect(text).toContain('Outside the panel it never moves');
  });

  it('stops at a failed check, asks, and a fix keeps the failure', () => {
    expect(text).toContain('A failed check stops here');
    expect(text).toContain('Never report a check you did not run');
    expect(text).toContain('AskUserQuestion');
    expect(text).toContain('the failure stays in the history');
    expect(text.indexOf('A failed check stops here')).toBeLessThan(text.indexOf('(`report`)'));
  });

  it('runs each check word for word, since Hub matches the command', () => {
    expect(text).toContain('word for word');
  });
});

describe('/hub:doc', () => {
  const text = skill('doc');

  it('has the five stages, and searches before writing', () => {
    for (const stage of ['search', 'propose', 'draft', 'save', 'link']) {
      expect(text).toContain(`(\`${stage}\`)`);
    }
    expect(text.indexOf('hub.search_docs')).toBeLessThan(text.indexOf('hub.save_doc'));
    expect(text).toContain('Never start a new document before searching');
  });

  it('proposes with flagged claims, saves through the draft, and invents nothing', () => {
    expect(text).toContain('hub.propose_doc');
    expect(text.indexOf('hub.propose_doc')).toBeLessThan(text.indexOf('hub.save_doc'));
    expect(text).toContain('baseVersion');
    expect(text).toContain('Nothing invented');
    expect(text).toContain('unverified');
    expect(text).toContain('`draft` id');
    expect(text).toContain('refuses while a flag has no answer');
  });
});
