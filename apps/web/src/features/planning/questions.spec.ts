import { describe, expect, it } from 'vitest';

import { answersOf } from '@/components/planning/studio/conversation';

import { answersMessage, emptyAnswer, isAnswered, questionsOf, toggle, withRecommended } from './questions';

const [single, multi, open] = questionsOf([
  {
    text: 'Which provider?',
    options: [{ label: 'LiteAPI' }, { label: 'Hotelbeds' }],
    recommended: 0,
    why: 'Keys at once',
  },
  { text: 'Who sees it?', options: [{ label: 'Staff' }, { label: 'Customers' }], multi: true },
  'Any deadline?',
]);

describe('answering a question', () => {
  it('keeps one pick on a single-answer question, and closes Other', () => {
    let a = toggle(single!, emptyAnswer(), 'other');
    a = toggle(single!, a, 1);
    a = toggle(single!, a, 0);
    expect(a).toMatchObject({ picks: [0], other: false });
  });

  it('keeps several picks on a multi-answer question, and Other beside them', () => {
    let a = toggle(multi!, emptyAnswer(), 1);
    a = toggle(multi!, a, 0);
    a = toggle(multi!, a, 'other');
    expect(a).toMatchObject({ picks: [0, 1], other: true });
    expect(toggle(multi!, a, 1).picks).toEqual([0]);
  });

  it('counts Other only when it has words', () => {
    const a = toggle(open!, emptyAnswer(), 'other');
    expect(isAnswered(a)).toBe(false);
    expect(isAnswered({ ...a, otherText: ' soon ' })).toBe(true);
  });

  it('takes the recommendation only where nothing was answered', () => {
    expect(withRecommended(single!, undefined)?.picks).toEqual([0]);
    const mine = toggle(single!, emptyAnswer(), 1);
    expect(withRecommended(single!, mine)).toBe(mine);
    expect(withRecommended(multi!, undefined)).toBeUndefined();
  });

  it('drops a recommendation that points past the options', () => {
    expect(questionsOf([{ text: 'Q', options: [{ label: 'A' }], recommended: 3 }])[0]!.recommended).toEqual(
      [],
    );
  });

  it('reads options as plain labels, and a recommendation by its label, several on a multi-answer question', () => {
    const [q] = questionsOf([
      {
        text: 'Q',
        options: ['A', 'B', { label: 'C', detail: 'c' }],
        recommended: ['C', 'A', 'Z'],
        multi: true,
      },
    ]);
    expect(q!.options).toEqual([{ label: 'A' }, { label: 'B' }, { label: 'C', detail: 'c' }]);
    expect(q!.recommended).toEqual([2, 0]);
    expect(withRecommended(q!, undefined)?.picks).toEqual([0, 2]);
    expect(
      questionsOf([{ text: 'Q', options: ['A', 'B'], recommended: ['B', 'A'] }])[0]!.recommended,
    ).toEqual([1]);
  });
});

describe('the answers message', () => {
  it('writes each answered question with its picks, notes and own words, and the conversation reads it back', () => {
    const answers = {
      0: { ...toggle(single!, emptyAnswer(), 0), notes: { 0: 'sandbox first' } },
      1: { picks: [0, 1], notes: {}, other: true, otherText: 'and partners\nlater' },
      2: { ...emptyAnswer(), other: true, otherText: 'End of May' },
    };
    const text = answersMessage('My answers:', [single!, multi!, open!], answers, 'Other');
    expect(text).toBe(
      'My answers:\n- Which provider?\n  → LiteAPI (sandbox first)\n- Who sees it?\n  → Staff؛ Customers؛ Other: and partners later\n- Any deadline?\n  → End of May',
    );
    expect(answersOf(text!, 'My answers:')).toHaveLength(3);
  });

  it('is nothing when nothing is answered', () => {
    expect(answersMessage('P', [single!], {}, 'Other')).toBeNull();
  });
});
