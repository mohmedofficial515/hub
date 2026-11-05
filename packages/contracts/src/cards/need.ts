/**
 * @file Need: status machine (docs/01 §4.1, docs/04 §3.12). Self-verification is allowed with a note (D24).
 */
import { defineMachine } from './machine';

export const NEED_STATUSES = ['requested', 'in_progress', 'delivered', 'verified', 'cancelled'] as const;
export type NeedStatus = (typeof NEED_STATUSES)[number];

export const NEED_KINDS = ['token', 'account', 'contract', 'value_check', 'file', 'access', 'other'] as const;

export const NEED_MACHINE = defineMachine<NeedStatus>({
  statuses: NEED_STATUSES,
  initial: 'requested',
  terminal: ['verified', 'cancelled'],
  transitions: {
    start: { from: ['requested'], to: 'in_progress' },
    deliver: { from: ['requested', 'in_progress'], to: 'delivered' },
    verify: { from: ['delivered'], to: 'verified' },
    reject_delivery: { from: ['delivered'], to: 'in_progress' },
    cancel: { from: ['requested', 'in_progress', 'delivered'], to: 'cancelled' },
  },
});
