/**
 * Self-test of the sentence books: renders every template in ar and en over every combination of the switches and enum values it
 * reads (cartesian when small, one-at-a-time from the mock values when large) and fails on empty output, leftover syntax, double
 * spaces, stray spacing before punctuation, sentences that contradict their value, and (for the hand-written groups) sentences with
 * more than 4 tokens or 40 words. Pure: runs in Node (scratchpad runner) and in the browser.
 */
import type { FieldValue } from '@lab/mocks/settings';
import { messages, type Messages } from '../i18n';
import { ORG_DOCS, PREF_DOCS, fieldOf, initialValues, type Values } from './model';
import { expand, keysOfRaw, parse, plainLine, rawSubsection, type Get } from './templates';

type Locale = 'ar' | 'en';

/** The 12 hand-written groups plus maintenance, gateways and WhatsApp: held to the sentence-length rule. */
export const HAND_WRITTEN = [
  'refund_policy',
  'security',
  'abuse_protection',
  'fraud_policy',
  'payment_methods',
  'markup_rules',
  'tax',
  'flights',
  'flight_guards',
  'notifications',
  'loyalty',
  'maintenance',
  'payment_gateways',
  'whatsapp_provider',
];

/** Phrases that must not appear when a condition holds (one per known contradiction). */
const CONTRADICTIONS: { doc: string; id: string; when: Record<string, FieldValue>; ar: string; en: string }[] = [
  { doc: 'refund_policy', id: 'destination', when: { destination: 'WALLET' }, ar: 'من يختار المحفظة', en: 'Choosing the wallet' },
  { doc: 'refund_policy', id: 'destination', when: { destination: 'ORIGINAL_METHOD' }, ar: 'مكافأة', en: 'bonus' },
  { doc: 'refund_policy', id: 'failed', when: { 'failedBooking.mode': 'ORIGINAL_METHOD' }, ar: 'مكافأة', en: 'bonus' },
  { doc: 'refund_policy', id: 'topups', when: { allowWalletTopup: false }, ar: 'الحد اليومي', en: 'daily limit' },
  { doc: 'security', id: 'lockout', when: { 'lockout.enabled': false }, ar: 'يُقفل الحساب.', en: 'the account locks' },
  { doc: 'security', id: 'staff', when: { 'adminIpAllowlist.enabled': false }, ar: 'لا تُفتح لوحة التحكم إلا', en: 'only opens from' },
  { doc: 'security', id: 'staff', when: { 'loginAlerts.admin': 'off' }, ar: 'ونرسل للموظفين', en: 'Staff get a sign-in alert' },
  { doc: 'abuse_protection', id: 'otp', when: { 'otpBudget.enabled': false }, ar: 'لا نرسل أكثر', en: 'no more than' },
  { doc: 'abuse_protection', id: 'captcha', when: { 'captcha.enabled': false }, ar: 'يظهر بعد', en: 'It appears after' },
  { doc: 'fraud_policy', id: 'review', when: { 'review.enabled': false }, ar: 'ينتظر موظفًا', en: 'waits for a staff' },
  { doc: 'fraud_policy', id: 'summary', when: { 'review.enabled': false }, ar: 'ينتظر موظفًا', en: 'waits for a staff' },
  { doc: 'fraud_policy', id: 'threeDs', when: { 'threeDs.mode': 'ALWAYS' }, ar: 'فأكثر', en: 'or more' },
  { doc: 'fraud_policy', id: 'cardTesting', when: { 'cardTesting.enabled': false }, ar: 'نحظر بعد', en: 'We block after' },
  ...[
    'cardSharedAcrossAccounts',
    'cardsPerAccount',
    'accountsPerDevice',
    'paymentsPerIp',
    'countryMismatch',
    'sameDayTravel',
    'highAmount',
    'noLiabilityShift',
  ].map((r) => ({ doc: 'fraud_policy', id: 'rules', when: { [`rules.${r}.enabled`]: false }, ar: `${r}:أضفنا`, en: `${r}:adds` })),
  { doc: 'payment_methods', id: 'wallet', when: { 'walletPayments.enabled': false }, ar: 'الجزئي', en: 'Partial' },
  { doc: 'markup_rules', id: 'default', when: { 'defaultRule.mode': 'fixed' }, ar: '٪', en: '%' },
  { doc: 'markup_rules', id: 'summary', when: { 'defaultRule.mode': 'fixed' }, ar: '٪', en: '%' },
  { doc: 'tax', id: 'summary', when: { mode: 'NONE' }, ar: 'ونصدر باسم', en: 'issues the tax invoices' },
  { doc: 'tax', id: 'summary', when: { mode: 'VAT' }, ar: 'إيصالات لا فواتير', en: 'receipts, not tax' },
  { doc: 'flights', id: 'calendar', when: { 'fareCalendar.enabled': false }, ar: 'يبقى السعر حديثًا', en: 'stays fresh' },
  { doc: 'flight_guards', id: 'balance', when: { 'supplierBalance.enabled': false }, ar: 'ننبّه حين', en: 'We alert when' },
  { doc: 'notifications', id: 'ops', when: { 'opsAlerts.enabled': false }, ar: 'تصل إلى', en: 'They reach' },
  { doc: 'notifications', id: 'quiet', when: { 'quietHours.enabled': false }, ar: 'نؤجّل', en: 'we hold' },
  { doc: 'loyalty', id: 'summary', when: { enabled: false }, ar: 'يكسب العميل', en: 'Customers earn' },
  { doc: 'loyalty', id: 'redemption', when: { 'redemption.enabled': false }, ar: 'قيمة النقطة', en: 'A point is worth' },
  { doc: 'loyalty', id: 'expiry', when: { 'expiry.enabled': false }, ar: 'تنتهي النقطة', en: 'A point expires' },
  { doc: 'maintenance', id: 'switch', when: { scope: 'full' }, ar: 'فقط', en: 'only' },
  { doc: 'maintenance', id: 'summary', when: { enabled: false }, ar: 'الآن على', en: 'right now' },
  { doc: 'payment_gateways', id: 'stripe', when: { 'STRIPE.mode': 'unknown' }, ar: 'في وضع غير', en: 'in unknown mode' },
  { doc: 'whatsapp_provider', id: 'status', when: { lastErrorAt: null }, ar: 'آخر إخفاق', en: 'last failure' },
];

