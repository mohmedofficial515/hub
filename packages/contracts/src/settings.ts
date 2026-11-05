/**
 * @file Workspace settings catalogue (docs/03 §4.2): every key, its schema, default and description.
 * @description A row exists in `workspace_settings` only when a project overrides the default, so a new
 * project has every setting from the first moment. Add a key here and nowhere else.
 */
import { z } from 'zod';

import { roleSchema } from './roles';

const hours = z.number().int().min(1).max(8760);
const positiveInt = z.number().int().min(1);
const intervalSec = z.number().int().min(10).max(86_400);
const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const onboardingItemSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  kind: z.enum(['doc', 'card', 'url', 'action']),
  ref: z.string().min(1).max(500),
});
export type OnboardingItem = z.infer<typeof onboardingItemSchema>;

export const SETTING_TYPES = ['number', 'string', 'boolean', 'string[]', 'number[]', 'object'] as const;
export type SettingType = (typeof SETTING_TYPES)[number];

interface Definition<S extends z.ZodType> {
  readonly schema: S;
  readonly default: z.output<S>;
  readonly type: SettingType;
  readonly group: string;
  readonly description: { readonly ar: string; readonly en: string };
}

function define<S extends z.ZodType>(definition: Definition<S>): Definition<S> {
  return definition;
}

