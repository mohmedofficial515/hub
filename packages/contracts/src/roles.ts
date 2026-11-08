/**
 * @file Roles and specialties.
 * @description Catalogue from docs/03 §4.1. Roles are per project, resolved live on every call (docs/15 §5).
 */
import { z } from 'zod';

export const ROLES = ['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa'] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

export const ROLE_LABELS: Record<Role, { ar: string; en: string }> = {
  owner: { ar: 'المالك', en: 'Owner' },
  pm: { ar: 'مدير المشروع', en: 'Project manager' },
  accountant: { ar: 'المحاسب', en: 'Accountant' },
  backend: { ar: 'الباك إند', en: 'Backend' },
  frontend: { ar: 'الفرونت إند', en: 'Frontend' },
  designer: { ar: 'التصميم', en: 'Designer' },
  qa: { ar: 'الاختبار', en: 'QA' },
};

export const SPECIALTIES = ['backend', 'frontend', 'design', 'qa', 'ops', 'docs'] as const;
export type Specialty = (typeof SPECIALTIES)[number];
export const specialtySchema = z.enum(SPECIALTIES);

/** Which roles the `S` grant of the permission matrix accepts for a task's specialty (docs/04 §2). */
export const SPECIALTY_ROLES: Record<Specialty, readonly Role[]> = {
  backend: ['backend'],
  frontend: ['frontend'],
  design: ['designer'],
  qa: ['qa'],
  ops: ['backend', 'frontend'],
  docs: ['backend', 'frontend'],
};

/** The role a task is routed to when the creator names none (docs/04 §3.8). */
export const SPECIALTY_DEFAULT_ROLE: Record<Specialty, Role> = {
  backend: 'backend',
  frontend: 'frontend',
  design: 'designer',
  qa: 'qa',
  ops: 'backend',
  docs: 'backend',
};

/**
 * What a role does, in one line the engine reads (docs/16 D60). Hub held no instructions per role before this: a role was a name, its specialties (`SPECIALTY_ROLES`) and its reading path (`onboarding.paths`).
 * A queued run that carries roles is told each role's line, its specialties and its reading path. English, because agents read it.
 */
export const ROLE_BRIEFS: Record<Role, string> = {
  owner:
    'Decides scope and priorities, and approves what ships. Prefer asking for a decision over guessing a business rule.',
  pm: 'Keeps tasks, plans and handoffs in order. Make sure each change has a card, checks and a clear next step.',
  accountant:
    'Owns money rules: invoices, taxes, refunds and reports. Change nothing about amounts without a recorded decision.',
  backend:
    'Builds the API, data and integrations. Keep contracts, migrations and tests in step, and run the backend checks.',
  frontend:
    'Builds the pages people use. Follow the existing design and i18n, keep RTL and LTR right, and run the web checks.',
  designer:
    'Shapes how pages look and read. Keep existing layouts and measurements unless a decision changes them.',
  qa: 'Tests what changed. Write or run tests for every acceptance check, and say plainly what was not checked.',
};

/** The specialties a role covers, from `SPECIALTY_ROLES`. */
export function specialtiesOf(role: Role): Specialty[] {
  return SPECIALTIES.filter((specialty) => SPECIALTY_ROLES[specialty].includes(role));
}
