// Search self-test: ~26 Arabic + English queries, each asserting what must (and must not) be in the top 3 hits.
// Run in a lab frame: `await (await import('/lab/@fs/<abs path>/search.selftest.ts')).runSearchSelfTest()`
// (the screenshot script in the scratchpad does this and prints the table). Not imported by the page.

import type { Locale } from '@lab/i18n';
import { search } from './search';

interface Case {
  q: string;
  locale: Locale;
  /** At least one of the top 3 ids starts with one of these. */
  top3: string[];
  /** None of the top 3 ids starts with these. */
  not?: string[];
  /** The first hit must start with this. */
  first?: string;
}

const CASES: Case[] = [
  { q: 'قفل', locale: 'ar', top3: ['security.lockout'], not: ['fraud_policy'] },
  { q: 'lockout', locale: 'en', top3: ['security.lockout'], not: ['fraud_policy'] },
  { q: 'lockot', locale: 'en', top3: ['security.lockout'] },
  { q: 'refnd', locale: 'en', top3: ['refund_policy'] },
  { q: 'refund destination', locale: 'en', top3: ['refund_policy.destination'], first: 'refund_policy.destination' },
  { q: 'وجهة الاسترداد', locale: 'ar', top3: ['refund_policy.destination'], first: 'refund_policy.destination' },
  { q: 'ضريبه', locale: 'ar', top3: ['tax.'] },
  { q: 'هامش', locale: 'ar', top3: ['markup_rules', 'flights'] },
  { q: 'markup', locale: 'en', top3: ['markup_rules'], first: 'markup_rules' },
  { q: 'محفظة', locale: 'ar', top3: ['refund_policy', 'payment_methods', 'account', 'agent_payment_policy', 'platform.features.wallet', 'money_check.wallet', 'post_booking_services_policy.wallet'] },
  { q: 'wallet', locale: 'en', top3: ['refund_policy', 'payment_methods', 'account', 'agent_payment_policy'] },
  { q: 'صيانة', locale: 'ar', top3: ['maintenance'] },
  { q: 'maintenance', locale: 'en', top3: ['maintenance'] },
  { q: 'واتساب', locale: 'ar', top3: ['whatsapp_provider', 'notifications', 'platform.supportWhatsapp'] },
  { q: 'lockout.maxFailures', locale: 'en', top3: ['security.lockout.maxFailures'], first: 'security.lockout.maxFailures' },
  { q: 'default currency', locale: 'en', top3: ['platform.defaultCurrency'], first: 'platform.defaultCurrency' },
  { q: 'اللغة الافتراضية', locale: 'ar', top3: ['platform.defaultLocale'], first: 'platform.defaultLocale' },
  { q: 'support email', locale: 'en', top3: ['platform.supportEmail'], first: 'platform.supportEmail' },
  { q: 'بريد الدعم', locale: 'ar', top3: ['platform.supportEmail'], first: 'platform.supportEmail' },
  { q: 'time zone', locale: 'en', top3: ['platform.timezone'] },
  { q: 'احتيال', locale: 'ar', top3: ['fraud_policy'] },
  { q: '3ds', locale: 'en', top3: ['fraud_policy'] },
  { q: 'retention', locale: 'en', top3: ['retention', 'audit', 'storage', 'money_check', 'finance_ledger'] },
  { q: 'page size', locale: 'en', top3: ['pref.tables.tableSettings.pageSize'], first: 'pref.tables.tableSettings.pageSize' },
  { q: 'داكن', locale: 'ar', top3: ['pref.appearance.theme'], first: 'pref.appearance.theme' },
  { q: 'سر', locale: 'ar', top3: ['payment_gateways', 'whatsapp_provider', 'notifications', 'security', 'pref'], not: [] },
  { q: 'fx', locale: 'en', top3: ['fx.'] },
];

export interface CaseResult {
  q: string;
  locale: Locale;
  ok: boolean;
  count: number;
  top3: string[];
  why?: string;
}

export function runSearchSelfTest(): { passed: number; total: number; results: CaseResult[] } {
  const results = CASES.map((c): CaseResult => {
    const hits = search({ query: c.q, filters: [], section: null, locale: c.locale, valueOf: (e) => e.field.value, visible: () => true });
    const top3 = hits.slice(0, 3).map((h) => `${h.entry.id}${h.matchedIn && h.matchedIn !== 'label' ? ` [${h.matchedIn}${h.via ? `:${h.via}` : ''}]` : ''}`);
    const ids = hits.slice(0, 3).map((h) => h.entry.id);
    let why: string | undefined;
    if (!ids.some((id) => c.top3.some((p) => id.startsWith(p)))) why = `expected one of ${c.top3.join(', ')}`;
    else if (c.not && ids.some((id) => c.not!.some((p) => id.startsWith(p)))) why = `must not have ${c.not.join(', ')}`;
    else if (c.first && !ids[0]?.startsWith(c.first)) why = `first must be ${c.first}`;
    return { q: c.q, locale: c.locale, ok: !why, count: hits.length, top3, why };
  });
  return { passed: results.filter((r) => r.ok).length, total: results.length, results };
}
