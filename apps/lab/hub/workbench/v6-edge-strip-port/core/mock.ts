import type { Role } from '@lab/mocks/hub-app';
import { documentTask, gapsScript, improveArabicDoc, improveDoc, taskClaimedScript, questionsScript, taskCutScript, taskRefusedScript, taskScript } from './scripts';

/**
 * Mock of what the bridge, the chats API and the queue would return (docs/16 §4, §7, §9). Paths and commands are realistic and fake:
 * nothing here reaches a machine. The event names in comments are the real ones from docs/16 "Event mapping".
 */
export type L = { ar: string; en: string };
const l = (ar: string, en: string): L => ({ ar, en });

export const PROJECTS = [
  { id: 'goteav', name: 'Goteav', folders: ['F:/Goteav/backend', 'F:/Goteav/web', 'F:/Goteav/Goteav-Dashboard'] },
  { id: 'hub', name: 'Hub', folders: ['F:/Goteav/hub'] },
] as const;
export type ProjectId = (typeof PROJECTS)[number]['id'];

export type DeviceId = 'main' | 'laptop' | 'phone' | 'office';
export interface Device {
  id: DeviceId;
  name: L;
  /** `ready`: bridge paired and online. `no-bridge`: Hub open, nothing can run here. `offline`: paired, not reachable. */
  state: 'ready' | 'no-bridge' | 'offline';
  note: L;
}
export const DEVICES: Device[] = [
  { id: 'main', name: l('الجهاز الرئيسي', 'Main machine'), state: 'ready', note: l('هذا الجهاز · يحمل المعرفة', 'This device, holds the knowledge') },
  { id: 'laptop', name: l('اللابتوب', 'Laptop'), state: 'ready', note: l('متصل عبر Tailscale', 'Connected over Tailscale') },
  { id: 'office', name: l('جهاز المكتب', 'Office PC'), state: 'offline', note: l('آخر اتصال أمس 18:20', 'Last seen yesterday 18:20') },
  { id: 'phone', name: l('الهاتف', 'Phone'), state: 'no-bridge', note: l('بلا جسر: يوافق ويقرأ ولا يشغّل', 'No bridge: can approve and read, cannot run') },
];

export const PERSONAS: { role: Role; focus: L }[] = [
  { role: 'owner', focus: l('كل المشروع: القرارات والإحالات أولًا', 'The whole project: decisions and handoffs first') },
  { role: 'backend', focus: l('مهام الخادم وعقود API', 'Server tasks and API contracts') },
  { role: 'frontend', focus: l('مهام الواجهة والنقل من المختبر', 'Interface tasks and ports from the lab') },
  { role: 'designer', focus: l('نسخ المختبر وما ينتظر المراجعة', 'Lab versions and what awaits review') },
  { role: 'qa', focus: l('ما ينتظر التحقق والتسليمات', 'What awaits verification and delivery') },
  { role: 'pm', focus: l('المتأخر وما يعطّل غيره', 'What is late and what blocks others') },
];

export type SkillSource = 'hub' | 'personal' | 'folder';
export interface Skill {
  name: string;
  source: SkillSource;
  about: L;
}
export const SKILLS: Skill[] = [
  { name: '/hub:work', source: 'hub', about: l('نفّذ مهمة بخطوات ثابتة، وتقرير على البطاقة', 'Do a task in fixed stages, with a report on the card') },
  { name: '/hub:doc', source: 'hub', about: l('حسّن وثيقة أو اكتبها، بفرق وعبارات موسومة', 'Improve or write a doc, with a diff and flagged claims') },
  { name: '/hub:next', source: 'hub', about: l('ابدأ أولى المهام الجاهزة لك', 'Start the first task ready for you') },
  { name: '/hub:suggest', source: 'hub', about: l('اقرأ المشروع واقترح مهام، ولا تنشئ شيئًا قبل موافقتك', 'Read the project and propose tasks. Nothing is created until you accept') },
  { name: '/hub:ask', source: 'hub', about: l('سؤال عن وثائق المشروع مع مصادره', 'A question about the project docs, with sources') },
  { name: '/hub:handoff', source: 'hub', about: l('سجّل إحالة من هذه الجلسة', 'Record a handoff from this session') },
  { name: '/redesign-workflow', source: 'personal', about: l('اتفاقيات مختبر إعادة التصميم', 'The redesign lab conventions') },
  { name: '/code-review', source: 'personal', about: l('راجع التغييرات الحالية', 'Review the current changes') },
  { name: '/security-review', source: 'personal', about: l('مراجعة أمان للتغييرات المعلّقة', 'A security review of pending changes') },
  { name: '/secure-deploy', source: 'personal', about: l('نشر آمن على الخادم', 'A secure deploy to the server') },
  { name: '/simplify', source: 'personal', about: l('تبسيط الكود المتغيّر', 'Simplify the changed code') },
  { name: '/backend:migrate', source: 'folder', about: l('مهارة من مجلد backend: توليد ترحيل', 'From the backend folder: generate a migration') },
];

// ── Runs (docs/16 §9) ───────────────────────────────────────────────────────────────────────────

export type RunState = 'waiting' | 'running' | 'next' | 'paused' | 'scheduled' | 'done' | 'denied' | 'interrupted';
export interface Run {
  id: string;
  title: L;
  cardKey?: string;
  folder: string;
  state: RunState;
  chatId?: string;
  /** The live line under the title. */
  step?: L;
  /** "Tonight 23:00", "Every Monday 08:00", "Waits for this folder". */
  when?: L;
  repeat?: boolean;
  /** For a waiting run: the exact command it paused on. */
  command?: string;
  /** For a finished run: what the card received. */
  summary?: L;
}

/** docs/16 §9: runs at the same time default to 1, runs per day to 5. */
export const LIMITS = { atOnce: 1, perDay: 5, usedToday: 3, quiet: '23:30–07:00' };

/** Why a run stays in line. Both come from docs/16 §9. */
export const WAITS = {
  folder: l('ينتظر فراغ المجلد: تشغيل واحد لكل مجلد', 'Waits for the folder: one run per folder'),
  slot: l('ينتظر دوره: تشغيل واحد في وقت واحد', 'Waits for its turn: one run at a time'),
};

export const SEED_RUNS: Run[] = [
  {
    id: 'r-paytr',
    title: l('محوّل PayTR: الدفع الحي', 'PayTR adapter: live payments'),
    cardKey: 'GTV-259',
    folder: 'F:/Goteav/backend',
    state: 'waiting',
    chatId: 'c-paytr',
    command: 'git push origin feat/paytr-live',
    when: l('ينتظر منذ 6 د ويمسك مكان المجلد', 'Waiting 6 min, holds this folder'),
  },
  {
    id: 'r-refund',
    title: l('مزامنة عقد الاسترداد', 'Sync refund contract'),
    cardKey: 'GTV-260',
    folder: 'F:/Goteav/web',
    state: 'next',
    when: WAITS.slot,
  },
  {
    id: 'r-backups',
    title: l('النسخ الاحتياطية الليلية', 'Nightly backups'),
    cardKey: 'GTV-258',
    folder: 'F:/Goteav/backend',
    state: 'next',
    when: WAITS.folder,
  },
  {
    id: 'r-wallet',
    title: l('نقل wallet v7', 'Port wallet v7'),
    cardKey: 'GTV-265',
    folder: 'F:/Goteav/web',
    state: 'scheduled',
    when: l('اليوم 22:00', 'Today 22:00'),
  },
  {
    id: 'r-weekly',
    title: l('مزامنة العقود الأسبوعية', 'Weekly contract sync'),
    folder: 'F:/Goteav/Goteav-Dashboard',
    state: 'scheduled',
    repeat: true,
    when: l('كل اثنين 08:00', 'Every Monday 08:00'),
  },
  {
    id: 'r-invite',
    title: l('دعوة الأعضاء', 'Invite members'),
    cardKey: 'GTV-262',
    folder: 'F:/Goteav/hub',
    state: 'done',
    chatId: 'c-invite',
    when: l('انتهى 10:40', 'Finished 10:40'),
    summary: l('تغيّر ملفان. بانتظار تأكيدك على البطاقة', '2 files changed. Waiting for you to confirm on the card'),
  },
  {
    id: 'r-akbank',
    title: l('عقد Akbank', 'Akbank contract'),
    cardKey: 'GTV-267',
    folder: 'F:/Goteav/backend',
    state: 'interrupted',
    when: l('انقطع 03:12 حين نام الجهاز', 'Cut off 03:12 when the machine slept'),
    summary: l('لا يعاد تلقائيًا. راجع ما تغيّر ثم شغّله', 'Not restarted automatically. Check what changed, then run it'),
  },
];