export const SETTINGS = {
  'decisions.reminder_offsets_hours': define({
    schema: z.array(hours).max(10),
    default: [24, 2],
    type: 'number[]',
    group: 'decisions',
    description: {
      ar: 'التذكير قبل موعد القرار بهذه الساعات',
      en: 'Remind this many hours before a decision is due',
    },
  }),
  'decisions.escalation_hours': define({
    schema: hours,
    default: 24,
    type: 'number',
    group: 'decisions',
    description: {
      ar: 'ساعات التصعيد إلى مدير المشروع بعد الموعد',
      en: 'Hours after the due date before escalating to pm',
    },
  }),
  'decisions.default_due_days': define({
    schema: positiveInt.max(365),
    default: 3,
    type: 'number',
    group: 'decisions',
    description: { ar: 'الموعد الافتراضي للقرار بالأيام', en: 'Default decision deadline in days' },
  }),
  'handoffs.stale_hours': define({
    schema: hours,
    default: 48,
    type: 'number',
    group: 'handoffs',
    description: {
      ar: 'متى يعد التسليم معلقا طويلا',
      en: 'Hours before a pending handoff counts as stale',
    },
  }),
  'needs.stale_days': define({
    schema: positiveInt.max(365),
    default: 5,
    type: 'number',
    group: 'needs',
    description: { ar: 'أيام التذكير للدور المسؤول', en: 'Days before reminding the responsible role' },
  }),
  'tasks.ready_limit_per_role': define({
    schema: positiveInt.max(200),
    default: 20,
    type: 'number',
    group: 'tasks',
    description: { ar: 'حجم قوائم المهام الجاهزة لك', en: 'Size of the "ready for you" lists' },
  }),
  'capture.github.interval_sec': define({
    schema: intervalSec,
    default: 120,
    type: 'number',
    group: 'capture',
    description: { ar: 'فترة قراءة GitHub بالثواني', en: 'GitHub poll period in seconds' },
  }),
  'capture.github.branch_patterns': define({
    schema: z.array(z.string().min(1).max(100)).max(50),
    default: ['main', 'feat/*', 'fix/*', 'chore/*'],
    type: 'string[]',
    group: 'capture',
    description: { ar: 'الفروع المتابعة', en: 'Branches to follow' },
  }),
  'capture.commit_group_minutes': define({
    schema: positiveInt.max(1440),
    default: 90,
    type: 'number',
    group: 'capture',
    description: { ar: 'نافذة تجميع الالتزامات بالدقائق', en: 'Commit grouping window in minutes' },
  }),
  'capture.lab.interval_sec': define({
    schema: intervalSec,
    default: 60,
    type: 'number',
    group: 'capture',
    description: { ar: 'فترة فحص المختبر بالثواني', en: 'Lab scanner period in seconds' },
  }),
  'capture.docs.interval_sec': define({
    schema: intervalSec,
    default: 300,
    type: 'number',
    group: 'capture',
    description: { ar: 'فترة فهرسة المستندات بالثواني', en: 'Docs indexer period in seconds' },
  }),
  'capture.openapi.path': define({
    schema: z.string().min(1).max(300),
    default: 'openapi/openapi.json',
    type: 'string',
    group: 'capture',
    description: { ar: 'ملف OpenAPI المقارن في المستودع', en: 'File to diff in the backend repository' },
  }),
  'capture.session.hook_grace_minutes': define({
    schema: positiveInt.max(1440),
    default: 10,
    type: 'number',
    group: 'capture',
    description: {
      ar: 'مدة انتظار log_session قبل إنشاء بطاقة حقائق فقط',
      en: 'Minutes to wait for log_session before creating a facts-only card',
    },
  }),
  'digest.morning_time': define({
    schema: localTime,
    default: '07:30',
    type: 'string',
    group: 'digest',
    description: { ar: 'وقت الموجز الصباحي', en: 'Local time of the morning brief' },
  }),
  'digest.weekly_day_time': define({
    schema: z.string().regex(/^(SUN|MON|TUE|WED|THU|FRI|SAT) ([01]\d|2[0-3]):[0-5]\d$/),
    default: 'SUN 08:00',
    type: 'string',
    group: 'digest',
    description: { ar: 'يوم ووقت الملخص الأسبوعي', en: 'Day and time of the weekly summary' },
  }),
  'notifications.quiet_hours': define({
    schema: z.object({ from: localTime, to: localTime }),
    default: { from: '22:00', to: '07:00' },
    type: 'object',
    group: 'notifications',
    description: { ar: 'ساعات الهدوء', en: 'Quiet hours for pushed notifications' },
  }),
  'security.totp_required_roles': define({
    schema: z.array(roleSchema),
    // Hub runs on the owner's machine: enrolling is optional until a project names roles here (docs/15 §2).
    default: [],
    type: 'string[]',
    group: 'security',
    description: { ar: 'الأدوار التي تلزمها المصادقة الثنائية', en: 'Roles that must enrol in TOTP' },
  }),
  'security.session_refresh_days': define({
    schema: positiveInt.max(365),
    default: 30,
    type: 'number',
    group: 'security',
    description: { ar: 'مدة بقاء الجلسة بالأيام', en: 'Days a session stays refreshable' },
  }),
  'lab.enabled': define({
    schema: z.boolean(),
    default: true,
    type: 'boolean',
    group: 'lab',
    description: { ar: 'إظهار صفحات إعادة التصميم', en: 'Show the Redesign pages' },
  }),
  'lab.port_task_specialty': define({
    schema: z.string().min(1).max(40),
    default: 'frontend',
    type: 'string',
    group: 'lab',
    description: { ar: 'تخصص مهمة النقل التلقائية', en: 'Specialty of the auto-created port task' },
  }),
  'timeline.commit_card_min_commits': define({
    schema: positiveInt.max(1000),
    default: 1,
    type: 'number',
    group: 'timeline',
    description: { ar: 'أقل عدد التزامات لإنشاء بطاقة', en: 'Fewest commits that make a change card' },
  }),
  'onboarding.paths': define({
    schema: z.partialRecord(roleSchema, z.array(onboardingItemSchema).max(100)),
    default: {},
    type: 'object',
    group: 'onboarding',
    description: { ar: 'مسار القراءة لكل دور', en: 'Reading path per role' },
  }),
  'modules.catalogue': define({
    schema: z.array(z.string().min(1).max(40)).max(200),
    default: [],
    type: 'string[]',
    group: 'modules',
    description: { ar: 'القيم المسموحة لوحدة البطاقة', en: 'Allowed values of a card module' },
  }),
} as const;

export type SettingKey = keyof typeof SETTINGS;
export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];
export type SettingValue<K extends SettingKey> = z.output<(typeof SETTINGS)[K]['schema']>;

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS, key);
}

export function settingDefault<K extends SettingKey>(key: K): SettingValue<K> {
  return SETTINGS[key].default as SettingValue<K>;
}

/** Validates a stored or submitted value with the key's schema. */
export function parseSetting<K extends SettingKey>(key: K, value: unknown): SettingValue<K> {
  return SETTINGS[key].schema.parse(value) as SettingValue<K>;
}

/** The catalogue as `GET /settings/catalogue` returns it (docs/04 §3.6). */
export function settingsCatalogue(): {
  key: SettingKey;
  type: SettingType;
  schema: Record<string, unknown>;
  description: { ar: string; en: string };
  group: string;
}[] {
  return SETTING_KEYS.map((key) => {
    const definition = SETTINGS[key];
    return {
      key,
      type: definition.type,
      schema: z.toJSONSchema(definition.schema),
      description: { ...definition.description },
      group: definition.group,
    };
  });
}
