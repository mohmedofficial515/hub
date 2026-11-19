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

/** Hub's own protocols. Skills the owner adds on the Skills page live beside them and keep their own words (D64, D65). */
const CORE = ['ask', 'doc', 'done', 'guide', 'idea', 'next', 'plan', 'start', 'suggest', 'work'];

describe('the skills', () => {
  const names = readdirSync(SKILLS).filter((name) => CORE.includes(name));

  it('the core ones are all there', () => {
    expect(names.sort()).toEqual([...CORE].sort());
  });

  it("an owner's skill names itself and says when to use it", () => {
    for (const name of readdirSync(SKILLS).filter((entry) => !CORE.includes(entry))) {
      const head = frontMatter(skill(name));
      expect([name, head]).toEqual([name, expect.stringContaining(`name: ${name}`)]);
      expect([name, head]).toEqual([name, expect.stringMatching(/^description: \S/m)]);
    }
  });

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

  it('fixes a mechanical failure of its own change without asking, asks before anything wider, and a fix keeps the failure', () => {
    expect(text).toContain("A mechanical failure in this task's own change");
    expect(text).toContain('without asking. At most two attempts');
    expect(text).toContain('Never report a check you did not run');
    expect(text).toContain('AskUserQuestion');
    expect(text).toContain('the failure stays in the history');
    expect(text.indexOf('**A failed check.**')).toBeLessThan(text.indexOf('(`report`)'));
  });

  it('runs each check word for word, since Hub matches the command', () => {
    expect(text).toContain('word for word');
  });
});

/** These three were MCP prompts only, and no Claude Code a member uses ever ran them (see packages/contracts/src/mcp/prompts.ts). */
describe('/hub:start, /hub:next and /hub:done', () => {
  it('are typed by a person', () => {
    for (const name of ['start', 'next', 'done']) {
      expect([name, frontMatter(skill(name))]).toEqual([
        name,
        expect.stringContaining('user-invocable: true'),
      ]);
    }
  });

  it('/hub:start reports what awaits, offers the missing summaries, and never saves the brief unasked', () => {
    const text = skill('start');
    for (const tool of ['get_project_brief', 'whats_new', 'list_my_sessions_without_summary']) {
      expect(text).toContain(`hub.${tool}`);
    }
    expect(text).toContain('hub://brief/today');
    expect(text).toContain('Save it only if I agree');
    expect(text).toContain('/hub:next');
  });

  it('/hub:start does not call Hub unreachable while its server is still connecting', () => {
    expect(skill('start')).toContain('may still be connecting');
  });

  it('/hub:next takes the key as its argument, claims before editing, and stops on a blocker', () => {
    const text = skill('next');
    expect(frontMatter(text)).toContain("argument-hint: '[card key]'");
    expect(text).toContain('$ARGUMENTS');
    expect(text.indexOf('hub.claim_task')).toBeLessThan(text.indexOf('hub.start_task'));
    expect(text).toContain('"blocked by"');
    expect(text).toContain('rule about asking before creating branches');
    expect(text).toContain('/hub:done');
  });

  it('/hub:done logs the session with the id from the session context, and never skips it', () => {
    const text = skill('done');
    expect(text).toContain('hub.log_session');
    expect(text).toContain('"Hub session id"');
    expect(text).toContain('do not skip step 3');
    expect(text.indexOf('hub.log_session')).toBeLessThan(text.indexOf('hub.submit_task'));
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

describe('/hub:suggest', () => {
  const text = skill('suggest');

  it('is typed by a person, and keeps to a focus when given one', () => {
    expect(frontMatter(text)).toContain('user-invocable: true');
    expect(text).toContain('$ARGUMENTS');
  });

  it('reads only, through Hub, and creates nothing', () => {
    expect(text).toContain('**Read only.**');
    for (const tool of [
      'get_project_brief',
      'list_tasks',
      'list_plans',
      'get_plan',
      'list_queue',
      'list_skills',
    ]) {
      expect(text).toContain(`hub.${tool}`);
    }
    // It names the create tools only to forbid them, before it ever proposes.
    expect(text.indexOf('no `hub.create_task`')).toBeLessThan(text.indexOf('hub.propose_suggestions'));
    expect(text).not.toMatch(/hub\.(update|claim|start|complete|delete)_/);
  });

  it('proposes structured tasks, plans and skills, and stops for the owner', () => {
    expect(text).toContain('hub.propose_suggestions(summary, items)');
    for (const kind of ['kind: task', 'kind: plan', 'kind: skill']) expect(text).toContain(kind);
    expect(text).toContain('I accept or dismiss each one');
  });

  it('checks what exists first, and invents nothing', () => {
    expect(text).toContain('Never propose what already exists');
    expect(text).toContain('Nothing invented');
    expect(text.indexOf('hub.list_skills')).toBeLessThan(text.indexOf('hub.propose_suggestions'));
  });
});
