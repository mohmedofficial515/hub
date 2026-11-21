import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, Pin, PinOff, RefreshCw, ShoppingBag, X } from 'lucide-react';
import {
  FX_ENVELOPE,
  convertUsd,
  fmtRate,
  fxOverrideState,
  pctDelta,
  type FxOverride,
  type PaymentMode,
  CHARGE_CURRENCY_OPTIONS,
} from '@lab/mocks/currencies';
import type { Locale } from '@lab/i18n';
import { cn } from '@lab/utils';
import { Button } from '@dash/components/ui/button';
import { Input } from '@dash/components/ui/input';
import { fill } from '../i18n';
import { rateDigits, type CellCtx, type PanelSection } from './columns';
import { fmtDate, fmtPct, localName, relTime, type Meta } from './derive';
import { CurrencyMark } from './marks';
import type { CurrencyLab } from './store';
import { Change, Ltr, Pill, Sparkline, SpreadBar } from './ui';

function Section({
  id,
  title,
  children,
  action,
}: {
  id: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section id={`cur-panel-${id}`} aria-labelledby={`cur-panel-${id}-h`} className="scroll-mt-4 border-t border-border/70 px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 id={`cur-panel-${id}-h`} className="text-14 font-bold">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

const Stat = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-12 text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 truncate text-14 font-bold">{children}</dd>
  </div>
);

interface Props {
  m: Meta;
  metas: Meta[];
  ctx: CellCtx;
  overrides: FxOverride[];
  lab: CurrencyLab;
  section: { name: PanelSection; tick: number } | null;
  onClose: () => void;
  onNav: (dir: -1 | 1) => void;
  /** Inline (xl) panel has its own close button; the sheet uses the overlay's. */
  embedded: boolean;
}

export function CurrencyPanel({ m, metas, ctx, overrides, lab, section, onClose, onNav, embedded }: Props) {
  const { t, locale, act } = ctx;
  const c = m.row.currency;
  const r = m.row.rate;
  const d = rateDigits(m.code);
  const [margin, setMargin] = useState(c.marginPercentOverride === null ? '' : String(c.marginPercentOverride));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mode, setMode] = useState<PaymentMode>(c.paymentMode);
  const [chargeIn, setChargeIn] = useState(c.chargeCurrency ?? 'USD');
  const mine = overrides.filter((o) => o.quoteCurrency === m.code);
  const isBusy = lab.busy.has(m.code);
  const marginNum = margin.trim() === '' ? null : Number(margin);
  const marginValid = marginNum === null || (Number.isFinite(marginNum) && marginNum >= 0 && marginNum <= 50);

  useEffect(() => {
    if (!section) return;
    if (section.name === 'history') setHistoryOpen(true);
    const el = document.getElementById(`cur-panel-${section.name}`);
    el?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [section]);

  const rateOf = (code: string) => metas.find((x) => x.code === code)?.row.rate.effective ?? '1';
  const chargeCode = c.effectiveChargeCurrency;
  const chargeDigits = metas.find((x) => x.code === chargeCode)?.row.currency.decimalDigits ?? 2;
  const chargeAmount = convertUsd('100', rateOf(chargeCode), chargeDigits);
  const converted = convertUsd('100', r.effective, c.decimalDigits);

  const history = m.row.history;
  const dir = m.changePct > 0.0049 ? 'up' : m.changePct < -0.0049 ? 'down' : 'flat';

  const applyMode = (nextMode: PaymentMode, nextCharge: string) => {
    setMode(nextMode);
    setChargeIn(nextCharge);
    lab.setPaymentMode(m.code, nextMode, nextMode === 'DISPLAY_ONLY' && nextCharge !== 'USD' ? nextCharge : nextMode === 'DISPLAY_ONLY' ? 'USD' : null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* header */}
        <header className="relative px-5 pb-5 pt-5">
          <div className="flex items-start gap-4 pe-12">
            <CurrencyMark code={m.code} size={72} ring={m.ring} dim={m.hidden} className="text-foreground" title={c.names[locale]} />
            <div className="min-w-0 pt-1">
              <h2 className="flex flex-wrap items-center gap-2 text-22 font-extrabold leading-tight">
                <Ltr className="font-mono">{m.code}</Ltr>
                {m.isBase && <Pill tone="primary">{t.base}</Pill>}
              </h2>
              <p className="mt-0.5 text-14 text-muted-foreground">
                <bdi dir={locale === 'ar' ? 'rtl' : 'ltr'}>{localName(c, locale)}</bdi>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.stale && <Pill tone="warning">{t.staleLabel}</Pill>}
                {m.pin && <Pill tone="primary" icon={<Pin className="fill-current" />}>{t.pinnedLabel}</Pill>}
                {m.hidden && <Pill tone="muted" icon={<EyeOff />}>{t.hiddenLabel}</Pill>}
                {c.degraded && <Pill tone="warning">{t.degraded}</Pill>}
              </div>
            </div>
          </div>
          <div className="absolute end-14 top-3 flex">
            <Button variant="ghost" size="icon" className="size-11" onClick={() => onNav(-1)} aria-label={t.panel.prev}>
              <ChevronUp />
            </Button>
            <Button variant="ghost" size="icon" className="size-11" onClick={() => onNav(1)} aria-label={t.panel.next}>
              <ChevronDown />
            </Button>
          </div>
          {embedded && (
            <Button variant="ghost" size="icon" className="absolute end-3 top-3 size-11" onClick={onClose} aria-label={t.panel.close}>
              <X />
            </Button>
          )}
        </header>

        {/* identity: all three languages */}
        <Section id="identity" title={t.panel.identity}>
          <ul className="grid gap-2">
            {(['ar', 'en', 'tr'] as const).map((l) => (
              <li
                key={l}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2',
                  l === locale ? 'border-primary/40 bg-primary/5' : 'border-border/70',
                )}
              >
                <span className="w-14 shrink-0 text-12 font-semibold text-muted-foreground">{t.lang[l]}</span>
                <bdi dir={l === 'ar' ? 'rtl' : 'ltr'} className="min-w-0 flex-1 truncate text-14 font-bold">
                  {c.names[l]}
                </bdi>
                <span className="inline-flex h-7 shrink-0 items-center rounded-md bg-muted px-2 text-13 font-bold" aria-label={t.panel.abbrs}>
                  <bdi dir={l === 'ar' ? 'rtl' : 'ltr'}>{c.abbr[l]}</bdi>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* rate + trend */}
        <Section id="rate" title={t.panel.rateSection}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-12 text-muted-foreground">
                <Ltr>{t.panel.oneUsd}</Ltr>
              </p>
              <p className="flex items-baseline gap-1.5">
                <Ltr className="text-32 font-extrabold leading-none">{fmtRate(r.effective, d)}</Ltr>
                <Ltr className="font-mono text-14 text-muted-foreground">{m.code}</Ltr>
              </p>
            </div>
            <Change pct={m.changePct} className="text-15" />
          </div>
          {!m.isBase && (
            <div className="mt-3 flex items-center gap-3">
              <SpreadBar spreadPct={m.spreadPct} pinned={!!m.pin} className="w-32" />
              <span className="text-12 text-muted-foreground">
                {t.rawLabel} <Ltr>{fmtRate(r.raw, d)}</Ltr> · <Ltr>{fmtPct(m.spreadPct)}</Ltr>
              </span>
            </div>
          )}
          <div className="mt-4 rounded-xl border border-border/70 bg-muted/40 p-3">
            <Sparkline
              values={history}
              dir={dir}
              width={300}
              height={56}
              className="h-14 w-full"
              label={fill(t.change.summary, {
                code: m.code,
                dir: t.change[dir],
                pct: fmtPct(m.changePct),
                min: fmtRate(history.reduce((a, b) => (a < b ? a : b)), d),
                max: fmtRate(history.reduce((a, b) => (a > b ? a : b)), d),
              })}
            />
            <div className="mt-1 flex justify-between text-12 text-muted-foreground">
              <span>{t.panel.trend}</span>
              <span>{relTime(m.ageMin, t)}</span>
            </div>
          </div>
        </Section>

        {/* customer preview */}
        <Section id="preview" title={t.panel.previewSection}>
          <div className={cn('rounded-2xl border border-border/70 bg-card p-4 shadow-sm', m.hidden && 'opacity-70')}>
            <div className="flex items-center gap-2 text-13 text-muted-foreground">
              <ShoppingBag className="size-4" aria-hidden /> {t.panel.previewAmount} <Ltr>100 USD</Ltr>
            </div>
            <p className="mt-1 flex items-baseline gap-2">
              <Ltr className="text-26 font-extrabold">{converted}</Ltr>
              <Ltr className="font-mono text-14 font-bold text-muted-foreground">{m.code}</Ltr>
            </p>
            <Button className="mt-3 h-11 w-full" disabled={m.displayOnly} aria-describedby="cur-pay-note">
              {t.panel.previewPay}
            </Button>
            <p id="cur-pay-note" className="mt-2 text-12 text-muted-foreground">
              {m.displayOnly ? (
                <>
                  {t.panel.previewPayDisabled}.{' '}
                  <span className="font-bold text-foreground">
                    {fill(t.panel.previewDisabledWhy, { code: chargeCode, amount: chargeAmount })}
                  </span>
                </>
              ) : m.hidden ? (
                t.panel.previewHidden
              ) : (
                t.chargeable
              )}
            </p>
            {m.hidden && m.displayOnly && <p className="mt-1 text-12 text-muted-foreground">{t.panel.previewHidden}</p>}
          </div>
        </Section>

        {/* payment mode */}
        <Section id="mode" title={t.panel.modeSection}>
          <div role="radiogroup" aria-label={t.panel.modeSection} className="grid grid-cols-2 gap-2">
            {(['CHARGEABLE', 'DISPLAY_ONLY'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={mode === v}
                onClick={() => applyMode(v, chargeIn)}
                className={cn(
                  'min-h-11 rounded-xl border px-3 text-14 font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  mode === v ? 'border-primary bg-primary/10 text-primary-text' : 'border-border hover:bg-accent',
                )}
              >
                {v === 'CHARGEABLE' ? t.chargeable : t.displayOnly}
              </button>
            ))}
          </div>
          {mode === 'DISPLAY_ONLY' && (
            <label className="mt-3 flex items-center justify-between gap-3 text-14">
              <span className="font-medium">{t.panel.chargeIn}</span>
              <select
                value={chargeIn}
                onChange={(e) => applyMode('DISPLAY_ONLY', e.target.value)}
                className="h-11 min-w-36 rounded-lg border border-input bg-background px-3 font-mono text-14 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {CHARGE_CURRENCY_OPTIONS.filter((x) => x !== m.code).map((x) => (
                  <option key={x} value={x}>
                    {x === 'USD' ? `USD · ${t.panel.chargeUsdDefault}` : x}
                  </option>
                ))}
              </select>
            </label>
          )}
          {c.degraded && <p className="mt-3 rounded-lg bg-warning/15 p-2.5 text-12 text-warning-soft-foreground">{t.degradedTip}</p>}
        </Section>

        {/* margin */}
        {!m.isBase && (
          <Section id="margin" title={t.panel.marginSection}>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (marginValid) lab.setMargin(m.code, marginNum);
              }}
            >
              <label className="min-w-0 flex-1 text-13 font-medium">
                {t.panel.marginInput}
                <Input
                  dir="ltr"
                  inputMode="decimal"
                  value={margin}
                  onChange={(e) => setMargin(e.target.value)}
                  placeholder={String(FX_ENVELOPE.safetyMarginPercent)}
                  aria-invalid={!marginValid}
                  className="mt-1 h-11 text-start tabular-nums"
                />
              </label>
              <Button type="submit" variant="outline" className="h-11" disabled={!marginValid}>
                {t.panel.marginApply}
              </Button>
            </form>
            <p className="mt-2 text-12 text-muted-foreground">{fill(t.panel.marginHint, { pct: FX_ENVELOPE.safetyMarginPercent })}</p>
            {m.pin && <p className="mt-2 text-12 text-warning-soft-foreground">{t.panel.marginPinnedNote}</p>}
          </Section>
        )}

        {/* pinned overrides */}
        <Section
          id="pins"
          title={t.panel.pinsSection}
          action={
            !m.isBase && (
              <Button variant="outline" size="sm" className="h-9 pointer-coarse:h-11" onClick={() => act.pin(m.code)}>
                <Pin /> {t.actions.pin}
              </Button>
            )
          }
        >
          {mine.length === 0 ? (
            <p className="text-13 text-muted-foreground">{t.panel.pinsEmpty}</p>
          ) : (
            <ul className="grid gap-2">
              {mine.map((o) => {
                const st = fxOverrideState(o, lab.clock);
                return (
                  <li key={o.id} className="rounded-xl border border-border/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Ltr className="text-15 font-extrabold">{fmtRate(o.rate, d)}</Ltr>
                        <Pill tone={st === 'active' ? 'success' : st === 'expired' ? 'muted' : 'outline'}>
                          {st === 'active' ? t.panel.pinsActive : st === 'expired' ? t.panel.pinsExpired : t.panel.pinsRevoked}
                        </Pill>
                      </span>
                      {st === 'active' && (
                        <Button variant="ghost" size="sm" className="h-9 pointer-coarse:h-11" onClick={() => act.revoke(o.id)}>
                          <PinOff /> {t.actions.revoke}
                        </Button>
                      )}
                    </div>
                    <p className="mt-1 text-12 text-muted-foreground">
                      {fill(t.panel.pinsCreated, { date: fmtDate(o.createdAt, locale as Locale) })}
                      {' · '}
                      {o.expiresAt ? fill(t.pinnedUntil, { date: fmtDate(o.expiresAt, locale) }) : t.pinnedNoExpiry}
                    </p>
                    {o.note && <p className="mt-1 text-13">{o.note}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* history */}
        <Section
          id="history"
          title={t.panel.historySection}
          action={
            <Button variant="ghost" size="sm" className="h-9 pointer-coarse:h-11" aria-expanded={historyOpen} onClick={() => setHistoryOpen((v) => !v)}>
              {historyOpen ? <ChevronUp /> : <ChevronDown />}
            </Button>
          }
        >
          {historyOpen ? (
            <table className="w-full text-13">
              <tbody>
                {history
                  .map((v, i) => ({ v, i, prev: history[i - 1] }))
                  .reverse()
                  .map(({ v, i, prev }) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <th scope="row" className="py-1.5 text-start font-normal text-muted-foreground">
                        {i === history.length - 1 ? t.panel.historyToday : fill(t.panel.historyPoint, { n: history.length - 1 - i })}
                      </th>
                      <td className="py-1.5 text-end font-bold">
                        <Ltr>{fmtRate(v, d)}</Ltr>
                      </td>
                      <td className="w-24 py-1.5 text-end">{prev ? <Change pct={pctDelta(prev, v)} className="text-12" /> : '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <p className="text-12 text-muted-foreground">
              <Ltr>{history.length}</Ltr> · {t.panel.trend}
            </p>
          )}
        </Section>

        {/* tech details */}
        <Section id="meta" title={t.panel.metaSection}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Stat label={t.panel.metaCode}>
              <Ltr className="font-mono">{c.code}</Ltr>
            </Stat>
            <Stat label={t.panel.metaSymbol}>{c.symbol ? <Ltr>{c.symbol}</Ltr> : t.panel.noSymbol}</Stat>
            <Stat label={t.panel.metaDecimals}>
              <Ltr>{c.decimalDigits}</Ltr>
            </Stat>
            <Stat label={t.col.margin}>
              <Ltr>{m.isBase ? '0.00' : m.margin.toFixed(2)}%</Ltr>
            </Stat>
            <Stat label={t.panel.metaProvider}>{m.isBase ? '-' : r.provider}</Stat>
            <Stat label={t.panel.metaGateway}>{c.gatewaySupported ? t.gatewayOn : t.gatewayOff}</Stat>
            <Stat label={t.panel.metaFetched}>{fmtDate(r.fetchedAt, locale, true)}</Stat>
            <Stat label={t.panel.metaRateId}>
              <Ltr className="font-mono text-12">{r.rateId ?? '-'}</Ltr>
            </Stat>
          </dl>
        </Section>
      </div>

      {/* actions */}
      <footer className="grid shrink-0 grid-cols-4 gap-2 border-t border-border bg-card px-4 py-3">
        <Button variant="outline" className="h-11 flex-col gap-0 px-1 text-12 font-semibold" disabled={m.isBase} onClick={() => (m.pin ? act.revoke(m.pin.id) : act.pin(m.code))} title={m.isBase ? t.actions.baseLocked : undefined}>
          {m.pin ? <PinOff /> : <Pin />} {m.pin ? t.actions.revoke : t.actions.pin}
        </Button>
        <Button variant="outline" className="h-11 flex-col gap-0 px-1 text-12 font-semibold" onClick={() => act.copy(m.code)}>
          <Copy /> {t.actions.copy}
        </Button>
        <Button variant="outline" className="h-11 flex-col gap-0 px-1 text-12 font-semibold" disabled={m.isBase || isBusy} onClick={() => act.refresh(m.code)}>
          <RefreshCw className={cn(isBusy && 'animate-spin')} /> {t.actions.refreshShort}
        </Button>
        <Button variant="outline" className="h-11 flex-col gap-0 px-1 text-12 font-semibold" disabled={m.isBase} onClick={() => act.toggle(m.code)}>
          {m.hidden ? <Eye /> : <EyeOff />} {m.hidden ? t.actions.showShort : t.actions.hideShort}
        </Button>
      </footer>
    </div>
  );
}
