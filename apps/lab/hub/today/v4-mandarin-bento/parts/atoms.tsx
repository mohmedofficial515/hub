import { Fragment, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Check, Copy, type LucideIcon } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { CardType, Member, Priority } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { typeIcon } from './type-meta';

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

/** Card titles carry percentages and endpoints: isolate them, so "(2%)" never renders as "(%2)". */
export function Title({ text }: { text: string }) {
  const parts = text.split(/(\d+(?:\.\d+)?%|(?:GET|POST|PUT|PATCH|DELETE) \/\S+)/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Ltr key={i} mono={!part.endsWith('%')} className={part.endsWith('%') ? undefined : 'key-inline'}>
            {part}
          </Ltr>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

// ── Focus: on a solid tile the ring is the tile's own text colour, so it always shows ────────────

export const ring =
  'outline-none focus-visible:ring-2 focus-visible:ring-(--t-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--t-bg)';

/**
 * The row's title is its disclosure button, stretched over the row. The ring is drawn on the stretch,
 * so a focused row is outlined whole. The scroll margin keeps it clear of the fixed toast.
 */
export const rowTitle =
  'scroll-my-28 touch-manipulation text-start outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-(--t-ring) focus-visible:after:ring-inset';

// ── Links and buttons ──────────────────────────────────────────────────────────────────────────

/** A link to a real Hub route. In the lab it must not navigate the frame. */
export function HubLink({ to, className, children, ...rest }: Omit<ComponentProps<'a'>, 'href'> & { to: string }) {
  const locale = useLocale();
  return (
    <a
      href={`/${locale}/goteav${to}`}
      onClick={(e) => e.preventDefault()}
      className={cn('rounded-sm touch-manipulation', ring, className)}
      {...rest}
    >
      {children}
    </a>
  );
}

/** Jump to a tile on this page. The lab routes on `location.hash`, so it scrolls instead of navigating. */
export function JumpLink({ target, className, children }: { target: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={`#${target}`}
      onClick={(e) => {
        e.preventDefault();
        const el = document.getElementById(target);
        if (!el) return;
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
        el.focus({ preventScroll: true });
      }}
      className={cn('rounded-sm', ring, className)}
    >
      {children}
    </a>
  );
}

type ButtonProps = ComponentProps<'button'> & { variant?: 'primary' | 'outline' | 'ghost' };

/**
 * `primary` exists exactly once on the page: the lead item of Needs you. Everything else is an outline
 * in the colours of its tile. A button is 44 px on a phone and 40 px from 768 px.
 */
export function Button({ variant = 'outline', className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-11 shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-lg px-4 text-body font-bold whitespace-nowrap transition-colors duration-[120ms] ease-out md:h-10',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary-hover',
        variant === 'outline' && 'border-2 border-(--t-btn) text-(--t-fg) hover:bg-(--t-hover)',
        variant === 'ghost' && 'text-(--t-fg) hover:bg-(--t-hover)',
        ring,
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
        'inline-flex h-11 max-w-full touch-manipulation items-center gap-2 rounded-lg border border-(--t-btn) px-3 text-body-sm text-(--t-fg) transition-colors duration-[120ms] hover:bg-(--t-hover) md:h-8',
        ring,
        className,
      )}
    >
      <code dir="ltr" translate="no" className="key truncate">
        {text}
      </code>
      <Icon aria-hidden className="size-3.5 shrink-0 text-(--t-muted)" strokeWidth={1.75} />
      <span role="status" className="sr-only">
        {copied ? t.copy.copied : ''}
      </span>
    </button>
  );
}

// ── Tile shell ─────────────────────────────────────────────────────────────────────────────────

export type TileTone = 'ink' | 'orange' | 'green' | 'paper';
export type TileRule = 'blue' | 'orange' | 'yellow' | 'green' | 'cyan';

/**
 * A bento tile. Solid tones wear the section's colour on the whole surface. The paper tone wears it as
 * a thick 4 px rule at the top. The `tile-*` class publishes the `--t-*` palette every atom reads.
 */
export function Tile({
  tone = 'paper',
  rule,
  labelledBy,
  className,
  children,
}: {
  tone?: TileTone;
  rule?: TileRule;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn(
        `tile-${tone}`,
        rule && `rule-${rule}`,
        'relative min-w-0 rounded-2xl bg-(--t-bg) p-4 text-(--t-fg) md:p-6',
        tone === 'paper' && 'border border-border',
        rule && 'border-t-4 border-t-(--t-rule)',
        className,
      )}
    >
      {children}
    </section>
  );
}

/** A tile's heading: heavy Cairo, the count set as a lighter number beside it, not as a pill. */
export function TileHead({
  id,
  title,
  count,
  aside,
  className,
}: {
  id: string;
  title: ReactNode;
  count?: number;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-1', className)}>
      <h2 id={id} tabIndex={-1} className={cn('scroll-mt-4 rounded-sm text-title font-extrabold text-(--t-fg) md:text-headline', ring)}>
        {title}
      </h2>
      {count !== undefined && (
        <span className="text-title font-normal text-(--t-muted) tabular-nums md:text-headline">
          <Ltr>{count}</Ltr>
        </span>
      )}
      {aside && <div className="ms-auto">{aside}</div>}
    </header>
  );
}

