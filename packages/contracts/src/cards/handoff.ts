/**
 * @file Handoff: status machine (docs/01 §4.1, docs/04 §3.13, D25).
 */
import { defineMachine } from './machine';

export const HANDOFF_STATUSES = ['pending', 'acknowledged', 'applied', 'dismissed'] as const;
export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export const HANDOFF_KINDS = ['contract', 'component', 'design', 'data', 'other'] as const;
export const HANDOFF_SEVERITIES = ['breaking', 'notable', 'info'] as const;

export const HANDOFF_MACHINE = defineMachine<HandoffStatus>({
  statuses: HANDOFF_STATUSES,
  initial: 'pending',
  terminal: ['applied', 'dismissed'],
  transitions: {
    acknowledge: { from: ['pending'], to: 'acknowledged' },
    apply: { from: ['pending', 'acknowledged'], to: 'applied' },
    dismiss: { from: ['pending', 'acknowledged'], to: 'dismissed' },
  },
});
