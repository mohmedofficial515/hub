// Launch readiness: a small, documented rule set evaluated against the SAVED values (never drafts).
//
// Status of a check:
//   done     its test passes on the saved values;
//   todo     the test fails and the owner can fix it in the dashboard now (kinds `switch`, `value`, `attention`);
//   blocked  the test fails and only backend work can fix it (kinds `proposed`: field not in the API yet,
//            `env`: value bound on the server, `dashboard`: group missing from the dashboard).
// Headline figure = YOUR PART: owner-actionable done / owner-actionable total. Backend checks are counted apart. Every check names one primary field so "Open field" lands on it.
import { SETTINGS_GROUPS, SETTINGS_SECTIONS, type FieldValue, type SectionId } from '@lab/mocks/settings';
import { NOW } from './data';

export type CheckStatus = 'done' | 'todo' | 'blocked';
export type CheckKind = 'switch' | 'value' | 'attention' | 'proposed' | 'env' | 'dashboard';
/** Reads a saved value by `<group>.<field key>`. */
export type Get = (id: string) => FieldValue | undefined;

export interface Recommendation {
  group: string;
  field: string;
  value: FieldValue;
}

export interface CheckDef {
  id: string;
  section: SectionId;
  group: string;
  field: string;
  kind: CheckKind;
  proposalId?: string;
  priority?: 'P0' | 'P1' | 'P2';
  /** Server environment variable behind an `env` check. */
  env?: string;
  /** Values that make the check pass; "Apply recommendation" stages them into the group draft. */
  recommend?: Recommendation[];
  test: (get: Get) => boolean;
}

export interface Check extends CheckDef {
  status: CheckStatus;
  /** Text of a group `attention` that has no dedicated rule. */
  fallbackText?: { ar: string; en: string };
}

const BLOCKING_KINDS: CheckKind[] = ['proposed', 'env', 'dashboard'];
const filled = (v: FieldValue | undefined) =>
  v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
const on = (get: Get, ...ids: string[]) => ids.every((id) => get(id) === true);
const rec = (group: string, field: string, value: FieldValue): Recommendation => ({ group, field, value });
const GATEWAYS = ['STRIPE', 'MYFATOORAH', 'PAYMOB', 'MOYASAR', 'TAP', 'PAYTR', 'IYZICO'];
const never = () => false;

