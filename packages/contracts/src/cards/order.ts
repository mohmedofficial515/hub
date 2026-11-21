/**
 * @file The one order of things that wait: the deadline, then the priority, then the key. Today and Decisions must name the same next decision (review R8).
 */
export const compareKeys = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

interface Waiting {
  readonly dueAt?: string | null | undefined;
  readonly priority: string;
  readonly key: string;
}

const dueOf = (card: Waiting) => (card.dueAt ? Date.parse(card.dueAt) : Infinity);

/** Earliest deadline first, no deadline last. */
export function compareWaiting(a: Waiting, b: Waiting): number {
  const [dueA, dueB] = [dueOf(a), dueOf(b)];
  if (dueA !== dueB) return dueA < dueB ? -1 : 1;
  return a.priority.localeCompare(b.priority) || compareKeys(a.key, b.key);
}
