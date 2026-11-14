/**
 * `<Amount>`: the one element that prints money (plan 5.2). Calm figures:
 *  - the number is the hero and inherits size, weight and colour from the surrounding text (no `size` prop)
 *  - the sign / code and the K / M / B / T unit are lighter and in muted-foreground (never below 11px)
 *  - cents are softened ONLY on plain foreground text (`softCents`): never on muted or semantic tones, never in compact values
 *  - one LTR isolate holds [sign][space][minus][number][unit], so Arabic and English print the same picture (SAMA rules 1-4)
 *  - one aria-label with the exact amount; the sign is aria-hidden
 */
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@lab/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@dash/components/ui/popover';
import { CurrencySign, hasSign } from './currency-sign';
import { infoOf } from './data';
import { dollarMark, useLab, type Lab } from './env';
import { amountParts, partsNumber, type AmountParts, type CompactMode, type MoneyContext, type Unit } from './money-core';

export type Tone = 'neutral' | 'positive' | 'negative' | 'muted';

const TONES: Record<Tone, string> = {
  neutral: '',
  positive: 'text-success',
  negative: 'text-destructive',
  muted: 'text-muted-foreground',
};

/** Sign (SVG) when the currency has an official one, else its ISO code. The dollar follows ONE page-wide decision (question c). */
export function markKind(code: string, lab: Lab): 'sign' | 'code' {
  if (!lab.catalogReady) return 'code';
  if (code === 'USD' && dollarMark(lab.decisions) === 'code') return 'code';
  return hasSign(code) ? 'sign' : 'code';
}

/** "1,250,000.00 US dollars" / "1,250,000.00 دولار أمريكي". The exact amount, never the compact one. */
export function amountLabel(p: AmountParts, lab: Lab): string {
  const info = infoOf(p.currency);
  const name = info ? (lab.locale === 'ar' ? info.nameAr : info.pluralEn) : p.currency;
  const minus = p.negative ? (lab.locale === 'ar' ? 'سالب ' : 'minus ') : '';
  return `${minus}${p.exact} ${name}`;
}

export interface AmountProps {
  value: string | null | undefined;
  currency: string;
  context?: MoneyContext;
  compact?: CompactMode;
  /** Table only: the ONE unit of the whole column (`columnScale`), null = exact. */
  columnUnit?: Unit | null;
  tone?: Tone;
  /** Soften the cents (default: only for the neutral tone). Pass false inside muted parents. */
  softCents?: boolean;
  /** `none` = the column header already names the single currency: print the number only. */
  mark?: 'auto' | 'none';
  /** Tiny tag after the amount, e.g. "USD" on balances. */
  tag?: string;
  /** Show the exact value on hover / focus / tap when the amount is compacted (kpi, chart, list). Default on. */
  reveal?: boolean;
  /** Extra content of the reveal card (e.g. the converted note). */
  revealNote?: ReactNode;
  className?: string;
}

/** Pure rendering of the parts. No interaction. */
export function AmountView({
  value,
  currency,
  context = 'detail',
  compact = 'auto',
  columnUnit,
  tone = 'neutral',
  softCents,
  mark = 'auto',
  className,
}: Omit<AmountProps, 'tag' | 'reveal' | 'revealNote'>) {
  const lab = useLab();
  const parts = amountParts(value, currency, { context, compact, columnUnit });
  if (!parts) {
    return (
      <span role="img" aria-label={lab.t.states.noValue} className={cn('text-muted-foreground', className)}>
        {'—'}
      </span>
    );
  }
  const kind = mark === 'none' ? null : markKind(currency, lab);
  const samaAr = lab.locale === 'ar' && lab.decisions.negative === 'sama-ar';
  const minus = parts.negative && !samaAr ? '-' : '';
  const trailingMinus = parts.negative && samaAr ? '-' : '';
  const soft = (softCents ?? tone === 'neutral') && !parts.compacted;
  return (
    <bdi
      dir="ltr"
      role="img"
      aria-label={amountLabel(parts, lab)}
      className={cn('inline-block whitespace-nowrap tabular-nums', TONES[tone], className)}
    >
      {kind === 'sign' && <CurrencySign code={currency} scale={lab.signScale} className="text-muted-foreground" />}
      {kind === 'code' && (
        <span aria-hidden className="me-[0.3em] align-baseline text-[max(11px,0.72em)] font-medium tracking-wide text-muted-foreground">
          {currency}
        </span>
      )}
      <span aria-hidden>
        {minus}
        {parts.int}
        {parts.frac && (soft ? <span className="font-normal opacity-75">.{parts.frac}</span> : <span>.{parts.frac}</span>)}
        {parts.unit && <span className="ms-[0.04em] text-[max(11px,0.8em)] font-medium text-muted-foreground">{parts.unit}</span>}
        {trailingMinus}
      </span>
    </bdi>
  );
}

