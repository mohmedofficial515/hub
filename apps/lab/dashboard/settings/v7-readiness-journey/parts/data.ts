// Read-only helpers over `@lab/mocks/settings`, plus value formatting. Nothing here holds state.
import {
  SETTINGS_GROUPS,
  SETTINGS_NOW_ISO,
  SETTINGS_SECTIONS,
  type Field,
  type FieldOption,
  type FieldValue,
  type Localized,
  type SectionId,
  type SettingsGroup,
  type Subsection,
} from '@lab/mocks/settings';
import type { Locale } from '@lab/i18n';

export type Role = 'owner' | 'admin' | 'none';

export const NOW = new Date(SETTINGS_NOW_ISO).getTime();

const GROUP_INDEX = new Map(SETTINGS_GROUPS.map((g) => [g.key, g]));

export function groupOf(key: string): SettingsGroup | undefined {
  return GROUP_INDEX.get(key);
}

export function sectionOf(id: SectionId) {
  return SETTINGS_SECTIONS.find((s) => s.id === id)!;
}

export function fieldsOf(group: SettingsGroup): Field[] {
  return group.subsections.flatMap((s) => s.fields);
}

export function findField(groupKey: string, fieldKey: string): { field: Field; subsection: Subsection } | undefined {
  const group = groupOf(groupKey);
  if (!group) return undefined;
  for (const subsection of group.subsections) {
    const field = subsection.fields.find((f) => f.key === fieldKey);
    if (field) return { field, subsection };
  }
  return undefined;
}

/** Pages a role may open. The owner sees everything; an admin loses the owner-only gateway keys. */
export function canOpenGroup(key: string, role: Role): boolean {
  if (role === 'none') return false;
  if (key === 'payment_gateways') return role === 'owner';
  return true;
}

/** Fields an admin may not see even inside a page they can open (WhatsApp account is owner only). */
export function canSeeField(groupKey: string, fieldKey: string, role: Role): boolean {
  if (!canOpenGroup(groupKey, role)) return false;
  if (groupKey === 'whatsapp_provider' && (fieldKey === 'apiUrl' || fieldKey === 'apiToken')) return role === 'owner';
  return true;
}

export function visibleGroupsOfSection(id: SectionId, role: Role): SettingsGroup[] {
  return sectionOf(id)
    .groupKeys.map((k) => groupOf(k))
    .filter((g): g is SettingsGroup => !!g && canOpenGroup(g.key, role));
}

/**
 * Related groups shown in each group header (audit.md §9.2 overlaps). Each group still appears once in the index;
 * these are links, never copies.
 */
export const RELATED: Record<string, string[]> = {
  platform: ['maintenance', 'loyalty', 'refund_policy'],
  maintenance: ['platform'],
  security: ['verification_policy', 'abuse_protection', 'security_alerts'],
  verification_policy: ['security', 'abuse_protection', 'notifications'],
  abuse_protection: ['security', 'flight_guards'],
  security_alerts: ['security', 'notifications'],
  account: ['refund_policy'],
  travellers: ['account'],
  loyalty: ['platform', 'refund_policy'],
  payment_methods: ['payment_gateways', 'refund_policy'],
  payment_gateways: ['payment_methods'],
  refund_policy: ['payment_methods', 'agent_payment_policy', 'disputes'],
  fraud_policy: ['abuse_protection', 'disputes'],
  disputes: ['refund_policy', 'loyalty'],
  markup_rules: ['fx', 'tax'],
  fx: ['markup_rules'],
  tax: ['e_invoicing', 'accounting_access'],
  e_invoicing: ['tax'],
  finance_ledger: ['money_check'],
  money_check: ['finance_ledger', 'refund_policy'],
  accounting_access: ['tax'],
  agent_booking_policy: ['agent_payment_policy', 'refund_policy'],
  agent_payment_policy: ['agent_booking_policy', 'refund_policy'],
  post_booking_services_policy: ['flight_provider'],
  flights: ['flight_provider', 'flight_guards'],
  flight_provider: ['flights', 'flight_guards', 'post_booking_services_policy'],
  flight_guards: ['flight_provider', 'abuse_protection'],
  notifications: ['whatsapp_provider', 'security_alerts'],
  whatsapp_provider: ['notifications'],
  mobile_app: ['platform'],
  analytics: ['retention', 'audit'],
  audit: ['retention', 'analytics'],
  storage: ['retention'],
  retention: ['analytics', 'audit', 'storage'],
};

/** Payment gateway pages map to `payment_methods.gateways.<index>`, in the same order. */
export const GATEWAY_INDEX: Record<string, number> = {
  stripe: 0,
  myfatoorah: 1,
  paymob: 2,
  moyasar: 3,
  tap: 4,
  paytr: 5,
  iyzico: 6,
};

// ---------------------------------------------------------------- formatting

