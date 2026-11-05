/**
 * @file Release: status machine (docs/01 §4.1, docs/04 §3.20).
 */
import { defineMachine } from './machine';

export const RELEASE_STATUSES = ['planned', 'released'] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const RELEASE_MACHINE = defineMachine<ReleaseStatus>({
  statuses: RELEASE_STATUSES,
  initial: 'planned',
  terminal: ['released'],
  transitions: {
    release: { from: ['planned'], to: 'released' },
  },
});
