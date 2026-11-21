// Settings data (09 §18, shapes from 03 §3, §4, §8, §9, §11 and 04 §2, §3.3, §3.6, §3.7, §3.21, §3.23).
//
// Hub never stores or shows a secret here: tokens appear as prefixes, source credentials as `hasSecret`. The one
// value a token dialog reveals is built by `exampleToken` and says in plain words that it is not real.

import { NOW, todayFor, type HubScenario, type L, type Role } from './index';

const l = (ar: string, en: string): L => ({ ar, en });
type Scenario = HubScenario | 'error';
const safe = (s: Scenario): HubScenario => (s === 'error' ? 'default' : s);

export const ROLES: Role[] = ['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa'];

// ── General (03 §4.2) ─────────────────────────────────────────────────────────────────────────────

export interface OnboardingItem {
  id: string;
  kind: 'doc' | 'card' | 'url' | 'action';
  title: L;
  ref: string;
}

export interface GeneralSettings {
  name: L;
  slug: string;
  keyPrefix: string;
  timezone: string;
  defaultLocale: 'ar' | 'en';
  reminderOffsets: number[];
  escalationHours: number;
  defaultDueDays: number;
  handoffStaleHours: number;
  needStaleDays: number;
  morningTime: string;
  weeklyDay: 'SAT' | 'SUN' | 'MON';
  weeklyTime: string;
  quietFrom: string;
  quietTo: string;
  onboarding: Record<Role, OnboardingItem[]>;
}

/** Catalogue defaults, shown beside each field. */
export const settingDefaults = {
  reminderOffsets: '24, 2',
  escalationHours: 24,
  defaultDueDays: 3,
  handoffStaleHours: 48,
  needStaleDays: 5,
  morningTime: '07:30',
  weekly: 'SUN 08:00',
  quietHours: '22:00 – 07:00',
};

export const timezones = ['Europe/Istanbul', 'Asia/Riyadh', 'Asia/Dubai', 'Africa/Cairo', 'UTC'];

const common: OnboardingItem[] = [
  { id: 'o-team-pack', kind: 'action', title: l('ثبّت حزمة الفريق', 'Install the team pack'), ref: 'install_team_pack' },
  { id: 'o-map', kind: 'doc', title: l('خريطة المشروع', 'Project map'), ref: 'docs/map/README.md' },
];
const engineering: OnboardingItem[] = [
  ...common,
  { id: 'o-arch', kind: 'doc', title: l('الوثيقة 01: البنية', 'Doc 01: architecture'), ref: 'docs/01-architecture.md' },
  { id: 'o-safety', kind: 'doc', title: l('الوثيقة 21: أمان التأكيد', 'Doc 21: confirmation safety'), ref: 'docs/21-confirmation-safety.md' },
];

export const generalSeed: GeneralSettings = {
  name: { ar: 'جوتيف', en: 'Goteav' },
  slug: 'goteav',
  keyPrefix: 'GTV',
  timezone: 'Europe/Istanbul',
  defaultLocale: 'ar',
  reminderOffsets: [24, 2],
  escalationHours: 24,
  defaultDueDays: 3,
  handoffStaleHours: 48,
  needStaleDays: 5,
  morningTime: '07:30',
  weeklyDay: 'SUN',
  weeklyTime: '08:00',
  quietFrom: '22:00',
  quietTo: '07:00',
  onboarding: {
    owner: common,
    pm: [...common, { id: 'o-decisions', kind: 'card', title: l('البوابة الأساسية: كيف حُسم القرار', 'Primary gateway: how it was decided'), ref: 'GTV-228' }],
    accountant: [common[0], { id: 'o-fees', kind: 'card', title: l('قرار رسوم Moyasar', 'Moyasar fee decision'), ref: 'GTV-231' }],
    backend: engineering,
    frontend: [...engineering, { id: 'o-contract', kind: 'card', title: l('تغيير كاسر في عقد الاسترداد', 'Breaking change in the refund contract'), ref: 'GTV-255' }],
    designer: [common[0], { id: 'o-wallet', kind: 'card', title: l('المحفظة v7-twin-tanks', 'Wallet v7-twin-tanks'), ref: 'GTV-252' }],
    qa: engineering,
  },
};

// ── Sources (03 §3, §4.3, §8; API 04 §3.7) ────────────────────────────────────────────────────────

