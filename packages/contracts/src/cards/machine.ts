/**
 * @file Status machine shape and helpers.
 * @description Each card type declares one machine: named transitions (the action verb) with their
 * allowed source statuses. `CardService.apply` reads it; nothing else decides whether a status may change.
 */
export interface Transition<S extends string> {
  readonly from: readonly S[];
  readonly to: S;
}

export interface StatusMachine<S extends string = string> {
  readonly statuses: readonly S[];
  readonly initial: S;
  /** Reaching one of these sets `closed_at`; leaving clears it. */
  readonly terminal: readonly S[];
  readonly transitions: Readonly<Record<string, Transition<S>>>;
}

export function defineMachine<S extends string>(machine: StatusMachine<S>): StatusMachine<S> {
  return machine;
}

/** True when some named transition moves `from` to `to`. */
export function canTransition(machine: StatusMachine, from: string, to: string): boolean {
  return Object.values(machine.transitions).some((t) => t.to === to && t.from.includes(from));
}

/** Every allowed `[from, to]` pair of a machine, for tests and diagrams. */
export function transitionPairs(machine: StatusMachine): [string, string][] {
  const pairs = new Set<string>();
  for (const t of Object.values(machine.transitions)) {
    for (const from of t.from) pairs.add(`${from}\u0000${t.to}`);
  }
  return [...pairs].map((pair) => pair.split('\u0000') as [string, string]);
}
