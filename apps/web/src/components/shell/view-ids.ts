/**
 * @file view-ids.ts
 * @description The list of views, in a plain module so that server components can read it too.
 */
export const VIEW_IDS = [
  'today',
  'inbox',
  'timeline',
  'planning',
  'tasks',
  'decisions',
  'needs',
  'handoffs',
  'redesign',
  'releases',
  'docs',
  'ask',
  'onboarding',
  'members',
  'settings',
] as const;
export type ViewId = (typeof VIEW_IDS)[number];