export type SourceKind = 'github_repo' | 'openapi' | 'lab' | 'docs_folder';
export type RunStatus = 'running' | 'ok' | 'failed';
/** One hour of a source's runs. `partial` = some runs failed; `idle` = nothing ran, which is normal for slow sources. */
export type RunHour = 'ok' | 'partial' | 'failed' | 'idle';

export interface CaptureRun {
  id: string;
  kind: 'github_poll' | 'openapi_diff' | 'lab_scan' | 'docs_index' | 'import';
  startedAt: string;
  durationSec: number;
  status: RunStatus;
  created: number;
  updated: number;
  error?: L;
}

export interface SourceConfig {
  owner?: string;
  repo?: string;
  defaultBranch?: string;
  app?: string;
  clonePath?: string;
  branchPatterns?: string[];
  repoSource?: string;
  path?: string;
  fromRole?: Role;
  toRole?: Role;
  root?: string;
  apps?: string[];
  include?: string[];
  exclude?: string[];
  kinds?: string;
}

/** Proposal, not in 04 §3.7: why a source is unhappy and what fixes it. `lastError` alone cannot drive a fix button. */
export interface SourceDiagnosis {
  code: string;
  since: string;
  failedRuns: number;
  meaning: L;
  remedy: L;
  fix: { kind: 'exclude'; glob: string } | { kind: 'wait'; retryAt: string };
}

export interface SourceRow {
  id: string;
  kind: SourceKind;
  name: string;
  target: string;
  status: 'ok' | 'lagging' | 'failing';
  enabled: boolean;
  hasSecret: boolean;
  intervalSec: number;
  lastRunAt: string;
  lastSuccessAt: string;
  lagSec: number;
  runs24h: number;
  cards24h: number;
  lastError?: L;
  config: SourceConfig;
  /** 24 entries, oldest first. The newest hour ends at NOW. */
  hours: RunHour[];
  runs: CaptureRun[];
  diagnosis?: SourceDiagnosis;
}

const CONFIG: Record<string, { id: string; hasSecret: boolean; intervalSec: number; config: SourceConfig }> = {
  backend: { id: 's-backend', hasSecret: true, intervalSec: 120, config: { owner: 'mohmedofficial515', repo: 'Goteav-backend', defaultBranch: 'main', app: 'backend', clonePath: 'repos/goteav-backend', branchPatterns: ['main', 'feat/*', 'fix/*', 'chore/*'] } },
  web: { id: 's-web', hasSecret: true, intervalSec: 120, config: { owner: 'Alremaal-Co', repo: 'Goteav', defaultBranch: 'main', app: 'web', clonePath: 'repos/goteav-web', branchPatterns: ['main', 'feat/*', 'fix/*', 'chore/*'] } },
  dashboard: { id: 's-dashboard', hasSecret: true, intervalSec: 120, config: { owner: 'Alremaal-Co', repo: 'Goteav-Dashboard', defaultBranch: 'main', app: 'dashboard', clonePath: 'repos/goteav-dashboard', branchPatterns: ['main', 'feat/*', 'fix/*', 'chore/*'] } },
  contract: { id: 's-contract', hasSecret: false, intervalSec: 28800, config: { repoSource: 'backend', path: 'openapi/openapi.json', fromRole: 'backend', toRole: 'frontend' } },
  lab: { id: 's-lab', hasSecret: false, intervalSec: 60, config: { root: 'apps/lab', apps: ['web', 'dashboard'] } },
  'backend docs': { id: 's-docs', hasSecret: false, intervalSec: 300, config: { repoSource: 'backend', path: 'docs', include: ['**/*.md', '**/*.html'], exclude: ['handover/**'], kinds: 'adr/* → adr, status/* → status' } },
};

const RUN_KIND: Record<SourceKind, CaptureRun['kind']> = { github_repo: 'github_poll', openapi: 'openapi_diff', lab: 'lab_scan', docs_folder: 'docs_index' };

function hoursFor(name: string, status: SourceRow['status']): RunHour[] {
  if (status === 'failing') return [...Array<RunHour>(12).fill('ok'), ...Array<RunHour>(12).fill('failed')];
  if (status === 'lagging') return [...Array<RunHour>(23).fill('ok'), 'partial'];
  if (name === 'contract') return Array.from({ length: 24 }, (_, i): RunHour => (i === 7 || i === 15 || i === 23 ? 'ok' : 'idle'));
  // One hiccup yesterday afternoon on `web`: a healthy source is not always spotless.
  if (name === 'web') return Array.from({ length: 24 }, (_, i): RunHour => (i === 6 ? 'partial' : 'ok'));
  return Array<RunHour>(24).fill('ok');
}