export const CHECKS: CheckDef[] = [
  // 1 Platform & access
  { id: 'legal-links', section: 'platform', group: 'platform', field: 'legal.termsUrl', kind: 'value',
    test: (g) => filled(g('platform.legal.termsUrl')) && filled(g('platform.legal.privacyUrl')) },
  { id: 'kvkk', section: 'platform', group: 'platform', field: 'legal.kvkkNoticeUrl', kind: 'proposed', proposalId: 'S-01', priority: 'P0', test: never },
  { id: 'tursab', section: 'platform', group: 'platform', field: 'company.tursabLicenseNo', kind: 'proposed', proposalId: 'S-02', priority: 'P0', test: never },
  { id: 'checkout-legal', section: 'platform', group: 'platform', field: 'legal.refundPolicyUrl', kind: 'proposed', proposalId: 'S-03', priority: 'P1', test: never },
  { id: 'maintenance-dashboard', section: 'platform', group: 'maintenance', field: 'enabled', kind: 'dashboard', proposalId: 'F-03', priority: 'P0', test: never },
  { id: 'lockout', section: 'platform', group: 'security', field: 'lockout.enabled', kind: 'switch',
    recommend: [rec('security', 'lockout.enabled', true)], test: (g) => on(g, 'security.lockout.enabled') },
  { id: 'admin-totp', section: 'platform', group: 'verification_policy', field: 'adminTotpRequired', kind: 'switch',
    recommend: [rec('verification_policy', 'adminTotpRequired', true)], test: (g) => on(g, 'verification_policy.adminTotpRequired') },
  { id: 'admin-ip', section: 'platform', group: 'security', field: 'adminIpAllowlist.enabled', kind: 'switch',
    recommend: [rec('security', 'adminIpAllowlist.enabled', true)],
    test: (g) => on(g, 'security.adminIpAllowlist.enabled') && filled(g('security.adminIpAllowlist.cidrs')) },
  { id: 'staff-sessions', section: 'platform', group: 'security', field: 'adminSession.idleTimeoutMinutes', kind: 'proposed', proposalId: 'S-06', priority: 'P1', test: never },
  { id: 'signin-defences', section: 'platform', group: 'abuse_protection', field: 'breachedPasswords.enabled', kind: 'switch',
    recommend: [rec('abuse_protection', 'breachedPasswords.enabled', true), rec('abuse_protection', 'captcha.enabled', true)],
    test: (g) => on(g, 'abuse_protection.breachedPasswords.enabled', 'abuse_protection.captcha.enabled') },
  { id: 'security-waves', section: 'platform', group: 'security_alerts', field: 'enabled', kind: 'switch',
    recommend: [rec('security_alerts', 'enabled', true)], test: (g) => on(g, 'security_alerts.enabled') },

  // 2 Customers
  { id: 'deletion-wallet', section: 'customers', group: 'account', field: 'deletion.walletBalancePolicy', kind: 'proposed', proposalId: 'S-09', priority: 'P1', test: never },
  { id: 'loyalty-switches', section: 'customers', group: 'loyalty', field: 'enabled', kind: 'value',
    recommend: [rec('loyalty', 'enabled', true)], test: (g) => g('platform.features.loyalty') === g('loyalty.enabled') },
  { id: 'passport-validity', section: 'customers', group: 'travellers', field: 'passportValidityMonths', kind: 'value',
    recommend: [rec('travellers', 'passportValidityMonths', 6)], test: (g) => Number(g('travellers.passportValidityMonths') ?? 0) >= 6 },

  // 3 Payments & wallet
  { id: 'live-gateway', section: 'payments', group: 'payment_methods', field: 'gateways.0.enabled', kind: 'value',
    test: (g) =>
      GATEWAYS.some(
        (code, i) =>
          g(`payment_methods.gateways.${i}.enabled`) === true &&
          g(`payment_gateways.${code}.source`) !== 'none' &&
          g(`payment_gateways.${code}.mode`) === 'live',
      ) },
  { id: 'test-keys', section: 'payments', group: 'payment_methods', field: 'gateways.6.enabled', kind: 'value',
    test: (g) => !GATEWAYS.some((code, i) => g(`payment_methods.gateways.${i}.enabled`) === true && g(`payment_gateways.${code}.mode`) === 'test') },
  { id: 'refund-approval', section: 'payments', group: 'refund_policy', field: 'approvalThresholdUsd', kind: 'value',
    test: (g) => Number(g('refund_policy.approvalThresholdUsd') ?? 0) > 0 },
  { id: 'fraud-review', section: 'payments', group: 'fraud_policy', field: 'review.enabled', kind: 'switch',
    recommend: [rec('fraud_policy', 'review.enabled', true), rec('fraud_policy', 'cardTesting.enabled', true)],
    test: (g) => on(g, 'fraud_policy.review.enabled', 'fraud_policy.cardTesting.enabled') },
  { id: 'fraud-blocklists', section: 'payments', group: 'fraud_policy', field: 'blocklist.emailDomains', kind: 'proposed', proposalId: 'S-14', priority: 'P1', test: never },

  // 4 Pricing & tax
  { id: 'tax-id', section: 'pricing', group: 'tax', field: 'legalEntity.taxId', kind: 'attention', test: (g) => filled(g('tax.legalEntity.taxId')) },
  { id: 'tax-office', section: 'pricing', group: 'e_invoicing', field: 'sellerTaxOffice', kind: 'attention', test: (g) => filled(g('e_invoicing.sellerTaxOffice')) },
  { id: 'einvoice-provider', section: 'pricing', group: 'e_invoicing', field: 'provider', kind: 'env', env: 'E_INVOICING_PROVIDER', proposalId: 'S-20', priority: 'P1',
    test: (g) => g('e_invoicing.provider') !== 'none' },
  { id: 'markup-default', section: 'pricing', group: 'markup_rules', field: 'defaultRule.percent', kind: 'value',
    test: (g) => Number(g('markup_rules.defaultRule.percent') ?? 0) > 0 },

  // 5 Finance controls
  { id: 'ledger', section: 'finance', group: 'finance_ledger', field: 'enabled', kind: 'switch',
    recommend: [rec('finance_ledger', 'enabled', true)], test: (g) => on(g, 'finance_ledger.enabled') },
  { id: 'money-check', section: 'finance', group: 'money_check', field: 'enabled', kind: 'switch',
    recommend: [rec('money_check', 'enabled', true)], test: (g) => on(g, 'money_check.enabled') },

  // 6 Staff desk
  { id: 'manual-payments', section: 'staff', group: 'agent_booking_policy', field: 'manualPaymentApprovalRequired', kind: 'switch',
    recommend: [rec('agent_booking_policy', 'manualPaymentApprovalRequired', true)], test: (g) => on(g, 'agent_booking_policy.manualPaymentApprovalRequired') },
  { id: 'price-adjust', section: 'staff', group: 'agent_booking_policy', field: 'priceAdjustApprovalRequired', kind: 'switch',
    recommend: [rec('agent_booking_policy', 'priceAdjustApprovalRequired', true)], test: (g) => on(g, 'agent_booking_policy.priceAdjustApprovalRequired') },
  { id: 'post-booking-chain', section: 'staff', group: 'post_booking_services_policy', field: 'staffAddEnabled', kind: 'value',
    test: (g) => on(g, 'flight_provider.postBookingEnabled', 'flight_provider.postBookingServicesEnabled', 'post_booking_services_policy.staffAddEnabled') },

  // 7 Flights
  { id: 'booking-cutoff', section: 'flights', group: 'flights', field: 'bookingCutoffMinutes', kind: 'proposed', proposalId: 'S-23', priority: 'P1', test: never },
  { id: 'balance-reading', section: 'flights', group: 'flight_guards', field: 'supplierBalance.lastReading.at', kind: 'attention',
    test: (g) => {
      const at = g('flight_guards.supplierBalance.lastReading.at');
      return typeof at === 'string' && NOW - new Date(at).getTime() <= 7 * 86_400_000;
    } },
  { id: 'circuit-breaker', section: 'flights', group: 'flight_provider', field: 'circuitBreaker.enabled', kind: 'switch',
    recommend: [rec('flight_provider', 'circuitBreaker.enabled', true)], test: (g) => on(g, 'flight_provider.circuitBreaker.enabled') },
  { id: 'supplier-switches', section: 'flights', group: 'flight_provider', field: 'searchEnabled', kind: 'switch',
    recommend: [rec('flight_provider', 'searchEnabled', true), rec('flight_provider', 'bookingEnabled', true)],
    test: (g) => on(g, 'flight_provider.searchEnabled', 'flight_provider.bookingEnabled') },

  // 8 System & data
  { id: 'sms-payment-link', section: 'system', group: 'notifications', field: 'events.payments.payment_link', kind: 'attention',
    recommend: [rec('notifications', 'events.payments.payment_link', ['EMAIL', 'WHATSAPP'])],
    test: (g) => {
      const v = g('notifications.events.payments.payment_link');
      return !(Array.isArray(v) && (v as string[]).includes('SMS'));
    } },
  { id: 'sms-provider', section: 'system', group: 'notifications', field: 'providers.sms.enabled', kind: 'env', env: 'SMS_PROVIDER', test: never },
  { id: 'quiet-hours', section: 'system', group: 'notifications', field: 'quietHours.enabled', kind: 'proposed', proposalId: 'S-26', priority: 'P1', test: never },
  { id: 'ops-recipients', section: 'system', group: 'notifications', field: 'opsAlerts.recipients', kind: 'value',
    test: (g) => filled(g('notifications.opsAlerts.recipients')) },
  { id: 'whatsapp-working', section: 'system', group: 'whatsapp_provider', field: 'status', kind: 'value',
    test: (g) => g('whatsapp_provider.status') === 'working' },
  { id: 'retention-sweep', section: 'system', group: 'retention', field: 'enabled', kind: 'switch',
    recommend: [rec('retention', 'enabled', true)], test: (g) => on(g, 'retention.enabled') },
];