// ── Modes, models and what a turn reports ───────────────────────────────────────────────────────

/** docs/16 §7.1. How each maps to flags is an assumption the engine must prove: see README. */
export type Mode = 'ask' | 'plan' | 'execute';
export const MODES: Mode[] = ['ask', 'plan', 'execute'];
/** The values `--model` takes. */
export type ModelId = 'sonnet' | 'opus' | 'haiku';
export const MODELS: { id: ModelId; name: string; note: L; effort: boolean }[] = [
  { id: 'sonnet', name: 'Sonnet', note: l('للعمل اليومي', 'For everyday work'), effort: true },
  { id: 'opus', name: 'Opus', note: l('للمسائل الصعبة، يستهلك حدّك أسرع', 'For hard problems, uses your limit faster'), effort: true },
  { id: 'haiku', name: 'Haiku', note: l('للمهام الصغيرة والسريعة', 'For small, quick jobs'), effort: false },
];
export type Effort = 'low' | 'medium' | 'high';
export const EFFORTS: Effort[] = ['low', 'medium', 'high'];

export type ToolState = 'running' | 'ok' | 'denied' | 'stopped' | 'failed';
export interface ToolCall {
  id: string;
  name: string;
  /** The short form on the folded row, always LTR. */
  detail: string;
  state: ToolState;
  result?: L;
  /** Exact input, from `assistant.message.content[].input`. */
  input?: string;
  /** Exact result, from `tool_result.content`. */
  output?: string;
  /** Exact error, from a `tool_result` with `is_error`. */
  error?: string;
  /** Time between the tool's start and its result, measured by the bridge. Left out when it was not measured. */
  ms?: number;
  /** `tool.result.decision` (docs/16 S1): `config` for rules, `user_temporary` or `user_reject` for an approval. */
  decision?: StepDecision;
  /** `chat_steps.startedAt`, ISO. */
  startedAt?: string;
}
export type StepDecision = 'config' | 'user_temporary' | 'user_reject';

export interface DiffLine {
  t: 'ctx' | 'add' | 'del' | 'hunk';
  text: string;
  /** A line Claude could not verify: it is flagged, not stated as fact. */
  flag?: string;
}
/** `changedFileSchema` in the contract, plus the diff the chat's diff route answers with. */
export interface ChangedFile {
  path: string;
  source: 'tool' | 'git' | 'claimed';
  status?: string;
  additions?: number;
  deletions?: number;
  diff: DiffLine[];
}
export interface Usage {
  input: number;
  output: number;
  cacheRead?: number;
}
/** `turn.ended.status` in the contract. A process that exited with no `result` is `failed` with `failure: 'cut_off'`, so nothing about usage is known. */
export type TurnEnd = 'done' | 'failed' | 'stopped' | 'interrupted';
export type TurnFailure = 'signed_out' | 'rate_limited' | 'billing' | 'overloaded' | 'version_out_of_range' | 'claude_missing' | 'session_missing' | 'folder_not_allowed' | 'folder_missing' | 'device_offline' | 'cut_off' | 'unreadable_event' | 'unknown';
export interface TurnMeta {
  state: TurnEnd;
  failure?: TurnFailure;
  mode: Mode;
  model: ModelId;
  effort?: Effort;
  ms?: number;
  /** `result.usage`. Absent when the engine reported none: the line simply leaves it out. */
  usage?: Usage;
  files?: ChangedFile[];
  steps?: number;
}

// ── Protocols (docs/16 §7.1) ────────────────────────────────────────────────────────────────────

export type StageState = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
export const TASK_STAGES = ['understand', 'plan', 'execute', 'verify', 'report'] as const;
export const DOC_STAGES = ['search', 'propose', 'draft', 'save', 'link'] as const;
export type StageId = (typeof TASK_STAGES)[number] | (typeof DOC_STAGES)[number];
export interface Stage {
  id: StageId;
  state: StageState;
  note?: L;
}
/** `proposedPlanSchema` in the contract. */
export interface ProposedPlan {
  title: L;
  steps: { title: L; role?: Role; why?: L }[];
  checks?: string[];
  risks?: L[];
}
/** `plan.proposed`: `plan` is always there as text, and `structured` is there when `propose_plan` was used. From the engine's `ExitPlanMode` or a reply, there is only the text. `state` is the panel's. */
export interface Plan {
  plan: L;
  structured?: ProposedPlan;
  state: 'proposed' | 'running' | 'scheduled' | 'set_aside';
  /** When a scheduled plan will run, chosen in the dialog. */
  when?: L;
}
/** `CHECK_BASES`: what a check's claim rests on. Only `passed` with `matched` is `verified`. */
export type CheckBasis = 'matched' | 'outside_panel' | 'no_command' | 'no_matching_step' | 'step_mismatch' | 'not_finished' | 'outcome_differs';
/** `checkRunSchema`: one real run of a check's command, oldest first. A failure stays here after a later pass. */
export interface CheckRun {
  stepId: string;
  status: 'passed' | 'failed' | 'cut_off' | 'running';
  startedAt: string;
  endedAt: string | null;
  excerpt?: string;
}
/** `reportedCheckSchema`. `verified`, `basis` and `runs` are the server's, and Claude cannot set them. */
export interface ReportedCheck {
  name: string;
  command: string | null;
  stepId: string | null;
  outcome: 'passed' | 'failed' | 'skipped';
  note: L | null;
  verified: boolean;
  basis: CheckBasis;
  runs: CheckRun[];
}
/** `REPORT_MOVE_REASONS` (D52). Only `all_verified` moves the task. */
export type ReportMoveReason = 'all_verified' | 'no_checks' | 'check_not_passed' | 'check_not_verified' | 'check_dropped' | 'outside_panel' | 'not_a_task' | 'wrong_status' | 'not_permitted';
/** `workReportSchema`. Strings are `L` here only because the prototype renders both languages. */
export interface Report {
  id: string;
  cardKey: string;
  origin: 'panel' | 'outside_panel';
  chatId: string | null;
  summary: L;
  checks: ReportedCheck[];
  changedFiles: Omit<ChangedFile, 'diff'>[];
  /** `bridge`: the device's own facts. `claimed`: the bridge had none, so these are Claude's words. */
  filesFrom: 'bridge' | 'claimed' | 'none';
  notChecked: L[];
  /** Checks an earlier report in this chat named and this one left out. Any of them stops the move. */
  droppedChecks: string[];
  counts: { total: number; passed: number; failed: number; skipped: number; verified: number; failedRuns: number };
  move: { moved: boolean; reason: ReportMoveReason; from: string | null; to: string | null };
  reportedAt: string;
}
/** `docDuplicateSchema`: a real document that looks like this draft, found by the server. `url` opens it in Hub. */
export interface DocDuplicate {
  key: string;
  title: L;
  source: string;
  path: string;
  url: string;
  overlap: L | null;
}
/** `chatQuestionItemSchema`. `id` on an option is the mock's, to pick a scripted branch. */
export interface QuestionItem {
  text: L;
  header?: L;
  multiSelect: boolean;
  options: { id?: string; label: L; description?: L }[];
}
/**
 * `chatQuestionSchema`, from `question.asked`: `questions`, `status`, `answers`, `expiresAt`. An option is filled only when its label says it is recommended, which is Claude's stated opinion. `variant`, `diff`, `changedOn`
 * and `path` are what the panel draws from Hub's own data. `stoppedBy` picks the sentence for `stopped`.
 */
