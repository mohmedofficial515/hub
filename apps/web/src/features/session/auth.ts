'use client';

/**
 * @file auth.ts
 * @description The auth endpoints (docs/04 §3.2). Sign-in answers either with the member or with a TOTP challenge. The challenge stays in
 * sessionStorage between the two pages and never in the URL.
 */
import { post } from '@/lib/api/client';
import { getQueryClient } from '@/lib/query-client';

import type { Me } from './session';

export type SignInResult = { totpRequired: false; user: Me } | { totpRequired: true; challenge: string };

const CHALLENGE_KEY = 'hub:totp-challenge';

export const rememberChallenge = (challenge: string) => {
  try {
    sessionStorage.setItem(CHALLENGE_KEY, challenge);
  } catch {
    /* Without storage the TOTP page sends the member back to sign in. */
  }
};

export const readChallenge = () => {
  try {
    return sessionStorage.getItem(CHALLENGE_KEY);
  } catch {
    return null;
  }
};

export const clearChallenge = () => {
  try {
    sessionStorage.removeItem(CHALLENGE_KEY);
  } catch {
    /* Nothing to clear. */
  }
};

export const signIn = (email: string, password: string) =>
  post<SignInResult>('auth/sign-in', { email, password });

export const verifyTotp = (challenge: string, code: string) =>
  post<{ user: Me; totpRequired: false }>('auth/totp/verify', { challenge, code });

export const recoverTotp = (challenge: string, code: string) =>
  post<{ user: Me; totpRequired: false }>('auth/totp/recover', { challenge, code });

export const forgotPassword = (email: string) => post<void>('auth/password/forgot', { email });

export const resetPassword = (token: string, password: string) =>
  post<void>('auth/password/reset', { token, password });

export interface InviteInfo {
  email: string;
  workspace: { slug: string; name: string };
  roles: string[];
  expiresAt: string;
  invitedBy: string;
}

export const acceptInvite = (
  token: string,
  body: { displayName?: string; password?: string; locale?: string },
) => post<{ user: Me; workspace: { slug: string } }>(`auth/invites/${token}/accept`, body);

export const setupTotp = () =>
  post<{ secret: string; otpauthUrl: string; qrDataUrl?: string }>('auth/totp/setup');

export const confirmTotp = (code: string) => post<{ recoveryCodes: string[] }>('auth/totp/confirm', { code });

export async function signOut(locale: string) {
  try {
    await post<void>('auth/sign-out');
  } finally {
    getQueryClient().clear();
    window.location.assign(`/${locale}/sign-in`);
  }
}

/** Where a member lands after signing in: where they were going, the one project they have, or the list (docs/09 §1.1, §2). */
export function landingFor(me: Pick<Me, 'workspaces'>, locale: string, next: string | null) {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  const open = me.workspaces.filter((w) => w.status !== 'closed');
  const only = open.length === 1 ? open[0] : undefined;
  return only ? `/${locale}/${only.slug}/today` : `/${locale}/workspaces`;
}
