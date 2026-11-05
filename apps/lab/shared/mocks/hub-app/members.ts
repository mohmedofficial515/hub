// Members and invites (09 §17, API 04 §3.5). Shapes follow `GET /workspaces/{ws}/members` and `GET …/invites`.
// Invite links and reset links are shown once by the API; the lab's are obviously fake examples.

import { members, type HubScenario, type Member, type Role } from './index';

export interface DirectoryRow {
  member: Member;
  email: string;
  roles: Role[];
  status: 'active' | 'disabled';
  joinedAt: string;
  lastSeenAt: string;
  githubLogins: string[];
  totpEnabled: boolean;
  disabledAt?: string;
}

export interface InviteRow {
  id: string;
  email: string;
  roles: Role[];
  createdById: string;
  createdAt: string;
  expiresAt: string;
}

const detail: Record<string, Pick<DirectoryRow, 'email' | 'joinedAt' | 'githubLogins' | 'totpEnabled'>> = {
  'u-owner': { email: 'mohamed@goteav.example', joinedAt: '2026-09-02T10:00:00+03:00', githubLogins: ['mohmedofficial515'], totpEnabled: true },
  'u-sara': { email: 'sara@goteav.example', joinedAt: '2026-09-14T10:30:00+03:00', githubLogins: ['sara-alharbi'], totpEnabled: false },
  'u-yousef': { email: 'yousef@goteav.example', joinedAt: '2026-09-03T09:15:00+03:00', githubLogins: ['yousef-q', 'yousef-bot'], totpEnabled: true },
  'u-omar': { email: 'omar@goteav.example', joinedAt: '2026-09-21T11:00:00+03:00', githubLogins: ['omar-sul'], totpEnabled: false },
  // No login on purpose: her commits arrive as "unknown author" until someone maps one (09 §17).
  'u-layla': { email: 'layla@goteav.example', joinedAt: '2026-10-05T12:00:00+03:00', githubLogins: [], totpEnabled: false },
  'u-karim': { email: 'karim@goteav.example', joinedAt: '2026-09-28T10:00:00+03:00', githubLogins: ['karim-adel'], totpEnabled: true },
  'u-nour': { email: 'nour@goteav.example', joinedAt: '2026-10-12T09:45:00+03:00', githubLogins: ['nour-qa'], totpEnabled: false },
};

const former: DirectoryRow = {
  member: {
    id: 'u-tarek',
    name: { ar: 'طارق ناصر', en: 'Tarek Nasser' },
    initials: { ar: 'ط', en: 'TN' },
    avatarColor: 8,
    roles: ['frontend'],
    online: false,
    lastActiveAt: '2026-10-09T17:20:00+03:00',
  },
  email: 'tarek@goteav.example',
  roles: ['frontend'],
  status: 'disabled',
  joinedAt: '2026-09-07T10:00:00+03:00',
  lastSeenAt: '2026-10-09T17:20:00+03:00',
  githubLogins: ['tarek-n'],
  totpEnabled: false,
  disabledAt: '2026-10-12T10:05:00+03:00',
};

/** Every member with the fields the Members page needs, plus one disabled former member. */
export function directoryFor(_scenario: HubScenario | 'error'): DirectoryRow[] {
  const active: DirectoryRow[] = members.map((m) => ({
    member: m,
    roles: m.roles,
    status: 'active',
    lastSeenAt: m.lastActiveAt,
    ...detail[m.id],
  }));
  return [...active, former];
}

const seedInvites: InviteRow[] = [
  { id: 'inv-2', email: 'faisal@goteav.example', roles: ['accountant'], createdById: 'u-owner', createdAt: '2026-10-29T10:00:00+03:00', expiresAt: '2026-11-05T10:00:00+03:00' },
  { id: 'inv-1', email: 'huda@goteav.example', roles: ['qa'], createdById: 'u-owner', createdAt: '2026-11-02T10:20:00+03:00', expiresAt: '2026-11-09T10:20:00+03:00' },
];

/** `navExtras` counts these: 2 for the owner, none in the `empty` scenario. Sara cannot read this endpoint. */
export function invitesFor(scenario: HubScenario | 'error'): InviteRow[] {
  return scenario === 'empty' || scenario === 'frontend' ? [] : seedInvites;
}

let linkSeq = 1;
/** A link the lab can show once. It is plainly not a working credential. */
export const exampleLink = (kind: 'invite' | 'reset', locale: 'ar' | 'en') => `https://hub.goteav.lan/${locale}/${kind}/EXAMPLE-${linkSeq++}-lab-link-not-real`;
