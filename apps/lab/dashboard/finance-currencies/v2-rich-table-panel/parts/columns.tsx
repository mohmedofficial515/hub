import type { ReactNode } from 'react';
import {
  Clock,
  Copy,
  Eye,
  EyeOff,
  History,
  Loader2,
  MoreHorizontal,
  PanelRightOpen,
  Percent,
  Pin,
  PinOff,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { convertUsd, fmtRate, parseDec, type PaymentMode } from '@lab/mocks/currencies';
import type { Locale } from '@lab/i18n';
import { cn } from '@lab/utils';
import { Button } from '@dash/components/ui/button';
import { Switch } from '@dash/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@dash/components/ui/dropdown-menu';
import { fill, type CurrencyMessages } from '../i18n';
import { fmtDate, fmtPct, localName, relTime, type Meta } from './derive';
import { CurrencyMark } from './marks';
import { Change, Ltr, Pill, Sparkline, SpreadBar, Tip } from './ui';

export type PanelSection = 'identity' | 'mode' | 'margin' | 'history' | 'pins';

export interface Act {
  open: (code: string, section?: PanelSection) => void;
  toggle: (code: string) => void;
  pin: (code: string) => void;
  revoke: (overrideId: string) => void;
  copy: (code: string) => void;
  refresh: (code: string) => void;
  busy: Set<string>;
}

export interface CellCtx {
  t: CurrencyMessages;
  locale: Locale;
  act: Act;
}

export type ColId =
  | 'abbr'
  | 'rate'
  | 'change'
  | 'source'
  | 'updated'
  | 'margin'
  | 'mode'
  | 'decimals'
  | 'preview'
  | 'visible'
  | 'freshness'
  | 'pin'
  | 'gateway';
export type Tab = 'rates' | 'pricing' | 'status';

export interface Col {
  id: ColId;
  tabs: Tab[];
  align: 'start' | 'end';
  /** Min width in px (applied from lg up). */
  w: number;
  /** Hidden below lg (tablets) and while the inline panel is open below 2xl, so no horizontal scroll. */
  lgOnly?: boolean;
  sort: (m: Meta) => number | string;
  render: (m: Meta, c: CellCtx) => ReactNode;
}

export const rateDigits = (code: string) => (code === 'USD' ? 2 : 4);

const num = (s: string) => Number(parseDec(s)) / 1e8;

export function nameTip(m: Meta, t: CurrencyMessages) {
  const c = m.row.currency;
  return (
    <span className="grid gap-1">
      {(['ar', 'en', 'tr'] as const).map((l) => (
        <span key={l} className="flex items-baseline gap-2">
          <span className="w-12 text-11 opacity-70">{t.lang[l]}</span>
          <bdi dir={l === 'ar' ? 'rtl' : 'ltr'} className="font-semibold">
            {c.names[l]}
          </bdi>
          <bdi dir={l === 'ar' ? 'rtl' : 'ltr'} className="opacity-80">
            {c.abbr[l]}
          </bdi>
        </span>
      ))}
    </span>
  );
}

export function IdentityCell({ m, ctx, compact }: { m: Meta; ctx: CellCtx; compact?: boolean }) {
  const { t, locale, act } = ctx;
  const c = m.row.currency;
  return (
    <Tip label={nameTip(m, t)} side="bottom">
      <button
        type="button"
        data-row-open={m.code}
        onClick={() => act.open(m.code)}
        aria-label={fill(t.rowOpen, { code: m.code })}
        className="group/id flex min-h-11 min-w-0 items-center gap-3 rounded-lg text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <CurrencyMark code={m.code} size={compact ? 36 : 44} ring={m.ring} dim={m.hidden} className="text-foreground" />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <Ltr className="font-mono text-15 font-extrabold tracking-wide">{m.code}</Ltr>
            {m.isBase && (
              <Pill tone="primary" className="h-5 px-1.5 text-11">
                {t.base}
              </Pill>
            )}
            {m.hidden && <EyeOff className="size-3.5 text-muted-foreground" aria-label={t.hiddenLabel} />}
          </span>
          <bdi className="block max-w-[6.5rem] truncate lg:max-w-32 xl:max-w-36 text-13 text-muted-foreground" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            {localName(c, locale)}
          </bdi>
        </span>
      </button>
    </Tip>
  );
}

function ModePill({ mode, degraded, t }: { mode: PaymentMode; degraded: boolean; t: CurrencyMessages }) {
  if (degraded)
    return (
      <Tip label={t.degradedTip}>
        <span>
          <Pill tone="warning">{t.degraded}</Pill>
        </span>
      </Tip>
    );
  return mode === 'CHARGEABLE' ? <Pill tone="success">{t.chargeable}</Pill> : <Pill tone="outline">{t.displayOnly}</Pill>;
}

const rtlText = (v: string, isAr: boolean) => (
  <bdi dir={isAr ? 'rtl' : 'ltr'} className="font-semibold">
    {v}
  </bdi>
);

export const COLUMNS: Col[] = [
  {
    id: 'abbr',
    tabs: ['rates'],
    align: 'start',
    lgOnly: true,
    w: 200,
    sort: (m) => m.row.currency.abbr.en,
    render: (m) => (
      <span className="flex flex-wrap gap-1">
        {(['ar', 'en', 'tr'] as const).map((l) => (
          <span key={l} className="inline-flex h-6 items-baseline gap-1 rounded-md border border-border/80 px-1.5 text-12 leading-6">
            <span className="text-11 uppercase text-muted-foreground" dir="ltr">
              {l}
            </span>
            {rtlText(m.row.currency.abbr[l], l === 'ar')}
          </span>
        ))}
      </span>
    ),
  },
  {
    id: 'rate',
    tabs: ['rates', 'pricing'],
    align: 'end',
    w: 140,
    sort: (m) => num(m.row.rate.effective),
    render: (m, { t }) => {
      const d = rateDigits(m.code);
      const r = m.row.rate;
      return (
        <span className="flex flex-col items-end gap-1">
          <span className="flex items-center gap-1.5">
            {m.pin && <Pin className="size-3.5 fill-current text-primary-text" aria-label={t.pinnedLabel} />}
            <Tip label={t.effectiveTip}>
              <Ltr className="cursor-help text-16 font-extrabold">{fmtRate(r.effective, d)}</Ltr>
            </Tip>
          </span>
          {!m.isBase && (
            <span className="flex items-center gap-2 whitespace-nowrap text-12 text-muted-foreground">
              <Tip label={t.rawTip}>
                <span className="cursor-help">
                  {t.rawLabel} <Ltr>{fmtRate(r.raw, d)}</Ltr>
                </span>
              </Tip>
              <Tip label={t.spreadTip}>
                <span>
                  <SpreadBar spreadPct={m.spreadPct} pinned={!!m.pin} className="w-16" />
                </span>
              </Tip>
            </span>
          )}
        </span>
      );
    },
  },
  {
    id: 'change',
    tabs: ['rates'],
    align: 'end',
    w: 125,
    sort: (m) => m.changePct,
    render: (m, { t }) => {
      const dir = m.changePct > 0.0049 ? 'up' : m.changePct < -0.0049 ? 'down' : 'flat';
      const vals = m.row.history.map(num);
      return (
        <span className="flex items-center justify-end gap-3">
          <Change pct={m.changePct} />
          <Sparkline
            className="max-lg:hidden"
            values={m.row.history}
            dir={dir}
            label={fill(t.change.summary, {
              code: m.code,
              dir: t.change[dir],
              pct: fmtPct(m.changePct),
              min: String(Math.min(...vals).toFixed(4)),
              max: String(Math.max(...vals).toFixed(4)),
            })}
          />
        </span>
      );
    },
  },
  {
    id: 'source',
    tabs: ['rates', 'status'],
    align: 'start',
    lgOnly: true,
    w: 120,
    sort: (m) => m.row.rate.source,
    render: (m, { t }) => (
      <span className="flex flex-col items-start gap-1">
        <Pill tone={m.row.rate.source === 'manual' ? 'warning' : 'muted'}>
          {m.row.rate.source === 'manual' ? t.sourceManual : t.sourceProvider}
        </Pill>
        <span className="text-12 text-muted-foreground">{m.isBase ? '-' : m.row.rate.provider}</span>
      </span>
    ),
  },
  {
    id: 'updated',
    tabs: ['rates', 'status'],
    align: 'start',
    w: 115,
    sort: (m) => m.ageMin,
    render: (m, { t, locale }) => (
      <Tip label={fmtDate(m.row.rate.fetchedAt, locale, true)}>
        <span
          className={cn(
            'inline-flex cursor-help items-center gap-1.5 whitespace-nowrap text-13',
            m.stale ? 'font-bold text-warning-soft-foreground' : 'text-foreground',
          )}
        >
          <Clock className="size-3.5 max-lg:hidden" aria-hidden />
          {relTime(m.ageMin, t)}
        </span>
      </Tip>
    ),
  },
  {
    id: 'margin',
    tabs: ['pricing'],
    align: 'end',
    w: 100,
    sort: (m) => m.margin,
    render: (m, { t }) => (
      <span className="flex flex-col items-end gap-1">
        <Ltr className="text-14 font-bold">{m.isBase ? '0.00' : m.margin.toFixed(2)}%</Ltr>
        <Pill tone={m.row.currency.marginPercentOverride === null ? 'muted' : 'info'} className="h-5 px-1.5 text-11">
          {m.row.currency.marginPercentOverride === null ? t.marginDefault : t.marginOwn}
        </Pill>
      </span>
    ),
  },
  {
    id: 'mode',
    tabs: ['pricing'],
    align: 'start',
    w: 140,
    sort: (m) => m.row.currency.effectivePaymentMode,
    render: (m, { t }) => {
      const c = m.row.currency;
      return (
        <span className="flex flex-col items-start gap-1">
          <ModePill mode={c.paymentMode} degraded={c.degraded} t={t} />
          {c.effectivePaymentMode === 'DISPLAY_ONLY' && (
            <span className="text-12 text-muted-foreground">
              {fill(t.chargedIn, { code: '' })}
              <Ltr className="font-mono font-bold">{c.effectiveChargeCurrency}</Ltr>
            </span>
          )}
        </span>
      );
    },
  },
  {
    id: 'decimals',
    tabs: ['pricing'],
    align: 'start',
    lgOnly: true,
    w: 120,
    sort: (m) => m.row.currency.decimalDigits,
    render: (m, { t }) => (
      <span className="flex flex-col items-start gap-0.5">
        <Ltr className="text-15 font-bold">{m.row.currency.symbol ?? m.row.currency.abbr.en}</Ltr>
        <span className="text-12 text-muted-foreground">
          {t.panel.metaDecimals}: <Ltr>{m.row.currency.decimalDigits}</Ltr>
        </span>
      </span>
    ),
  },
  {
    id: 'preview',
    tabs: ['pricing'],
    lgOnly: true,
    align: 'end',
    w: 120,
    sort: (m) => num(m.row.rate.effective),
    render: (m) => (
      <span className="flex items-baseline justify-end gap-1.5">
        <Ltr className="text-15 font-extrabold">
          {convertUsd('100', m.row.rate.effective, m.row.currency.decimalDigits)}
        </Ltr>
        <Ltr className="font-mono text-12 text-muted-foreground">{m.code}</Ltr>
      </span>
    ),
  },
  {
    id: 'visible',
    tabs: ['status'],
    align: 'start',
    lgOnly: true,
    w: 120,
    sort: (m) => (m.hidden ? 0 : 1),
    render: (m, { t }) =>
      m.hidden ? (
        <Pill tone="muted" icon={<EyeOff />}>
          {t.hiddenLabel}
        </Pill>
      ) : (
        <Pill tone="success" icon={<Eye />}>
          {t.filters.visible}
        </Pill>
      ),
  },
  {
    id: 'freshness',
    tabs: ['status'],
    align: 'start',
    w: 150,
    sort: (m) => m.ring.remaining,
    render: (m, { t }) => {
      const tone = m.ring.tone === 'fresh' ? 'success' : m.ring.tone === 'aging' ? 'warning' : 'danger';
      const label = m.ring.tone === 'fresh' ? t.fresh : m.ring.tone === 'aging' ? t.aging : t.staleLabel;
      return (
        <span className="flex flex-col items-start gap-1">
          <Pill tone={tone} icon={<Clock />}>
            {label}
          </Pill>
          <span className="h-1 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span
              className={cn(
                'block h-full rounded-full',
                m.ring.tone === 'fresh' ? 'bg-success' : m.ring.tone === 'aging' ? 'bg-warning' : 'bg-destructive',
              )}
              style={{ width: `${Math.max(4, m.ring.remaining * 100)}%` }}
            />
          </span>
        </span>
      );
    },
  },
  {
    id: 'pin',
    tabs: ['status'],
    align: 'start',
    w: 170,
    sort: (m) => (m.pin ? 1 : 0),
    render: (m, { t, locale }) =>
      m.pin ? (
        <span className="flex flex-col items-start gap-1">
          <Pill tone="primary" icon={<Pin className="fill-current" />}>
            {t.pinnedLabel} <Ltr>{fmtRate(m.pin.rate, rateDigits(m.code))}</Ltr>
          </Pill>
          <span className="text-12 text-muted-foreground">
            {m.pin.expiresAt ? fill(t.pinnedUntil, { date: fmtDate(m.pin.expiresAt, locale) }) : t.pinnedNoExpiry}
          </span>
        </span>
      ) : (
        <span className="text-13 text-muted-foreground">{t.noPin}</span>
      ),
  },
  {
    id: 'gateway',
    tabs: ['status'],
    align: 'start',
    lgOnly: true,
    w: 130,
    sort: (m) => (m.row.currency.gatewaySupported ? 1 : 0),
    render: (m, { t }) => (
      <Pill tone={m.row.currency.gatewaySupported ? 'success' : 'muted'}>
        {m.row.currency.gatewaySupported ? t.gatewayOn : t.gatewayOff}
      </Pill>
    ),
  },
];

export const TAB_ORDER: Tab[] = ['rates', 'pricing', 'status'];

// ── row actions ─────────────────────────────────────────────────────────────────────────────────

export function RowActions({ m, ctx }: { m: Meta; ctx: CellCtx }) {
  const { t, act } = ctx;
  const isBusy = act.busy.has(m.code);
  const locked = m.isBase;
  const quick = 'size-9 pointer-coarse:size-11';
  return (
    <div className="flex items-center justify-end gap-0.5">
      <div className="hidden items-center gap-0.5 opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 lg:flex">
        <Tip label={t.actions.pinTip}>
          <Button
            variant="ghost"
            size="icon"
            className={quick}
            disabled={locked}
            aria-label={`${t.actions.pin} ${m.code}`}
            onClick={() => act.pin(m.code)}
          >
            <Pin />
          </Button>
        </Tip>
        <Tip label={t.actions.copy}>
          <Button variant="ghost" size="icon" className={quick} aria-label={`${t.actions.copy} ${m.code}`} onClick={() => act.copy(m.code)}>
            <Copy />
          </Button>
        </Tip>
        <Tip label={t.actions.refreshOne}>
          <Button
            variant="ghost"
            size="icon"
            className={quick}
            disabled={locked || isBusy}
            aria-label={`${t.actions.refreshOne} ${m.code}`}
            onClick={() => act.refresh(m.code)}
          >
            <RefreshCw />
          </Button>
        </Tip>
      </div>
      {isBusy && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
      <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
        <Switch
          checked={!m.hidden}
          disabled={locked}
          onCheckedChange={() => act.toggle(m.code)}
          aria-label={fill(t.visibleSwitch, { code: m.code })}
        />
      </label>
      <RowMenu m={m} ctx={ctx} />
    </div>
  );
}

export function RowMenu({ m, ctx, className }: { m: Meta; ctx: CellCtx; className?: string }) {
  const { t, act } = ctx;
  const locked = m.isBase;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-9 pointer-coarse:size-11', className)}
          aria-label={`${t.actions.more} ${m.code}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onSelect={() => act.open(m.code)}>
          <PanelRightOpen /> {t.actions.open}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {m.pin ? (
          <DropdownMenuItem onSelect={() => act.revoke(m.pin!.id)}>
            <PinOff /> {t.actions.revoke}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled={locked} onSelect={() => act.pin(m.code)}>
            <Pin /> {t.actions.pin}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => act.copy(m.code)}>
          <Copy /> {t.actions.copy}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={locked || act.busy.has(m.code)} onSelect={() => act.refresh(m.code)}>
          <RefreshCw /> {t.actions.refreshOne}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => act.open(m.code, 'history')}>
          <History /> {t.actions.history}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => act.open(m.code, 'mode')}>
          <Wallet /> {t.actions.paymentMode}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={locked} onSelect={() => act.open(m.code, 'margin')}>
          <Percent /> {t.actions.margin}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={locked} onSelect={() => act.toggle(m.code)}>
          {m.hidden ? <Eye /> : <EyeOff />} {m.hidden ? t.actions.show : t.actions.hide}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
