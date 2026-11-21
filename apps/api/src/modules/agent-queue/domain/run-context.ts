/**
 * @file What a queued run tells the engine and shows the owner beyond its prompt (docs/16 D58 to D60), pure.
 * @description Roles become lines the engine reads: each role's brief, its specialties and its reading path from `onboarding.paths`. A pending item names its folder: the extra folder its command names, else the main one. Its reason is the model's own description of a shell call, when it gave one.
 */
import {
  type OnboardingItem,
  type PromptRole,
  type Role,
  ROLE_BRIEFS,
  ROLE_LABELS,
  specialtiesOf,
} from '@hub/contracts';

const READ_FIRST_LIMIT = 8;

export function promptRoles(
  roles: readonly Role[],
  paths: Partial<Record<Role, readonly OnboardingItem[]>>,
): PromptRole[] {
  return roles.map((role) => ({
    role,
    label: ROLE_LABELS[role].en,
    brief: ROLE_BRIEFS[role],
    specialties: specialtiesOf(role),
    readFirst: (paths[role] ?? [])
      .filter((item) => item.kind === 'doc' || item.kind === 'card')
      .slice(0, READ_FIRST_LIMIT)
      .map((item) => item.ref),
  }));
}

const plain = (path: string): string => path.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();

/** The folder a skipped command belongs to: the longest of the run's folders its text names, else the main one. */
export function decisionFolder(command: string, main: string, extra: readonly string[]): string {
  const text = plain(command);
  const named = [...extra, main]
    .filter((folder) => text.includes(plain(folder)))
    .sort((a, b) => b.length - a.length);
  return named[0] ?? main;
}

/** The model's own reason for a call, when it gave one: a shell call's `description`. */
export function whyOf(input: unknown): string | null {
  const description = (input as { description?: unknown } | null)?.description;
  return typeof description === 'string' && description.trim() ? description.trim().slice(0, 300) : null;
}
