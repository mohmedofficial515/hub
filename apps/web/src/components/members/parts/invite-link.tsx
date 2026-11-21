'use client';

/**
 * @file invite-link.tsx
 * @description The invite link, shown once (docs/16 D68, D69): copy it, or send it through the browser's share sheet, WhatsApp or a mail
 * draft, in the owner's language. It says where the invite email went, so nobody believes a friend was emailed when only the local test
 * inbox was, and on a tailnet it says the step the friend needs first: the owner shares this machine with them in Tailscale.
 */
import type { MailMode } from '@hub/contracts';
import { ExternalLink, Mail, MessageCircle, Network, Share2 } from 'lucide-react';

import { focusRing } from '@/components/cards/meta';
import {
  Button,
  CommandBlock,
  fill,
  fmt,
  Ltr,
  ShownOnce,
  useLocale,
  useSession,
  useT,
} from '@/components/kit';
import { usePublishing } from '@/features/backups/queries';
import {
  canShare,
  inviteText,
  mailtoHref,
  tailnetOf,
  TAILSCALE_MACHINES,
  whatsappHref,
} from '@/features/members/invite-share';
import type { MembersMessages } from '@/features/members/messages';
import { cn } from '@/lib/utils';

const linkButton = cn(
  'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-body-sm font-medium whitespace-nowrap text-foreground transition-colors duration-150 ease-out hover:bg-accent md:h-8',
  focusRing,
);

export function InviteLink({ email, url, mail }: { email: string; url: string; mail: MailMode }) {
  const t = useT<MembersMessages>('members');
  const s = t.inviteLink;
  const locale = useLocale();
  const { me, workspace, isOwner } = useSession();
  const publishing = usePublishing().data;
  const tailnet = tailnetOf(publishing?.publicUrl ?? url, publishing?.tailscale.dnsName);
  const project = workspace?.name ?? '';
  const text = inviteText(s, { inviter: me.name, project, url, tailnet });
  const subject = fmt(s.shareTitle, { project });

  return (
    <ShownOnce warning={t.once.warning}>
      <CommandBlock label={t.once.linkLabel} value={url} copyLabel={t.once.copy} />
      <div role="group" aria-label={s.sendLabel} className="flex flex-wrap items-center gap-2">
        {canShare(text) && (
          <Button
            size="sm"
            onClick={() => {
              void navigator.share({ title: subject, text }).catch(() => undefined);
            }}
          >
            <Share2 aria-hidden className="size-4" strokeWidth={1.75} />
            {s.share}
          </Button>
        )}
        <a href={whatsappHref(text)} target="_blank" rel="noreferrer" className={linkButton}>
          <MessageCircle aria-hidden className="size-4" strokeWidth={1.75} />
          {s.whatsapp}
        </a>
        <a href={mailtoHref(email, subject, text)} className={linkButton}>
          <Mail aria-hidden className="size-4" strokeWidth={1.75} />
          {s.email}
        </a>
      </div>
      <p className="flex items-start gap-2 text-body-sm text-muted-foreground" data-mail={mail}>
        <Mail aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        <span>
          {fill(s.mail[mail], { email: <Ltr>{email}</Ltr> })}{' '}
          {mail !== 'real' && isOwner && workspace && (
            <a
              href={`/${locale}/${workspace.slug}/settings?tab=system`}
              className={cn('rounded-sm text-primary underline-offset-2 hover:underline', focusRing)}
            >
              {s.mailSetUp}
            </a>
          )}
        </span>
      </p>
      {tailnet && (
        <section
          aria-labelledby="invite-tailnet-title"
          className="flex flex-col gap-2 rounded-md border border-border bg-card p-3"
        >
          <h3
            id="invite-tailnet-title"
            className="flex items-center gap-2 text-body-sm font-semibold text-foreground"
          >
            <Network aria-hidden className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
            {s.tailnetTitle}
          </h3>
          <p className="text-body-sm text-muted-foreground">
            {fill(s.tailnetBody, { machine: <Ltr mono>{tailnet.machine}</Ltr> })}
          </p>
          <a
            href={TAILSCALE_MACHINES}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'hit-44 inline-flex w-fit items-center gap-1 rounded-sm text-body-sm text-primary underline-offset-2 hover:underline',
              focusRing,
            )}
          >
            {s.tailnetOpen}
            <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
          </a>
        </section>
      )}
    </ShownOnce>
  );
}
