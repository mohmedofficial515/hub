import { useState } from 'react';
import { Clock, MailPlus } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { members } from '@lab/mocks/hub-app';
import type { InviteRow } from '@lab/mocks/hub-app/members';
import { Button, ConfirmDialog, firstName, fmt, hoursFromNow, Ltr, Pill, rel, RoleBadge, SectionHeader, showToast, updateAdmin, useKeyboardList, useSession, when, writeAudit } from '../../../kit';
import { messages } from '../i18n';

/**
 * People who have a link and have not joined. It sits above the roster: the sidebar's count points here, and these rows
 * are the only ones on this page with a clock on them.
 */
export function Invites({ invites, onLink }: { invites: InviteRow[]; onLink: (title: string, body: string) => void }) {
  const t = useT(messages);
  const locale = useLocale();
  const { me } = useSession();
  const [revoking, setRevoking] = useState<string | null>(null);
  const target = invites.find((i) => i.id === revoking);
  // Enter moves to the row's buttons. It never starts a revoke by itself.
  const list = useKeyboardList({ ids: invites.map((i) => i.id), onOpen: (id) => document.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"] button`)?.focus() });

  const revoke = (invite: InviteRow) => {
    updateAdmin((state) => ({ ...state, invites: state.invites.filter((i) => i.id !== invite.id) }));
    writeAudit({ action: 'members.invite.revoke', targetType: 'invite', targetId: invite.email, actorId: me.id, summary: { ar: 'إلغاء الدعوة', en: 'Revoked the invite' } });
    showToast({
      message: fmt(t.invites.revoked, { email: invite.email }),
      onUndo: () => updateAdmin((state) => ({ ...state, invites: [invite, ...state.invites] })),
    });
  };

  const resend = (invite: InviteRow) => {
    writeAudit({ action: 'members.invite.resend', targetType: 'invite', targetId: invite.email, actorId: me.id, summary: { ar: 'إعادة إرسال الدعوة برابط جديد', en: 'Resent the invite with a new link' } });
    onLink(t.invites.resendTitle, fmt(t.invites.resendBody, { email: invite.email }));
  };

  return (
    <section aria-labelledby="invites-title" className="flex flex-col gap-3">
      <SectionHeader id="invites-title" icon={MailPlus} title={t.invites.title} count={invites.length} />
      <ul data-hub-list className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {invites.map((invite) => {
          const soon = hoursFromNow(invite.expiresAt) <= 24;
          const inviter = members.find((m) => m.id === invite.createdById);
          return (
            <li key={invite.id} {...list.rowProps(invite.id)} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:py-3">
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
                  <span>{fmt(t.invites.sent, { name: inviter ? firstName(inviter.name[locale]) : '', when: rel(invite.createdAt, locale) })}</span>
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
                <Button size="sm" aria-label={`${t.invites.revoke}: ${invite.email}`} onClick={() => setRevoking(invite.id)}>
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
