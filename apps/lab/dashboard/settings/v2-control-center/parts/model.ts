/**
 * Derived data of the control centre, all computed from `@lab/mocks/settings` plus the session's saved values:
 * section hues, related groups (overlaps audit §9.2), attention rules, live value summaries, diffs and restore.
 * Version-local presentation data only: nothing here is a new API field.
 */
import type { Locale } from '@lab/i18n';
import {
  proposedFields,
  type Field,
  type FieldValue,
  type SectionId,
  type SettingsGroup,
  type SettingsHistoryEntry,
  type Subsection,
} from '@lab/mocks/settings';
import type { Messages } from '../i18n';
import { NOW, count, dateTime, fill, list, money, num, pct, relative, valueText } from './format';

export type Values = Record<string, FieldValue>;

export const same = (a: FieldValue | undefined, b: FieldValue | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const isEmpty = (v: FieldValue | undefined) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/** Section identity colour: on the icon only (owner rule: neutral cards, no stripes). */
export const HUE: Record<SectionId, { icon: string; tile: string }> = {
  platform: { icon: 'text-accent-blue-on-soft', tile: 'bg-accent-blue/12' },
  customers: { icon: 'text-accent-violet-on-soft', tile: 'bg-accent-violet/12' },
  payments: { icon: 'text-accent-emerald-on-soft', tile: 'bg-accent-emerald/12' },
  pricing: { icon: 'text-accent-amber-on-soft', tile: 'bg-accent-amber/15' },
  finance: { icon: 'text-accent-teal-on-soft', tile: 'bg-accent-teal/12' },
  staff: { icon: 'text-accent-cyan-on-soft', tile: 'bg-accent-cyan/12' },
  flights: { icon: 'text-primary', tile: 'bg-primary/10' },
  system: { icon: 'text-foreground/70', tile: 'bg-muted' },
};

type OverlapKey = keyof Messages['overlap'];

/** Related groups per group, and the "what lives where" note of its overlap cluster (audit O-1…O-16). */
export const RELATED: Record<string, { keys: string[]; overlap?: OverlapKey }> = {
  platform: { keys: ['maintenance'], overlap: 'maintenance' },
  maintenance: { keys: ['platform'], overlap: 'maintenance' },
  security: { keys: ['verification_policy', 'abuse_protection', 'security_alerts'], overlap: 'access' },
  verification_policy: { keys: ['security', 'abuse_protection'], overlap: 'access' },
  abuse_protection: { keys: ['security', 'verification_policy', 'flight_guards'], overlap: 'access' },
  security_alerts: { keys: ['security', 'notifications'], overlap: 'access' },
  account: { keys: ['refund_policy', 'retention'] },
  travellers: { keys: ['retention'] },
  loyalty: { keys: ['disputes', 'refund_policy'] },
  payment_methods: { keys: ['payment_gateways', 'refund_policy', 'agent_payment_policy'], overlap: 'gateways' },
  payment_gateways: { keys: ['payment_methods'], overlap: 'gateways' },
  refund_policy: { keys: ['payment_methods', 'agent_payment_policy', 'agent_booking_policy'], overlap: 'wallet' },
  fraud_policy: { keys: ['disputes', 'payment_methods'] },
  disputes: { keys: ['fraud_policy', 'loyalty'] },
  markup_rules: { keys: ['fx', 'tax'] },
  fx: { keys: ['markup_rules'] },
  tax: { keys: ['e_invoicing', 'finance_ledger'], overlap: 'tax' },
  e_invoicing: { keys: ['tax'], overlap: 'tax' },
  finance_ledger: { keys: ['money_check', 'accounting_access'], overlap: 'finance' },
  money_check: { keys: ['finance_ledger', 'refund_policy'], overlap: 'finance' },
  accounting_access: { keys: ['finance_ledger'], overlap: 'finance' },
  agent_booking_policy: { keys: ['agent_payment_policy', 'refund_policy'], overlap: 'approvals' },
  agent_payment_policy: { keys: ['agent_booking_policy', 'post_booking_services_policy', 'refund_policy'], overlap: 'wallet' },
  post_booking_services_policy: { keys: ['flight_provider', 'agent_payment_policy'], overlap: 'postBooking' },
  flights: { keys: ['flight_provider', 'flight_guards'], overlap: 'flights' },
  flight_provider: { keys: ['flights', 'flight_guards', 'post_booking_services_policy'], overlap: 'flights' },
  flight_guards: { keys: ['flight_provider', 'abuse_protection'], overlap: 'flights' },
  notifications: { keys: ['whatsapp_provider', 'security_alerts'], overlap: 'whatsapp' },
  whatsapp_provider: { keys: ['notifications'], overlap: 'whatsapp' },
  mobile_app: { keys: ['platform'] },
  analytics: { keys: ['retention'], overlap: 'retention' },
  audit: { keys: ['retention'], overlap: 'retention' },
  storage: { keys: ['retention'], overlap: 'retention' },
  retention: { keys: ['audit', 'analytics', 'storage'], overlap: 'retention' },
};

// ─── Field lookup ────────────────────────────────────────────────────────────

export interface FieldRef {
  field: Field;
  sub: Subsection;
}

const indexCache = new Map<string, Map<string, FieldRef>>();

export function fieldIndex(group: SettingsGroup): Map<string, FieldRef> {
  let index = indexCache.get(group.key);
  if (!index) {
    index = new Map();
    for (const sub of group.subsections) for (const field of sub.fields) index.set(field.key, { field, sub });
    indexCache.set(group.key, index);
  }
  return index;
}

export const groupFields = (group: SettingsGroup): Field[] => group.subsections.flatMap((s) => s.fields);

export function initialValues(group: SettingsGroup): Values {
  return Object.fromEntries(groupFields(group).map((f) => [f.key, f.value]));
}

export function changedFromDefault(group: SettingsGroup, values: Values): Field[] {
  return groupFields(group).filter((f) => !same(values[f.key], f.default));
}

// ─── Diffs & restore ─────────────────────────────────────────────────────────

export interface Change {
  key: string;
  ref?: FieldRef;
  from: FieldValue;
  to: FieldValue;
}

export function diff(group: SettingsGroup, base: Values, draft: Values): Change[] {
  const index = fieldIndex(group);
  return Object.entries(draft)
    .filter(([key, to]) => !same(base[key], to))
    .map(([key, to]) => ({ key, ref: index.get(key), from: base[key] ?? null, to }));
}

export function historyChanges(group: SettingsGroup, entry: SettingsHistoryEntry): Change[] {
  const index = fieldIndex(group);
  return entry.changes.map((c) => ({ key: c.field, ref: index.get(c.field), from: c.from, to: c.to }));
}

/** The values in force at `version`: walk the newer entries back, applying each change's `from`. */
export function valuesAt(current: Values, history: SettingsHistoryEntry[], version: number): Values {
  const out = { ...current };
  for (const entry of [...history].sort((a, b) => b.version - a.version)) {
    if (entry.version <= version) break;
    for (const change of entry.changes) out[change.field] = change.from;
  }
  return out;
}

export const needsTypedConfirm = (changes: Change[]) => changes.some((c) => c.ref?.field.risk === 'high');
export const needsSecurityConfirm = (changes: Change[]) => changes.some((c) => c.ref?.field.control === 'security');
export const isApprovalChange = (c: Change) => c.ref?.field.control === 'security' || !!c.ref?.field.twoPerson;

// ─── State of a group ────────────────────────────────────────────────────────

export type GroupState = 'on' | 'off' | 'attention' | 'scheduled' | 'none';

export function masterOn(group: SettingsGroup, values: Values): boolean | undefined {
  if (!group.masterSwitch) return undefined;
  const v = values[group.masterSwitch];
  return typeof v === 'boolean' ? v : undefined;
}

// ─── Attention ───────────────────────────────────────────────────────────────

export type Severity = 'blocking' | 'risky' | 'gap' | 'pending' | 'draft' | 'info';
export const SEVERITY_ORDER: Severity[] = ['blocking', 'risky', 'gap', 'pending', 'draft', 'info'];

interface AttentionRule {
  field: string;
  severity: Severity;
  active: (v: Values) => boolean;
}

/** Where each mock `attention` points and when it is resolved (re-evaluated on every save). */
export const ATTENTION_RULES: Record<string, AttentionRule> = {
  tax: { field: 'legalEntity.taxId', severity: 'blocking', active: (v) => isEmpty(v['legalEntity.taxId']) },
  e_invoicing: { field: 'sellerTaxOffice', severity: 'blocking', active: (v) => v.enabled === true && isEmpty(v.sellerTaxOffice) },
  notifications: {
    field: 'events.payments.payment_link',
    severity: 'risky',
    active: (v) => Array.isArray(v['events.payments.payment_link']) && (v['events.payments.payment_link'] as string[]).includes('SMS') && v['providers.sms.enabled'] !== true,
  },
  flight_guards: {
    field: 'supplierBalance.lastReading.amountUsd',
    severity: 'risky',
    active: (v) => {
      const at = v['supplierBalance.lastReading.at'];
      return typeof at !== 'string' || NOW - new Date(at).getTime() > 7 * 86400_000;
    },
  },
  maintenance: { field: 'window.startsAt', severity: 'info', active: () => true },
};

/** Groups whose "off" is the healthy state: their master switch being off is not an attention item. */
const OFF_IS_NORMAL = new Set(['maintenance']);

export interface AttentionItem {
  id: string;
  severity: Severity;
  groupKey: string;
  fieldKey?: string;
  text: string;
  action: 'fix' | 'review' | 'open';
}

export interface AttentionInput {
  groups: SettingsGroup[];
  saved: Record<string, Values>;
  drafts: Record<string, Values>;
  pending: Record<string, unknown>;
  locale: Locale;
  t: Messages;
  allClear: boolean;
}

export function attentionItems({ groups, saved, drafts, pending, locale, t, allClear }: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];
  const visible = new Set(groups.map((g) => g.key));
  for (const group of groups) {
    const values = saved[group.key];
    const rule = ATTENTION_RULES[group.key];
    if (!allClear && group.attention && rule?.active(values)) {
      items.push({ id: `att-${group.key}`, severity: rule.severity, groupKey: group.key, fieldKey: rule.field, text: group.attention[locale], action: 'fix' });
    }
    if (!allClear && masterOn(group, values) === false && !OFF_IS_NORMAL.has(group.key)) {
      const ref = fieldIndex(group).get(group.masterSwitch!);
      items.push({
        id: `off-${group.key}`,
        severity: 'risky',
        groupKey: group.key,
        fieldKey: group.masterSwitch,
        text: fill(t.attention.offSentence, { group: group.title[locale], field: ref ? ref.field.label[locale] : group.masterSwitch! }),
        action: 'fix',
      });
    }
    if (pending[group.key]) {
      items.push({ id: `pending-${group.key}`, severity: 'pending', groupKey: group.key, text: fill(t.attention.pendingSentence, { group: group.title[locale] }), action: 'open' });
    }
    const draftCount = Object.keys(drafts[group.key] ?? {}).length;
    if (draftCount > 0) {
      items.push({ id: `draft-${group.key}`, severity: 'draft', groupKey: group.key, text: fill(t.attention.draftSentence, { group: group.title[locale], n: num(locale, draftCount) }), action: 'review' });
    }
  }
  if (!allClear) {
    for (const field of proposedFields('P0')) {
      if (!visible.has(field.groupKey) || !isEmpty(saved[field.groupKey]?.[field.key])) continue;
      items.push({
        id: `gap-${field.id}`,
        severity: 'gap',
        groupKey: field.groupKey,
        fieldKey: field.key,
        text: fill(t.attention.gapSentence, { field: field.label[locale], id: field.proposalId ?? '' }),
        action: 'fix',
      });
    }
  }
  return items.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

export function groupState(group: SettingsGroup, values: Values): GroupState {
  const rule = ATTENTION_RULES[group.key];
  if (group.key === 'maintenance') return values.enabled === true ? 'attention' : isEmpty(values['window.startsAt']) ? 'off' : 'scheduled';
  if (group.attention && rule?.active(values)) return 'attention';
  const master = masterOn(group, values);
  if (master === true) return 'on';
  if (master === false) return 'off';
  return 'none';
}

// ─── Live value summaries ───────────────────────────────────────────────────

type Get = (key: string) => FieldValue;

/** 2–3 key values of a group as short phrases, joined with a middle dot on the card. */
export function summarize(group: SettingsGroup, values: Values, locale: Locale, t: Messages): string[] {
  const s = t.sum;
  const get: Get = (key) => values[key] ?? null;
  const n = (key: string) => Number(get(key) ?? 0);
  const ref = (key: string) => fieldIndex(group).get(key)?.field;
  const val = (key: string) => valueText(locale, t, ref(key), get(key));
  const d = val;
  const usd = (key: string) => money(locale, t, n(key));
  const on = (key: string) => get(key) === true;

  switch (group.key) {
    case 'platform':
      return [
        fill(s.langFirst, { lang: val('defaultLocale') }),
        count(locale, (get('supportedLocales') as string[] | null)?.length ?? 0, t.units.languages),
        fill(s.tz, { tz: String(get('timezone')) }),
      ];
    case 'maintenance': {
      const out = [on('enabled') ? s.maintOn : s.maintOff];
      if (!isEmpty(get('window.startsAt'))) out.push(fill(s.window, { date: dateTime(locale, String(get('window.startsAt'))) }));
      if (get('scope') === 'areas') out.push(fill(s.areas, { areas: val('areas') }));
      return out;
    }
    case 'security':
      return [
        fill(s.lock, { n: num(locale, n('lockout.maxFailures')), d: d('lockout.windowMinutes') }),
        on('adminIpAllowlist.enabled') ? s.ipOn : s.ipOff,
        fill(s.invites, { d: d('invites.ttlHours') }),
      ];
    case 'verification_policy':
      return [fill(s.otpDigits, { n: num(locale, n('otp.length')) }), fill(s.otpValid, { d: d('otp.ttlSeconds') }), fill(s.via, { channel: val('phoneOtpChannel') })];
    case 'abuse_protection': {
      const out = [on('captcha.enabled') ? s.captchaOn : s.captchaOff, fill(s.otpBudget, { n: num(locale, n('otpBudget.phoneDailyLimit')) })];
      if (on('breachedPasswords.enabled')) out.push(s.breached);
      return out;
    }
    case 'security_alerts':
      return [fill(s.wave, { n: num(locale, n('failedAdminLogins')), d: d('windowMinutes') }), fill(s.lockedStaff, { n: num(locale, n('lockedStaffAccounts')) })];
    case 'account':
      return [fill(s.deletion, { d: d('deletion.graceDays') }), fill(s.exportLink, { d: d('export.linkTtlDays') })];
    case 'travellers':
      return [fill(s.upTo, { x: count(locale, n('maxTravellers'), t.units.travellers) }), fill(s.passport, { d: d('passportValidityMonths') })];
    case 'loyalty':
      return [
        fill(s.perUsd, { points: count(locale, n('pointsPerUsd'), t.units.points) }),
        fill(s.pointValue, { money: usd('redemption.pointValueUsd') }),
        fill(s.expire, { d: d('expiry.monthsAfterEarn') }),
      ];
    case 'payment_methods': {
      const gates = [0, 1, 2, 3, 4, 5, 6];
      const onCount = gates.filter((i) => on(`gateways.${i}.enabled`)).length;
      return [
        fill(s.gatewaysOn, { n: num(locale, onCount), total: num(locale, gates.length) }),
        on('walletPayments.allowPartial') ? fill(s.walletSplit, { money: usd('walletPayments.minPartialUsd') }) : s.walletFull,
      ];
    }
    case 'payment_gateways': {
      const ids = group.subsections.map((sub) => sub.id.toUpperCase());
      const connected = ids.filter((id) => get(`${id}.source`) !== 'none').length;
      const live = ids.filter((id) => get(`${id}.mode`) === 'live').length;
      const test = ids.filter((id) => get(`${id}.mode`) === 'test').length;
      return [fill(s.connected, { n: num(locale, connected), total: num(locale, ids.length) }), fill(s.live, { n: num(locale, live) }), fill(s.test, { n: num(locale, test) })];
    }
    case 'refund_policy':
      return [val('destination'), fill(s.approvalAbove, { money: usd('approvalThresholdUsd') }), fill(s.within, { d: count(locale, n('refundProcessingDays'), t.units.days) })];
    case 'fraud_policy': {
      const out = [fill(s.reviewFrom, { n: num(locale, n('review.reviewScore')) }), fill(s.threeDs, { mode: val('threeDs.mode') })];
      if (on('cardTesting.enabled')) out.push(s.cardTesting);
      return out;
    }
    case 'disputes': {
      const out = [fill(s.remindBefore, { d: d('reminderHoursBeforeDue') })];
      if (on('freezeWalletOnOpen')) out.push(s.walletFrozen);
      return out;
    }
    case 'markup_rules': {
      if (get('rulesSource') === 'table') return [s.fromTable];
      const mode = get('defaultRule.mode');
      const parts = [mode !== 'fixed' ? pct(locale, t, n('defaultRule.percent')) : '', mode !== 'percentage' ? usd('defaultRule.fixedUsd') : ''].filter(Boolean);
      return [fill(s.defaultMarkup, { rule: parts.join(' + ') }), count(locale, (get('rules') as string[] | null)?.length ?? 0, t.units.rules)];
    }
    case 'fx':
      return [val('provider'), fill(s.refreshEvery, { d: d('refreshIntervalMinutes') }), fill(s.margin, { pct: pct(locale, t, n('safetyMarginPercent')) })];
    case 'tax': {
      const out = [val('mode'), on('pricesIncludeTax') ? s.inclTax : s.exclTax];
      if (isEmpty(get('legalEntity.taxId'))) out.push(s.noTaxId);
      return out;
    }
    case 'e_invoicing': {
      const out = [on('enabled') ? s.einvOn : s.einvOff, fill(s.provider, { p: val('provider') })];
      if (isEmpty(get('sellerTaxOffice'))) out.push(s.noOffice);
      return out;
    }
    case 'finance_ledger':
      return [on('dailyCloseEnabled') ? s.dailyClose : '', fill(s.alertAbove, { money: usd('differenceThresholdUsd') }), fill(s.catchUp, { d: d('catchUpDays') })].filter(Boolean);
    case 'money_check':
      return [fill(s.sample, { n: num(locale, n('sampleSize')) }), fill(s.failedRefunds, { d: d('refundFailedHours') })];
    case 'accounting_access': {
      const vs = groupFields(group).map((f) => get(f.key));
      const c = (x: string) => vs.filter((v) => v === x).length;
      return [fill(s.visible, { n: num(locale, c('visible')) }), fill(s.masked, { n: num(locale, c('masked')) }), fill(s.removed, { n: num(locale, c('removed')) })];
    }
    case 'agent_booking_policy':
      return [fill(s.adjustFree, { pct: pct(locale, t, n('maxAdjustPercentWithoutApproval')) }), fill(s.manualAbove, { money: usd('manualPaymentApprovalThresholdUsd') })];
    case 'agent_payment_policy':
      return [fill(s.walletOnBehalf, { money: usd('walletOnBehalfDailyCapUsd') }), fill(s.linksMin, { d: d('paymentLinkMinMinutes') })];
    case 'post_booking_services_policy': {
      if (!on('staffAddEnabled')) return [s.staffOff];
      const methods = ['paymentLinkEnabled', 'walletOnBehalfEnabled', 'manualPaymentEnabled'].filter(on).length;
      return [fill(s.collect, { n: num(locale, methods) }), fill(s.quotes, { d: d('staffQuoteMinutes') })];
    }
    case 'flights':
      return [fill(s.priceLock, { d: d('priceLockMinutes') }), fill(s.checkout, { d: d('checkoutTtlMinutes') }), fill(s.upTo, { x: count(locale, n('maxPassengers'), t.units.passengers) })];
    case 'flight_provider': {
      const off = [
        ['searchEnabled', s.search],
        ['bookingEnabled', s.booking],
        ['postBookingEnabled', s.afterBooking],
      ].filter(([k]) => !on(k)).map(([, label]) => label);
      return [off.length ? fill(s.stopped, { list: list(t, off) }) : s.allOn, fill(s.holds, { d: d('holdPolicy.maxHoldHours') })];
    }
    case 'flight_guards':
      return [
        fill(s.lowBalance, { money: usd('supplierBalance.lowBalanceUsd') }),
        fill(s.lastReading, { money: usd('supplierBalance.lastReading.amountUsd') }),
        fill(s.duplicates, { policy: val('duplicateBooking.policy') }),
      ];
    case 'notifications': {
      const channels = [
        ['providers.email.enabled', 'Email'],
        ['providers.whatsapp.enabled', 'WhatsApp'],
        ['providers.push.enabled', 'Push'],
      ].filter(([k]) => on(k)).map(([, label]) => label);
      const out = [fill(s.channelsOn, { list: channels.join(t.list.sep) })];
      if (!on('providers.sms.enabled')) out.push(s.smsOff);
      return out;
    }
    case 'whatsapp_provider': {
      const out = [val('status')];
      if (!isEmpty(get('lastSuccessAt'))) out.push(fill(s.lastSent, { rel: relative(locale, String(get('lastSuccessAt'))) }));
      return out;
    }
    case 'mobile_app':
      return [
        fill(s.versions, { os: 'iOS', min: String(get('ios.minSupportedVersion')), latest: String(get('ios.latestVersion')) }),
        fill(s.versions, { os: 'Android', min: String(get('android.minSupportedVersion')), latest: String(get('android.latestVersion')) }),
      ];
    case 'analytics': {
      const out = [fill(s.ordersKept, { d: d('retention.orderFactDays') })];
      if (on('live.enabled')) out.push(s.liveOn);
      return out;
    }
    case 'audit':
      return [fill(s.logKept, { d: d('retentionDays') }), fill(s.activityKept, { d: d('activityRetentionDays') })];
    case 'storage':
      return [fill(s.trashKept, { d: d('trash.retentionDays') })];
    case 'retention':
      return [on('enabled') ? s.nightly : s.nightlyOff, fill(s.messagesKept, { d: d('notificationDays') }), fill(s.searchLogs, { d: d('flightSearchLogDays') })];
    default:
      return [group.summary[locale]];
  }
}

// ─── Self-explanatory labels ────────────────────────────────────────────────

/** Leaf names that mean nothing without their parent («مفعّل», «النقاط», «العربية»…). */
const GENERIC_LEAF = new Set(['enabled', 'score', 'windowHours', 'rules', 'default', 'mode', 'ar', 'en', 'customer', 'admin', 'countries', 'cidrs', 'gateway', 'method']);

/** "Parent ▸ label" when the mock label is generic; never the bare state word «مفعّل». */
export function fieldLabel(field: Pick<Field, 'key' | 'label'>, locale: Locale, t: Messages): string {
  const parts = field.key.split('.');
  const leaf = parts[parts.length - 1];
  const parent = parts.slice(0, -1).join('.');
  const name = parent ? t.parents[parent] : undefined;
  if (!name || !GENERIC_LEAF.has(leaf)) return field.label[locale];
  return `${name} ${locale === 'ar' ? '◂' : '▸'} ${field.label[locale]}`;
}

/** Fields whose help repeats the subsection lead, the group description or an earlier field: said once only. */
export function repeatedHelp(group: SettingsGroup, sub: Subsection, locale: Locale): Set<string> {
  const norm = (x: string) => x.replace(/\s+/g, ' ').trim();
  const seen = new Set([norm(sub.description[locale]), norm(group.description[locale])]);
  const out = new Set<string>();
  for (const f of sub.fields) {
    const h = norm(f.help[locale]);
    if (seen.has(h)) out.add(f.key);
    seen.add(h);
  }
  return out;
}
