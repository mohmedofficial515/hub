/**
 * @file Redesign: status machine, mirrors the lab front-matter (docs/01 §4.1, docs/10 §4).
 * @description `reference` is the v1-baseline: it has no moves. request_changes stays in `review`
 * (docs/01 and docs/10), and docs/04 §3.14 is corrected to match.
 */
import { defineMachine } from './machine';

export const REDESIGN_STATUSES = ['draft', 'review', 'approved', 'rejected', 'ported', 'reference'] as const;
export type RedesignStatus = (typeof REDESIGN_STATUSES)[number];

export const REDESIGN_MACHINE = defineMachine<RedesignStatus>({
  statuses: REDESIGN_STATUSES,
  initial: 'draft',
  terminal: ['rejected', 'ported', 'reference'],
  transitions: {
    send_to_review: { from: ['draft'], to: 'review' },
    approve: { from: ['review'], to: 'approved' },
    reject: { from: ['review'], to: 'rejected' },
    request_changes: { from: ['review'], to: 'review' },
    mark_ported: { from: ['approved'], to: 'ported' },
  },
});
