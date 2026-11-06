'use client';

/**
 * @file avatar.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/avatar.tsx. Contract: apps/web/README.md.
 */
import { Bot, Cpu } from 'lucide-react';

import { avatarClass } from '@/components/cards/meta';
import { fmt } from '@/components/common/text';
import type { ActorKind, Member } from '@/features/cards/types';
import { useMember } from '@/features/session/session';
import { initials, rel } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const sizes = {
  xs: 'size-5 text-caption tracking-tighter',
  sm: 'size-6 text-caption',
  md: 'size-8 text-body-sm',
};

export function Avatar({
  member,
  size = 'sm',
  agent = false,
  online,
  className,
}: {
  member?: Member | undefined;
  size?: keyof typeof sizes | undefined;
  /** Bot overlay: this member's agent did it (08 P4). */
  agent?: boolean | undefined;
  /** Status dot. Always give the same fact in words near it or in `title`. */
  online?: boolean | undefined;
  className?: string | undefined;
}) {
  const locale = useLocale();
  const t = useT(kitMessages);
  const presence =
    online === undefined || !member
      ? undefined
      : online
        ? t.online
        : member.lastActiveAt
          ? member.lastActiveAt
            ? fmt(t.lastSeen, { rel: rel(member.lastActiveAt, locale) })
            : undefined
          : undefined;
  return (
    <span className={cn('relative inline-flex shrink-0', className)} title={presence}>
      <span
        aria-hidden
        className={cn(
          'inline-flex items-center justify-center rounded-full font-semibold text-(--avatar-fg)',
          sizes[size],
          member ? avatarClass[member.avatarColor] : 'bg-muted text-muted-foreground',
        )}
      >
        {member ? initials(member.name) : '·'}
      </span>
      {agent && (
        <span className="absolute -end-1 -bottom-1 inline-flex size-3.5 items-center justify-center rounded-full bg-card ring-1 ring-border">
          <Bot aria-hidden className="size-2.5 text-foreground" strokeWidth={2} />
        </span>
      )}
      {online !== undefined && (
        <span
          aria-hidden
          className={cn(
            'absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-card',
            online ? 'bg-success' : 'bg-muted-foreground/50',
          )}
        />
      )}
    </span>
  );
}

/**
 * Who did it (08 §5.1, P4): avatar + name. Agents get a Bot overlay and an "(agent)" suffix; the system gets a Cpu
 * icon and its adapter name (github, oasdiff, lab, docs).
 */
export function ActorChip({
  kind = 'user',
  memberId,
  adapter,
  className,
}: {
  kind?: ActorKind | undefined;
  memberId?: string | undefined;
  adapter?: string | undefined;
  className?: string | undefined;
}) {
  const t = useT(kitMessages);
  if (kind === 'system') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-body-sm text-muted-foreground', className)}>
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted">
          <Cpu aria-hidden className="size-3" strokeWidth={1.75} />
        </span>
        <span translate="no">{adapter ?? t.actor.system}</span>
      </span>
    );
  }
  return <MemberChip agent={kind === 'agent'} memberId={memberId} className={className} />;
}

/** Its own component, so that reading the member is not a hook behind a condition. */
function MemberChip({
  agent,
  memberId,
  className,
}: {
  agent: boolean;
  memberId?: string | undefined;
  className?: string | undefined;
}) {
  const t = useT(kitMessages);
  const member = useMember(memberId);
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-body-sm text-foreground', className)}>
      <Avatar member={member} size="xs" agent={agent} />
      <span>{member?.name ?? t.actor.system}</span>
      {agent && <span className="text-muted-foreground">{t.actor.agentSuffix}</span>}
    </span>
  );
}
