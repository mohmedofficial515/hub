/**
 * @file Doc: a read-only mirror of a Markdown file (docs/01 §4.1). The indexer moves the status.
 */
import { defineMachine } from './machine';

export const DOC_STATUSES = ['current', 'stale', 'removed'] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const DOC_KINDS = ['doc', 'adr', 'status', 'readme', 'other'] as const;

export const DOC_MACHINE = defineMachine<DocStatus>({
  statuses: DOC_STATUSES,
  initial: 'current',
  terminal: [],
  transitions: {
    mark_stale: { from: ['current'], to: 'stale' },
    mark_current: { from: ['stale', 'removed'], to: 'current' },
    mark_removed: { from: ['current', 'stale'], to: 'removed' },
  },
});