const minus = (iso: string, sec: number) => new Date(Date.parse(iso) - sec * 1000).toISOString();

function runsFor(id: string, kind: SourceKind, lastRunAt: string, intervalSec: number, status: SourceRow['status'], error?: L): CaptureRun[] {
  return Array.from({ length: 8 }, (_, i): CaptureRun => {
    const failed = status === 'failing' || (status === 'lagging' && i < 3);
    return {
      id: `${id}-r${i}`,
      kind: RUN_KIND[kind],
      startedAt: minus(lastRunAt, i * intervalSec),
      durationSec: failed ? 2 + (i % 3) : 4 + ((i * 7) % 9),
      status: failed ? 'failed' : 'ok',
      created: failed ? 0 : i === 2 ? 2 : i === 5 ? 1 : 0,
      updated: failed ? 0 : (i * 3) % 5,
      error: failed ? error : undefined,
    };
  });
}

const DIAGNOSIS: Record<string, SourceDiagnosis> = {
  'backend docs': {
    code: 'hub.capture.docs_parse_failed',
    since: '2026-11-03T21:05:00+03:00',
    failedRuns: 140,
    meaning: l(
      'دخل ملف HTML في مسار الفهرسة، فيتوقف المفهرس عنده في كل تشغيل. لم تُحدَّث أي وثيقة منذ ذلك الوقت، وما زال البحث وصفحة الوثائق يعرضان النسخة القديمة.',
      'An HTML file got into the indexed path and the indexer stops at it on every run. No doc has updated since then, so search and the Docs page still show the old versions.',
    ),
    remedy: l('استثنِ مجلد {glob} من هذا المصدر ثم شغّله مرة أخرى.', 'Exclude {glob} from this source, then run it again.'),
    fix: { kind: 'exclude', glob: 'map/**' },
  },
  dashboard: {
    code: 'hub.github.rate_limited',
    since: '2026-11-04T08:31:02+03:00',
    failedRuns: 3,
    meaning: l(
      'أوقف GitHub الطلبات مؤقتًا بعد أن تجاوز Hub حد الطلبات الثانوي. الـ commits محفوظة في GitHub ولن يضيع منها شيء، لكنها ستظهر متأخرة.',
      'GitHub paused requests after Hub went over its secondary rate limit. Commits are safe on GitHub and nothing is lost, but they will show up late.',
    ),
    remedy: l('لا تحتاج إلى فعل شيء الآن: يعيد Hub المحاولة وحده الساعة {time}. إن تكرر هذا، فأطل فترة الاستطلاع من تعديل المصدر.', 'Nothing to do now: Hub retries by itself at {time}. If this keeps happening, lengthen the polling period in the source’s settings.'),
    fix: { kind: 'wait', retryAt: '2026-11-04T08:47:00+03:00' },
  },
};

/** Sources read their health from the same rows as Today, so names and numbers match across pages. */
export function sourcesFor(scenario: Scenario): SourceRow[] {
  return todayFor(safe(scenario)).sources.map((s) => {
    const c = CONFIG[s.name];
    // `empty` is a quiet, healthy morning: hub-today only clears the status, so its old times are brought up to date here.
    const quiet = safe(scenario) === 'empty';
    const lastSuccessAt = quiet ? minus(NOW, s.lagSec) : s.lastSuccessAt;
    const lastRunAt = s.status === 'failing' ? '2026-11-04T08:40:00+03:00' : s.status === 'lagging' ? '2026-11-04T08:42:00+03:00' : lastSuccessAt;
    return {
      ...s,
      ...c,
      lastSuccessAt,
      enabled: true,
      lastRunAt,
      hours: hoursFor(s.name, s.status),
      runs: runsFor(c.id, s.kind, lastRunAt, c.intervalSec, s.status, s.lastError),
      diagnosis: s.status === 'ok' ? undefined : DIAGNOSIS[s.name],
    };
  });
}

export const lastImport = {
  at: '2026-10-28T11:12:00+03:00',
  clonePath: 'repos/goteav-backend',
  decisions: 31,
  tasks: 58,
  statusNotes: 24,
  contractChanges: 17,
  skipped: 3,
};

// ── Roles (03 §4.1, 04 §2) ────────────────────────────────────────────────────────────────────────

