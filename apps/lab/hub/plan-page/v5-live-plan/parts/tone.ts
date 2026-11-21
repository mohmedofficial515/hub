import type { PhaseGroup } from './model';

/** A phase's tone: one of the eight hues in `story.css`, cycled, so phase 8 and phase 0 share a hue but never sit side by side. */
export const toneOf = (index: number) => String(index % 8);

export type PhaseState = 'done' | 'now' | 'todo';

/** Done: every step done. Now: holds the next step. Todo: the rest, even if some steps were done out of order. */
export function phaseState(g: PhaseGroup): PhaseState {
  if (g.total > 0 && g.done === g.total) return 'done';
  if (g.hasNext) return 'now';
  return 'todo';
}