// ── Item atoms: neutral on any tile ────────────────────────────────────────────────────────────

/** A card's type: icon + word in the tile's own colour. Never a tint (owner decision, this version). */
export function TypeTag({ type, className }: { type: CardType; className?: string }) {
  const t = useT(messages);
  const Icon = typeIcon[type];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-body-sm font-medium text-(--t-fg)', className)}>
      <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
      {t.types[type]}
    </span>
  );
}

export function CardKey({ k, className }: { k: string; className?: string }) {
  return (
    <Ltr mono className={cn('text-body-sm text-(--t-muted)', className)}>
      {k}
    </Ltr>
  );
}

/** P0 is the only priority that shouts: inverted on the tile's own colours. */
export function PriorityTag({ p, className }: { p: Priority; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-sm px-1.5 text-caption font-medium',
        p === 'P0' ? 'bg-(--t-fg) text-(--t-bg)' : 'border border-(--t-line) text-(--t-muted)',
        className,
      )}
    >
      <Ltr mono>{p}</Ltr>
    </span>
  );
}

/**
 * Status in words + icon, never colour alone.
 * `alarm` is red ink on paper: the single look of overdue, escalated, failing and breaking on any tile.
 * `warn` is orange ink on paper, for things due or lagging. `soon` is an outline in the tile's colours.
 */
export function Chip({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: 'alarm' | 'warn' | 'soon' | 'plain';
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 max-w-full items-center gap-1 rounded-full text-body-sm whitespace-nowrap',
        tone !== 'plain' && 'border px-2.5',
        tone === 'alarm' && 'border-(--alarm-fg) bg-(--alarm-bg) font-semibold text-(--alarm-fg)',
        tone === 'warn' && 'border-warning-strong bg-(--alarm-bg) font-semibold text-warning-strong',
        tone === 'soon' && 'border-(--t-btn) font-medium text-(--t-fg)',
        tone === 'plain' && 'text-(--t-muted)',
        className,
      )}
    >
      {Icon && <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Inline reference: type icon + key. The 44 px hit area on phones comes from the `after` slop. */
export function CardChip({ k, type, title, className }: { k: string; type: CardType; title?: string; className?: string }) {
  const t = useT(messages);
  const Icon = typeIcon[type];
  return (
    <HubLink
      to={`/cards/${k}`}
      title={title ?? fmt(t.letter.cardLink, { type: t.types[type], key: k })}
      className={cn(
        'relative inline-flex max-w-full items-center gap-1 rounded-full border border-(--t-line) px-2 align-baseline text-body-sm text-(--t-fg) after:absolute after:-inset-y-2.5 after:inset-x-0 hover:bg-(--t-hover) md:after:hidden',
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
      <Ltr mono className="shrink-0">
        {k}
      </Ltr>
      {title && <span className="truncate">{title}</span>}
    </HubLink>
  );
}

/** A monogram in the tile's own colours. People are not colour-coded on this page. */
export function Monogram({ member, size = 'sm', className }: { member?: Member; size?: 'sm' | 'md'; className?: string }) {
  const locale = useLocale();
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-(--t-chip) font-bold text-(--t-fg)',
        size === 'sm' ? 'size-7 text-caption' : 'size-9 text-body-sm',
        className,
      )}
    >
      {member ? member.initials[locale] : ''}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="key inline-flex h-6 min-w-6 items-center justify-center rounded-sm border border-(--t-btn) px-1.5 text-caption text-(--t-fg)">{children}</kbd>;
}

// ── Layout atoms ───────────────────────────────────────────────────────────────────────────────

export function EmptyNote({ icon: Icon, title, children, className }: { icon: LucideIcon; title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-(--t-muted)" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-body font-semibold text-(--t-fg)">{title}</p>
        {children && <div className="mt-1 text-body-sm text-(--t-muted)">{children}</div>}
      </div>
    </div>
  );
}

/** Expanded row details (the lab's stand-in for the CardSheet, opened with Enter / o). */
export function RowDetails({ id, rows, actions }: { id: string; rows: { label: string; value: ReactNode }[]; actions?: ReactNode }) {
  return (
    <div id={id} className="relative z-10 col-span-full mt-1 border-t border-(--t-line) pt-3">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-body-sm">
        {rows.map((r) => (
          <Fragment key={r.label}>
            <dt className="text-(--t-muted)">{r.label}</dt>
            <dd className="min-w-0 text-(--t-fg) wrap-anywhere">{r.value}</dd>
          </Fragment>
        ))}
      </dl>
      {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('rounded-md bg-(--t-chip) motion-safe:animate-pulse', className)} />;
}