/** Candidate values of a field for the combinations. */
function candidates(docKey: string, key: string, base: FieldValue): FieldValue[] {
  const f = fieldOf(docKey, key);
  if (!f) return [base];
  if (f.type === 'boolean') return [true, false];
  if (f.type === 'enum' && f.options) return f.options.map((o) => o.value);
  if (['integer', 'number', 'money', 'duration'].includes(f.type)) return f.nullable ? [base ?? f.min ?? 1, null] : [base, 0];
  if (f.nullable) return [base, null];
  if (f.type === 'string-list' || f.type === 'multi-enum') return [base, []];
  return [base];
}

function combos(docKey: string, keys: string[], base: Values): Values[] {
  const lists = keys.map((k) => candidates(docKey, k, base[k] ?? null));
  const total = lists.reduce((n, l) => n * l.length, 1);
  if (total <= 512) {
    let out: Values[] = [{ ...base }];
    keys.forEach((k, i) => {
      out = out.flatMap((v) => lists[i].map((c) => ({ ...v, [k]: c })));
    });
    return out;
  }
  // too many: every value of each key on its own, plus all switches off and all on
  const out: Values[] = [{ ...base }];
  keys.forEach((k, i) => lists[i].forEach((c) => out.push({ ...base, [k]: c })));
  const bools = keys.filter((k) => fieldOf(docKey, k)?.type === 'boolean');
  out.push({ ...base, ...Object.fromEntries(bools.map((k) => [k, false])) });
  out.push({ ...base, ...Object.fromEntries(bools.map((k) => [k, true])) });
  return out;
}