export interface Question {
  variant?: 'proposal' | 'verify' | 'conflict';
  questions: QuestionItem[];
  expiresAt: string;
  path?: string;
  diff?: DiffLine[];
  changedOn?: L;
  status: 'pending' | 'answered' | 'declined' | 'timed_out' | 'stopped';
  answers?: Record<string, string>;
  stoppedBy?: 'turn' | 'bridge' | 'engine';
}
export type QuestionInput = Omit<Question, 'status' | 'questions' | 'expiresAt'> & ({ questions: QuestionItem[] } | { header: L; text: L; multiSelect: boolean; options: QuestionItem['options'] });
/** `docClaimSchema`. `answer` is null while unanswered, and a verified claim needs none. */
export interface DocClaim {
  id: string;
  text: L;
  status: 'verified' | 'unverified';
  source: string | null;
  answer: 'confirm' | 'remove' | 'keep_flagged' | null;
}
/**
 * `chatDocDraftSchema`, from `doc.draft` and `doc.draft.updated`. `lines` is the diff the panel computes from `baseText` and `draft`, and `before` is where this page's copy takes the new text. `saving` is the
 * panel's: the moment between pressing Save, which is Allow on `save_doc` with the answers, and the draft's new status.
 */
export interface Draft {
  docKey: string | null;
  source: string | null;
  path: string | null;
  title: L;
  reason: L;
  baseVersion: string | null;
  duplicates: DocDuplicate[];
  claims: DocClaim[];
  lines: DiffLine[];
  status: 'open' | 'saving' | 'saved' | 'refused' | 'dropped';
  /** A refusal's error code, such as `hub.docs.stale_base`. */
  refusedCode: string | null;
  savedVersion: string | null;
  before: string;
}
export interface Gap {
  id: string;
  kind: 'missing' | 'stale';
  topic: L;
  why: L;
  /** Card keys and code paths it was found in. */
  cards: string[];
  paths: string[];
  /** The doc "Write it" drafts on. */
  doc: { key: string; path: string };
}
export interface GapReport {
  scope: L;
  notChecked: L;
  gaps: Gap[];
}

export type Item =
  | { kind: 'user'; id: string; text: string | L; context?: { view?: string; cardKey?: string; action?: string; more?: string[] }; skill?: string; script?: ScriptId }
  | { kind: 'text'; id: string; text: L; shown: number }
  | { kind: 'tools'; id: string; calls: ToolCall[] }
  | { kind: 'approval'; id: string; request: ApprovalRequest }
  | { kind: 'card'; id: string; cardKey: string }
  | { kind: 'notice'; id: string; tone: 'stopped' | 'denied' | 'cut'; text: L }
  | { kind: 'turn'; id: string; meta: TurnMeta }
  | { kind: 'protocol'; id: string; protocol: 'task' | 'doc'; target: string; stages: Stage[] }
  | { kind: 'plan'; id: string; plan: Plan }
  | { kind: 'report'; id: string; report: Report }
  | { kind: 'question'; id: string; question: Question }
  /** `report.refused`: a report that said a failed step passed. Nothing was stored on the card. */
  | { kind: 'refused'; id: string; cardKey: string; checks: { name: string; stepId: string }[] }
  | { kind: 'draft'; id: string; draft: Draft }
  | { kind: 'saved'; id: string; doc: string; path: string; revision: string; previous: string; restored?: boolean }
  | { kind: 'links'; id: string; doc: string; keys: string[]; done?: boolean }
  | { kind: 'gaps'; id: string; report: GapReport }
  /** `tool.blocked`: what was refused, in which mode. The panel offers to switch to Execute. */
  | { kind: 'blocked'; id: string; name: string; command: string; mode: 'ask' | 'plan' };

/** The D41 class a paused call falls in. The effect line and the pause reason are looked up from it, so neither can be model text (§7.2). */
export type ApprovalCategory = 'delete' | 'move' | 'commit' | 'push' | 'deploy' | 'branch' | 'worktree' | 'docker' | 'hub_project' | 'hub_doc' | 'hub_sensitive' | 'other';
/** `approval.requested` and `chatApprovalSchema` in the contract. `status` uses the contract's values. */
export interface ApprovalRequest {
  approvalId: string;
  toolName: string;
  /** The exact command or call, as the permission tool receives it. */
  command: string;
  category: ApprovalCategory;
  /** The chat's folder, which the prompt repeats. */
  folder: string;
  /** D46: computed by the panel from `input.repoPaths` and the project's list. */
  diff?: { before: string[]; after: string[] };
  /** `expiresAt`, as shown. The bridge owns the 30 minute window. */
  expiresAt: string;
  status: 'pending' | 'allowed' | 'denied' | 'timed_out' | 'stopped';
  /** Why `stopped` was reached, in words the owner can act on. */
  stoppedBy?: 'turn' | 'bridge' | 'engine';
}

export type TurnStatus = 'idle' | 'starting' | 'thinking' | 'retrying' | 'streaming' | 'tool' | 'waiting' | 'stopped';

export interface Chat {
  id: string;
  project: ProjectId;
  title: L;
  device: DeviceId;
  folder: string;
  persona: Role;
  at: L;
  items: Item[];
  status: TurnStatus;
  runId?: string;
  deleted?: boolean;
  pinned?: boolean;
  mode: Mode;
  model: ModelId;
  effort: Effort;
  /** `system/init.session_id`. A new chat has none until its first turn starts. */
  session?: string;
  /** Read by the bridge from the folder. Left out when the folder is not a repository. */
  branch?: string;
  started?: L;
  /** The chat this one branched from. */
  from?: { title: L; message: L };
  /** What the live process was started with. A change restarts it, with a visible Starting line (§7.2, S1). */
  live?: { mode: Mode; model: ModelId; effort: Effort };
  /** `turn.starting`: why a process is starting for this turn. A process that had closed is a `resume`, since nothing remembers what it was. */
  starting?: 'new' | 'resume' | 'mode' | 'model' | 'effort' | 'folder';
}

const done = (ar: string, en: string): L => l(ar, en);
const tool = (id: string, name: string, detail: string, extra: Partial<ToolCall> = {}): ToolCall => ({ id, name, detail, state: 'ok', ...extra });

export const PAYTR_APPROVAL: ApprovalRequest = {
  approvalId: 'a-paytr',
  toolName: 'Bash',
  command: 'git push origin feat/paytr-live',
  category: 'push',
  folder: 'F:/Goteav/backend',
  expiresAt: '14:30',
  status: 'pending',
};

export const REPO_APPROVAL: ApprovalRequest = {
  approvalId: 'a-repo',
  toolName: 'mcp__hub__update_project',
  command: 'update_project { "project": "goteav", "repoPaths": ["F:/Goteav/backend", "F:/Goteav/web", "F:/Goteav/Goteav-Dashboard", "F:/tools/page-companion"] }',
  category: 'hub_project',
  folder: 'Goteav',
  diff: {
    before: ['F:/Goteav/backend', 'F:/Goteav/web', 'F:/Goteav/Goteav-Dashboard'],
    after: ['F:/Goteav/backend', 'F:/Goteav/web', 'F:/Goteav/Goteav-Dashboard', 'F:/tools/page-companion'],
  },
  expiresAt: '14:30',
  status: 'pending',
};

/** A long command the prototype can start, to see the cap and the highlights (review N5). */
export const LONG_APPROVAL: ApprovalRequest = {
  approvalId: 'a-long',
  toolName: 'Bash',
  command: 'cd F:/Goteav/backend && pnpm build && git add -A && git commit -m "chore(release): bump the payment adapters and regenerate the OpenAPI client for the refund contract" && git push origin feat/paytr-live --force && rm -rf dist/.cache && docker compose -f deploy/compose.production.yaml up -d --build api worker && curl -fsS https://api.example.test/health',
  category: 'push',
  folder: 'F:/Goteav/backend',
  expiresAt: '14:30',
  status: 'pending',
};

