/**
 * @file steps.ts
 * @description Onboarding with no React. The API answers one group per role (docs/04 §3.23); the page lists each item once, with the roles that hold
 * it (09 §13). `doc`, `card`, `url` and `action` say where a step leads. An `action` finishes itself, so a member cannot tick it.
 */
import type { Role } from '@/features/cards/types';

export type StepKind = 'doc' | 'card' | 'url' | 'action';
export type StepPhase = 'read' | 'setup' | 'work';

export interface OnboardingItemDto {
  id: string;
  kind: StepKind;
  title: string;
  ref: string;
  done?: boolean | undefined;
  doneAt?: string | null | undefined;
  /** Optional words a path may carry. Absent means the row simply does not show them. */
  why?: string | null | undefined;
  minutes?: number | null | undefined;
  command?: string | null | undefined;
  phase?: StepPhase | null | undefined;
}

export interface OnboardingGroupDto {
  role: Role;
  items: OnboardingItemDto[];
}

export interface OnboardingStep {
  id: string;
  kind: StepKind;
  phase: StepPhase;
  title: string;
  why?: string | undefined;
  ref: string;
  minutes?: number | undefined;
  command?: string | undefined;
  /** Hub ticks this itself when the event arrives. */
  auto: boolean;
  done: boolean;
  roles: Role[];
}

/** What a known action opens or runs (docs/09 §13). */
const ACTIONS: Record<
  string,
  { view?: 'settings' | 'tasks'; query?: Record<string, string>; command?: string }
> = {
  install_pack: { view: 'settings', query: { tab: 'tokens' } },
  first_session: { command: '/hub:start' },
  first_claim: { view: 'tasks', query: { status: 'ready' } },
};

const phaseOf = (item: OnboardingItemDto): StepPhase => {
  if (item.phase) return item.phase;
  if (item.kind === 'doc') return 'read';
  if (item.kind === 'card' || item.ref === 'first_claim') return 'work';
  return 'setup';
};

/** The union of a member's paths, in the order first seen, each step once with the roles that hold it. */
export function mergeGroups(groups: readonly OnboardingGroupDto[]): OnboardingStep[] {
  const steps = new Map<string, OnboardingStep>();
  for (const { role, items } of groups) {
    for (const item of items) {
      const known = steps.get(item.id);
      if (known) {
        known.roles.push(role);
        continue;
      }
      steps.set(item.id, {
        id: item.id,
        kind: item.kind,
        phase: phaseOf(item),
        title: item.title,
        why: item.why ?? undefined,
        ref: item.ref,
        minutes: item.minutes ?? undefined,
        command: item.command ?? ACTIONS[item.ref]?.command,
        auto: item.kind === 'action',
        done: item.done ?? false,
        roles: [role],
      });
    }
  }
  return [...steps.values()];
}

export type StepTarget =
  | {
      kind: 'view';
      view: 'docs' | 'tasks' | 'settings' | 'decisions';
      query?: Record<string, string> | undefined;
    }
  | { kind: 'card'; card: string }
  | { kind: 'external'; href: string };

/**
 * Where a step leads. A doc opens in the viewer when it is indexed, otherwise on the Docs page. A `url` that names a page of the app (`settings/notifications`)
 * stays inside it.
 */
export function stepTarget(step: Pick<OnboardingStep, 'kind' | 'ref'>, docKey?: string): StepTarget | null {
  if (step.kind === 'doc')
    return { kind: 'view', view: 'docs', ...(docKey ? { query: { doc: docKey } } : {}) };
  if (step.kind === 'card') {
    return /^[A-Z][A-Z0-9]*-\d+$/.test(step.ref)
      ? { kind: 'card', card: step.ref }
      : { kind: 'view', view: 'decisions' };
  }
  if (step.kind === 'action') {
    const action = ACTIONS[step.ref];
    return action?.view ? { kind: 'view', view: action.view, query: action.query } : null;
  }
  if (/^https?:\/\//.test(step.ref)) return { kind: 'external', href: step.ref };
  const [view, tab] = step.ref.split('/');
  if (view === 'settings') return { kind: 'view', view: 'settings', ...(tab ? { query: { tab } } : {}) };
  return null;
}

export const nextStepOf = (steps: readonly OnboardingStep[]) => steps.find((s) => !s.done);