/** Every group `attention` is covered by a rule above; a new one without a rule still shows as a to-do. */
function attentionFallbacks(): Check[] {
  return SETTINGS_GROUPS.filter((g) => g.attention && !CHECKS.some((c) => c.group === g.key)).map((g) => ({
    id: `attention:${g.key}`,
    section: g.section,
    group: g.key,
    field: g.subsections[0]?.fields[0]?.key ?? '',
    kind: 'attention' as const,
    test: never,
    status: 'todo' as const,
    fallbackText: g.attention,
  }));
}

export function evaluate(get: Get, opts: { allDone?: boolean } = {}): Check[] {
  const checks: Check[] = CHECKS.map((def) => {
    const pass = opts.allDone || def.test(get);
    const status: CheckStatus = pass ? 'done' : BLOCKING_KINDS.includes(def.kind) ? 'blocked' : 'todo';
    return { ...def, status };
  });
  return opts.allDone ? checks : [...checks, ...attentionFallbacks()];
}

export interface Tally {
  /** Owner-actionable checks that pass (kinds switch / value / attention). */
  done: number;
  /** Owner-actionable checks that fail. */
  todo: number;
  /** Checks only backend work can close; never part of the headline figure. */
  blocked: number;
  /** done + todo: "your part". */
  own: number;
  /** done / own, the headline figure ("your part"). */
  pct: number;
  /** Every check, owner and backend. */
  total: number;
}