const PAYTR_REPLY = done(
  `جهّزت المحوّل وأصبحت الاختبارات خضراء.

## ما تغيّر
- **\`paytr.adapter.ts\`** صار يمسك الدفع قبل الخصم، كما في وثيقة أمان التأكيد.
- **\`paytr.webhook.ts\`** يتجاهل الإشعار المكرّر بدل تأكيد الحجز مرتين.
- اختبارات e2e للمسارين: 18 ناجحًا.

بقي أمر واحد: رفع الفرع. لا يُرفع شيء قبل أن توافق.`,
  `The adapter is ready and the tests are green.

## What changed
- **\`paytr.adapter.ts\`** now holds the payment before charging, as the confirmation safety doc says.
- **\`paytr.webhook.ts\`** ignores a duplicate notice instead of confirming a booking twice.
- e2e tests for both paths: 18 passing.

One thing is left: pushing the branch. Nothing goes up until you allow it.`,
);

const ADAPTER_DIFF: DiffLine[] = [
  { t: 'hunk', text: '@@ -41,9 +41,14 @@ export class PaytrAdapter implements PaymentPort {' },
  { t: 'ctx', text: '  async charge(order: Order, card: CardToken) {' },
  { t: 'del', text: '    const payment = await this.client.capture(order.total, card);' },
  { t: 'add', text: '    const hold = await this.client.authorize(order.total, card);' },
  { t: 'add', text: '    const seat = await this.provider.confirmSeat(order);' },
  { t: 'add', text: '    if (!seat.ok) {' },
  { t: 'add', text: '      await this.client.void(hold.id);' },
  { t: 'add', text: '      return PaymentResult.refused(seat.reason);' },
  { t: 'add', text: '    }' },
  { t: 'add', text: '    const payment = await this.client.capture(hold.id);' },
  { t: 'ctx', text: '    return PaymentResult.captured(payment);' },
  { t: 'ctx', text: '  }' },
];
const WEBHOOK_DIFF: DiffLine[] = [
  { t: 'hunk', text: '@@ -18,3 +18,8 @@ export class PaytrWebhook {' },
  { t: 'ctx', text: '  async handle(notice: PaytrNotice) {' },
  { t: 'add', text: '    if (await this.seen.has(notice.id)) {' },
  { t: 'add', text: '      return; // A repeated notice must not confirm a booking twice.' },
  { t: 'add', text: '    }' },
  { t: 'add', text: '    await this.seen.add(notice.id);' },
  { t: 'ctx', text: '    await this.orders.confirm(notice.orderId);' },
  { t: 'del', text: '    // TODO: duplicates' },
  { t: 'ctx', text: '  }' },
];

