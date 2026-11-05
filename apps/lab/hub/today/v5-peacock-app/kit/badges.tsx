import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { CardType, Priority, Role } from '@lab/mocks/hub-app';
import { kitMessages } from './i18n';
import { prioClass, roleIcon, statusIcon, statusTone, toneClass, typeClass, typeIcon, type Tone } from './meta';
import { fmt, Ltr } from './text';

/** 8 px circle in the type colour. Always paired with visible or sr-only text (08 §6). */
export function TypeDot({ type, className }: { type: CardType; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', typeClass[type].dot, className)} />;
}

/**
 * The coloured type icon of the owner's card rule: one neutral surface with one neutral border, and this icon with the type word.
 * `labelled` adds the type word beside it. Without it, the word is sr-only.
 */
export function TypeIcon({ type, labelled = false, size = 'sm', className }: { type: CardType; labelled?: boolean; size?: 'sm' | 'md'; className?: string }) {
  const t = useT(kitMessages);
  const Icon = typeIcon[type];
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 text-caption font-medium', typeClass[type].fg, className)}>
      <Icon aria-hidden className={size === 'md' ? 'size-5' : 'size-4'} strokeWidth={1.75} />
      <span className={labelled ? undefined : 'sr-only'}>{t.types[type]}</span>
    </span>
  );
}

/** Pill with dot + type word on the type's soft tint. Soft tints exist for small badges only. */
export function TypeBadge({ type, className }: { type: CardType; className?: string }) {
  const t = useT(kitMessages);
  return (
    <span className={cn('inline-flex h-5.5 items-center gap-1.5 rounded-full px-2 text-caption font-medium whitespace-nowrap', typeClass[type].soft, typeClass[type].fg, className)}>
      <TypeDot type={type} />
      {t.types[type]}
    </span>
  );
}

/** Generic status pill: icon + words on a soft tone, so a status is never colour alone. */
export function Pill({ tone = 'muted', icon: Icon, children, className }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-5.5 items-center gap-1 rounded-full px-2 text-caption font-medium whitespace-nowrap', toneClass[tone], className)}>
      {Icon && <Icon aria-hidden className="size-3" strokeWidth={2} />}
      {children}
    </span>
  );
}

/** Label from `cards.status`, tone from 08 §5.1. Any status string works; unknown ones print as they are. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const t = useT(kitMessages);
  return (
    <Pill tone={statusTone(status)} icon={statusIcon(status)} className={className}>
      {t.status[status] ?? status}
    </Pill>
  );
}

/** The one marker for "this one is mine" on a row or a desk (review M5, M6). The Mine filter never hides it. */
export function MineMark({ className }: { className?: string }) {
  const t = useT(kitMessages);
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-body-sm font-medium text-foreground', className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-foreground" />
      {t.mineMark}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-caption font-medium', prioClass[priority], className)}>
      {priority === 'P0' && <span aria-hidden className="size-1.5 rounded-full bg-prio-p0" />}
      <Ltr mono>{priority}</Ltr>
    </span>
  );
}

/**
 * Icon + role word. `routed` adds the filled dot for "one of my roles" (08 P3); leave it off where everything is
 * routed to me by definition, as in Awaiting me. `outline={false}` drops the border for meta lines. `iconOnly` keeps the
 * word for screen readers and in `title`, for dense rows.
 */
export function RoleBadge({ role, routed = false, outline = true, iconOnly = false, className }: { role: Role; routed?: boolean; outline?: boolean; iconOnly?: boolean; className?: string }) {
  const t = useT(kitMessages);
  const Icon = roleIcon[role];
  return (
    <span
      title={routed ? fmt(t.routed, { role: t.roles[role] }) : t.roles[role]}
      className={cn('inline-flex items-center gap-1 text-caption text-muted-foreground', outline && 'h-5.5 rounded-full border border-border bg-card px-2', className)}
    >
      {routed && <span aria-hidden className="size-1.5 rounded-full bg-foreground" />}
      <Icon aria-hidden className={iconOnly ? 'size-3.5' : 'size-3'} strokeWidth={1.75} />
      <span className={iconOnly ? 'sr-only' : undefined}>{t.roles[role]}</span>
    </span>
  );
}
