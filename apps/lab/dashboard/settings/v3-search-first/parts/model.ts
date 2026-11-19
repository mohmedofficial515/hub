// Data helpers of v3 "Search first": one flat index of every field (organisation groups and personal preferences),
// with its path (Section › Group › Subsection), plus history walking for restore. Everything reads @lab/mocks/settings.

import {
  PREFERENCES,
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  historyOf,
  type Field,
  type FieldValue,
  type Localized,
  type SectionId,
  type SettingsGroup,
  type SettingsHistoryEntry,
} from '@lab/mocks/settings';
import { messages } from '../i18n';

export type Scope = 'org' | 'pref';
export type Role = 'owner' | 'admin';

/** One searchable field. Preferences use the group key `pref:<tab>`. */
export interface Entry {
  id: string;
  scope: Scope;
  groupKey: string;
  key: string;
  field: Field;
  sectionId: SectionId | 'prefs';
  sectionTitle: Localized;
  groupTitle: Localized;
  subsectionId: string;
  subsectionTitle: Localized;
  icon: string;
  order: number;
}

export const PREFS_TITLE: Localized = { ar: messages.ar.scope.prefs, en: messages.en.scope.prefs };

export const prefGroupKey = (tab: string) => `pref:${tab}`;
export const isPrefGroup = (groupKey: string) => groupKey.startsWith('pref:');

const sectionTitle = (id: SectionId): Localized =>
  SETTINGS_SECTIONS.find((s) => s.id === id)?.title ?? { ar: id, en: id };

let index: Entry[] | null = null;

/** Every field of every group and every preference, in display order. */
export function allEntries(): Entry[] {
  if (index) return index;
  let order = 0;
  const org: Entry[] = SETTINGS_GROUPS.flatMap((group) =>
    group.subsections.flatMap((sub) =>
      sub.fields.map((field) => ({
        id: `${group.key}.${field.key}`,
        scope: 'org' as const,
        groupKey: group.key,
        key: field.key,
        field,
        sectionId: group.section,
        sectionTitle: sectionTitle(group.section),
        groupTitle: group.title,
        subsectionId: sub.id,
        subsectionTitle: sub.title,
        icon: group.icon,
        order: order++,
      })),
    ),
  );
  const prefs: Entry[] = PREFERENCES.flatMap((tab) =>
    tab.fields.map((field) => ({
      id: `pref.${tab.id}.${field.key}`,
      scope: 'pref' as const,
      groupKey: prefGroupKey(tab.id),
      key: field.key,
      field,
      sectionId: 'prefs' as const,
      sectionTitle: PREFS_TITLE,
      groupTitle: tab.title,
      subsectionId: tab.id,
      subsectionTitle: tab.title,
      icon: tab.icon,
      order: order++,
    })),
  );
  index = [...org, ...prefs];
  return index;
}

const byId = new Map<string, Entry>();
export function entryById(id: string): Entry | undefined {
  if (!byId.size) allEntries().forEach((e) => byId.set(e.id, e));
  return byId.get(id);
}

export function entryOf(groupKey: string, key: string): Entry | undefined {
  return isPrefGroup(groupKey) ? entryById(`pref.${groupKey.slice(5)}.${key}`) : entryById(`${groupKey}.${key}`);
}

export function groupByKey(key: string): SettingsGroup | undefined {
  return SETTINGS_GROUPS.find((g) => g.key === key);
}

export function fieldsOf(group: SettingsGroup): Field[] {
  return group.subsections.flatMap((s) => s.fields);
}

export const same = (a: FieldValue | undefined, b: FieldValue | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Simple types that can be edited straight from a result row. */
export function isInlineEditable(field: Field): boolean {
  if (field.readOnly || field.structured) return false;
  if (field.type === 'boolean') return true;
  if (field.type === 'enum') return (field.options?.length ?? 0) > 0;
  return field.type === 'integer' || field.type === 'number' || field.type === 'money' || field.type === 'duration';
}

/** Fields only the owner may see (gateway keys page, the Cartat account). */
export function ownerOnly(groupKey: string, field?: Field): boolean {
  if (groupKey === 'payment_gateways') return true;
  if (groupKey === 'whatsapp_provider' && field && (field.key === 'apiToken' || field.key === 'apiUrl')) return true;
  return false;
}

export function canSee(role: Role, groupKey: string, field?: Field): boolean {
  return role === 'owner' || !ownerOnly(groupKey, field);
}

/** A change waits for a second approver: security controls or two-person money controls, made by someone other than the owner. */
export function waitsForApprover(role: Role, group: SettingsGroup | undefined, field: Field): boolean {
  if (!group || role === 'owner') return false;
  return field.control === 'security' || !!field.twoPerson || (group.approval === 'second-approver' && field.risk === 'high');
}

/** Needs explicit confirmation in the review: high risk or a security control. */
export const needsConfirm = (field: Field) => field.risk === 'high' || field.control === 'security';

/** Values of a group at version `k`, walking the history back from the current saved values. */
export function valuesAt(
  history: SettingsHistoryEntry[],
  current: Record<string, FieldValue>,
  k: number,
): Record<string, FieldValue> {
  const out = { ...current };
  for (const entry of history) {
    if (entry.version <= k) break;
    for (const change of entry.changes) out[change.field] = change.from;
  }
  return out;
}

export { historyOf };

/** Related groups and the overlap they share (audit.md §9.2). Text lives in i18n `related`. */
export const RELATED: Record<string, string[]> = {
  platform: ['maintenance'],
  maintenance: ['platform'],
  security: ['verification_policy', 'abuse_protection', 'security_alerts'],
  verification_policy: ['security', 'abuse_protection'],
  abuse_protection: ['security', 'flight_guards'],
  security_alerts: ['security', 'notifications'],
  payment_methods: ['payment_gateways', 'refund_policy'],
  payment_gateways: ['payment_methods'],
  refund_policy: ['payment_methods', 'agent_payment_policy'],
  agent_payment_policy: ['refund_policy', 'agent_booking_policy'],
  agent_booking_policy: ['agent_payment_policy', 'post_booking_services_policy'],
  post_booking_services_policy: ['flight_provider', 'agent_booking_policy'],
  flights: ['flight_provider', 'flight_guards'],
  flight_provider: ['flights', 'flight_guards', 'post_booking_services_policy'],
  flight_guards: ['flight_provider', 'abuse_protection'],
  notifications: ['whatsapp_provider', 'security_alerts'],
  whatsapp_provider: ['notifications'],
  retention: ['audit', 'storage', 'finance_ledger', 'money_check'],
  audit: ['retention'],
  storage: ['retention'],
  markup_rules: ['fx', 'tax'],
  fx: ['markup_rules'],
  tax: ['e_invoicing'],
  e_invoicing: ['tax'],
};

/** A small set of real history-like "recent" events across groups, newest first. */
export function recentChanges(limit = 6) {
  return SETTINGS_GROUPS.flatMap((group) =>
    historyOf(group.key)
      .filter((h) => h.changes.length > 0)
      .map((h) => ({ group, entry: h })),
  )
    .sort((a, b) => b.entry.at.localeCompare(a.entry.at))
    .slice(0, limit);
}
