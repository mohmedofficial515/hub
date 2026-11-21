import { describe, expect, it } from 'vitest';

import {
  effortOf,
  fitStepTitle,
  isPlanStudioChat,
  latestTextPlan,
  planIdeaKey,
  planPrompt,
  planWords,
  rolesOf,
} from './plan-studio';
import { actOf, discoveryOf, isPlumbing, projectPath } from './studio-acts';

describe('actOf', () => {
  it('names a Hub step by what it did, and keeps a card key for a chip', () => {
    expect(actOf('mcp__hub__get_card', { key: 'GTV-9' })).toEqual({
      where: 'hub',
      key: 'card',
      subject: 'GTV-9',
      card: 'GTV-9',
    });
    expect(actOf('mcp__hub__list_cards', '{"q":"refund"}')).toMatchObject({
      where: 'hub',
      key: 'cards',
      subject: 'refund',
    });
  });

  it('reads both studios’ reports as the report stage', () => {
    expect(actOf('mcp__hub__propose_idea', { title: 'A' }).where).toBe('report');
    expect(actOf('mcp__hub__propose_plan', { title: 'B' })).toMatchObject({ where: 'report', subject: 'B' });
  });

  it('keeps a Read’s file inside the project, without the drive', () => {
    const act = actOf('Read', { file_path: 'F:\\Goteav\\backend\\src\\modules\\payments\\refund.entity.ts' });
    expect(act).toMatchObject({ where: 'code', key: 'read', subject: 'payments/refund.entity.ts' });
    expect(act.file).toBe('backend/src/modules/payments/refund.entity.ts');
  });

  it('links a page it opened by its host', () => {
    expect(actOf('WebFetch', { url: 'https://www.stripe.com/docs/refunds' })).toMatchObject({
      where: 'web',
      subject: 'stripe.com',
      href: 'https://www.stripe.com/docs/refunds',
    });
  });

  it('survives input that is not JSON', () => {
    expect(actOf('Grep', '{broken')).toMatchObject({ key: 'grep', subject: '' });
  });
});

describe('projectPath', () => {
  it('keeps the repository folder before src', () => {
    expect(projectPath('F:/Goteav/web/src/features/account/trip/money-records.tsx')).toBe(
      'web/src/features/account/trip/money-records.tsx',
    );
  });
  it('leaves a relative path alone', () => {
    expect(projectPath('src/app/page.tsx')).toBe('src/app/page.tsx');
  });
});

describe('discoveryOf', () => {
  it('collects each card, file and page once, and leaves plumbing out of the counts', () => {
    const found = discoveryOf([
      { name: 'ToolSearch', input: {} },
      { name: 'mcp__hub__report_stage', input: {} },
      { name: 'mcp__hub__get_card', input: { key: 'GTV-3' } },
      { name: 'mcp__hub__get_card', input: { key: 'GTV-3' } },
      { name: 'Read', input: { file_path: '/repo/web/src/a.ts' } },
      { name: 'Grep', input: { pattern: 'refund' } },
      { name: 'WebSearch', input: { query: 'refund tracker' } },
      { name: 'WebFetch', input: { url: 'https://docs.stripe.com/x' } },
    ]);
    expect(found.cards).toEqual(['GTV-3']);
    expect(found.files).toEqual(['web/src/a.ts']);
    expect(found.searches).toEqual(['refund']);
    expect(found.webSearches).toEqual(['refund tracker']);
    expect(found.pages).toEqual([{ host: 'docs.stripe.com', href: 'https://docs.stripe.com/x' }]);
    expect(found.counts).toEqual({ hub: 2, code: 2, web: 2 });
    expect(isPlumbing('ToolSearch')).toBe(true);
  });
});

describe('the Plan Studio prompt', () => {
  it('names the idea it starts from, and the page reads it back', () => {
    const prompt = planPrompt('  ship it in May ', 'GTV-12');
    expect(prompt).toBe('/hub:plan GTV-12 ship it in May');
    expect(planIdeaKey(prompt)).toBe('GTV-12');
    expect(planWords(prompt)).toBe('ship it in May');
  });
  it('has no idea key when it starts from words', () => {
    expect(planIdeaKey(planPrompt('a topic'))).toBeNull();
  });
});

describe('a plan’s shape', () => {
  const plan = {
    title: 'P',
    steps: [
      { title: 'a', role: 'backend', size: 'M' as const },
      { title: 'b', role: 'backend', size: 'S' as const },
      { title: 'c', role: 'designer' },
      { title: 'd', role: 'astronaut', size: 'L' as const },
    ],
  };
  it('counts steps by role, the busiest first, and unknown roles apart', () => {
    expect(rolesOf(plan)).toEqual([
      { role: 'backend', steps: 2 },
      { role: 'designer', steps: 1 },
      { role: null, steps: 1 },
    ]);
  });
  it('weighs the sized steps only', () => {
    expect(effortOf(plan)).toEqual({ points: 12, sized: 3 });
  });
});

describe('fitStepTitle', () => {
  it('keeps a title that fits as it is', () => {
    expect(fitStepTitle('  short  title ')).toBe('short title');
  });
  it('ends a long one at its last clause that fits, with an ellipsis', () => {
    const long = `${'a'.repeat(120)}، ${'b'.repeat(60)}، ${'c'.repeat(60)}`;
    const fit = fitStepTitle(long);
    expect(fit).toBe(`${'a'.repeat(120)}، ${'b'.repeat(60)}…`);
    expect(fit.length).toBeLessThanOrEqual(200);
  });
  it('never cuts inside a word', () => {
    const fit = fitStepTitle('word '.repeat(60));
    expect(fit.endsWith('word…')).toBe(true);
    expect(fit.length).toBeLessThanOrEqual(200);
  });
});

describe('isPlanStudioChat', () => {
  const msg = (role: 'user' | 'assistant', content: string, extra: Record<string, unknown> = {}) =>
    ({ id: `${role}-${content}`, role, content, plan: null, structuredPlan: null, ...extra }) as never;

  it('takes a chat that started with the planning command, or any chat whose reply proposed a plan', () => {
    expect(isPlanStudioChat({ messages: [msg('user', '/hub:plan hotels')] })).toBe(true);
    expect(
      isPlanStudioChat({
        messages: [msg('user', 'Plan hotels'), msg('assistant', '…', { plan: '# Hotels' })],
      }),
    ).toBe(true);
    expect(isPlanStudioChat({ messages: [msg('user', 'Hello'), msg('assistant', 'Hi')] })).toBe(false);
  });

  it('finds the latest plan written as words, and none once a structured plan came after it', () => {
    const words = { messages: [msg('user', 'Plan'), msg('assistant', 'a', { plan: '# One' })] };
    expect(latestTextPlan(words)).toEqual({ text: '# One', messageId: 'assistant-a' });
    const structured = {
      messages: [...words.messages, msg('assistant', 'b', { structuredPlan: { title: 'Two', steps: [] } })],
    };
    expect(latestTextPlan(structured)).toBeNull();
  });
});
