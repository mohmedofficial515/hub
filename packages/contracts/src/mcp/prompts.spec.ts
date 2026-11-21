/**
 * @file The three prompts a person types through a team-pack skill of the same name: the skill and the prompt must ask for the same Hub tools.
 * @description A person types `/hub:start`, `/hub:next` and `/hub:done` through the skills, because Claude Code in VS Code and in the Hub panel lists
 * no MCP prompt as a command (see prompts.ts). The prompts stay for other clients. Two texts for one command drift, so a change to one fails here until
 * the other follows.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { isCoreSkill } from '../skills';
import { MCP_PROMPTS } from './prompts';

const SKILLS = resolve(__dirname, '../../../team-pack/plugin/skills');
const CONTEXT = { displayName: 'A', roles: ['owner'], project: 'p' };
const TWINS = ['start', 'next', 'done'] as const;

const toolsIn = (text: string): string[] =>
  [...new Set([...text.matchAll(/hub\.(\w+)/g)].map((match) => match[1] ?? ''))].sort();

describe('the prompts typed through skills', () => {
  it.each(TWINS)('/hub:%s names the same Hub tools in the skill as in the prompt', (name) => {
    const prompt = MCP_PROMPTS.find((entry) => entry.name === name);
    expect(prompt).toBeDefined();
    // With a key and without one, since `next` asks for a different tool in each case and the skill covers both.
    const rendered = `${prompt?.render(CONTEXT, { key: 'GTV-1' })}\n${prompt?.render(CONTEXT, {})}`;
    const skill = readFileSync(join(SKILLS, name, 'SKILL.md'), 'utf8');
    expect(toolsIn(skill)).toEqual(toolsIn(rendered));
  });

  it.each(TWINS)('/hub:%s is a core skill a person can type, so no owner skill can take its name', (name) => {
    expect(isCoreSkill(name)).toBe(true);
    expect(readFileSync(join(SKILLS, name, 'SKILL.md'), 'utf8')).toMatch(/^user-invocable: true\r?$/m);
  });
});