export const seedChats = (): Chat[] => [
  {
    id: 'c-paytr',
    project: 'goteav',
    title: l('تشغيل: محوّل PayTR', 'Run: PayTR adapter'),
    device: 'main',
    folder: 'F:/Goteav/backend',
    persona: 'backend',
    at: l('قبل 6 د', '6 min ago'),
    status: 'waiting',
    runId: 'r-paytr',
    mode: 'execute',
    model: 'sonnet',
    effort: 'high',
    live: { mode: 'execute', model: 'sonnet', effort: 'high' },
    session: '7f3a9c12-48de-4b1f-a1c7-2e90d4b6f001',
    branch: 'feat/paytr-live',
    started: l('اليوم 14:02', 'Today 14:02'),
    items: [
      { kind: 'user', id: 'u1', text: l('نفّذ GTV-259 وأكمل الاختبارات، ثم ارفع الفرع.', 'Do GTV-259, finish the tests, then push the branch.'), context: { cardKey: 'GTV-259' }, script: 'push' },
      {
        kind: 'tools',
        id: 't1',
        calls: [
          tool('t1a', 'mcp__hub__get_card', 'GTV-259', { ms: 180, result: l('حُمّلت البطاقة', 'Card loaded'), input: '{ "key": "GTV-259" }', output: '{ "key": "GTV-259", "type": "task", "status": "in_progress", "repo": "backend", "branch": "feat/paytr-live", "links": ["GTV-231", "GTV-240"] }', decision: 'config' }),
          tool('t1b', 'Read', 'src/payments/paytr/paytr.adapter.ts', { ms: 40, input: '{ "file_path": "src/payments/paytr/paytr.adapter.ts" }', output: '212 lines read', decision: 'config' }),
          tool('t1c', 'Edit', 'src/payments/paytr/paytr.adapter.ts', { ms: 60, result: l('+42 −9', '+42 −9'), input: '{ "file_path": "src/payments/paytr/paytr.adapter.ts", "old_string": "const payment = await this.client.capture(order.total, card);", "new_string": "const hold = await this.client.authorize(order.total, card);\\n…" }', output: 'The file was updated.', decision: 'config' }),
          tool('t1d', 'Edit', 'src/payments/paytr/paytr.webhook.ts', { ms: 55, result: l('+18 −3', '+18 −3'), input: '{ "file_path": "src/payments/paytr/paytr.webhook.ts", "old_string": "// TODO: duplicates", "new_string": "if (await this.seen.has(notice.id)) {\\n…" }', output: 'The file was updated.', decision: 'config' }),
          tool('t1e', 'Bash', 'pnpm test:e2e paytr', { ms: 48200, result: l('18 ناجحًا', '18 passing'), input: '{ "command": "pnpm test:e2e paytr", "description": "Run the PayTR e2e tests" }', output: 'PASS test/e2e/paytr-hold.e2e-spec.ts (11 tests)\nPASS test/e2e/paytr-webhook.e2e-spec.ts (7 tests)\n\nTests: 18 passed, 18 total\nTime: 46.3 s', decision: 'config' }),
          tool('t1f', 'Bash', 'git commit -m "feat(paytr): hold before charge"', { ms: 900, result: l('وافقت قبل 9 د', 'You allowed this 9 min ago'), input: '{ "command": "git commit -m \\"feat(paytr): hold before charge\\"" }', output: '[feat/paytr-live 8e21c40] feat(paytr): hold before charge\n 4 files changed, 60 insertions(+), 12 deletions(-)', decision: 'user_temporary' }),
        ],
      },
      { kind: 'text', id: 'x1', text: PAYTR_REPLY, shown: 1 },
      {
        kind: 'turn',
        id: 'turn1',
        meta: {
          state: 'done',
          mode: 'execute',
          model: 'sonnet',
          effort: 'high',
          ms: 94000,
          steps: 6,
          usage: { input: 18420, output: 3120, cacheRead: 41800 },
          files: [
            { path: 'src/payments/paytr/paytr.adapter.ts', source: 'tool', additions: 42, deletions: 9, diff: ADAPTER_DIFF },
            { path: 'src/payments/paytr/paytr.webhook.ts', source: 'tool', additions: 18, deletions: 3, diff: WEBHOOK_DIFF },
          ],
        },
      },
      { kind: 'approval', id: 'a1', request: { ...PAYTR_APPROVAL } },
    ],
  },
  {
    id: 'c-plan',
    project: 'goteav',
    title: l('خطة: إعادة محاولة إشعارات الاسترداد', 'Plan: retry refund webhooks'),
    device: 'main',
    folder: 'F:/Goteav/backend',
    persona: 'backend',
    at: l('اليوم 11:20', 'Today 11:20'),
    status: 'idle',
    mode: 'plan',
    model: 'opus',
    effort: 'high',
    live: { mode: 'plan', model: 'opus', effort: 'high' },
    session: 'b21e6f40-93aa-4c58-8d02-77c1a0e3f210',
    branch: 'fix/refund-webhook-retry',
    started: l('اليوم 11:18', 'Today 11:18'),
    pinned: true,
    items: [
      { kind: 'user', id: 'u1', text: l('خطّط لإعادة محاولة إشعارات الاسترداد دون لمس العقد.', 'Plan the refund webhook retries without touching the contract.'), context: { cardKey: 'GTV-281', action: 'plan' } },
      { kind: 'tools', id: 't1', calls: [tool('t1a', 'mcp__hub__get_card', 'GTV-281', { ms: 170, input: '{ "key": "GTV-281" }', output: '{ "key": "GTV-281", "type": "task", "status": "in_review" }', decision: 'config' }), tool('t1b', 'Grep', 'refund.webhook src/', { ms: 90, input: '{ "pattern": "refund.webhook", "path": "src/" }', output: 'src/payments/refund/refund.webhook.ts\nsrc/payments/refund/refund.service.ts', decision: 'config' })] },
      {
        kind: 'plan',
        id: 'p1',
        plan: {
          plan: l('نقل معالجة الإشعار إلى صف بثلاث محاولات، وحفظ رقم الإشعار، واختبار.', 'Move notice handling into a queue with three attempts, store the notice id, and add a test.'),
          structured: {
            title: l('إعادة المحاولة خلف الواجهة نفسها', 'Retries behind the same interface'),
            steps: [
              { title: l('نقل معالجة الإشعار إلى صف BullMQ بثلاث محاولات.', 'Move notice handling into a BullMQ queue with three attempts.'), role: 'backend', why: l('الإشعار الفاشل يضيع اليوم دون إعادة.', 'A failed notice is lost today, with no retry.') },
              { title: l('حفظ رقم الإشعار لمنع التكرار.', 'Store the notice id so a repeat does nothing.'), role: 'backend' },
              { title: l('اختبار للانقطاع ثم الوصول المتأخر.', 'Add a test for a failure followed by a late arrival.'), role: 'qa' },
            ],
            checks: ['pnpm typecheck', 'pnpm test refund', 'pnpm test:e2e refund-webhook'],
            risks: [l('قد يصل إشعار مرتين أثناء التبديل.', 'A notice can arrive twice during the switch.')],
          },
          state: 'proposed',
        },
      },
      { kind: 'turn', id: 'turn1', meta: { state: 'done', mode: 'plan', model: 'opus', effort: 'high', ms: 38000, steps: 2, usage: { input: 9200, output: 840, cacheRead: 22100 } } },
    ],
  },
  {
    id: 'c-fees',
    project: 'goteav',
    title: l('شرح رسوم Moyasar', 'Explain Moyasar fees'),
    device: 'main',
    folder: 'F:/Goteav/backend',
    persona: 'owner',
    at: l('أمس 21:14', 'Yesterday 21:14'),
    status: 'idle',
    mode: 'ask',
    model: 'sonnet',
    effort: 'medium',
    session: '0c44d1b7-2ae1-4f93-b6a0-5d1e8c3a7702',
    branch: 'main',
    started: l('أمس 21:12', 'Yesterday 21:12'),
    items: [
      { kind: 'user', id: 'u1', text: l('اشرح GTV-231 وما يترتب على كل خيار.', 'Explain GTV-231 and what each option means.'), context: { cardKey: 'GTV-231', action: 'explain' } },
      { kind: 'tools', id: 't1', calls: [tool('t1a', 'mcp__hub__get_card', 'GTV-231', { ms: 160, input: '{ "key": "GTV-231" }', decision: 'config' }), tool('t1b', 'Grep', 'moyasar src/', { ms: 70, input: '{ "pattern": "moyasar", "path": "src/" }', decision: 'config' })] },
      {
        kind: 'text',
        id: 'x1',
        shown: 1,
        text: done(
          'السؤال: من يتحمّل الرسوم. إن تحمّلها العميل يتغيّر السعر الظاهر في صفحة الدفع، وإن تحمّلناها يتغيّر تقرير المحاسب فقط. **القرار يخصّك**، وأنا لا أقرره.',
          'The question is who carries the fee. If the customer does, the visible price on checkout changes. If we do, only the accountant report changes. **The decision is yours**, and I do not make it.',
        ),
      },
      { kind: 'turn', id: 'turn1', meta: { state: 'done', mode: 'ask', model: 'sonnet', effort: 'medium', ms: 21000, steps: 2, usage: { input: 6100, output: 410, cacheRead: 15200 } } },
    ],
  },
  {
    id: 'c-invite',
    project: 'hub',
    title: l('تشغيل: دعوة الأعضاء', 'Run: invite members'),
    device: 'main',
    folder: 'F:/Goteav/hub',
    persona: 'pm',
    at: l('اليوم 10:40', 'Today 10:40'),
    status: 'idle',
    runId: 'r-invite',
    mode: 'execute',
    model: 'sonnet',
    effort: 'medium',
    session: '3ad8e5f2-71c6-4e0b-9f14-c8b2d6a1e903',
    branch: 'feat/first-release',
    started: l('اليوم 10:31', 'Today 10:31'),
    items: [
      { kind: 'user', id: 'u1', text: l('نفّذ GTV-262.', 'Do GTV-262.'), context: { cardKey: 'GTV-262' } },
      { kind: 'text', id: 'x1', shown: 1, text: done('تم. تغيّر ملفان، والبطاقة تنتظر تأكيدك.', 'Done. Two files changed, and the card is waiting for you to confirm.') },
      { kind: 'turn', id: 'turn1', meta: { state: 'done', mode: 'execute', model: 'sonnet', effort: 'medium', ms: 412000, steps: 14, usage: { input: 31200, output: 4300, cacheRead: 88000 } } },
    ],
  },
  {
    // The honest case: the process died, so there was no `result` and nothing about usage is known. The line reads well with it left out.
    id: 'c-scan',
    project: 'hub',
    title: l('لماذا تكررت بطاقات المسح؟', 'Why did scan cards repeat?'),
    device: 'laptop',
    folder: 'F:/Goteav/hub',
    persona: 'owner',
    at: l('الثلاثاء', 'Tuesday'),
    status: 'idle',
    mode: 'ask',
    model: 'haiku',
    effort: 'medium',
    session: 'e90b2c77-15fd-4a6c-8e33-1b7f4d0c6a15',
    started: l('الثلاثاء 19:03', 'Tuesday 19:03'),
    items: [
      { kind: 'user', id: 'u1', text: l('لماذا تكررت بطاقات المسح؟', 'Why did scan cards repeat?') },
      { kind: 'tools', id: 't1', calls: [tool('t1a', 'Grep', 'externalKey apps/api', { input: '{ "pattern": "externalKey", "path": "apps/api" }' }), { id: 't1b', name: 'Read', detail: 'apps/api/src/scan/scan.service.ts', state: 'stopped', input: '{ "file_path": "apps/api/src/scan/scan.service.ts" }' }] },
      { kind: 'notice', id: 'n1', tone: 'cut', text: l('انقطعت هذه الجولة: توقّف Claude دون نتيجة، فلا نعرف استهلاكها. نام اللابتوب على الأرجح.', 'This turn was cut off: Claude stopped without a result, so its usage is not known. The laptop probably slept.') },
      { kind: 'turn', id: 'turn1', meta: { state: 'failed', failure: 'cut_off', mode: 'ask', model: 'haiku', steps: 2 } },
    ],
  },
  {
    // No answer in the bridge's 30 minute window: denied, and it says so (review N7).
    id: 'c-expired',
    project: 'goteav',
    title: l('فرع للاسترداد', 'A branch for refunds'),
    device: 'main',
    folder: 'F:/Goteav/backend',
    persona: 'backend',
    at: l('أمس 16:02', 'Yesterday 16:02'),
    status: 'idle',
    mode: 'execute',
    model: 'sonnet',
    effort: 'medium',
    session: '91c0d7e4-30ab-4f2c-b7e5-6a1d9f02c844',
    branch: 'main',
    started: l('أمس 15:30', 'Yesterday 15:30'),
    items: [
      { kind: 'user', id: 'u1', text: l('أنشئ فرعًا لإصلاح الاسترداد.', 'Create a branch for the refund fix.') },
      { kind: 'approval', id: 'a1', request: { approvalId: 'a-expired', toolName: 'Bash', command: 'git switch -c fix/refund-retry', category: 'branch', folder: 'F:/Goteav/backend', expiresAt: '16:00', status: 'timed_out' } },
      { kind: 'text', id: 'x1', shown: 1, text: l('لم تصلني إجابة فلم أنشئ الفرع. بقي العمل على `main` كما كان.', 'No answer reached me, so I did not create the branch. The work stays on `main` as it was.') },
      { kind: 'turn', id: 'turn1', meta: { state: 'done', mode: 'execute', model: 'sonnet', effort: 'medium', ms: 1812000, steps: 1, usage: { input: 2100, output: 90, cacheRead: 9000 } } },
    ],
  },
  {
    // Every closed state a question can reach (review M5).
    id: 'c-questions',
    project: 'goteav',
    title: l('أسئلة منتهية', 'Closed questions'),
    device: 'main',
    folder: 'F:/Goteav/backend',
    persona: 'backend',
    at: l('أمس 12:10', 'Yesterday 12:10'),
    status: 'idle',
    mode: 'execute',
    model: 'sonnet',
    effort: 'medium',
    session: '6ed1c0a2-9b37-4e51-a0c4-11f7d2e8b932',
    started: l('أمس 12:00', 'Yesterday 12:00'),
    items: [
      { kind: 'user', id: 'u1', text: l('أضف صفحة الفواتير.', 'Add the invoices page.') },
      ...(['answered', 'declined', 'timed_out', 'stopped'] as const).map((status, i): Item => ({
        kind: 'question',
        id: `q${i}`,
        question: {
          expiresAt: '12:30',
          status,
          stoppedBy: status === 'stopped' ? 'bridge' : undefined,
          answers: status === 'answered' ? { 'Which table?': 'invoices' } : undefined,
          questions: [{ text: l('أي جدول؟', 'Which table?'), header: l('الجدول', 'Table'), multiSelect: false, options: [{ label: l('invoices', 'invoices') }, { label: l('billing', 'billing') }] }],
        },
      })),
      { kind: 'turn', id: 'turn1', meta: { state: 'done', mode: 'execute', model: 'sonnet', effort: 'medium', ms: 64000, steps: 0, usage: { input: 2100, output: 90, cacheRead: 9000 } } },
    ],
  },
  {
    // §7.2: text in the reply stays the fallback when the model did not call `propose_plan`.
    id: 'c-plan-text',
    project: 'goteav',
    title: l('خطة: ترتيب ملفات الفوترة', 'Plan: tidy the billing files'),
    device: 'main',
    folder: 'F:/Goteav/backend',
    persona: 'backend',
    at: l('اليوم 09:05', 'Today 09:05'),
    status: 'idle',
    mode: 'plan',
    model: 'sonnet',
    effort: 'medium',
    session: '5be21a04-6c1d-49d0-8f33-2d7ac0b19e61',
    branch: 'main',
    started: l('اليوم 09:02', 'Today 09:02'),
    items: [
      { kind: 'user', id: 'u1', text: l('خطّط لترتيب ملفات الفوترة.', 'Plan how to tidy the billing files.') },
      {
        kind: 'plan',
        id: 'p1',
        plan: {
          plan: l('1. نقل الحساب إلى `billing/core`.\n2. إبقاء الواجهة كما هي.\n3. تشغيل `pnpm test billing`.', '1. Move the calculation into `billing/core`.\n2. Keep the interface as it is.\n3. Run `pnpm test billing`.'),
          state: 'proposed',
        },
      },
      { kind: 'turn', id: 'turn1', meta: { state: 'done', mode: 'plan', model: 'sonnet', effort: 'medium', ms: 19000, steps: 0, usage: { input: 3100, output: 280, cacheRead: 8200 } } },
    ],
  },
];

