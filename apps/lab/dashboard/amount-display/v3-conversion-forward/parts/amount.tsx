import { useMemo, useState, type ReactNode } from 'react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { Badge } from '@dash/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@dash/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@dash/components/ui/tooltip';
import { fill, messages } from '../i18n';
import { CurrencySign } from './currency-sign';
import { nameOf, showsSign, useEnv } from './env';
import { FSI, PDI, amountParts, type AmountContext } from './money-core';

export interface AmountProps {
  /** Decimal string from the API; null/undefined renders a dash. */
  value: string | null | undefined;
  currency: string;
  context?: AmountContext;
  compact?: 'auto' | 'always' | 'never';
  /** Table only: the column decision (largest value of the column >= 1M), made once by the caller. */
  columnCompact?: boolean;
  tone?: 'neutral' | 'positive' | 'negative' | 'muted';
  /** The surrounding view mixes currencies (decision c: "$" or "USD"). */
  multi?: boolean;
  /** Skip the chip style (tooltips, plain prose). */
  plain?: boolean;
  /** The figure was converted from this currency: the exact popover says so. */
  from?: string;
  /** Turn the exact-value trigger off (default: on for compacted kpi / chart / list). */
  noTrigger?: boolean;
  /** Table cells: hover text (e.g. the equivalent). Never a focusable control. */
  hint?: ReactNode;
  /** The rate behind this figure is an estimate. */
  estimated?: boolean;
  className?: string;
}

const TONE: Record<NonNullable<AmountProps['tone']>, string> = {
  neutral: '',
  positive: 'text-success-soft-foreground',
  negative: 'text-destructive',
  muted: 'text-muted-foreground',
};

/** The one display element. It inherits the font size of its surroundings; nothing here sets one. */
export function Amount(props: AmountProps) {
  const { value, currency, context = 'inline', compact, columnCompact, tone = 'neutral', multi, plain, from, noTrigger, hint, estimated, className } = props;
  const env = useEnv();
  const t = useT(messages);
  const [pop, setPop] = useState(false);
  const [tip, setTip] = useState(false);

  const parts = useMemo(
    () => (value == null || value === '' ? null : amountParts({ value, currency, context, compact, columnCompact })),
    [value, currency, context, compact, columnCompact],
  );

  if (!parts) {
    return (
      <span className={cn('text-muted-foreground', className)} aria-label={t.noAmount}>
        —
      </span>
    );
  }

  const style = plain ? 'plain' : context === 'kpi' || context === 'detail' ? 'chip' : context === 'table' ? 'muted' : 'plain';
  const sign = showsSign(env, currency, !!multi);
  const trailing = env.lang === 'ar' && env.dec.arNegative === 'trailing' && parts.negative;
  const label = `${FSI}${parts.negative ? '-' : ''}${parts.exact}${PDI} ${nameOf(env, currency)}`;

  const signNode = sign ? (
    <CurrencySign code={currency} className={cn(style === 'muted' && 'opacity-70')} />
  ) : (
    <span className={cn('font-bold uppercase', style === 'chip' ? 'text-[.42em] tracking-wide' : 'text-[.78em]', style === 'muted' && 'text-muted-foreground')}>
      {currency}
    </span>
  );

  const core = (
    <bdi
      dir="ltr"
      className={cn('inline-flex whitespace-nowrap tabular-nums', style === 'chip' ? 'items-center' : 'items-baseline', TONE[tone], className)}
      style={{ ['--sign-box' as string]: `${env.dec.box}em` }}
    >
      {style === 'chip' ? (
        <span className="me-[.25em] inline-flex min-w-[1.5em] items-center justify-center rounded-[.3em] bg-muted px-[.3em] py-[.1em] text-foreground">{signNode}</span>
      ) : (
        <span className="me-[.25em] inline-flex items-baseline">{signNode}</span>
      )}
      {parts.negative && !trailing && <span>-</span>}
      <span>{parts.number}</span>
      {parts.unit && <span>{parts.unit}</span>}
      {trailing && <span>-</span>}
    </bdi>
  );

  const withTag = (node: ReactNode) =>
    estimated ? (
      <span className="inline-flex items-baseline gap-1.5">
        {node}
        <Badge variant="warning" className="px-1.5 py-0 text-10 leading-4">
          {t.estimatedShort}
        </Badge>
      </span>
    ) : (
      node
    );

  const wantsTrigger = parts.compacted && !noTrigger && context !== 'table' && context !== 'detail' && context !== 'inline';

  if (wantsTrigger) {
    return withTag(
      <Popover open={pop} onOpenChange={setPop}>
        <Tooltip open={tip && !pop} onOpenChange={setTip}>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={label}
                className="-mx-1 inline-flex cursor-help rounded-md px-1 text-start outline-none transition-colors hover:bg-muted/70 focus-visible:ring-[3px] focus-visible:ring-ring/60"
              >
                {core}
              </button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent className="text-13 font-semibold">
            <Amount value={value} currency={currency} context="detail" plain noTrigger multi={multi} />
          </TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-72 space-y-2 p-3 text-start">
          <p className="text-11 font-medium text-muted-foreground">{t.exactValue}</p>
          <Amount value={value} currency={currency} context="detail" multi={multi} className="text-2xl font-black" noTrigger />
          <p className="text-12 text-muted-foreground">{nameOf(env, currency)}</p>
          {from && (
            <p className="rounded-lg bg-muted/60 p-2 text-12 leading-5 text-muted-foreground">{fill(t.convertedFromDays, { cur: from })}</p>
          )}
          {from && (
            <button
              type="button"
              onClick={() => {
                setPop(false);
                env.openReceipt(currency);
              }}
              className="text-12 font-bold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/60"
            >
              {t.howCalc}
            </button>
          )}
        </PopoverContent>
      </Popover>,
    );
  }

  const labelled = (
    <span role="img" aria-label={label} className="inline-flex">
      <span aria-hidden className="inline-flex">
        {core}
      </span>
    </span>
  );

  if (hint && context === 'table') {
    return withTag(
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-default">{labelled}</span>
        </TooltipTrigger>
        <TooltipContent className="text-12">{hint}</TooltipContent>
      </Tooltip>,
    );
  }
  return withTag(labelled);
}

/** Muted converted equivalent: "≈ SAR 4,687.50" (decision d toggles the prefix). Never an interactive control. */
export function Equivalent({ value, currency, multi, className }: { value: string; currency: string; multi?: boolean; className?: string }) {
  const env = useEnv();
  return (
    <span dir="ltr" className={cn('inline-flex items-baseline gap-1 text-muted-foreground', className)}>
      {env.dec.approx && <span aria-hidden>≈</span>}
      <Amount value={value} currency={currency} context="detail" plain multi={multi} />
    </span>
  );
}