export const roleNotes: Record<Role, L> = {
  owner: l('يملك كل الصلاحيات، وهو وحده من يوافق على التصاميم. لا بد من مالك واحد نشط على الأقل.', 'Can do everything, and is the only role that approves redesigns. At least one must stay active.'),
  pm: l('تصل إليه التصعيدات، ويدير الأعضاء والمصادر والإعدادات والأولويات.', 'Receives escalations, and manages members, sources, settings and priorities.'),
  accountant: l('القرارات المالية واحتياجات التحقق من القيم. يعمل من الواجهة عادةً.', 'Financial decisions and value-check needs. Usually works from the interface.'),
  backend: l('خدمات الباك إند وعقود API.', 'Backend services and API contracts.'),
  frontend: l('الموقع ولوحة التحكم.', 'The website and the dashboard.'),
  designer: l('نسخ المختبر وإحالات التصميم.', 'Lab versions and design handoffs.'),
  qa: l('مهام المراجعة والاختبار.', 'Review and test tasks.'),
};

/**
 * ✓ allowed · R routed to this role · S the task's specialty maps here · A assignee only · C creator only ·
 * ✗ not allowed · T rename and timezone only. Order follows `ROLES`.
 */
export type PermissionCell = 'y' | 'n' | 'R' | 'S' | 'A' | 'C' | 'T';

export interface PermissionRow {
  group: 'create' | 'edit' | 'tasks' | 'decisions' | 'needs' | 'handoffs' | 'redesign' | 'cards' | 'workspace';
  label: L;
  cells: PermissionCell[];
  humanOnly: boolean;
  mcp: boolean;
}

const p = (group: PermissionRow['group'], ar: string, en: string, cells: string, humanOnly = false, mcp = true): PermissionRow => ({
  group,
  label: l(ar, en),
  cells: cells.split(' ') as PermissionCell[],
  humanOnly,
  mcp,
});

export const permissionMatrix: PermissionRow[] = [
  p('create', 'إنشاء مهمة', 'Create task', 'y y y y y y y'),
  p('create', 'إنشاء قرار', 'Create decision', 'y y y y y y y'),
  p('create', 'إنشاء احتياج', 'Create need', 'y y y y y y y'),
  p('create', 'إنشاء إحالة', 'Create handoff', 'y y y y y y y'),
  p('create', 'إنشاء إصدار', 'Create release', 'y y n n n n n', false, false),
  p('edit', 'تعديل العنوان والوصف والوسوم', 'Edit title, body, tags', 'y y C C C C C'),
  p('edit', 'تعديل الأولوية والموعد والدور والمكلَّف', 'Edit priority, due date, role, assignee', 'y y n n n n n'),
  p('tasks', 'حجز مهمة أو إلغاء حجزها', 'Claim or unclaim a task', 'y y n S S S S'),
  p('tasks', 'بدء مهمة وإرسالها للمراجعة وإنجازها', 'Start, submit and finish a task', 'y y n A A A A'),
  p('tasks', 'إلغاء مهمة أو إعادة فتحها', 'Cancel or reopen a task', 'y y n C C C C'),
  p('tasks', 'تعديل التخصص والجهد والقبول والأمر', 'Edit specialty, effort, acceptance, prompt', 'y y n S S S S'),
  p('decisions', 'تعديل الخيارات ما دام القرار مفتوحًا', 'Edit options while open', 'y y C C C C C'),
  p('decisions', 'حسم القرار', 'Decide', 'y R R R R R R', true, false),
  p('decisions', 'سحب القرار', 'Withdraw', 'y y C C C C C', true, false),
  p('decisions', 'استبدال قرار', 'Supersede', 'y y n n n n n', true, false),
  p('decisions', 'كتابة مسودة ADR', 'Draft the ADR', 'y y R R R R R'),
  p('decisions', 'فتح PR لسجل القرار', 'Open the ADR pull request', 'y y R R R R R', true, false),
  p('needs', 'بدء الاحتياج وتسليمه', 'Start and deliver', 'y y R R R R R'),
  p('needs', 'التحقق من التسليم', 'Verify', 'y y R R R R R', true, false),
  p('needs', 'إلغاء الاحتياج', 'Cancel', 'y y C C C C C'),
  p('handoffs', 'الاستلام والتطبيق والرفض', 'Acknowledge, apply, dismiss', 'y y R R R R R'),
  p('redesign', 'إرسال للمراجعة', 'Submit for review', 'y y n n y y n'),
  p('redesign', 'الموافقة أو الرفض', 'Approve or reject', 'y n n n n n n', true, false),
  p('redesign', 'طلب تعديلات', 'Request changes', 'y y n n n n y', true, false),
  p('redesign', 'تسجيله منقولًا', 'Mark ported', 'y y n n y n n'),
  p('cards', 'تعديل الإصدار وتسجيل صدوره', 'Edit and mark a release released', 'y y n n n n n'),
  p('cards', 'أرشفة بطاقة أو استعادتها', 'Archive or restore a card', 'y y n n n n n', true, false),
  p('cards', 'التعليق والربط والمتابعة', 'Comment, link, watch', 'y y y y y y y'),
  p('cards', 'حجب تعليق', 'Redact a comment', 'y y n n n n n', true, false),
  p('cards', 'قراءة البطاقات والخط الزمني والوثائق', 'Read cards, timeline, docs', 'y y y y y y y'),
  p('cards', 'قراءة البطاقات المؤرشفة', 'Read archived cards', 'y y n n n n n'),
  p('workspace', 'الأعضاء: الدعوة والأدوار وهوية GitHub', 'Members: invite, roles, GitHub identity', 'y y n n n n n', true, false),
  p('workspace', 'مساحة العمل: الاسم والمنطقة الزمنية والأرشفة', 'Workspace: rename, timezone, archive', 'y T n n n n n', true, false),
  p('workspace', 'كتابة الإعدادات', 'Write settings', 'y y n n n n n', true, false),
  p('workspace', 'إدارة المصادر وتشغيلها والاستيراد', 'Manage, run and import sources', 'y y n n n n n', true, false),
  p('workspace', 'سجل التدقيق: القراءة', 'Audit log: read', 'y y n n n n n', false, false),
  p('workspace', 'توكناتي: إنشاء وإلغاء', 'Own API tokens: create and revoke', 'y y y y y y y', true, false),
  p('workspace', 'ملفي وقنوات إشعاراتي', 'Own profile and notification channels', 'y y y y y y y', false, false),
];

