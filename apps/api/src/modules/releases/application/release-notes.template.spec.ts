/**
 * @file Release notes golden files, per audience and language (docs/07 §6.3).
 */
import { expectGolden } from '../../../../test/golden';
import { type ReleaseNoteCard, renderReleaseNotes } from './release-notes.template';

const card = (overrides: Partial<ReleaseNoteCard>): ReleaseNoteCard => ({
  key: 'GTV-1',
  title: 'A card',
  type: 'task',
  status: 'done',
  priority: 'P2',
  ownerRole: null,
  module: null,
  tags: [],
  ...overrides,
});

const included: readonly ReleaseNoteCard[] = [
  card({ key: 'GTV-10', title: 'Refund button', priority: 'P1', module: 'wallet', prUrl: 'https://pr/10' }),
  card({ key: 'GTV-11', title: 'Small fix', priority: 'P3' }),
  card({ key: 'GTV-12', title: 'Sync client', type: 'handoff', status: 'applied', tags: ['finance'] }),
  card({
    key: 'GTV-13',
    title: 'Provider',
    type: 'decision',
    status: 'decided',
    kind: 'financial',
    chosenOption: 'Provider A',
  }),
  card({ key: 'GTV-14', title: 'Wallet page', type: 'redesign', status: 'ported' }),
  card({ key: 'GTV-15', title: 'Merged PR', type: 'change', status: 'merged', prUrl: 'https://pr/15' }),
  card({ key: 'GTV-16', title: 'Tax rate', type: 'need', status: 'verified', kind: 'value_check' }),
];

const open: readonly ReleaseNoteCard[] = [
  card({ key: 'GTV-20', title: 'Pick a bank', type: 'decision', status: 'open', ownerRole: 'owner' }),
  card({ key: 'GTV-21', title: 'VAT number', type: 'need', status: 'delivered', ownerRole: 'accountant' }),
];

describe('renderReleaseNotes', () => {
  describe.each(['en', 'ar'] as const)('%s', (locale) => {
    it.each(['team', 'owner', 'accountant'] as const)('%s', (audience) => {
      expectGolden(`release-${audience}.${locale}.md`, renderReleaseNotes(audience, included, open, locale));
    });

    it('an audience with nothing says so', () => {
      expectGolden(`release-empty.${locale}.md`, renderReleaseNotes('accountant', [], [], locale));
    });
  });

  it('an empty section is left out', () => {
    const text = renderReleaseNotes('team', [included[0] as ReleaseNoteCard], [], 'en');
    expect(text).toContain('### Tasks done');
    expect(text).not.toContain('### Decisions');
  });
});
