/**
 * `<Amount>`: the one element that prints money (plan 5.2). Quiet figures:
 *  - the number is the hero and inherits size, weight and colour from the surrounding text (no `size` prop)
 *  - the sign / code and the K / M / B unit are lighter and in muted-foreground
 *  - cents are lighter than the integer part, never in compact values
 *  - one LTR isolate holds [sign][space][minus][number][unit], so Arabic and English print the same picture (SAMA rules 1-4)
 *  - one aria-label with the exact amount; the sign is aria-hidden
 */
import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@lab/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@dash/components/ui/popover';
import { CurrencySign, hasSign } from './currency-sign';
import { infoOf } from './data';
import { useLab, type Lab } from './env';
import { amountParts, partsNumber, type AmountParts, type CompactMode, type MoneyContext } from './money-core';

export type Tone = 'neutral' | 'positive' | 'negative' | 'muted';

const TONES: Record<Tone, string> = {
  neutral: '',
  positive: 'text-success',
  negative: 'text-destructive',
  muted: 'text-muted-foreground',
};

/** Sign (SVG) when the currency has an official one, else the ISO code. USD can fall back to its code in mixed tables (question c). */
export function markKind(code: string, lab: Lab, mixed: boolean): 'sign' | 'code' {
  if (!lab.catalogReady) return 'code';
  if (code === 'USD' && mixed && lab.decisions.dollar === 'code') return 'code';
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
  /** Table only: the column decision (largest value of the column >= 1M). */
  columnCompact?: boolean;
  tone?: Tone;
  /** The column / list mixes currencies (USD may print as code, question c). */
  mixed?: boolean;
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
  columnCompact,
  tone = 'neutral',
  mixed = false,
  mark = 'auto',
  className,
}: Omit<AmountProps, 'tag' | 'reveal' | 'revealNote'>) {
  const lab = useLab();
  const parts = amountParts(value, currency, { context, compact, columnCompact });
  if (!parts) {
    return (
      <span role="img" aria-label={lab.t.states.noValue} className={cn('text-muted-foreground', className)}>
        {'—'}
      </span>
    );
  }
  const kind = mark === 'none' ? null : markKind(currency, lab, mixed);
  const samaAr = lab.locale === 'ar' && lab.decisions.negative === 'sama-ar';
  const minus = parts.negative && !samaAr ? '-' : '';
  const trailingMinus = parts.negative && samaAr ? '-' : '';
  const cents = parts.frac && !parts.compacted;
  return (
    <bdi
      dir="ltr"
      role="img"
      aria-label={amountLabel(parts, lab)}
      className={cn('inline-block whitespace-nowrap tabular-nums', TONES[tone], className)}
    >
      {kind === 'sign' && <CurrencySign code={currency} scale={lab.signScale} className="text-muted-foreground" />}
      {kind === 'code' && (
        <span aria-hidden className="me-[0.3em] align-baseline text-[0.72em] font-medium tracking-wide text-muted-foreground">
          {currency}
        </span>
      )}
      <span aria-hidden>
        {minus}
        {parts.int}
        {parts.frac && (cents ? <span className="font-normal opacity-60">.{parts.frac}</span> : <span>.{parts.frac}</span>)}
        {parts.unit && <span className="ms-[0.04em] text-[0.8em] font-medium text-muted-foreground">{parts.unit}</span>}
        {trailingMinus}
      </span>
    </bdi>
  );
}

/** Amount with the exact-value access of compacted figures and an optional tiny tag. */
export function Amount(props: AmountProps) {
  const lab = useLab();
  const { reveal = true, revealNote, tag, value, currency, context = 'detail', compact = 'auto', columnCompact, mixed } = props;
  const parts = amountParts(value, currency, { context, compact, columnCompact });
  const view = <AmountView {...props} />;
  const tagNode = tag ? (
    <span className="ms-1.5 inline-block rounded border border-border px-1 align-middle text-[10px] font-semibold leading-4 text-muted-foreground">{tag}</span>
  ) : null;
  const canReveal = reveal && parts?.compacted && (context === 'kpi' || context === 'chart' || context === 'list');
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
            <AmountView value={value} currency={currency} context="detail" mixed={mixed} className="text-15 font-bold" />
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
 * Exact value on demand, with no button inside a table cell: desktop hover, keyboard focus (focus ring) and touch tap all open the same card.
 * Radix tooltips do not open by touch (plan 3), so this is a Popover opened by pointer-enter (mouse only), focus-visible or click.
 */
export function Reveal({ children, content, label, className }: { children: ReactNode; content: ReactNode; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const hover = useRef(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onPointerEnter={(e) => {
            if (e.pointerType === 'mouse') {
              hover.current = true;
              setOpen(true);
            }
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse' && hover.current) {
              hover.current = false;
              setOpen(false);
            }
          }}
          onFocus={(e) => {
            if (e.currentTarget.matches(':focus-visible')) setOpen(true);
          }}
          onClick={(e) => {
            // a mouse click while the hover card is open keeps it open (no flicker); touch and keyboard toggle
            if (hover.current) e.preventDefault();
          }}
          className={cn(
            'inline-block cursor-help rounded-sm align-baseline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            className,
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={6}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-auto min-w-40 max-w-[min(22rem,calc(100vw-1.5rem))] rounded-lg p-3 text-start"
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
      <AmountView value={value} currency={currency} context={context} />
    </span>
  );
}

export { partsNumber };
