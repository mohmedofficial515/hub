import { Fragment, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Bot, Check, Copy, type LucideIcon } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { CardType, Member, Priority, Role } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { avatarClass, focusRing, prioClass, roleIcon, typeClass, typeIcon } from './type-meta';

// ── Text helpers ───────────────────────────────────────────────────────────────────────────────

/** Replace `{name}` placeholders with plain values. */
export const fmt = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/** Replace `{name}` placeholders with nodes, e.g. an LTR key inside an Arabic sentence. */
export function fill(template: string, slots: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return <Fragment key={i}>{m && m[1] in slots ? slots[m[1]] : part}</Fragment>;
  });
}

/** Card keys, commands, branches, numbers with units: always an LTR isolate (docs/08 §4). */
export function Ltr({ children, mono = false, className }: { children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <bdi dir="ltr" className={cn(mono && 'key', className)}>
      {children}
    </bdi>
  );
}

// ── Links and buttons ──────────────────────────────────────────────────────────────────────────

/** A link to a real Hub route. In the lab it must not navigate the frame. */
export function HubLink({ to, className, children, ...rest }: Omit<ComponentProps<'a'>, 'href'> & { to: string }) {
  const locale = useLocale();
  return (
    <a
      href={`/${locale}/goteav${to}`}
      onClick={(e) => e.preventDefault()}
      className={cn('rounded-sm', focusRing, className)}
      {...rest}
    >
      {children}
    </a>
  );
}

type ButtonProps = ComponentProps<'button'> & { variant?: 'primary' | 'outline' | 'ghost'; size?: 'sm' | 'md' };

export function Button({ variant = 'outline', size = 'md', className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-55',
        size === 'md' ? 'h-11 px-4 text-body md:h-9' : 'h-11 px-3 text-body-sm md:h-8',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary-hover',
        variant === 'outline' && 'border border-border bg-card text-foreground hover:bg-accent',
        variant === 'ghost' && 'text-muted-foreground hover:bg-accent hover:text-foreground',
        focusRing,
        className,
      )}
      {...rest}
    />
  );
}

export function CopyButton({ text, className, compact = false }: { text: string; className?: string; compact?: boolean }) {
  const t = useT(messages);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard can be blocked inside the lab iframe: fall back to a hidden selection.
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1500);
  };

  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={fmt(t.copy.label, { cmd: text })}
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-muted text-body-sm text-foreground transition-colors duration-150 hover:bg-accent',
        compact ? 'h-11 px-2.5 md:h-7' : 'h-11 px-3 md:h-8',
        focusRing,
        className,
      )}
    >
      <code dir="ltr" className="key truncate">
        {text}
      </code>
      <Icon aria-hidden className={cn('size-3.5 shrink-0', copied ? 'text-success' : 'text-muted-foreground')} strokeWidth={1.75} />
      <span role="status" className="sr-only">
        {copied ? t.copy.copied : ''}
      </span>
    </button>
  );
}

// ── Card atoms (docs/08 §5.1) ──────────────────────────────────────────────────────────────────

export function TypeDot({ type, className }: { type: CardType; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', typeClass[type].dot, className)} />;
}

/** Icon + label in the type's text colour: used on the type's own soft tint (awaiting cards). */
export function TypeLabel({ type, className }: { type: CardType; className?: string }) {
  const t = useT(messages);
  const Icon = typeIcon[type];
  return (
    <span className={cn('inline-flex items-center gap-1 text-caption font-medium', typeClass[type].fg, className)}>
      <Icon aria-hidden className="size-3.5" strokeWidth={1.75} />
      {t.types[type]}
    </span>
  );
}

export function TypeBadge({ type, className }: { type: CardType; className?: string }) {
  const t = useT(messages);
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-caption font-medium',
        typeClass[type].soft,
        typeClass[type].fg,
        className,
      )}
    >
      <TypeDot type={type} />
      {t.types[type]}
    </span>
  );
}

