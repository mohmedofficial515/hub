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