// ── Scripts: what a turn does, step by step ─────────────────────────────────────────────────────

export type Step =
  | { t: 'starting'; ms?: number }
  | { t: 'thinking'; ms: number }
  /** `turn.status` with `state: 'retrying'`, `attempt` and `retryInMs`. */
  | { t: 'retrying'; ms: number }
  | { t: 'tool'; name: string; detail: string; ms: number; result?: L; input?: string; output?: string; error?: string; decision?: StepDecision; file?: ChangedFile; refused?: boolean; runState?: 'stopped' | 'running' }
  | { t: 'text'; text: L }
  | { t: 'approval'; request: ApprovalRequest; allow: Step[]; deny: Step[] }
  | { t: 'card' }
  | { t: 'run'; state: RunState; when?: L; summary?: L }
  | { t: 'notice'; tone: 'stopped' | 'denied' | 'cut'; text: L }
  | { t: 'protocol'; protocol: 'task' | 'doc'; target: string }
  | { t: 'stage'; id: StageId; state: StageState; note?: L }
  | { t: 'plan'; plan: Plan }
  /** `hub.start_task`: `/hub:work` starts the task, so the card really does move (docs/16 §7.2 as built). */
  | { t: 'started'; key: string }
  /** `report_work`'s input. The store does what the server does with it: it finds the runs, sets `verified` and `basis`, and refuses a contradiction. */
  | { t: 'report'; report: { card: string; summary: L; checks: { name: string; command?: string; outcome: 'passed' | 'failed' | 'skipped'; note?: L }[]; changedFiles?: Omit<ChangedFile, 'diff'>[]; notChecked: L[] } }
  | { t: 'question'; question: QuestionInput; branches: Record<string, Step[]> }
  /** `onUpdate` is the way back when the server found a duplicate: draft on the existing doc instead. */
  | { t: 'draft'; draft: Draft; onSave: Step[]; onDiscard: Step[]; onUpdate?: Step[] }
  /** `doc.draft.updated`: a refused save never shows as sent. */
  | { t: 'draftState'; status: Draft['status']; refusedCode?: string; savedVersion?: string }
  | { t: 'saved'; doc: string; path: string }
  | { t: 'links'; doc: string; keys: string[] }
  | { t: 'gaps'; report: GapReport }
  | { t: 'blocked'; name: string; command: string; mode: 'ask' | 'plan' }
  /** Closes the turn with what `result` reported. `usage: null` is a turn the engine reported nothing for. */
  | { t: 'end'; state?: TurnEnd; failure?: TurnFailure; usage?: Usage | null };

const opening = (cold: boolean): Step[] => (cold ? [{ t: 'starting' }, { t: 'thinking', ms: 500 }] : [{ t: 'thinking', ms: 700 }]);

export type ScriptId = 'explain' | 'plan' | 'redesign' | 'push' | 'pushLong' | 'folders' | 'create' | 'long' | 'next' | 'suggest' | 'free' | 'runwork' | 'answer' | 'blocked' | 'retrying' | 'taskPass' | 'taskFail' | 'taskClaimed' | 'taskRefused' | 'taskCut' | 'questions' | 'docImprove' | 'docConflict' | 'docDocument' | 'docArabic' | 'gaps';

/** What a script can read about the turn it plays. */
export interface ScriptTarget {
  command?: string;
  key: string;
  title: L;
  folder?: string;
  path?: string;
  reply?: L;
  mode?: Mode;
}

