// Types of the settings mock, shaped after the backend settings groups (src/modules/settings/groups/*.settings.ts,
// read through GET /admin/settings, /:key, /:key/schema and /:key/history) and the dashboard catalog
// (src/features/settings/catalog). One group = one versioned server document; a field = one leaf path in it.
//
// PROPOSED EXTENSION (not in the real API): `SettingsGroup.subsections` (the real editor makes one section per
// top-level compound field), `attention`, `notes`, the `maintenance` and special-page entries as groups, and every
// field with `proposed: true` (see dashboard/settings/audit.md, proposals S-xx). `risk`, `control`, `twoPerson` mirror
// the backend control lists (settings-controls.ts) and field warnings; they are not API fields either.

export type Localized = { ar: string; en: string };

/** The 8 sections of the recommended section map (audit.md §9.1). */
export type SectionId =
  'platform' | 'customers' | 'payments' | 'pricing' | 'finance' | 'staff' | 'flights' | 'system';

export type FieldType =
  | 'boolean'
  | 'integer'
  | 'number'
  | 'money'
  | 'duration'
  | 'enum'
  | 'multi-enum'
  | 'string'
  | 'string-list'
  | 'secret'
  | 'url';

export type DurationUnit = 'ms' | 'seconds' | 'minutes' | 'hours' | 'days' | 'months';
export type FieldUnit = DurationUnit | 'percent' | 'points' | 'count' | 'bytes' | 'ratio' | 'score' | 'USD';

/** How a `string` / `string-list` value is written, so a version can pick a fitting control. */
export type FieldFormat =
  | 'email'
  | 'phone'
  | 'currency'
  | 'timezone'
  | 'datetime'
  | 'time'
  | 'cidr'
  | 'country'
  | 'iata'
  | 'version'
  | 'hex';

export type FieldValue = boolean | number | string | null | string[] | number[];

export type Priority = 'P0' | 'P1' | 'P2';

export interface FieldOption {
  value: string;
  label: Localized;
  /** A swatch colour or a size shown next to the choice (preferences). */
  hint?: string;
}

export interface Field {
  /** Dotted path inside the group, array items by index (`gateways.0.enabled`), as the dashboard deep-links (`?focus=`). */
  key: string;
  label: Localized;
  help: Localized;
  type: FieldType;
  value: FieldValue;
  default: FieldValue;
  /** The backend accepts null (an optional setting; null = not set / the default behaviour). */
  nullable?: boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: FieldUnit;
  format?: FieldFormat;
  options?: FieldOption[];
  /** `string-list` items that are numbers (backoff ladders, reminder offsets). */
  itemType?: 'integer';
  itemUnit?: DurationUnit;
  /** The list order matters (wallet spend order). */
  ordered?: true;
  multiline?: true;
  /** A change needs confirmation (moves money, weakens a defence, can lock people out). */
  risk?: 'low' | 'high';
  /** Backend control: `money` needs settings.write_controls; `security` also needs the owner or a second approver. */
  control?: 'money' | 'security';
  /** A money control that also takes the two-person path (manual payments, offline settlements). */
  twoPerson?: true;
  /** Shown, never edited here (status, env-bound values, managed lists). */
  readOnly?: true;
  /** Edited in a dedicated editor (rules, tables); `value` is a readable summary per item. */
  structured?: true;
  /** Engineering tuning, folded under "Advanced". */
  advanced?: true;
  /** Legacy field proposed for retirement (audit overlaps). */
  deprecated?: true;
  /** The backend group that stores the field when it is shown in another group (`pricing`, `notifications`). */
  storedIn?: string;
  /** Notification template key of an event row. */
  templateKey?: string;
  note?: Localized;
  /** Audit proposal: not in the real API yet. */
  proposed?: true;
  proposalId?: string;
  priority?: Priority;
  /** The proposal needs server behaviour, not only a stored field. */
  needsBackend?: boolean;
  /** Choices that are themselves a proposal (theme "system"). */
  proposedOptions?: string[];
}

export interface Subsection {
  id: string;
  title: Localized;
  description: Localized;
  fields: Field[];
}

export interface SettingsGroup {
  /** Backend group key, or `payment_gateways` / `whatsapp_provider` for the two special pages. */
  key: string;
  section: SectionId;
  /** lucide-react icon name. */
  icon: string;
  title: Localized;
  /** One line for cards (dashboard `settings.groupSummaries`). */
  summary: Localized;
  /** Longer text for the group header (dashboard `settings.groupDescriptions`). */
  description: Localized;
  kind: 'server' | 'special';
  /** False for `maintenance`: in the backend since 2026-11-18, not in the dashboard yet. */
  inDashboard: boolean;
  /** Who may open it, when narrower than settings.read. */
  permission?: Localized;
  /** `controls`: some fields need settings.write_controls; `second-approver`: some changes wait for a second admin. */
  approval: 'none' | 'controls' | 'second-approver';
  version: number;
  /** Code schema version (null for special pages, which are not settings documents). */
  schemaVersion: number | null;
  updatedAt: string;
  updatedBy: string;
  /** Field key of the group's master switch, and its current value. */
  masterSwitch?: string;
  enabled?: boolean;
  /** A realistic warning to surface on the overview. */
  attention?: Localized;
  /** Cross-group explanation shown under the header. */
  notes?: Localized;
  subsections: Subsection[];
}

export interface SettingsSection {
  id: SectionId;
  icon: string;
  title: Localized;
  description: Localized;
  groupKeys: string[];
}

export interface SettingsChange {
  field: string;
  from: FieldValue;
  to: FieldValue;
}

export interface SettingsHistoryEntry {
  version: number;
  at: string;
  by: string;
  /** The optional reason typed on Save (null when none). */
  note: Localized | null;
  changes: SettingsChange[];
  /** Applied from a settings change request (security groups). */
  requestId?: string;
  approvedBy?: string;
}

export interface PreferenceTab {
  id: 'appearance' | 'tables' | 'notifications';
  icon: string;
  title: Localized;
  description: Localized;
  fields: Field[];
}
