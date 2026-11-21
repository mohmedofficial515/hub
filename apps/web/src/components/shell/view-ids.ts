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
  'queue',
  'live',
  'docs',
  'ask',
  'onboarding',
  'skills',
  'members',
  'settings',
  'schema',
  // Not in the sidebar: the lab's own full page, opened in a new tab from Redesign, a card or the timeline.
  'gallery',
] as const;
export type ViewId = (typeof VIEW_IDS)[number];