export type Specialty = 'backend' | 'frontend' | 'design' | 'qa' | 'ops' | 'docs';
export const specialtyMapSeed: Record<Specialty, Role[]> = {
  backend: ['backend'],
  frontend: ['frontend'],
  design: ['designer'],
  qa: ['qa'],
  ops: ['pm', 'backend'],
  docs: ['pm', 'backend'],
};

// ── Notifications (03 §9, 04 §3.3, §3.18) ─────────────────────────────────────────────────────────

export type ChannelMode = 'off' | 'immediate' | 'digest';
export type NotificationKind = 'routed_decision' | 'routed_need' | 'routed_handoff' | 'mention' | 'watch_update' | 'deadline_reminder' | 'escalation' | 'unblocked' | 'task_ready' | 'brief' | 'system';
export const notificationKinds: NotificationKind[] = ['routed_decision', 'routed_need', 'routed_handoff', 'mention', 'watch_update', 'deadline_reminder', 'escalation', 'unblocked', 'task_ready', 'brief', 'system'];

export interface NotificationPrefs {
  push: { mode: ChannelMode; kinds: NotificationKind[]; subscription: { browser: L; createdAt: string } | null };
  telegram: { mode: ChannelMode; kinds: NotificationKind[]; linked: { username: string; linkedAt: string } | null };
  email: { mode: ChannelMode; kinds: NotificationKind[]; address: string; available: boolean };
  /** null = the workspace default. */
  quiet: { from: string; to: string } | null;
}

export const telegramBot = '@goteav_hub_bot';
export const telegramCodeExample = '482913';

export function notificationsFor(scenario: Scenario): NotificationPrefs {
  if (safe(scenario) === 'frontend') {
    return {
      push: { mode: 'off', kinds: notificationKinds, subscription: null },
      telegram: { mode: 'off', kinds: notificationKinds, linked: null },
      email: { mode: 'immediate', kinds: ['routed_handoff', 'mention', 'task_ready', 'unblocked'], address: 'sara@goteav.example', available: true },
      quiet: null,
    };
  }
  return {
    push: { mode: 'immediate', kinds: ['routed_decision', 'routed_need', 'routed_handoff', 'mention', 'deadline_reminder', 'escalation'], subscription: { browser: l('Chrome على Windows', 'Chrome on Windows'), createdAt: '2026-10-02T09:30:00+03:00' } },
    telegram: { mode: 'immediate', kinds: ['routed_decision', 'deadline_reminder', 'escalation', 'brief'], linked: { username: '@mohamed_goteav', linkedAt: '2026-09-10T20:12:00+03:00' } },
    email: { mode: 'digest', kinds: notificationKinds, address: 'mohamed@goteav.example', available: true },
    quiet: { from: '23:00', to: '07:00' },
  };
}

