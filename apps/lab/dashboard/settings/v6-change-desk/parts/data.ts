// Pure data helpers over @lab/mocks/settings: field index, canonical ids, merged history, versions and as-of reconstruction.
import {
  allFields,
  getGroup,
  historyOf,
  SETTINGS_GROUPS,
  type FieldValue,
  type FlatField,
  type SettingsGroup,
  type SettingsHistoryEntry,
} from '@lab/mocks/settings';
import { sameValue } from './format';

export const FIELDS: FlatField[] = allFields();
export const FIELD_INDEX = new Map<string, FlatField>(FIELDS.map((f) => [f.id, f]));

/** Where a field is stored: a field shown in another group (`storedIn`) stages into the storing group. */
export function canonicalId(field: FlatField): string {
  if (field.storedIn) {
    const id = `${field.storedIn}.${field.key}`;
    if (FIELD_INDEX.has(id)) return id;
  }
  return field.id;
}

export const INITIAL_VALUES: Record<string, FieldValue> = Object.fromEntries(FIELDS.map((f) => [f.id, f.value]));
export const INITIAL_VERSIONS: Record<string, number> = Object.fromEntries(SETTINGS_GROUPS.map((g) => [g.key, g.version]));

/** Groups that are server documents (staged through the ticket). Special pages are not. */
export const isServer = (g: SettingsGroup) => g.kind === 'server';

/** Second-approver path: a security control in a second-approver group, or a two-person money switch. */
export function needsSecondApprover(field: FlatField): boolean {
  const group = getGroup(field.groupKey);
  return !!group && group.approval === 'second-approver' && (field.control === 'security' || !!field.twoPerson);
}

export type ChangeRisk = 'high' | 'security' | 'money' | 'normal';
export function riskOf(field: FlatField): ChangeRisk {
  if (field.risk === 'high') return 'high';
  if (field.control === 'security') return 'security';
  if (field.control === 'money') return 'money';
  return 'normal';
}
export const RISK_ORDER: ChangeRisk[] = ['high', 'security', 'money', 'normal'];

export interface TimelineEntry extends SettingsHistoryEntry {
  groupKey: string;
  /** Ticket code when the entry came from this session's apply. */
  ticket?: string;
}

export type SessionHistory = Record<string, TimelineEntry[]>;

export function groupHistory(groupKey: string, session: SessionHistory): TimelineEntry[] {
  return [...(session[groupKey] ?? []), ...historyOf(groupKey).map((e) => ({ ...e, groupKey }))];
}

export function allEntries(session: SessionHistory, includeMock = true): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const g of SETTINGS_GROUPS) {
    out.push(...(session[g.key] ?? []));
    if (includeMock) out.push(...historyOf(g.key).map((e) => ({ ...e, groupKey: g.key })));
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export function entryRisk(entry: TimelineEntry): ChangeRisk {
  let best: ChangeRisk = 'normal';
  for (const c of entry.changes) {
    const f = FIELD_INDEX.get(`${entry.groupKey}.${c.field}`);
    if (!f) continue;
    const r = riskOf(f);
    if (RISK_ORDER.indexOf(r) < RISK_ORDER.indexOf(best)) best = r;
  }
  return best;
}

/** Field values of a group at a given version (only the fields that changed after it). */
export function valuesAtVersion(groupKey: string, version: number, session: SessionHistory): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const entry of groupHistory(groupKey, session)) {
    if (entry.version <= version) break;
    for (const c of entry.changes) out[c.field] = c.from;
  }
  return out;
}

export type AsOfStatus =
  | { kind: 'same'; version: number }
  | { kind: 'version'; version: number }
  | { kind: 'before'; version: number }
  | { kind: 'notYet' }
  | { kind: 'unknown'; version: number };

export interface AsOfGroup {
  group: SettingsGroup;
  status: AsOfStatus;
  /** field key → value then (only the fields that differ from today). */
  then: Record<string, FieldValue>;
}

/** The state of a group at the end of a given day, from its version history. */
export function groupAsOf(group: SettingsGroup, dateIso: string, values: Record<string, FieldValue>, session: SessionHistory, currentVersion: number): AsOfGroup {
  const entries = groupHistory(group.key, session);
  const then: Record<string, FieldValue> = {};
  if (entries.length === 0) {
    const status: AsOfStatus = group.updatedAt > dateIso ? { kind: 'unknown', version: currentVersion } : { kind: 'same', version: currentVersion };
    return { group, status, then };
  }
  const after = entries.filter((e) => e.at > dateIso);
  for (const e of after) for (const c of e.changes) then[c.field] = c.from;
  for (const key of Object.keys(then)) {
    if (sameValue(then[key], values[`${group.key}.${key}`])) delete then[key];
  }
  const inForce = entries.find((e) => e.at <= dateIso);
  let status: AsOfStatus;
  if (after.length === 0) status = { kind: 'same', version: currentVersion };
  else if (inForce) status = { kind: 'version', version: inForce.version };
  else {
    const oldest = entries[entries.length - 1];
    status = oldest.version === 1 ? { kind: 'notYet' } : { kind: 'before', version: oldest.version - 1 };
  }
  return { group, status, then };
}

export function oldestHistoryDate(): string {
  return allEntries({}).at(-1)?.at ?? new Date().toISOString();
}