export function PriorityBadge({ p, className }: { p: Priority; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-full bg-card px-1.5 text-caption font-medium',
        prioClass[p],
        className,
      )}
    >
      {p === 'P0' && <span aria-hidden className="size-1.5 rounded-full bg-prio-p0" />}
      <Ltr mono>{p}</Ltr>
    </span>
  );
}

export function RoleBadge({ role, routed = false, className }: { role: Role; routed?: boolean; className?: string }) {
  const t = useT(messages);
  const Icon = roleIcon[role];
  return (
    <span
      title={routed ? fmt(t.routed, { role: t.roles[role] }) : t.roles[role]}
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-full border border-border bg-card px-1.5 text-caption text-muted-foreground',
        className,
      )}
    >
      {routed && <span aria-hidden className="size-1.5 rounded-full bg-primary" />}
      <Icon aria-hidden className="size-3" strokeWidth={1.75} />
      {t.roles[role]}
    </span>
  );
}

/** Inline reference: dot + key (+ optional title). Used in the letter and focus chips. */
export function CardChip({
  k,
  type,
  title,
  className,
}: {
  k: string;
  type: CardType;
  title?: string;
  className?: string;
}) {
  const t = useT(messages);
  return (
    <HubLink
      to={`/cards/${k}`}
      title={title ?? fmt(t.letter.cardLink, { type: t.types[type], key: k })}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-2 align-middle text-caption leading-5 text-foreground hover:bg-accent',
        className,
      )}
    >
      <TypeDot type={type} />
      <Ltr mono className="shrink-0 text-muted-foreground">
        {k}
      </Ltr>
      {title && <span className="truncate">{title}</span>}
    </HubLink>
  );
}

export function Avatar({
  member,
  size = 'sm',
  agent = false,
  online,
  className,
}: {
  member?: Member;
  size?: 'xs' | 'sm' | 'md';
  agent?: boolean;
  online?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const dims = size === 'xs' ? 'size-5 text-caption tracking-tighter' : size === 'sm' ? 'size-6 text-caption' : 'size-8 text-body-sm';
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        aria-hidden
        className={cn(
          'inline-flex items-center justify-center rounded-full font-semibold text-(--avatar-fg)',
          dims,
          member ? avatarClass[member.avatarColor] : 'bg-muted text-muted-foreground',
        )}
      >
        {member ? member.initials[locale] : '·'}
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

// ── Status pills (status always in words + icon, never colour alone) ─────────────────────────

const toneClass = {
  danger: 'bg-destructive-soft text-destructive-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
  success: 'bg-success-soft text-success-soft-foreground',
  info: 'bg-info-soft text-info-soft-foreground',
  muted: 'bg-card text-muted-foreground',
} as const;

export function Pill({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: keyof typeof toneClass;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-full px-2 text-caption font-medium whitespace-nowrap',
        toneClass[tone],
        className,
      )}
    >
      {Icon && <Icon aria-hidden className="size-3" strokeWidth={2} />}
      {children}
    </span>
  );
}

// ── Layout atoms ───────────────────────────────────────────────────────────────────────────────

export function SectionHead({
  id,
  icon: Icon,
  title,
  count,
  aside,
  className,
  level = 2,
}: {
  id: string;
  icon?: LucideIcon;
  title: string;
  count?: number;
  aside?: ReactNode;
  className?: string;
  level?: 2 | 3;
}) {
  const H = level === 2 ? 'h2' : 'h3';
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      <H id={id} className="flex items-center gap-2 text-title-sm font-semibold text-foreground">
        {Icon && <Icon aria-hidden className="size-4.5 text-muted-foreground" strokeWidth={1.75} />}
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-muted px-2 text-caption font-medium text-muted-foreground tabular-nums">
            <Ltr>{count}</Ltr>
          </span>
        )}
      </H>
      {aside && <div className="ms-auto flex items-center gap-2">{aside}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border border-dashed border-border px-4 py-4', className)}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-body font-medium text-foreground">{title}</p>
        {children && <div className="mt-1 text-body-sm text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('rounded-md bg-muted motion-safe:animate-pulse', className)} />;
}
