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

  it('writes evidence on the card and never completes the task', () => {
    expect(text).toContain('hub.comment');
    for (const part of ['What changed', 'Files', 'Checks run', 'Not checked']) expect(text).toContain(part);
    expect(text).toContain('Never call `hub.complete_task`');
  });

  it('stops at a failed check, and shows real output', () => {
    expect(text).toContain('A failed check stops here');
    expect(text).toContain('Never report a check you did not run');
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

  it('saves on approval with the version it read, and invents nothing', () => {
    expect(text).toContain('hub.save_doc');
    expect(text).toContain('baseHash');
    expect(text).toContain('Nothing invented');
    expect(text).toContain('Unverified');
    expect(text).toContain('Only when I agree');
  });
});