export const numLocale = (lang: Locale) => (lang === 'ar' ? 'ar-u-nu-latn' : 'en');

export function L(text: Localized | undefined, lang: Locale): string {
  return text ? text[lang] : '';
}

export function sameValue(a: FieldValue | undefined, b: FieldValue | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

const UNIT_MAP: Partial<Record<NonNullable<Field['unit']>, string>> = {
  ms: 'millisecond',
  seconds: 'second',
  minutes: 'minute',
  hours: 'hour',
  days: 'day',
  months: 'month',
  percent: 'percent',
};

export function formatNumber(n: number, lang: Locale, digits = 2): string {
  return new Intl.NumberFormat(numLocale(lang), { maximumFractionDigits: digits }).format(n);
}

export function formatWithUnit(n: number, unit: Field['unit'] | Field['itemUnit'] | undefined, lang: Locale): string {
  if (unit === 'USD') {
    return new Intl.NumberFormat(numLocale(lang), { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
  }
  if (unit === 'bytes') {
    const mb = n / 1_000_000;
    return new Intl.NumberFormat(numLocale(lang), { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format(mb);
  }
  const intlUnit = unit ? UNIT_MAP[unit] : undefined;
  if (intlUnit) {
    return new Intl.NumberFormat(numLocale(lang), {
      style: 'unit',
      unit: intlUnit,
      unitDisplay: intlUnit === 'percent' ? 'short' : 'long',
      maximumFractionDigits: 2,
    }).format(n);
  }
  return formatNumber(n, lang);
}

/** Short unit word next to a number input ("minutes", "دقيقة"). */
export function unitWord(unit: Field['unit'] | undefined, lang: Locale): string {
  if (!unit) return '';
  if (unit === 'USD') return 'USD';
  if (unit === 'percent') return '%';
  if (unit === 'bytes') return 'MB';
  const intlUnit = UNIT_MAP[unit];
  if (!intlUnit) return '';
  const parts = new Intl.NumberFormat(numLocale(lang), { style: 'unit', unit: intlUnit, unitDisplay: 'long' }).formatToParts(10);
  return parts
    .filter((p) => p.type === 'unit')
    .map((p) => p.value)
    .join('')
    .trim();
}

function optionLabel(options: FieldOption[] | undefined, value: string, lang: Locale): string {
  const hit = options?.find((o) => o.value === value);
  return hit ? hit.label[lang] : value;
}

export function formatDateTime(iso: string, lang: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(numLocale(lang), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(d);
}

export function formatRelative(iso: string, lang: Locale): string {
  const diff = new Date(iso).getTime() - NOW;
  const rtf = new Intl.RelativeTimeFormat(numLocale(lang), { numeric: 'auto' });
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 1) return rtf.format(0, 'second');
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, 'month');
  return rtf.format(Math.round(months / 12), 'year');
}

export interface ValueWords {
  on: string;
  off: string;
  notSet: string;
  items: (n: number) => string;
}

/** A field value as a short readable phrase (review sentences, summaries, search results). */
export function formatValue(field: Field, value: FieldValue | undefined, lang: Locale, words: ValueWords): string {
  if (value === null || value === undefined || value === '') return words.notSet;
  switch (field.type) {
    case 'boolean':
      return value ? words.on : words.off;
    case 'enum':
      return optionLabel(field.options, String(value), lang);
    case 'multi-enum': {
      const list = Array.isArray(value) ? value.map(String) : [];
      if (!list.length) return words.notSet;
      return list.map((v) => optionLabel(field.options, v, lang)).join(lang === 'ar' ? '، ' : ', ');
    }
    case 'integer':
    case 'number':
    case 'money':
    case 'duration':
      return typeof value === 'number' ? formatWithUnit(value, field.unit, lang) : String(value);
    case 'string-list': {
      const list = Array.isArray(value) ? value.map(String) : [];
      if (!list.length) return words.items(0);
      if (field.itemType === 'integer') return list.join(' → ');
      if (field.options) return list.map((v) => optionLabel(field.options, v, lang)).join(lang === 'ar' ? '، ' : ', ');
      if (list.length <= 2) return list.join(lang === 'ar' ? '، ' : ', ');
      return `${list.slice(0, 2).join(lang === 'ar' ? '، ' : ', ')} +${list.length - 2}`;
    }
    case 'secret':
      return String(value);
    case 'string':
      if (field.format === 'datetime') return formatDateTime(String(value), lang);
      return String(value);
    default:
      return String(value);
  }
}

/** Values that read left to right in either language (codes, addresses, numbers with Latin parts). */
export function isLtrValue(field: Field): boolean {
  return (
    field.type === 'url' ||
    field.type === 'secret' ||
    ['email', 'phone', 'cidr', 'iata', 'version', 'hex', 'currency', 'timezone', 'country'].includes(field.format ?? '')
  );
}
