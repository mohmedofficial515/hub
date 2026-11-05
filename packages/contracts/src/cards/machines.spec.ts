/**
 * @file Every listed transition is allowed, every other pair is refused (docs/12 H0-01).
 */
import { describe, expect, it } from 'vitest';

import { canTransition, CARD_MACHINES, CARD_TYPES, type CardType, transitionPairs } from './index';

const EXPECTED: Record<CardType, string[]> = {
  task: [
    'backlog>ready',
    'ready>backlog',
    'backlog>claimed',
    'ready>claimed',
    'claimed>ready',
    'in_progress>ready',
    'claimed>in_progress',
    'in_progress>in_review',
    'in_review>in_progress',
    'backlog>done',
    'ready>done',
    'claimed>done',
    'in_progress>done',
    'in_review>done',
    'backlog>cancelled',
    'ready>cancelled',
    'claimed>cancelled',
    'in_progress>cancelled',
    'in_review>cancelled',
    'done>ready',
    'cancelled>ready',
  ],
  decision: ['open>decided', 'open>withdrawn', 'open>superseded', 'decided>superseded'],
  need: [
    'requested>in_progress',
    'requested>delivered',
    'in_progress>delivered',
    'delivered>verified',
    'delivered>in_progress',
    'requested>cancelled',
    'in_progress>cancelled',
    'delivered>cancelled',
  ],
  handoff: [
    'pending>acknowledged',
    'pending>applied',
    'acknowledged>applied',
    'pending>dismissed',
    'acknowledged>dismissed',
  ],
  redesign: ['draft>review', 'review>approved', 'review>rejected', 'review>review', 'approved>ported'],
  change: [],
  doc: ['current>stale', 'stale>current', 'removed>current', 'current>removed', 'stale>removed'],
  release: ['planned>released'],
  idea: [
    'open>exploring',
    'open>accepted',
    'exploring>accepted',
    'open>parked',
    'exploring>parked',
    'open>rejected',
    'exploring>rejected',
    'parked>open',
    'rejected>open',
  ],
  plan: [
    'draft>in_review',
    'in_review>approved',
    'approved>in_progress',
    'draft>in_progress',
    'in_review>in_progress',
    'in_progress>in_progress',
    'in_progress>done',
    'draft>abandoned',
    'in_review>abandoned',
    'approved>abandoned',
    'in_progress>abandoned',
    'done>abandoned',
  ],
};

describe.each(CARD_TYPES)('%s machine', (type) => {
  const machine = CARD_MACHINES[type];

  it('allows exactly the listed pairs and refuses every other', () => {
    const expected = new Set(EXPECTED[type]);
    for (const from of machine.statuses) {
      for (const to of machine.statuses) {
        expect([`${from}>${to}`, canTransition(machine, from, to)]).toEqual([
          `${from}>${to}`,
          expected.has(`${from}>${to}`),
        ]);
      }
    }
    expect(
      transitionPairs(machine)
        .map(([from, to]) => `${from}>${to}`)
        .sort(),
    ).toEqual([...expected].sort());
  });

  it('starts in a known status and only names known statuses', () => {
    expect(machine.statuses).toContain(machine.initial);
    for (const status of machine.terminal) expect(machine.statuses).toContain(status);
  });
});