export function script(id: ScriptId, target: ScriptTarget, cold: boolean): Step[] {
  const k = target.key;
  const name = (loc: 'ar' | 'en') => target.title[loc];
  switch (id) {
    case 'explain':
      return [
        ...opening(cold),
        { t: 'tool', name: 'mcp__hub__get_card', detail: k, ms: 500 },
        { t: 'tool', name: 'Grep', detail: `"${k}" docs/`, ms: 450 },
        {
          t: 'text',
          text: l(
            `**${name('ar')}** باختصار:\n\n- ما هو: ما تطلبه البطاقة وما حولها من روابط.\n- لماذا الآن: \`${k}\` مرتبطة بعمل ينتظرها.\n- الخطوة التالية: عندك على البطاقة، وأنا لا أغيّر حالتها دون طلبك.\n\nهل تريد خطة، أم أبدأ التنفيذ؟`,
            `**${name('en')}** in short:\n\n- What it is: what the card asks for, and its links.\n- Why now: \`${k}\` is tied to work waiting on it.\n- Next step: on the card, and I do not change its state unless you ask.\n\nWant a plan, or should I start?`,
          ),
        },
      ];
    case 'plan':
      return [
        ...opening(cold),
        { t: 'tool', name: 'mcp__hub__get_card', detail: k, ms: 450, input: `{ "key": "${k}" }`, decision: 'config' },
        { t: 'tool', name: 'Read', detail: 'docs/16-workbench.md', ms: 450, input: '{ "file_path": "docs/16-workbench.md" }', decision: 'config' },
        {
          t: 'plan',
          plan: {
            plan: l(`خطة ${k}: قراءة العقد، تغيير صغير، اختبارات، ثم طلب موافقتك.`, `A plan for ${k}: read the contract, a small change, tests, then ask you.`),
            structured: {
              title: l(`خطة ${k}`, `A plan for ${k}`),
              steps: [
                { title: l('قراءة العقد الحالي والاختبارات.', 'Read the current contract and its tests.'), why: l('حتى لا يكسر التغيير ما يعتمد عليه.', 'So the change does not break what relies on it.') },
                { title: l('تغيير صغير خلف الواجهة نفسها.', 'Make a small change behind the same interface.'), role: 'backend' },
                { title: l('اختبارات للمسار الجديد والقديم.', 'Add tests for the new and the old path.'), role: 'qa' },
                { title: l('طلب موافقتك قبل الالتزام والرفع.', 'Ask you before committing and pushing.') },
              ],
              checks: ['pnpm typecheck', 'pnpm test', 'pnpm lint'],
            },
            state: 'proposed',
          },
        },
      ];
    case 'answer':
      return [...opening(cold), { t: 'tool', name: 'mcp__hub__get_card', detail: k, ms: 420, input: `{ "key": "${k}" }`, decision: 'config' }, { t: 'text', text: target.reply ?? l('لا يوجد رد.', 'No reply.') }];
    case 'blocked':
      return [
        ...opening(cold),
        { t: 'tool', name: 'Bash', detail: target.command ?? 'pnpm test', ms: 240, input: `{ "command": "${target.command ?? 'pnpm test'}" }`, error: `Refused: ${target.mode === 'plan' ? 'Plan' : 'Ask'} mode has no terminal.`, decision: 'config', refused: true },
        { t: 'blocked', name: 'Bash', command: target.command ?? 'pnpm test', mode: target.mode === 'plan' ? 'plan' : 'ask' },
      ];
    case 'taskPass':
      return taskScript(k, target.folder ?? 'F:/Goteav/Goteav-Dashboard', cold, false);
    case 'taskFail':
      return taskScript(k, target.folder ?? 'F:/Goteav/Goteav-Dashboard', cold, true);
    case 'taskClaimed':
      return taskClaimedScript(k, target.folder ?? 'F:/Goteav/Goteav-Dashboard', cold);
    case 'taskCut':
      return taskCutScript(k, target.folder ?? 'F:/Goteav/Goteav-Dashboard', cold);
    case 'questions':
      return questionsScript(cold);
    case 'taskRefused':
      return taskRefusedScript(k, target.folder ?? 'F:/Goteav/Goteav-Dashboard', cold);
    case 'docArabic':
      return improveArabicDoc(cold);
    case 'retrying':
      return [...opening(cold), { t: 'retrying', ms: 2400 }, { t: 'thinking', ms: 500 }, { t: 'text', text: l('عدت بعد إعادة المحاولة. لم يضع شيء.', 'Back after the retry. Nothing was lost.') }];
    case 'pushLong':
      return [
        ...opening(cold),
        { t: 'text', text: l('أطلب موافقتك على هذا الأمر الطويل. اقرأه كاملًا.', 'I am asking you about this long command. Read all of it.') },
        { t: 'approval', request: { ...LONG_APPROVAL }, allow: [{ t: 'text', text: l('لم يُنفَّذ شيء هنا: هذا نموذج أولي.', 'Nothing ran here: this is a prototype.') }], deny: [{ t: 'text', text: l('لم يُنفَّذ شيء.', 'Nothing ran.') }] },
      ];
    case 'docImprove':
      return improveDoc(k, target.path ?? k, cold, false);
    case 'docConflict':
      return improveDoc(k, target.path ?? k, cold, true);
    case 'docDocument':
      return documentTask(k, cold);
    case 'gaps':
      return gapsScript(cold);
    case 'redesign':
      return [
        ...opening(cold),
        { t: 'tool', name: 'Skill', detail: 'redesign-workflow', ms: 400 },
        { t: 'tool', name: 'Read', detail: 'apps/lab/README.md', ms: 400 },
        {
          t: 'text',
          text: l(
            `سأبدأ موجزًا لـ**${name('ar')}** في المختبر ثم 3 اتجاهات مختلفة الفكرة لتختار منها. لا يتغير شيء حقيقي قبل موافقتك على نسخة.`,
            `I will start a brief for **${name('en')}** in the lab, then three directions that differ in idea for you to choose from. Nothing real changes until you approve a version.`,
          ),
        },
      ];
    case 'push':
      return [
        ...opening(cold),
        { t: 'tool', name: 'Bash', detail: 'git status', ms: 400, result: l('نظيف، 2 متقدّم', 'Clean, 2 ahead') },
        { t: 'text', text: l('الفرع جاهز. أطلب موافقتك على الرفع.', 'The branch is ready. Asking you before the push.') },
        {
          t: 'approval',
          request: { ...PAYTR_APPROVAL, approvalId: 'a-push', command: 'git push origin feat/full-dashboard-integration', folder: 'F:/Goteav/Goteav-Dashboard' },
          allow: [
            { t: 'tool', name: 'Bash', detail: 'git push origin feat/full-dashboard-integration', ms: 800, result: l('رُفع', 'Pushed') },
            { t: 'text', text: l('رُفع الفرع. لم أفتح طلب دمج.', 'The branch is pushed. I did not open a pull request.') },
          ],
          deny: [{ t: 'text', text: l('لم أرفع شيئًا. الالتزامات باقية محليًا.', 'Nothing was pushed. The commits stay local.') }],
        },
      ];
    case 'folders':
      return [
        ...opening(cold),
        { t: 'tool', name: 'mcp__hub__get_project', detail: 'goteav', ms: 450 },
        { t: 'text', text: l('المجلد خارج قائمة المشروع. أضيفه بعد موافقتك.', 'That folder is outside the project list. I will add it once you allow it.') },
        {
          t: 'approval',
          request: { ...REPO_APPROVAL },
          allow: [
            { t: 'tool', name: 'mcp__hub__update_project', detail: 'repoPaths + F:/tools/page-companion', ms: 600, result: l('حُدّثت القائمة', 'List updated') },
            { t: 'text', text: l('أُضيف المجلد، ويستطيع الجسر العمل فيه من الرسالة التالية.', 'The folder is added, and the bridge can work there from the next message.') },
          ],
          deny: [{ t: 'text', text: l('بقيت القائمة كما هي. لن أعمل خارج مجلدات المشروع.', 'The list stays as it was. I will not work outside the project folders.') }],
        },
      ];
    case 'create':
      return [
        ...opening(cold),
        { t: 'tool', name: 'mcp__hub__create_card', detail: '{ "type": "task", "priority": "P1", "ownerRole": "backend" }', ms: 600 },
        { t: 'card' },
        { t: 'text', text: l('أنشأت البطاقة بحالة «جاهز»، وهي الآن في لوحة المهام. لم أبدأها.', 'I created the card as Ready, and it is on the Tasks board now. I have not started it.') },
      ];
    case 'long':
      return [
        ...opening(cold),
        { t: 'tool', name: 'Read', detail: 'src/payments/**/*.ts', ms: 900 },
        { t: 'tool', name: 'Bash', detail: 'pnpm test --filter payments', ms: 1800, result: l('212 ناجحًا', '212 passing') },
        {
          t: 'text',
          text: l(
            `مراجعة طويلة لوحدة الدفع.\n\n${'كل محوّل يكرر فحص المبلغ، ويمكن جمعها في مكان واحد، لكن هذا يمس عقد الاسترداد ويحتاج قرارًا منك أولًا. '.repeat(14)}`,
            `A long review of the payments module.\n\n${'Each adapter repeats the amount check, and they could live in one place, but that touches the refund contract and needs your decision first. '.repeat(14)}`,
          ),
        },
      ];
    case 'next':
      return [...opening(cold), { t: 'tool', name: 'mcp__hub__next_task', detail: '{ "role": "backend" }', ms: 500 }, { t: 'text', text: l(`أولى المهام الجاهزة لك: \`${k}\`. هل أبدأ؟`, `First task ready for you: \`${k}\`. Shall I start?`) }];
    case 'suggest':
      return [
        ...opening(cold),
        { t: 'tool', name: 'mcp__hub__list_cards', detail: '{ "status": "open" }', ms: 600 },
        {
          t: 'text',
          text: l(
            'قرأت المشروع. أقترح:\n\n1. مهمة: **فهرس لسجل الدخول**، لأن التقرير بطيء.\n2. مهارة: **`/backend:migrate`** تكفي عن خطوات تكررها يدويًا.\n\nلا أنشئ شيئًا قبل أن تقبل.',
            'I read the project. My suggestions:\n\n1. A task: **an index for the login log**, because the report is slow.\n2. A skill: **`/backend:migrate`** replaces steps you repeat by hand.\n\nNothing gets created until you accept.',
          ),
        },
      ];
    case 'runwork':
      return [
        ...opening(true),
        { t: 'tool', name: 'mcp__hub__get_card', detail: k, ms: 500 },
        { t: 'tool', name: 'Edit', detail: 'src/**', ms: 1600 },
        { t: 'text', text: l(`أنهيت \`${k}\`. البطاقة تنتظر تأكيدك، فهي لا تكتمل وحدها.`, `Finished \`${k}\`. The card is waiting for you to confirm, it does not complete itself.`) },
        { t: 'run', state: 'done', when: l('انتهى الآن', 'Finished now'), summary: l('النتيجة على البطاقة', 'The result is on the card') },
      ];
    case 'free':
    default:
      return [
        ...opening(cold),
        { t: 'tool', name: 'Grep', detail: `"${k}" src/`, ms: 500 },
        {
          t: 'text',
          text: l(
            `هذا رد تجريبي من نموذج أولي، لا من Claude. في النسخة الحقيقية يأتي الرد من Claude Code في \`المجلد المختار\`، بملف \`CLAUDE.md\` ومهاراته.\n\nجرّب من قائمة «تجربة»: طلب \`git push\` أو تغيير المجلدات المسموحة.`,
            `This is a canned reply from a prototype, not from Claude. In the real panel, it comes from Claude Code in \`the chosen folder\`, with its \`CLAUDE.md\` and skills.\n\nFrom the Try menu, test a \`git push\` or a change to the allowed folders.`,
          ),
        },
      ];
  }
}

