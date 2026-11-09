'use client';

/**
 * @file invites.tsx
 * @description Ported from the approved design, pages/members. Contract: apps/web/README.md. Every row says its status from the API's one
 * rule (docs/16 D68): waiting, expired, joined or revoked. Waiting and expired rows have New link, which issues a fresh link for seven days
 * and stops the old one, and Revoke. Joined and revoked rows sit below the team, as the disabled accounts do.
 */
import { CircleCheck, CircleSlash, Clock, History, MailPlus } from 'lucide-react';
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
import { type InviteLinkResult, type InviteRow, useInviteWrites } from '@/features/members/queries';
import { isHubError } from '@/lib/api/errors';

/** The second line's status: when it expires, expired, joined or revoked. */
export function InviteStatusLine({ invite }: { invite: InviteRow }) {
  const t = useT<MembersMessages>('members');
  const locale = useLocale();
  if (invite.status === 'accepted') {
    return (
      <Pill tone="success" icon={CircleCheck}>
        {invite.acceptedAt
          ? fmt(t.invites.joined, { when: rel(invite.acceptedAt, locale) })
          : t.invites.status.accepted}
      </Pill>
    );
  }
  if (invite.status === 'revoked') {
    return (
      <Pill tone="muted" icon={CircleSlash}>
        {invite.revokedAt
          ? fmt(t.invites.revokedOn, { when: rel(invite.revokedAt, locale) })
          : t.invites.status.revoked}
      </Pill>
    );
  }
  if (invite.status === 'expired') {
    return (
      <Pill tone="warning" icon={Clock}>
        {fmt(t.invites.expired, { when: rel(invite.expiresAt, locale) })}
      </Pill>
    );
  }
  return hoursFromNow(invite.expiresAt) <= 24 ? (
    <Pill tone="warning" icon={Clock}>
      {fmt(t.invites.expiresSoon, { when: when(invite.expiresAt, locale) })}
    </Pill>
  ) : (
    <span>{fmt(t.invites.expires, { when: rel(invite.expiresAt, locale) })}</span>
  );
}

/**
 * People with a link who have not joined: waiting, or expired and waiting for a new link. It sits above the roster: the sidebar's count
 * points here, and these rows are the only ones on this page with a clock on them.
 */
export function Invites({
  invites,
  onLink,
}: {
  invites: InviteRow[];
  onLink: (invite: InviteRow, link: InviteLinkResult) => void;
}) {
  const t = useT<MembersMessages>('members');
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

  const renew = (invite: InviteRow) =>
    writes.resend.mutate(invite.id, { onSuccess: (link) => onLink(invite, link), onError: refused });

  return (
    <section aria-labelledby="invites-title" className="flex flex-col gap-3">
      <SectionHeader id="invites-title" icon={MailPlus} title={t.invites.title} count={invites.length} />
      <ul
        data-hub-list
        className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card"
      >
        {invites.map((invite) => (
          <li
            key={invite.id}
            {...list.rowProps(invite.id)}
            data-status={invite.status}
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
                <span>{fmt(t.invites.sent, { name: firstName(invite.createdBy) ?? invite.createdBy })}</span>
                <InviteStatusLine invite={invite} />
              </p>
            </div>
            <span className="flex items-center gap-2">
              <Button
                size="sm"
                variant={invite.status === 'expired' ? 'primary' : 'outline'}
                aria-label={fmt(t.invites.resendLabel, { email: invite.email })}
                busy={writes.resend.isPending && writes.resend.variables === invite.id}
                onClick={() => renew(invite)}
              >
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
        ))}
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

/** Joined and revoked invites: nothing to do on them, so they sit below the team, as the disabled accounts do. */
export function EarlierInvites({ invites }: { invites: InviteRow[] }) {
  const t = useT<MembersMessages>('members');
  return (
    <section
      aria-labelledby="earlier-invites-title"
      className="flex flex-col gap-2 border-t border-border pt-6"
    >
      <SectionHeader
        id="earlier-invites-title"
        level={3}
        icon={History}
        title={t.invites.earlierTitle}
        count={invites.length}
      />
      <ul className="flex flex-col gap-2">
        {invites.map((invite) => (
          <li
            key={invite.id}
            data-status={invite.status}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm"
          >
            <Ltr mono className="min-w-0 break-all text-foreground">
              {invite.email}
            </Ltr>
            {invite.roles.map((r) => (
              <RoleBadge key={r} role={r} />
            ))}
            <InviteStatusLine invite={invite} />
          </li>
        ))}
      </ul>
    </section>
  );
}
