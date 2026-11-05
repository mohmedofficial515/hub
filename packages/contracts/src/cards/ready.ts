/**
 * @file Who sees which ready work (review M6, owner decision 2026-11-05). Owner and pm see all of it and may claim any of it, and the words say
 * "in the project". Everyone else keeps the tasks routed to their roles. The API's scope and the web's words both read this rule.
 */
import type { Role, Specialty } from '../roles';
import { SPECIALTIES, SPECIALTY_ROLES } from '../roles';

export function seesAllReadyWork(roles: readonly Role[]): boolean {
  return roles.includes('owner') || roles.includes('pm');
}

/** The specialties whose ready tasks this member sees. */
export function readySpecialties(roles: readonly Role[]): Specialty[] {
  if (seesAllReadyWork(roles)) return [...SPECIALTIES];
  return SPECIALTIES.filter((specialty) => SPECIALTY_ROLES[specialty].some((role) => roles.includes(role)));
}
