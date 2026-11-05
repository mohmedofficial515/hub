'use client';

/**
 * @file invites.tsx
 * @description Ported from the approved design, pages/members. Contract: apps/web/README.md.
 */
import { Clock, MailPlus } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  ConfirmDialog,
  firstName,
  fmt,
  hoursFromNow,
  Ltr,
  Pill,
  rel,
  RoleBadge,
  SectionHeader,
  showToast,
  useKeyboardList,
  useLocale,
  useT,
  when,
} from '@/components/kit';
import type { MembersMessages } from '@/features/members/messages';
import { type InviteRow, useInviteWrites } from '@/features/members/queries';
import { isHubError } from '@/lib/api/errors';

/**
 * People who have a link and have not joined. It sits above the roster: the sidebar's count points here, and these rows
 * are the only ones on this page with a clock on them.
 */
export function Invites({
  invites,
  onLink,
}: {
  invites: InviteRow[];
  onLink: (title: string, body: string, link: string) => void;
}) {
  const t = useT<MembersMessages>('members');
  const locale = useLocale();
  const writes = useInviteWrites();
  const [revoking, setRevoking] = useState<string | null>(null);
  const target = invites.find((i) => i.id === revoking);
  // Enter moves to the row's buttons. It never starts a revoke by itself.
  const list = useKeyboardList({
    ids: invites.map((i) => i.id),
    onOpen: (id) => document.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"] button`)?.focus(),
  });

  const refused = (cause: unknown) =>
    showToast({ tone: 'error', message: isHubError(cause) ? cause.message : t.errorThing });

  // A revoked link cannot come back through the API, so this toast offers no Undo: inviting again makes a new one.
  const revoke = (invite: InviteRow) =>
    writes.revoke.mutate(invite.id, {
      onSuccess: () => showToast({ message: fmt(t.invites.revoked, { email: invite.email }) }),
      onError: refused,
    });

  const resend = (invite: InviteRow) =>
    writes.resend.mutate(invite.id, {
      onSuccess: ({ url }) =>
        onLink(t.invites.resendTitle, fmt(t.invites.resendBody, { email: invite.email }), url),
      onError: refused,
    });

  return (
    <section aria-labelledby="invites-title" className="flex flex-col gap-3">
      <SectionHeader id="invites-title" icon={MailPlus} title={t.invites.title} count={invites.length} />
      <ul
        data-hub-list
        className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card"
      >
        {invites.map((invite) => {
          const soon = hoursFromNow(invite.expiresAt) <= 24;
          return (
            <li
              key={invite.id}
              {...list.rowProps(invite.id)}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:py-3"
            >
              <div className="min-w-0 flex-1 basis-64">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Ltr mono className="min-w-0 text-body-sm font-medium break-all text-foreground">
                    {invite.email}
                  </Ltr>
                  {invite.roles.map((r) => (
                    <RoleBadge key={r} role={r} />
                  ))}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground">
                  <span>
                    {fmt(t.invites.sent, { name: firstName(invite.createdBy) ?? invite.createdBy })}
                  </span>
                  {soon ? (
                    <Pill tone="warning" icon={Clock}>
                      {fmt(t.invites.expiresSoon, { when: when(invite.expiresAt, locale) })}
                    </Pill>
                  ) : (
                    <span>{fmt(t.invites.expires, { when: rel(invite.expiresAt, locale) })}</span>
                  )}
                </p>
              </div>
              <span className="flex items-center gap-2">
                <Button size="sm" onClick={() => resend(invite)}>
                  {t.invites.resend}
                </Button>
                <Button
                  size="sm"
                  aria-label={`${t.invites.revoke}: ${invite.email}`}
                  onClick={() => setRevoking(invite.id)}
                >
                  {t.invites.revoke}
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={!!target}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={target ? fmt(t.invites.revokeTitle, { email: target.email }) : ''}
        description={t.invites.revokeBody}
        confirmLabel={t.invites.revoke}
        onConfirm={() => target && revoke(target)}
      />
    </section>
  );
}