// ── Tokens (03 §2, 04 §3.3). Prefixes only ────────────────────────────────────────────────────────

export interface TokenRow {
  id: string;
  name: string;
  kind: 'mcp' | 'hook';
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export const hubPublicUrl = 'https://hub.goteav.lan';

export function tokensFor(scenario: Scenario): TokenRow[] {
  const s = safe(scenario);
  if (s === 'empty') return [];
  if (s === 'frontend') {
    return [{ id: 't-s1', name: 'Claude Code — laptop', kind: 'mcp', prefix: 'hub_demo7d10', lastUsedAt: '2026-11-04T08:05:00+03:00', createdAt: '2026-10-19T10:00:00+03:00', revokedAt: null }];
  }
  return [
    { id: 't-o1', name: 'Claude Code — laptop', kind: 'mcp', prefix: 'hub_demo0a8f', lastUsedAt: '2026-11-04T08:40:00+03:00', createdAt: '2026-11-02T09:00:00+03:00', revokedAt: null },
    { id: 't-o2', name: 'hook — laptop', kind: 'hook', prefix: 'hub_demo09c2', lastUsedAt: '2026-11-03T18:20:00+03:00', createdAt: '2026-11-02T09:02:00+03:00', revokedAt: null },
    { id: 't-o3', name: 'Claude Code — desktop', kind: 'mcp', prefix: 'hub_demo5be7', lastUsedAt: null, createdAt: '2026-11-03T21:40:00+03:00', revokedAt: null },
    { id: 't-o0', name: 'Old laptop', kind: 'mcp', prefix: 'hub_demo44b1', lastUsedAt: '2026-10-18T12:10:00+03:00', createdAt: '2026-09-04T11:00:00+03:00', revokedAt: '2026-10-20T10:00:00+03:00' },
  ];
}

let tokenSeq = 1;
/** POST /me/tokens returns the full token once. The lab's says what it is, so nobody mistakes it for a credential. */
export function exampleToken() {
  const n = tokenSeq++;
  const prefix = `hub_EXAMPLE${n}`;
  return { prefix, token: `${prefix}_lab-mock-not-a-real-token` };
}

// ── System (04 §3.23) ─────────────────────────────────────────────────────────────────────────────

export const systemSeed = {
  version: { api: '1.4.2', worker: '1.4.2', web: '1.4.2', lab: '1.4.0' },
  uptime: { apiSec: 532_800, workerSec: 532_560 },
  services: { postgres: true, redis: true },
  worker: { alive: true, lastHeartbeatAt: '2026-11-04T08:44:50+03:00' },
  outbox: { pending: 3, failed: 1, oldestPendingAgeSec: 42 },
  sse: { connections: 5 },
  backup: { lastAt: '2026-11-04T03:00:00+03:00', sizeBytes: 412_000_000 },
  db: { sizeBytes: 1_260_000_000, cards: 268, events: 4_912 },
  disk: { usedBytes: 18_400_000_000, totalBytes: 60_000_000_000 },
  queues: [
    { name: 'capture.github', waiting: 2, active: 1, failed: 3, delayed: 1 },
    { name: 'capture.docs', waiting: 0, active: 0, failed: 140, delayed: 0 },
    { name: 'capture.lab', waiting: 0, active: 1, failed: 0, delayed: 0 },
    { name: 'notifications', waiting: 3, active: 0, failed: 1, delayed: 0 },
    { name: 'digests', waiting: 0, active: 0, failed: 0, delayed: 1 },
  ],
};
/** A stopped worker (lab: `?worker=stale`). 09 §18.6: shown within 60 s. */
export const staleHeartbeatAt = '2026-11-04T08:42:30+03:00';

// ── Audit (03 §11, 04 §3.21) ──────────────────────────────────────────────────────────────────────

export type AuditVia = 'web' | 'mcp' | 'hook' | 'adapter' | 'scheduler' | 'telegram';

export interface AuditRow {
  id: string;
  actorKind: 'user' | 'agent' | 'system';
  actorId: string | null;
  /** System actors only: the adapter or job that wrote it. */
  adapter?: string;
  via: AuditVia;
  action: string;
  targetType: 'card' | 'member' | 'source' | 'token' | 'setting' | 'invite' | 'workspace';
  targetId: string | null;
  summary: L;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

const CHROME = 'Chrome 141 on Windows';
const SAFARI = 'Safari on iPhone';
const CLAUDE = 'claude-code/2.1';
const u = (id: string, createdAt: string, actorId: string, via: AuditVia, action: string, targetType: AuditRow['targetType'], targetId: string | null, summary: L, ip = '10.20.0.14', userAgent: string | null = via === 'web' ? CHROME : via === 'mcp' || via === 'hook' ? CLAUDE : null): AuditRow => ({
  id,
  actorKind: via === 'mcp' || via === 'hook' ? 'agent' : 'user',
  actorId,
  via,
  action,
  targetType,
  targetId,
  summary,
  ip,
  userAgent,
  createdAt,
});
const sys = (id: string, createdAt: string, adapter: string, via: AuditVia, action: string, targetType: AuditRow['targetType'], targetId: string | null, summary: L): AuditRow => ({
  id,
  actorKind: 'system',
  actorId: null,
  adapter,
  via,
  action,
  targetType,
  targetId,
  summary,
  ip: null,
  userAgent: null,
  createdAt,
});

export const auditSeed: AuditRow[] = [
  u('a48', '2026-11-04T08:41:00+03:00', 'u-owner', 'web', 'sources.test', 'source', 'backend docs', l('فحص الاتصال نجح: وُجد 186 ملفًا', 'Connection test passed: 186 files found')),
  u('a47', '2026-11-04T08:21:00+03:00', 'u-sara', 'web', 'cards.acknowledge', 'card', 'GTV-255', l('استلمت سارة تغيير عقد الاسترداد', 'Sara acknowledged the refund contract change'), '10.20.0.31'),
  sys('a46', '2026-11-04T08:20:00+03:00', 'oasdiff', 'adapter', 'cards.create', 'card', 'GTV-255', l('تغيير كاسر في POST /admin/payments/{id}/refund: أُنشئت إحالة إلى الفرونت إند', 'Breaking change in POST /admin/payments/{id}/refund: handoff created for frontend')),
  sys('a45', '2026-11-04T08:31:02+03:00', 'github', 'adapter', 'capture.run.failed', 'source', 'dashboard', l('تجاوز حد GitHub الثانوي، وإعادة المحاولة 08:47', 'GitHub secondary rate limit, retrying at 08:47')),
  u('a44', '2026-11-04T08:05:00+03:00', 'u-sara', 'hook', 'capture.session', 'card', 'GTV-256', l('جلسة مزامنة عقد الاسترداد في لوحة التحكم', 'Session syncing the refund contract in the dashboard'), '10.20.0.31'),
  sys('a43', '2026-11-04T07:30:00+03:00', 'digest', 'scheduler', 'digests.morning', 'workspace', null, l('أُرسل موجز الصباح إلى 7 أعضاء', 'Morning brief sent to 7 members')),
  sys('a42', '2026-11-04T03:00:00+03:00', 'backup', 'scheduler', 'system.backup', 'workspace', null, l('اكتملت النسخة الاحتياطية: 412 MB', 'Backup finished: 412 MB')),
  u('a41', '2026-11-04T01:40:00+03:00', 'u-omar', 'mcp', 'cards.comment', 'card', 'GTV-253', l('علّق وكيل عمر على إصلاح سباق الاسترداد', 'Omar’s agent commented on the refund race fix'), '10.20.0.42'),
  u('a40', '2026-11-03T22:10:00+03:00', 'u-yousef', 'telegram', 'cards.acknowledge', 'card', 'GTV-244', l('استلام من تيليجرام', 'Acknowledged from Telegram'), '10.20.0.27', SAFARI),
  sys('a39', '2026-11-03T21:05:00+03:00', 'docs', 'adapter', 'capture.run.failed', 'source', 'backend docs', l('فشل تحليل docs/map/index.html', 'Failed to parse docs/map/index.html')),
  u('a38', '2026-11-03T21:40:00+03:00', 'u-owner', 'web', 'identity.token.create', 'token', 'hub_demo5be7', l('أنشأ توكن MCP باسم «Claude Code — desktop»', 'Created MCP token “Claude Code — desktop”')),
  u('a37', '2026-11-03T20:30:00+03:00', 'u-layla', 'mcp', 'redesign.submit_review', 'card', 'GTV-252', l('أُرسلت نسخة المحفظة v7-twin-tanks للمراجعة', 'Wallet v7-twin-tanks sent to review'), '10.20.0.51'),
  u('a36', '2026-11-03T18:15:00+03:00', 'u-owner', 'web', 'cards.decide', 'card', 'GTV-228', l('اختار PayTR مع Akbank احتياطًا', 'Chose PayTR with Akbank as backup')),
  u('a35', '2026-11-03T16:00:00+03:00', 'u-owner', 'web', 'settings.update', 'setting', 'decisions.escalation_hours', l('من 48 إلى 24 ساعة', 'From 48 to 24 hours')),
  u('a34', '2026-11-03T15:20:00+03:00', 'u-yousef', 'web', 'cards.deliver', 'card', 'GTV-247', l('سُلّم مكان القيمة: 1Password › Goteav › Akbank', 'Delivered the location: 1Password › Goteav › Akbank'), '10.20.0.27'),
  u('a33', '2026-11-03T12:00:00+03:00', 'u-owner', 'web', 'cards.create', 'card', 'GTV-246', l('أنشأ إصدار 2026-11-03', 'Created release 2026-11-03')),
  u('a32', '2026-11-03T10:15:00+03:00', 'u-owner', 'web', 'members.roles.update', 'member', 'u-omar', l('إضافة دور الجودة إلى عمر', 'Added the QA role to Omar')),
  sys('a31', '2026-11-03T09:45:00+03:00', 'escalation', 'scheduler', 'cards.escalate', 'card', 'GTV-219', l('تجاوز القرار موعده فصُعّد إلى مدير المشروع', 'Decision passed its deadline and was escalated to PM')),
  u('a30', '2026-11-02T10:20:00+03:00', 'u-owner', 'web', 'members.invite.create', 'invite', 'huda@goteav.example', l('دعوة بدور الجودة', 'Invite with the QA role')),
  u('a29', '2026-11-02T09:02:00+03:00', 'u-owner', 'web', 'identity.token.create', 'token', 'hub_demo09c2', l('أنشأ توكن hook باسم «hook — laptop»', 'Created hook token “hook — laptop”')),
  u('a28', '2026-11-02T09:00:00+03:00', 'u-owner', 'web', 'identity.token.create', 'token', 'hub_demo0a8f', l('أنشأ توكن MCP باسم «Claude Code — laptop»', 'Created MCP token “Claude Code — laptop”')),
  u('a27', '2026-11-01T17:25:00+03:00', 'u-yousef', 'mcp', 'cards.claim', 'card', 'GTV-259', l('حجز وكيل يوسف مهمة محوّل PayTR', 'Yousef’s agent claimed the PayTR adapter task'), '10.20.0.27'),
  u('a26', '2026-11-01T11:00:00+03:00', 'u-owner', 'web', 'sources.update', 'source', 'web', l('غيّر فترة الاستطلاع إلى 120 ثانية', 'Changed the polling period to 120 s')),
  u('a25', '2026-10-30T14:30:00+03:00', 'u-owner', 'web', 'members.github_logins.update', 'member', 'u-yousef', l('أضاف الحساب yousef-bot إلى يوسف', 'Added the login yousef-bot to Yousef')),
  u('a24', '2026-10-29T10:00:00+03:00', 'u-owner', 'web', 'members.invite.create', 'invite', 'faisal@goteav.example', l('دعوة بدور المحاسب', 'Invite with the Accountant role')),
  u('a23', '2026-10-28T11:12:00+03:00', 'u-owner', 'web', 'capture.import.goteav', 'workspace', null, l('استيراد تاريخ جوتيف: 31 قرارًا و58 مهمة و24 ملاحظة حالة', 'Imported Goteav history: 31 decisions, 58 tasks, 24 status notes')),
  u('a22', '2026-10-20T10:00:00+03:00', 'u-owner', 'web', 'identity.token.revoke', 'token', 'hub_demo44b1', l('ألغى التوكن «Old laptop»', 'Revoked the token “Old laptop”')),
  u('a21', '2026-10-19T10:00:00+03:00', 'u-sara', 'web', 'identity.token.create', 'token', 'hub_demo7d10', l('أنشأت توكن MCP باسم «Claude Code — laptop»', 'Created MCP token “Claude Code — laptop”'), '10.20.0.31'),
  u('a20', '2026-10-12T10:05:00+03:00', 'u-owner', 'web', 'members.disable', 'member', 'u-tarek', l('عطّل حساب طارق وألغى جلساته وتوكناته', 'Disabled Tarek and revoked his sessions and tokens')),
].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

export const auditFor = (scenario: Scenario): AuditRow[] => (safe(scenario) === 'empty' ? [] : auditSeed);
export const auditActionGroups = ['cards', 'members', 'identity', 'settings', 'sources', 'capture', 'redesign', 'digests', 'system'] as const;

