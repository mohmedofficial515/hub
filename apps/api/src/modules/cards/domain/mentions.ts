/**
 * @file Mentions in a comment (docs/04 §3.8): `@user:<id>` and `@role:<role>`.
 */
import { type Role, ROLES } from '@hub/contracts';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export interface Mentions {
  readonly userIds: readonly string[];
  readonly roles: readonly Role[];
}

export function parseMentions(body: string): Mentions {
  const userIds = [...body.matchAll(new RegExp(`@user:(${UUID})`, 'gi'))].map((m) =>
    (m[1] as string).toLowerCase(),
  );
  const roles = [...body.matchAll(/@role:([a-z]+)/g)]
    .map((m) => m[1] as string)
    .filter((role): role is Role => (ROLES as readonly string[]).includes(role));
  return { userIds: [...new Set(userIds)], roles: [...new Set(roles)] };
}

const EXCERPT_LENGTH = 140;

/** The start of a comment, kept on its event for the timeline. */
export function excerptOf(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH)}…` : flat;
}