const sentencesOf = (text: string) => text.split(/(?<=[.؟?])\s+/).filter((s) => s.trim());

export interface SelfTestResult {
  templates: number;
  renders: number;
  failures: string[];
  longest: { words: number; tokens: number; where: string };
}

export function runSelfTest(): SelfTestResult {
  const base = initialValues();
  const failures: string[] = [];
  let renders = 0;
  let templates = 0;
  const longest = { words: 0, tokens: 0, where: '' };
  for (const doc of [...ORG_DOCS, ...PREF_DOCS]) {
    const ids = ['summary', ...doc.subsections.map((s) => s.id)];
    for (const id of ids) {
      for (const locale of ['ar', 'en'] as Locale[]) {
        const t = messages[locale] as Messages;
        const raw = id === 'summary' ? (t.book[doc.key]?.summary !== undefined ? { lines: ([] as string[]).concat(t.book[doc.key].summary), list: false } : null) : rawSubsection(t, locale, doc.key, id);
        if (!raw) continue;
        if (locale === 'ar') templates += 1;
        const keys = [...new Set(raw.lines.flatMap(keysOfRaw))].filter((k) => fieldOf(doc.key, k));
        for (const values of combos(doc.key, keys, base[doc.key])) {
          const get: Get = (k) => values[k] ?? null;
          const lines = raw.lines.map((l) => expand(l, get)).filter(Boolean);
          renders += 1;
          const where = `${locale} ${doc.key}.${id} ${JSON.stringify(Object.fromEntries(keys.map((k) => [k, values[k]])))}`.slice(0, 240);
          if (!lines.length) {
            failures.push(`empty: ${where}`);
            continue;
          }
          lines.forEach((line, li) => {
            const text = plainLine(t, locale, doc.key, line, get);
            const bad = [
              [/[{}]|\[\[|\]\]|\*\*|@\./, 'leftover syntax'],
              [/ {2,}/, 'double space'],
              [/ [،.,:;؛]/, 'space before punctuation'],
              [/undefined|NaN|\bnull\b/, 'raw value'],
              [/^[\s،.,:;]/, 'starts with punctuation'],
              [/\.\.|،\./, 'double punctuation'],
            ] as const;
            for (const [re, what] of bad) if (re.test(text)) failures.push(`${what}: ${where} → «${text}»`);
            if (!/[.؟?]$/.test(text.trim())) failures.push(`no final stop: ${where} → «${text}»`);
            if (HAND_WRITTEN.includes(doc.key)) {
              for (const s of sentencesOf(text)) {
                const words = s.split(/\s+/).length;
                if (words > longest.words) Object.assign(longest, { words, where: `${locale} ${doc.key}.${id}` });
                if (words > 40) failures.push(`> 40 words (${words}): ${where}`);
              }
              for (const s of sentencesOf(line)) {
                const tokens = parse(s).filter((p) => p.k === 'field').length;
                if (tokens > longest.tokens) longest.tokens = tokens;
                if (tokens > 4) failures.push(`> 4 tokens (${tokens}): ${locale} ${doc.key}.${id} «${s.slice(0, 80)}…»`);
              }
            }
            for (const c of CONTRADICTIONS) {
              if (c.doc !== doc.key || c.id !== id) continue;
              if (!Object.entries(c.when).every(([k, v]) => JSON.stringify(values[k] ?? null) === JSON.stringify(v))) continue;
              const needle = c[locale];
              const [rule, phrase] = needle.includes(':') && !needle.startsWith('http') && c.id === 'rules' ? needle.split(':') : [null, needle];
              if (rule && !raw.lines[li]?.includes(`rules.${rule}.`)) continue;
              if (text.includes(phrase)) failures.push(`contradiction «${phrase}» when ${JSON.stringify(c.when)}: ${locale} → «${text}»`);
            }
          });
        }
      }
    }
  }
  return { templates, renders, failures, longest };
}
