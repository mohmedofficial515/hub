/**
 * @file Decision: status machine (docs/01 §4.1, docs/04 §3.11). Flags `overdue` and `escalated` are derived.
 */
import { defineMachine } from './machine';

export const DECISION_STATUSES = ['open', 'decided', 'withdrawn', 'superseded'] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const DECISION_KINDS = ['product', 'technical', 'financial', 'design'] as const;

export const DECISION_MACHINE = defineMachine<DecisionStatus>({
  statuses: DECISION_STATUSES,
  initial: 'open',
  terminal: ['decided', 'withdrawn', 'superseded'],
  transitions: {
    decide: { from: ['open'], to: 'decided' },
    withdraw: { from: ['open'], to: 'withdrawn' },
    // docs/01 lists open, docs/04 lists decided; both are real situations.
    supersede: { from: ['open', 'decided'], to: 'superseded' },
  },
});
