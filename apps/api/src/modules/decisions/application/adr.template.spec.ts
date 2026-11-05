/**
 * @file ADR skeleton golden files (docs/07 §6.5).
 */
import { expectGolden } from '../../../../test/golden';
import { type AdrData, renderAdr } from './adr.template';

const data: AdrData = {
  key: 'GTV-231',
  title: 'Which payment provider',
  decidedDate: '2026-11-05',
  deciderRole: 'owner',
  decidedBy: 'Mohmed',
  hubUrl: 'http://localhost:7300/ar/goteav/cards/GTV-231',
  question: 'Which provider handles refunds?',
  body: 'We need refunds in Turkey.',
  options: [
    { title: 'Provider A', pros: ['Cheap', 'Local'], cons: ['Slow'], chosen: true },
    { title: 'Provider B', pros: [], cons: ['Expensive'], chosen: false },
  ],
  rationale: 'It works in Turkey.',
  unblocked: [{ key: 'GTV-240', title: 'Refund button' }],
};

describe('renderAdr', () => {
  it.each(['en', 'ar'] as const)('%s', (locale) => {
    expectGolden(`adr.${locale}.md`, renderAdr(data, locale));
  });

  it('leaves out a missing body and shortens a long one', () => {
    expect(renderAdr({ ...data, body: null }, 'en')).not.toContain('We need refunds');
    expect(renderAdr({ ...data, body: 'x'.repeat(1000) }, 'en')).toContain(`${'x'.repeat(800)}…`);
  });
});
