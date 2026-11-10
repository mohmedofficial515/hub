/**
 * @file Structured results' pure parts: a plan as words, flags applied to a draft, and the line diff.
 */
import { describe, expect, it } from 'vitest';

import {
  applyClaimAnswers,
  cleanPlan,
  lineDiff,
  openFlags,
  planToMarkdown,
  planToPrompt,
} from './chat-results';

const claim = (text: string, answer: 'confirm' | 'remove' | 'keep_flagged' | null, status = 'unverified') =>
  ({ id: text, text, status, source: null, answer }) as Parameters<typeof applyClaimAnswers>[1][number];

describe('a plan as words', () => {
  const plan = {
    title: 'Add a README',
    steps: [{ title: 'Write it', role: 'backend', why: 'Nobody knows how to start' }, { title: 'Link it' }],
    checks: ['pnpm check'],
    risks: ['It goes stale'],
  };

  it('has its steps in order, with checks and risks', () => {
    expect(planToMarkdown(plan)).toBe(
      '# Add a README\n\n1. Write it (backend): Nobody knows how to start\n2. Link it\n\n## Checks\n\n- pnpm check\n\n## Risks\n\n- It goes stale',
    );
  });

  it('leaves out what is not there', () => {
    expect(planToMarkdown({ title: 'T', steps: [{ title: 'S' }] })).toBe('# T\n\n1. S');
  });

  it('Run this plan says to run its checks', () => {
    expect(planToPrompt(plan)).toContain('run its checks');
    expect(planToPrompt(plan)).toContain('1. Write it');
  });
});

describe('flags', () => {
  it('only an unanswered unverified claim is open', () => {
    expect(
      openFlags([
        claim('a', null),
        claim('b', 'confirm'),
        claim('c', null, 'verified'),
        claim('d', 'keep_flagged'),
      ]).map((item) => item.text),
    ).toEqual(['a']);
  });

  const TEXT = 'First line.\nThe limit is 40 a minute.\nLast line.\n';

  it('remove takes the claim out, and its line when it stood alone', () => {
    expect(applyClaimAnswers(TEXT, [claim('The limit is 40 a minute.', 'remove')])).toBe(
      'First line.\nLast line.\n',
    );
    expect(applyClaimAnswers('It is fast. The limit is 40.\n', [claim('The limit is 40.', 'remove')])).toBe(
      'It is fast.\n',
    );
  });

  it('remove takes a marked claim out whole', () => {
    expect(applyClaimAnswers('Top\n> Unverified: Forty, ask ops\nEnd\n', [claim('Forty', 'remove')])).toBe(
      'Top\nEnd\n',
    );
  });

  it('confirm keeps it as fact, and drops the mark if it wore one', () => {
    expect(applyClaimAnswers(TEXT, [claim('The limit is 40 a minute.', 'confirm')])).toBe(TEXT);
    expect(applyClaimAnswers('> Unverified: Forty a minute\n', [claim('Forty a minute', 'confirm')])).toBe(
      'Forty a minute\n',
    );
  });

  it('keep_flagged marks it in the text, once', () => {
    const once = applyClaimAnswers(TEXT, [claim('The limit is 40 a minute.', 'keep_flagged')]);
    expect(once).toBe('First line.\n> Unverified: The limit is 40 a minute.\nLast line.\n');
    expect(applyClaimAnswers(once, [claim('The limit is 40 a minute.', 'keep_flagged')])).toBe(once);
  });

  it('a verified claim and an unanswered flag change nothing, and neither do words the owner already edited out', () => {
    expect(applyClaimAnswers(TEXT, [claim('Last line.', 'remove', 'verified')])).toBe(TEXT);
    expect(applyClaimAnswers(TEXT, [claim('Last line.', null)])).toBe(TEXT);
    expect(applyClaimAnswers(TEXT, [claim('Not there at all', 'keep_flagged')])).toBe(TEXT);
    expect(applyClaimAnswers(TEXT, [claim('Not there at all', 'remove')])).toBe(TEXT);
  });
});

describe('the line diff', () => {
  it('a new document is all added', () => {
    expect(lineDiff(null, 'a\nb')).toEqual([
      { kind: 'added', text: 'a' },
      { kind: 'added', text: 'b' },
    ]);
  });

  it('shows a changed line among unchanged ones', () => {
    expect(lineDiff('a\nb\nc', 'a\nB\nc')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'removed', text: 'b' },
      { kind: 'added', text: 'B' },
      { kind: 'same', text: 'c' },
    ]);
  });

  it('finds what stayed in the middle of bigger changes', () => {
    const lines = lineDiff('x\nkeep\ny', 'keep\nz\nw');
    expect(lines.filter((line) => line.kind === 'same').map((line) => line.text)).toEqual(['keep']);
    expect(lines.filter((line) => line.kind === 'added').map((line) => line.text)).toEqual(['z', 'w']);
    expect(lines.filter((line) => line.kind === 'removed').map((line) => line.text)).toEqual(['x', 'y']);
  });

  it('a very large rewrite stays cheap, and keeps both sides', () => {
    const before = Array.from({ length: 3_000 }, (_, index) => `old ${index}`).join('\n');
    const after = Array.from({ length: 3_000 }, (_, index) => `new ${index}`).join('\n');
    const lines = lineDiff(before, after);
    expect(lines).toHaveLength(6_000);
  });
});

describe('a Plan Studio plan', () => {
  const plan = {
    title: 'Refund tracker',
    goal: 'Customers see where their money is.',
    approach: 'Four stages over the existing states.',
    steps: [
      { title: 'Map states', role: 'pm', size: 'S' as const },
      { title: 'Store transitions', role: 'backend', size: 'M' as const, after: [1, 1, 3, 9] },
    ],
    outOfScope: ['Guests'],
    questions: ['Which channels?'],
    diagram: {
      nodes: [
        { id: 'a', label: 'Customer' },
        { id: 'b', label: 'Refund' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'ghost' },
      ],
    },
    sources: [{ title: 'Stripe', url: 'https://docs.stripe.com/refunds' }],
  };

  it('keeps each step after earlier steps only, and edges between nodes that exist', () => {
    const clean = cleanPlan(plan);
    expect(clean.steps[1]?.after).toEqual([1]);
    expect(clean.diagram?.edges).toEqual([{ from: 'a', to: 'b' }]);
  });

  it('writes the goal, the approach and the new lists into the text', () => {
    const text = planToMarkdown(cleanPlan(plan));
    expect(text).toContain('## Goal');
    expect(text).toContain('2. Store transitions (backend) [M] (after 1)');
    expect(text).toContain('## Out of scope');
    expect(text).toContain('## Open questions');
    expect(text).toContain('- Customer → Refund');
    expect(text).toContain('1. [Stripe](https://docs.stripe.com/refunds)');
  });
});
