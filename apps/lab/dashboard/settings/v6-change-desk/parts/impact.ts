// Impact preview: what a staged change means in practice, for the fields where the number alone does not say it.
// Pure: reads other values through `get` (draft first, then applied), formats through the version's messages.
import type { Locale } from '@lab/i18n';
import type { FieldValue } from '@lab/mocks/settings';
import type { Messages } from '../i18n';
import { duration, formatDateLong, money, NOW, num } from './format';

type Get = (id: string) => FieldValue;

const n = (v: FieldValue | undefined, fallback = 0): number => (typeof v === 'number' ? v : v == null ? fallback : Number(v) || fallback);

/** The markup engine for the default rule (mode, percent, fixed, min, max, round). */
export function markupPrice(base: number, r: { mode: string; percent: number; fixed: number; min: number; max: number | null; roundTo: number }): number {
  let m = 0;
  if (r.mode === 'percentage' || r.mode === 'both') m += (base * r.percent) / 100;
  if (r.mode === 'fixed' || r.mode === 'both') m += r.fixed;
  m = Math.max(m, r.min);
  if (r.max != null) m = Math.min(m, r.max);
  const total = base + m;
  const step = r.roundTo > 0 ? r.roundTo : 0.01;
  return Math.ceil(total / step - 1e-9) * step;
}

function markupRule(get: Get) {
  const p = 'markup_rules.defaultRule.';
  const max = get(`${p}maxUsd`);
  return {
    mode: String(get(`${p}mode`) ?? 'percentage'),
    percent: n(get(`${p}percent`)),
    fixed: n(get(`${p}fixedUsd`)),
    min: n(get(`${p}minUsd`)),
    max: max == null ? null : n(max),
    roundTo: n(get(`${p}roundTo`), 0.01),
  };
}

/** Fields with a computed effect (the review and the tray show it). */
export const IMPACT_FIELDS = [
  'markup_rules.defaultRule.percent',
  'markup_rules.defaultRule.fixedUsd',
  'markup_rules.defaultRule.mode',
  'markup_rules.defaultRule.minUsd',
  'markup_rules.defaultRule.maxUsd',
  'markup_rules.defaultRule.roundTo',
  'refund_policy.refundProcessingDays',
  'refund_policy.walletIncentivePercent',
  'refund_policy.approvalThresholdUsd',
  'refund_policy.walletTopUp.maxUsd',
  'security.lockout.maxFailures',
  'security.lockout.windowMinutes',
  'security.lockout.backoffMinutes',
  'security.lockout.enabled',
  'security.invites.ttlHours',
  'tax.pricesIncludeTax',
  'tax.mode',
  'fx.safetyMarginPercent',
  'loyalty.pointsPerUsd',
  'loyalty.redemption.pointValueUsd',
  'flights.checkoutTtlMinutes',
  'flights.priceLockMinutes',
  'flights.priceChangeToleranceUsd',
  'maintenance.enabled',
  'account.deletion.graceDays',
  'platform.features.flights',
  'platform.features.wallet',
  'platform.features.loyalty',
  'platform.features.guestCheckout',
] as const;

/**
 * One sentence for the change `id: from → to`, or null when no helper covers the field.
 * `before` reads the applied values, `after` reads the draft over them.
 */
