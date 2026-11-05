import { Fragment, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Bot, Check, Copy, type LucideIcon } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { CardType, Member, Priority } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { avatarClass, focusRing, prioClass, typeClass, typeIcon } from './type-meta';

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
    <bdi dir="ltr" translate={mono ? 'no' : undefined} className={cn(mono && 'key', className)}>
      {children}
    </bdi>
  );
}

/**
 * Card titles arrive as plain text. Endpoints and percentages inside them must stay LTR, or "(2%)"
 * renders "(%2)" in Arabic (critic: percent signs not isolated).
 */
const RICH = /((?:GET|POST|PUT|PATCH|DELETE)\s+\/\S*|\d+(?:\.\d+)?%)/;
export function rich(text: string): ReactNode[] {
  return text.split(RICH).map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
    return (
      <Ltr key={i} mono={part.includes('/')}>
        {part}
      </Ltr>
    );
  });
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
        'inline-flex shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed',
        size === 'md' ? 'h-11 px-4 text-body md:h-10' : 'h-11 px-3 text-body-sm md:h-9',
        variant === 'primary' && 'bg-primary font-semibold text-primary-foreground hover:bg-primary-hover',
        variant === 'outline' && 'border border-(--reef-control) bg-card text-foreground hover:bg-accent',
        variant === 'ghost' && 'text-muted-foreground hover:bg-accent hover:text-foreground',
        focusRing,
        className,
      )}
      {...rest}
    />
  );
}

export function CopyButton({ text, className }: { text: string; className?: string }) {
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
        'inline-flex h-11 max-w-full touch-manipulation items-center gap-2 rounded-lg border border-(--reef-control) bg-card px-3 text-body-sm text-foreground transition-colors duration-150 hover:bg-accent md:h-9',
        focusRing,
        className,
      )}
    >
      <code dir="ltr" translate="no" className="key truncate">
        {text}
      </code>
      <Icon aria-hidden className={cn('size-3.5 shrink-0', copied ? 'text-success-soft-foreground' : 'text-muted-foreground')} strokeWidth={1.75} />
      <span role="status" className="sr-only">
        {copied ? t.copy.copied : ''}
      </span>
    </button>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      dir="ltr"
      className={cn('key inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-(--reef-control) bg-card px-1.5 text-caption text-foreground', className)}
    >
      {children}
    </kbd>
  );
}

// ── Card atoms (docs/08 §5.1) ──────────────────────────────────────────────────────────────────

const BADGE = {
  xs: { box: 'size-5', icon: 'size-3' },
  sm: { box: 'size-6', icon: 'size-3.5' },
  md: { box: 'size-8', icon: 'size-4' },
  lg: { box: 'size-10', icon: 'size-5' },
} as const;

/** The one place a row shows colour: a small round badge carrying the type's icon (shape, not hue alone). */
export function TypeIcon({ type, size = 'lg', icon, className }: { type: CardType; size?: keyof typeof BADGE; icon?: LucideIcon; className?: string }) {
  const Icon = icon ?? typeIcon[type];
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full', BADGE[size].box, typeClass[type].soft, typeClass[type].fg, className)}>
      <Icon className={BADGE[size].icon} strokeWidth={1.75} />
    </span>
  );
}

/** P0 and P1 earn a mark; P2 and P3 stay out of dense lists (docs/08 §5.1). `always` is for the details panel. */
export function PriorityMark({ p, always = false, className }: { p: Priority; always?: boolean; className?: string }) {
  if (!always && (p === 'P2' || p === 'P3')) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 font-medium', prioClass[p], className)}>
      {p === 'P0' && <span aria-hidden className="size-1.5 rounded-full bg-prio-p0" />}
      <Ltr mono>{p}</Ltr>
    </span>
  );
}

/** Inline reference in prose: a tiny type badge + the key. A hit area wider than the chip on phones. */
export function CardChip({ k, type, title, className }: { k: string; type: CardType; title?: string; className?: string }) {
  const t = useT(messages);
  return (
    <HubLink
      to={`/cards/${k}`}
      title={title ?? fmt(t.letter.cardLink, { type: t.types[type], key: k })}
      className={cn(
        'relative inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background py-px ps-0.5 pe-2 align-baseline text-caption text-foreground no-underline transition-colors duration-150 after:absolute after:-inset-x-1 after:-inset-y-2 hover:bg-accent md:after:inset-0',
        className,
      )}
    >
      <TypeIcon type={type} size="xs" />
      <Ltr mono className="shrink-0">
        {k}
      </Ltr>
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
          'inline-flex items-center justify-center rounded-full leading-none font-semibold text-(--avatar-fg)',
          dims,
          member ? avatarClass[member.avatarColor] : 'bg-muted text-muted-foreground',
        )}
      >
        {member ? member.initials[locale] : ''}
      </span>
      {agent && (
        <span className="absolute -end-1 -bottom-1 inline-flex size-3.5 items-center justify-center rounded-full bg-card ring-1 ring-border">
          <Bot aria-hidden className="size-2.5 text-foreground" strokeWidth={2} />
        </span>
      )}
      {online !== undefined && (
        <span aria-hidden className={cn('absolute -end-1 -bottom-1 size-2.5 rounded-full ring-2 ring-background', online ? 'bg-success' : 'bg-(--reef-control)')} />
      )}
    </span>
  );
}

// ── Layout atoms ───────────────────────────────────────────────────────────────────────────────

/** A section title. `tabIndex=-1` so focus can land here when its list empties, or from a hero number. */
export function SectionHead({ id, title, aside, sub, className }: { id: string; title: string; aside?: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-4 gap-y-0.5', className)}>
      <h2 id={id} tabIndex={-1} className="reef-h2 scroll-mt-6 rounded-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background">
        {title}
      </h2>
      {sub && <p className="text-body-sm text-muted-foreground">{sub}</p>}
      {aside && <div className="ms-auto flex items-center gap-2">{aside}</div>}
    </div>
  );
}

export function RailHead({ id, title, sub }: { id: string; title: string; sub?: ReactNode }) {
  return (
    <div>
      <h2 id={id} className="reef-h3 text-foreground">
        {title}
      </h2>
      {sub && <p className="mt-0.5 text-body-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, className }: { icon: LucideIcon; title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-3 py-2', className)}>
      <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-title-sm font-semibold text-foreground">{title}</p>
        {children && <div className="mt-0.5 text-body text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('rounded-md bg-muted motion-safe:animate-pulse', className)} />;
}
