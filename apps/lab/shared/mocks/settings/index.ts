// Settings mock for the dashboard settings redesign (`@lab/mocks/settings`).
// Real data: the 33 backend settings groups (31 shown in the dashboard + `maintenance`, new, + `pricing`, shown here as a
// sub-section of markup rules), the two special pages (payment gateway keys, WhatsApp provider) and the three
// personal preference tabs. Proposed fields from dashboard/settings/audit.md carry `proposed: true`.

import { CUSTOMER_GROUPS } from './groups/customers';
import { FINANCE_GROUPS } from './groups/finance';
import { FLIGHT_GROUPS } from './groups/flights';
import { PAYMENT_GROUPS } from './groups/payments';
import { PLATFORM_GROUPS } from './groups/platform';
import { PRICING_GROUPS } from './groups/pricing';
import { STAFF_GROUPS } from './groups/staff';
import { SYSTEM_GROUPS } from './groups/system';
import { SETTINGS_HISTORY } from './history';
import { PREFERENCES } from './preferences';
import { SETTINGS_SECTIONS } from './sections';
import type {
  Field,
  FieldValue,
  Localized,
  Priority,
  SectionId,
  SettingsGroup,
  SettingsHistoryEntry,
  SettingsSection,
  Subsection,
} from './types';

export type * from './types';
export { PREFERENCES, SETTINGS_HISTORY, SETTINGS_SECTIONS };

/** Fixed "now" so relative dates ("3 days ago") are deterministic. */
export const SETTINGS_NOW_ISO = '2026-11-18T10:00:00.000Z';

/** Every group (server groups and the two special pages), in section order. */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  ...PLATFORM_GROUPS,
  ...CUSTOMER_GROUPS,
  ...PAYMENT_GROUPS,
  ...PRICING_GROUPS,
  ...FINANCE_GROUPS,
  ...STAFF_GROUPS,
  ...FLIGHT_GROUPS,
  ...SYSTEM_GROUPS,
];

export function getGroup(key: string): SettingsGroup | undefined {
  return SETTINGS_GROUPS.find((group) => group.key === key);
}

export function getSection(id: SectionId): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((section) => section.id === id);
}

/** The groups of a section, in display order. */
export function groupsOfSection(id: SectionId): SettingsGroup[] {
  const section = getSection(id);
  if (!section) return [];
  return section.groupKeys.map((key) => getGroup(key)).filter((group): group is SettingsGroup => !!group);
}

/** A field with where it lives, for deep search and cross-group views. */
export interface FlatField extends Field {
  /** `<group>.<field key>`: unique across the mock. */
  id: string;
  groupKey: string;
  groupTitle: Localized;
  sectionId: SectionId;
  subsectionId: string;
  subsectionTitle: Localized;
}

let flat: FlatField[] | null = null;

/** Every field of every group, flattened (preferences excluded). */
export function allFields(): FlatField[] {
  flat ??= SETTINGS_GROUPS.flatMap((group) =>
    group.subsections.flatMap((subsection: Subsection) =>
      subsection.fields.map((field) => ({
        ...field,
        id: `${group.key}.${field.key}`,
        groupKey: group.key,
        groupTitle: group.title,
        sectionId: group.section,
        subsectionId: subsection.id,
        subsectionTitle: subsection.title,
      })),
    ),
  );
  return flat;
}

const sameValue = (a: FieldValue, b: FieldValue): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The field's value differs from its default ("changed from default" state). */
export function isChangedFromDefault(field: Field): boolean {
  return !sameValue(field.value, field.default);
}

/** The fields of a group that differ from their default. */
export function changedFields(groupKey: string): Field[] {
  const group = getGroup(groupKey);
  return group ? group.subsections.flatMap((s) => s.fields).filter(isChangedFromDefault) : [];
}

/** Version history of a group, newest first (empty when the mock has none for it). */
export function historyOf(groupKey: string): SettingsHistoryEntry[] {
  return SETTINGS_HISTORY[groupKey] ?? [];
}

/** Proposed fields (audit.md), optionally of one priority. */
export function proposedFields(priority?: Priority): FlatField[] {
  return allFields().filter((field) => field.proposed && (!priority || field.priority === priority));
}

/**
 * Case-insensitive search over labels and help (both languages), keys and values. Arabic letters are compared
 * without diacritics and with alef / yaa / taa marbuta variants folded, so "اعدادات" finds "إعدادات".
 */
export function searchFields(query: string): FlatField[] {
  const q = fold(query);
  if (!q) return [];
  return allFields().filter((field) =>
    [
      field.id,
      field.label.ar,
      field.label.en,
      field.help.ar,
      field.help.en,
      field.groupTitle.ar,
      field.groupTitle.en,
      Array.isArray(field.value) ? field.value.join(' ') : String(field.value ?? ''),
    ].some((text) => fold(text).includes(q)),
  );
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

/** Counts for headers and the overview. */
export const SETTINGS_COUNTS = {
  groups: SETTINGS_GROUPS.length,
  serverGroups: SETTINGS_GROUPS.filter((g) => g.kind === 'server').length,
  specialPages: SETTINGS_GROUPS.filter((g) => g.kind === 'special').length,
  fields: allFields().length,
  proposed: allFields().filter((f) => f.proposed).length,
  changedFromDefault: allFields().filter(isChangedFromDefault).length,
  withAttention: SETTINGS_GROUPS.filter((g) => g.attention).length,
} as const;