export function impactOf(id: string, before: Get, after: Get, l: Locale, t: Messages): string | null {
  const i = t.impact;
  const usd = (v: number, d = 2) => money(v, l, t, d);

  if (id.startsWith('markup_rules.defaultRule.')) {
    const base = 1000;
    const a = markupPrice(base, markupRule(before));
    const b = markupPrice(base, markupRule(after));
    const r = markupRule(after);
    const pct = r.mode === 'fixed' ? '' : `${num(r.percent, l)}${t.units.percent}`;
    const fixed = r.mode === 'percentage' || r.fixed === 0 ? '' : usd(r.fixed, 0);
    const round = r.roundTo > 0.01 ? usd(r.roundTo) : '';
    return i.markup(usd(base, 0), i.markupRule(pct, fixed, round), usd(a), usd(b));
  }
  if (id.startsWith('gateways.') || /^payment_methods\.gateways\.\d+\.enabled$/.test(id)) {
    return after(id) ? i.gatewayOn : i.gatewayOff;
  }
  if (id.startsWith('platform.features.')) return after(id) ? i.featureOn : i.featureOff;

  switch (id) {
    case 'refund_policy.refundProcessingDays':
      return i.refundDays(duration(n(before(id)), 'days', l, t), duration(n(after(id)), 'days', l, t));
    case 'refund_policy.walletIncentivePercent': {
      const s = 300;
      return i.walletIncentive(usd(s, 0), usd(s * (1 + n(before(id)) / 100)), usd(s * (1 + n(after(id)) / 100)));
    }
    case 'refund_policy.approvalThresholdUsd': {
      const s = 300;
      const waits = (th: number) => (th === 0 || s >= th ? i.needsSecond : i.direct);
      return i.approvalThreshold(usd(s, 0), waits(n(before(id))), waits(n(after(id))));
    }
    case 'refund_policy.walletTopUp.maxUsd':
      return i.topUpMax(usd(n(before(id)), 0), usd(n(after(id)), 0), usd(n(after('refund_policy.walletTopUp.dailyMaxUsd')), 0));
    case 'security.lockout.enabled':
    case 'security.lockout.maxFailures':
    case 'security.lockout.windowMinutes':
    case 'security.lockout.backoffMinutes': {
      if (after('security.lockout.enabled') === false) return i.lockoutOff;
      const ladder = (after('security.lockout.backoffMinutes') as number[] | null) ?? [];
      return i.lockout(
        num(n(after('security.lockout.maxFailures')), l),
        duration(n(after('security.lockout.windowMinutes')), 'minutes', l, t),
        `${ladder.map((x) => num(x, l)).join(` ${t.arrow} `)} ${t.units.short.minutes}`,
      );
    }
    case 'security.invites.ttlHours': {
      const d = new Date(NOW.getTime() + n(after(id)) * 3600_000);
      return i.invites(formatDateLong(d, l));
    }
    case 'tax.pricesIncludeTax': {
      const s = 1000;
      if (after(id)) return i.taxIncluded(usd(s, 0), usd(s / 1.2), usd(s - s / 1.2));
      return i.taxExcluded(usd(s, 0), usd(s * 0.2), usd(s * 1.2));
    }
    case 'tax.mode':
      return after(id) === 'VAT' ? i.taxVat : i.taxNone;
    case 'fx.safetyMarginPercent': {
      const s = 1000;
      return i.fxMargin(usd(s, 0), usd((s * n(before(id))) / 100), usd((s * n(after(id))) / 100));
    }
    case 'loyalty.pointsPerUsd': {
      const s = 1000;
      const value = n(after('loyalty.redemption.pointValueUsd'), 0.01);
      return i.points(usd(s, 0), num(s * n(before(id)), l), num(s * n(after(id)), l), usd(s * n(after(id)) * value));
    }
    case 'loyalty.redemption.pointValueUsd':
      return i.pointValue(usd(10000 * n(before(id))), usd(10000 * n(after(id))));
    case 'flights.checkoutTtlMinutes':
      return i.payWindow(duration(n(after(id)), 'minutes', l, t));
    case 'flights.priceLockMinutes':
      return i.priceLock(duration(n(after(id)), 'minutes', l, t));
    case 'flights.priceChangeToleranceUsd':
      return i.tolerance(usd(n(after(id))));
    case 'maintenance.enabled':
      return after(id) ? i.maintenanceOn : i.maintenanceOff;
    case 'account.deletion.graceDays': {
      const d = new Date(NOW.getTime() + n(after(id)) * 86400_000);
      return i.deletion(formatDateLong(d, l));
    }
  }
  return null;
}
