/**
 * @file Change: commits, pull requests and session logs are facts, so the status never moves (docs/01 §4.1).
 */
import { defineMachine } from './machine';

export const CHANGE_STATUSES = ['recorded'] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

export const CHANGE_KINDS = ['commits', 'pull_request', 'session'] as const;
export const PR_STATES = ['open', 'merged', 'closed'] as const;

export const CHANGE_MACHINE = defineMachine<ChangeStatus>({
  statuses: CHANGE_STATUSES,
  initial: 'recorded',
  terminal: ['recorded'],
  transitions: {},
});
