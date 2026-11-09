'use client';

/**
 * @file queries.ts
 * @description The team and its invites (docs/04 §3.5, §3.23). Rows come from the same endpoint as `useMembers`, with what only this
 * page reads. Under `qk.admin`, which `project.updated` on the stream rereads, so a change from MCP appears without a reload.
 */
import type { InviteStatus, MailMode, MemberRow, Role } from '@hub/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import { avatarHue } from '@/features/cards/map';
import type { Member } from '@/features/cards/types';
import { del, patch, post, put } from '@/lib/api/client';
import { get } from '@/lib/api/client';
import { fetchAllPages } from '@/lib/api/pages';

export interface DirectoryRow {
  member: Member;
  email: string;
  roles: Role[];
  status: string;
  githubLogins: string[];
  lastSeenAt: string | null;
  totpEnabled: boolean;
}

export const toDirectoryRow = (row: MemberRow): DirectoryRow => ({
  member: {
    id: row.userId,
    name: row.displayName,
    email: row.email,
    avatarColor: avatarHue(row.avatarColor, row.userId),
    roles: row.roles as Role[],
    lastActiveAt: row.lastSeenAt ?? undefined,
  },
  email: row.email,
  roles: row.roles as Role[],
  status: row.status,
  githubLogins: row.githubLogins,
  lastSeenAt: row.lastSeenAt,
  totpEnabled: row.totpEnabled,
});

export function useDirectory() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.admin(ws, 'directory'),
    enabled: !!ws,
    queryFn: async () => (await fetchAllPages<MemberRow>(`workspaces/${ws}/members`)).map(toDirectoryRow),
  });
}

function useInvalidateTeam() {
  const { ws } = useRoute();
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.admin(ws) });
    void client.invalidateQueries({ queryKey: qk.members(ws) });
    void client.invalidateQueries({ queryKey: qk.me });
  };
}

export function useMemberWrites() {
  const { ws } = useRoute();
  const onSettled = useInvalidateTeam();
  const path = (id: string) => `workspaces/${ws}/members/${id}`;
  return {
    setRoles: useMutation({
      mutationFn: ({ id, roles }: { id: string; roles: Role[] }) => patch(path(id), { roles }),
      onSettled,
    }),
    setGithub: useMutation({
      mutationFn: ({ id, logins }: { id: string; logins: string[] }) =>
        put(`${path(id)}/github-logins`, { logins }),
      onSettled,
    }),
    setEnabled: useMutation({
      mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
        post(`${path(id)}/${enabled ? 'enable' : 'disable'}`),
      onSettled,
    }),
    resetLink: useMutation({
      mutationFn: (id: string) => post<{ url: string }>(`${path(id)}/password-reset-link`),
    }),
  };
}

export interface InviteRow {
  id: string;
  email: string;
  roles: Role[];
  /** The inviter's name. */
  createdBy: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  /** The API's one rule (docs/16 D68): the page never works it out again. */
  status: InviteStatus;
}

/** A link the API answers once, with where its email went. */
export interface InviteLinkResult {
  url: string;
  expiresAt: string;
  mail: MailMode;
}

/** Every invite with its status. Only owner and pm may read them, so nobody else asks. */
export function useInvites(enabled: boolean) {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.admin(ws, 'invites'),
    enabled: !!ws && enabled,
    queryFn: () => get<InviteRow[]>(`workspaces/${ws}/invites`),
  });
}

export function useInviteWrites() {
  const { ws } = useRoute();
  const onSettled = useInvalidateTeam();
  const path = `workspaces/${ws}/invites`;
  return {
    create: useMutation({
      mutationFn: (input: { email: string; roles: Role[] }) =>
        post<InviteLinkResult & { id: string }>(path, input),
      onSettled,
    }),
    resend: useMutation({
      mutationFn: (id: string) => post<InviteLinkResult>(`${path}/${id}/resend`),
      onSettled,
    }),
    revoke: useMutation({ mutationFn: (id: string) => del(`${path}/${id}`), onSettled }),
  };
}

export interface ProfileChanges {
  displayName?: string;
  locale?: 'ar' | 'en';
  password?: { current: string; next: string };
}

export function useProfileWrites() {
  const onSettled = useInvalidateTeam();
  return {
    save: useMutation({
      mutationFn: async ({ password, ...profile }: ProfileChanges) => {
        // Password first: a wrong current password should leave the rest unsaved, in one answer.
        if (password) await post('auth/password/change', password);
        if (Object.keys(profile).length) await patch('me', profile);
      },
      onSettled,
    }),
    disableTotp: useMutation({
      mutationFn: (code: string) => del('auth/totp', { code }),
      onSettled,
    }),
  };
}