/** What the approval's Allow or Deny continues with, for the seeded run. */
export const PAYTR_ALLOW: Step[] = [
  { t: 'tool', name: 'Bash', detail: 'git push origin feat/paytr-live', ms: 900, result: l('رُفع', 'Pushed') },
  { t: 'text', text: l('رُفع الفرع. النتيجة على `GTV-259`، والبطاقة تنتظر تأكيدك.', 'The branch is pushed. The result is on `GTV-259`, and the card is waiting for you to confirm.') },
  { t: 'run', state: 'done', when: l('انتهى الآن', 'Finished now'), summary: l('رُفع الفرع. بانتظار تأكيدك على البطاقة', 'The branch is pushed. Waiting for you to confirm on the card') },
];
export const PAYTR_DENY: Step[] = [
  { t: 'text', text: l('لم أرفع شيئًا. الالتزامات باقية محليًا في الفرع.', 'Nothing was pushed. The commits stay local on the branch.') },
  { t: 'run', state: 'denied', when: l('رفضتَ الرفع', 'You denied the push'), summary: l('الالتزامات محلية، ولم يُرفع شيء', 'Commits are local, nothing was pushed') },
];

export const CREATED_CARD = {
  title: l('فهرس لسجل الدخول حتى لا يبطؤ التقرير', 'Index the login log so the report stays fast'),
  body: l('أنشأها Claude من محادثة اللوحة. التقرير يقرأ السجل كاملًا كل مرة.', 'Created by Claude from a panel chat. The report reads the whole log each time.'),
};

export const REPO_FOLDER: Record<string, string> = { backend: 'F:/Goteav/backend', web: 'F:/Goteav/web', dashboard: 'F:/Goteav/Goteav-Dashboard', hub: 'F:/Goteav/hub' };
export const FOLDER_BRANCH: Record<string, string> = { 'F:/Goteav/backend': 'main', 'F:/Goteav/web': 'main', 'F:/Goteav/Goteav-Dashboard': 'feat/full-dashboard-integration', 'F:/Goteav/hub': 'feat/first-release' };

/** Files in a folder, for attaching one. The real list comes from the bridge. */
export const FOLDER_FILES: Record<string, string[]> = {
  'F:/Goteav/backend': ['src/payments/paytr/paytr.adapter.ts', 'src/payments/paytr/paytr.webhook.ts', 'src/wallet/wallet-topup.controller.ts', 'docs/21-confirmation-safety.md', 'CLAUDE.md'],
  'F:/Goteav/web': ['src/features/refund/refund-form.tsx', 'src/lib/api/generated/refund.ts', 'CLAUDE.md'],
  'F:/Goteav/Goteav-Dashboard': ['src/components/bookings/booking-row.tsx', 'src/components/ui/table.tsx', 'docs/api-integration/README.md', 'CLAUDE.md'],
  'F:/Goteav/hub': ['docs/16-workbench.md', 'apps/web/src/components/shell/shell.tsx', 'packages/bridge/src/index.ts', 'CLAUDE.md'],
};

export interface Template {
  id: string;
  project: ProjectId;
  name: L;
  text: L;
}
export const SEED_TEMPLATES: Template[] = [
  { id: 'tpl-review', project: 'goteav', name: l('مراجعة RTL', 'RTL review'), text: l('راجع هذا التغيير: الاتجاهات المنطقية، والمفاتيح داخل LTR، وأهداف اللمس 44 بكسل.', 'Review this change: logical properties, keys in LTR, and 44 px touch targets.') },
  { id: 'tpl-tests', project: 'goteav', name: l('اختبارات مسار', 'Tests for a path'), text: l('اكتب اختبارات e2e لهذا المسار، الناجح والمرفوض، وشغّلها وأرني النتيجة.', 'Write e2e tests for this path, success and refusal, run them and show me the result.') },
  { id: 'tpl-status', project: 'hub', name: l('تقرير الحالة', 'Status report'), text: l('لخّص ما تغيّر منذ أمس في هذا المشروع، وما ينتظرني.', 'Summarise what changed in this project since yesterday, and what waits for me.') },
];

export const STEP_LINES: L[] = [
  l('يعدّل 3 ملفات في src/features/refund', 'Editing 3 files in src/features/refund'),
  l('يشغّل pnpm typecheck', 'Running pnpm typecheck'),
  l('يشغّل اختبارات refund', 'Running the refund tests'),
];
