import { describe, expect, it } from 'vitest';

import { answersOf, appliedOf } from './conversation';

const PROMPT = 'My answers to your open questions. Send the whole report:';

describe('a message the page sent, read back', () => {
  it('reads answers to the report’s questions as pairs', () => {
    const text = `${PROMPT}\n- Guests too?\n  → Yes, through the booking link\n- Which range?\n  → 5 to 10 business days`;
    expect(answersOf(text, PROMPT)).toEqual([
      { q: 'Guests too?', a: 'Yes, through the booking link' },
      { q: 'Which range?', a: '5 to 10 business days' },
    ]);
  });

  it('leaves the owner’s own words alone', () => {
    expect(answersOf('Make it simpler', PROMPT)).toBeNull();
    expect(appliedOf('Make it simpler', 'Apply «{title}». Keep the rest.')).toBeNull();
  });

  it('reads an applied suggestion back by its title', () => {
    expect(appliedOf('Apply «Four stages». Keep the rest.', 'Apply «{title}». Keep the rest.')).toBe(
      'Four stages',
    );
  });
});