/** Amount with the exact-value access of compacted figures and an optional tiny tag. */
export function Amount(props: AmountProps) {
  const lab = useLab();
  const { reveal = true, revealNote, tag, value, currency, context = 'detail', compact = 'auto', columnUnit, ...viewProps } = props;
  const parts = amountParts(value, currency, { context, compact, columnUnit });
  const view = <AmountView value={value} currency={currency} context={context} compact={compact} columnUnit={columnUnit} {...viewProps} />;
  const tagNode = tag ? (
    <span className="ms-1.5 inline-block rounded border border-border px-1 align-middle text-[11px] font-semibold leading-4 text-muted-foreground">{tag}</span>
  ) : null;
  const canReveal = reveal && parts?.compacted && (context === 'kpi' || context === 'chart' || context === 'list' || context === 'table');
  if (!parts || !canReveal) {
    return (
      <>
        {view}
        {tagNode}
      </>
    );
  }
  return (
    <>
      <Reveal
        label={amountLabel(parts, lab)}
        content={
          <div className="grid gap-1">
            <span className="text-11 font-semibold text-muted-foreground">{lab.t.reveal.exact}</span>
            <AmountView value={value} currency={currency} context="detail" className="text-15 font-bold" />
            {revealNote}
          </div>
        }
      >
        {view}
      </Reveal>
      {tagNode}
    </>
  );
}

/**
 * Exact value on demand, with no real button inside a table cell: the trigger is a `span role="button"`, so mouse hover, keyboard
 * focus-visible and touch tap open the same card. The card is selectable (copy the exact figure): hovering it keeps it open.
 * Review P1-1: Radix returned focus to the trigger on close and `onFocus` re-opened the card. Now `onCloseAutoFocus` is prevented;
 * focus is only returned by hand after Escape, with the open-on-focus guard raised.
 */
export function Reveal({ children, content, label, className }: { children: ReactNode; content: ReactNode; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const mode = useRef<'hover' | 'sticky'>('sticky');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const guard = useRef(false);
  const esc = useRef(false);
  const trigger = useRef<HTMLSpanElement>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const leave = () => {
    if (mode.current !== 'hover') return;
    cancel();
    timer.current = setTimeout(() => setOpen(false), 140);
  };
  const enter = (pointerType: string) => {
    if (pointerType !== 'mouse') return;
    cancel();
    if (!open) mode.current = 'hover';
    setOpen(true);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.currentTarget.click();
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        cancel();
        setOpen(v);
        if (!v) mode.current = 'sticky';
      }}
    >
      <PopoverTrigger asChild>
        <span
          ref={trigger}
          role="button"
          tabIndex={0}
          aria-label={label}
          aria-haspopup="dialog"
          onKeyDown={onKeyDown}
          onPointerEnter={(e) => enter(e.pointerType)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && leave()}
          onFocus={(e) => {
            if (guard.current) return;
            if (e.currentTarget.matches(':focus-visible')) {
              mode.current = 'sticky';
              setOpen(true);
            }
          }}
          onClick={(e) => {
            // Radix would toggle; we decide: a click on a hover-opened card pins it, otherwise toggle
            e.preventDefault();
            cancel();
            if (open && mode.current === 'hover') mode.current = 'sticky';
            else {
              mode.current = 'sticky';
              setOpen(!open);
            }
          }}
          className={cn(
            'inline-block cursor-help rounded-sm align-baseline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            className,
          )}
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={6}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={() => {
          esc.current = true;
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (esc.current) {
            esc.current = false;
            guard.current = true;
            trigger.current?.focus({ preventScroll: true });
            guard.current = false;
          }
        }}
        onPointerEnter={(e) => e.pointerType === 'mouse' && cancel()}
        onPointerLeave={(e) => e.pointerType === 'mouse' && leave()}
        className="w-auto min-w-40 max-w-[min(22rem,calc(100vw-1.5rem))] select-text rounded-lg p-3 text-start"
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}

/** The converted equivalent: muted second line (detail pages) or the content of a table tooltip. */
export function Equivalent({
  value,
  currency,
  context = 'detail',
  className,
}: {
  value: string;
  currency: string;
  context?: MoneyContext;
  className?: string;
}) {
  const lab = useLab();
  return (
    <span className={cn('inline-flex items-baseline gap-1 text-muted-foreground', className)}>
      {lab.decisions.approx && (
        <span aria-hidden dir="ltr">
          {'≈'}
        </span>
      )}
      <span className="sr-only">{lab.t.n.approx}</span>
      <AmountView value={value} currency={currency} context={context} softCents={false} />
    </span>
  );
}

export { partsNumber };
