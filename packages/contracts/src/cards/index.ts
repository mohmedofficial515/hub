/**
 * @file Card contracts, and the one table from card type to status machine.
 */
import type { CardType } from './card';
import { CHANGE_MACHINE } from './change';
import { DECISION_MACHINE } from './decision';
import { DOC_MACHINE } from './doc';
import { HANDOFF_MACHINE } from './handoff';
import { IDEA_MACHINE } from './idea';
import type { StatusMachine } from './machine';
import { NEED_MACHINE } from './need';
import { PLAN_MACHINE } from './plan';
import { REDESIGN_MACHINE } from './redesign';
import { RELEASE_MACHINE } from './release';
import { TASK_MACHINE } from './task';

export * from './actions';
export * from './card';
export * from './change';
export * from './decision';
export * from './doc';
export * from './handoff';
export * from './idea';
export * from './inputs';
export * from './machine';
export * from './need';
export * from './plan';
export * from './read-models';
export * from './redesign';
export * from './release';
export * from './task';

export const CARD_MACHINES: Record<CardType, StatusMachine> = {
  task: TASK_MACHINE,
  decision: DECISION_MACHINE,
  need: NEED_MACHINE,
  change: CHANGE_MACHINE,
  handoff: HANDOFF_MACHINE,
  redesign: REDESIGN_MACHINE,
  doc: DOC_MACHINE,
  release: RELEASE_MACHINE,
  idea: IDEA_MACHINE,
  plan: PLAN_MACHINE,
};