export const isOwnerCheck = (c: Check) => !BLOCKING_KINDS.includes(c.kind);

export function tally(checks: Check[]): Tally {
  const own = checks.filter(isOwnerCheck);
  const done = own.filter((c) => c.status === 'done').length;
  const todo = own.filter((c) => c.status !== 'done').length;
  const blocked = checks.filter((c) => !isOwnerCheck(c) && c.status !== 'done').length;
  return { done, todo, blocked, own: own.length, total: checks.length, pct: own.length ? Math.round((done / own.length) * 100) : 100 };
}

export function bySection(checks: Check[]): { id: SectionId; checks: Check[]; tally: Tally }[] {
  return SETTINGS_SECTIONS.map((s) => {
    const list = checks.filter((c) => c.section === s.id);
    return { id: s.id, checks: list, tally: tally(list) };
  });
}

const ORDER: Record<CheckStatus, number> = { todo: 0, blocked: 1, done: 2 };
export const byUrgency = (a: Check, b: Check) =>
  ORDER[a.status] - ORDER[b.status] || (a.priority ?? 'P9').localeCompare(b.priority ?? 'P9');

/** Recommended value of one field, from the rules (shown as «موصى به» on the field row). */
export function recommendationFor(groupKey: string, fieldKey: string): FieldValue | undefined {
  for (const def of CHECKS) {
    const hit = def.recommend?.find((r) => r.group === groupKey && r.field === fieldKey);
    if (hit) return hit.value;
  }
  return undefined;
}

/** The readiness checks that point at a field (primary field or a recommended one). */
export function checksForField(checks: Check[], groupKey: string, fieldKey: string): Check[] {
  return checks.filter(
    (c) => (c.group === groupKey && c.field === fieldKey) || c.recommend?.some((r) => r.group === groupKey && r.field === fieldKey),
  );
}
