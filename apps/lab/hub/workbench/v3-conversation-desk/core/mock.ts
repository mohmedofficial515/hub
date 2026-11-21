import type { Role } from '@lab/mocks/hub-app';

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

export const LIMITS = { atOnce: 2, perDay: 5, usedToday: 3, quiet: '23:30–07:00' };

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
    state: 'running',
    chatId: 'c-refund',
    step: l('يعدّل 3 ملفات في src/features/refund', 'Editing 3 files in src/features/refund'),
  },
  {
    id: 'r-backups',
    title: l('النسخ الاحتياطية الليلية', 'Nightly backups'),
    cardKey: 'GTV-258',
    folder: 'F:/Goteav/backend',
    state: 'next',
    when: l('ينتظر فراغ المجلد: تشغيل واحد لكل مجلد', 'Waits for the folder: one run per folder'),
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

// ── Chats and scripted turns ────────────────────────────────────────────────────────────────────

export type ToolState = 'running' | 'ok' | 'denied' | 'stopped';
export interface ToolCall {
  id: string;
  name: string;
  /** Exact input, always LTR. */
  detail: string;
  state: ToolState;
  result?: L;
}

export interface ApprovalRequest {
  id: string;
  tool: string;
  /** The exact command or call, as the permission tool receives it. */
  command: string;
  folder: string;
  why: L;
  effect: L;
  /** D46: a change to `repoPaths` shows what the allowlist becomes. */
  diff?: { before: string[]; after: string[] };
  expires: string;
  state: 'pending' | 'allowed' | 'denied' | 'cancelled';
}

export type Item =
  | { kind: 'user'; id: string; text: string | L; context?: { view?: string; cardKey?: string; action?: string; more?: string[] }; skill?: string }
  | { kind: 'text'; id: string; text: L; shown: number }
  | { kind: 'tools'; id: string; calls: ToolCall[] }
  | { kind: 'approval'; id: string; request: ApprovalRequest }
  | { kind: 'card'; id: string; cardKey: string }
  | { kind: 'notice'; id: string; tone: 'stopped' | 'denied' | 'cut'; text: L };

export type TurnStatus = 'idle' | 'starting' | 'thinking' | 'streaming' | 'tool' | 'waiting' | 'stopped';

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
}

const done = (ar: string, en: string): L => l(ar, en);
const tool = (id: string, name: string, detail: string, result?: L): ToolCall => ({ id, name, detail, state: 'ok', result });

export const PAYTR_APPROVAL: ApprovalRequest = {
  id: 'a-paytr',
  tool: 'Bash',
  command: 'git push origin feat/paytr-live',
  folder: 'F:/Goteav/backend',
  why: l('الدفع إلى المستودع يتوقف عند موافقتك، حسب قواعدك.', 'A push pauses for you, under your rules.'),
  effect: l('يرفع 4 تغييرات إلى feat/paytr-live على origin.', 'Sends 4 commits to feat/paytr-live on origin.'),
  expires: '14:30',
  state: 'pending',
};

export const REPO_APPROVAL: ApprovalRequest = {
  id: 'a-repo',
  tool: 'mcp__hub__update_project',
  command: 'update_project { "project": "goteav", "repoPaths": ["F:/Goteav/backend", "F:/Goteav/web", "F:/Goteav/Goteav-Dashboard", "F:/tools/page-companion"] }',
  folder: 'Goteav',
  why: l('هذا يوسّع المجلدات التي يعمل فيها الجسر، فيتوقف دائمًا عند موافقتك.', 'This widens the folders the bridge may work in, so it always pauses for you.'),
  effect: l('سيقدر Claude على التشغيل في مجلد جديد على هذا الجهاز.', 'Claude could then run in one more folder on this device.'),
  diff: {
    before: ['F:/Goteav/backend', 'F:/Goteav/web', 'F:/Goteav/Goteav-Dashboard'],
    after: ['F:/Goteav/backend', 'F:/Goteav/web', 'F:/Goteav/Goteav-Dashboard', 'F:/tools/page-companion'],
  },
  expires: '14:30',
  state: 'pending',
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
    items: [
      { kind: 'user', id: 'u1', text: l('نفّذ GTV-259 وأكمل الاختبارات، ثم ارفع الفرع.', 'Do GTV-259, finish the tests, then push the branch.'), context: { cardKey: 'GTV-259' } },
      {
        kind: 'tools',
        id: 't1',
        calls: [
          tool('t1a', 'mcp__hub__get_card', 'GTV-259', l('حُمّلت البطاقة', 'Card loaded')),
          tool('t1b', 'Read', 'src/payments/paytr/paytr.adapter.ts'),
          tool('t1c', 'Edit', 'src/payments/paytr/paytr.adapter.ts', l('+42 −9', '+42 −9')),
          tool('t1d', 'Edit', 'src/payments/paytr/paytr.webhook.ts', l('+18 −3', '+18 −3')),
          tool('t1e', 'Bash', 'pnpm test:e2e paytr', l('18 ناجحًا', '18 passing')),
          tool('t1f', 'Bash', 'git commit -m "feat(paytr): hold before charge"', l('وافقت قبل 9 د', 'You allowed this 9 min ago')),
        ],
      },
      { kind: 'text', id: 'x1', text: PAYTR_REPLY, shown: 1 },
      { kind: 'approval', id: 'a1', request: PAYTR_APPROVAL },
    ],
  },
  {
    id: 'c-refund',
    project: 'goteav',
    title: l('تشغيل: عقد الاسترداد', 'Run: refund contract'),
    device: 'main',
    folder: 'F:/Goteav/web',
    persona: 'frontend',
    at: l('الآن', 'Now'),
    status: 'tool',
    runId: 'r-refund',
    items: [
      { kind: 'user', id: 'u1', text: l('نفّذ GTV-260.', 'Do GTV-260.'), context: { cardKey: 'GTV-260' } },
      { kind: 'tools', id: 't1', calls: [tool('t1a', 'Read', 'src/lib/api/generated/refund.ts'), { id: 't1b', name: 'Edit', detail: 'src/features/refund/refund-form.tsx', state: 'running' }] },
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
    items: [
      { kind: 'user', id: 'u1', text: l('اشرح GTV-231 وما يترتب على كل خيار.', 'Explain GTV-231 and what each option means.'), context: { cardKey: 'GTV-231', action: 'explain' } },
      { kind: 'tools', id: 't1', calls: [tool('t1a', 'mcp__hub__get_card', 'GTV-231'), tool('t1b', 'Grep', 'moyasar src/')] },
      {
        kind: 'text',
        id: 'x1',
        shown: 1,
        text: done(
          'السؤال: من يتحمّل الرسوم. إن تحمّلها العميل يتغيّر السعر الظاهر في صفحة الدفع، وإن تحمّلناها يتغيّر تقرير المحاسب فقط. **القرار يخصّك**، وأنا لا أقرره.',
          'The question is who carries the fee. If the customer does, the visible price on checkout changes. If we do, only the accountant report changes. **The decision is yours**, and I do not make it.',
        ),
      },
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
    items: [
      { kind: 'user', id: 'u1', text: l('نفّذ GTV-262.', 'Do GTV-262.'), context: { cardKey: 'GTV-262' } },
      { kind: 'text', id: 'x1', shown: 1, text: done('تم. تغيّر ملفان، والبطاقة تنتظر تأكيدك.', 'Done. Two files changed, and the card is waiting for you to confirm.') },
    ],
  },
  {
    id: 'c-scan',
    project: 'hub',
    title: l('لماذا تكررت بطاقات المسح؟', 'Why did scan cards repeat?'),
    device: 'laptop',
    folder: 'F:/Goteav/hub',
    persona: 'owner',
    at: l('الثلاثاء', 'Tuesday'),
    status: 'idle',
    items: [{ kind: 'user', id: 'u1', text: l('لماذا تكررت بطاقات المسح؟', 'Why did scan cards repeat?') }],
  },
];

// ── Scripts: what a turn does, step by step ─────────────────────────────────────────────────────

export type Step =
  | { t: 'starting'; ms: number }
  | { t: 'thinking'; ms: number }
  | { t: 'tool'; name: string; detail: string; ms: number; result?: L }
  | { t: 'text'; text: L }
  | { t: 'approval'; request: ApprovalRequest; allow: Step[]; deny: Step[] }
  | { t: 'card' }
  | { t: 'run'; state: RunState; when?: L; summary?: L }
  | { t: 'notice'; tone: 'stopped' | 'denied' | 'cut'; text: L };

const opening = (cold: boolean): Step[] => (cold ? [{ t: 'starting', ms: 1100 }, { t: 'thinking', ms: 500 }] : [{ t: 'thinking', ms: 700 }]);

export type ScriptId = 'explain' | 'plan' | 'redesign' | 'push' | 'folders' | 'create' | 'long' | 'next' | 'suggest' | 'free' | 'runwork';

export function script(id: ScriptId, target: { key: string; title: L }, cold: boolean): Step[] {
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
        { t: 'tool', name: 'mcp__hub__get_card', detail: k, ms: 450 },
        { t: 'tool', name: 'Read', detail: 'docs/16-workbench.md', ms: 450 },
        {
          t: 'text',
          text: l(
            `خطة \`${k}\`:\n\n1. قراءة العقد الحالي والاختبارات.\n2. تغيير صغير خلف نفس الواجهة.\n3. اختبارات للمسار الجديد والمسار القديم.\n4. طلب موافقتك قبل الالتزام والرفع.\n\nأي خطوة تريد تغييرها؟ يمكنني تحويلها إلى بطاقات حين تقول.`,
            `Plan for \`${k}\`:\n\n1. Read the current contract and tests.\n2. A small change behind the same interface.\n3. Tests for the new and the old path.\n4. Ask you before committing and pushing.\n\nWhich step would you change? I can turn these into cards when you say.`,
          ),
        },
      ];
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
          request: { ...PAYTR_APPROVAL, id: 'a-push', command: 'git push origin feat/full-dashboard-integration', folder: 'F:/Goteav/Goteav-Dashboard', effect: l('يرفع تغييرين إلى feat/full-dashboard-integration.', 'Sends 2 commits to feat/full-dashboard-integration.') },
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
          request: REPO_APPROVAL,
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
  { t: 'run', state: 'done', when: l('انتهى الآن', 'Finished now'), summary: l('4 تغييرات رُفعت. بانتظار تأكيدك على البطاقة', '4 commits pushed. Waiting for you to confirm on the card') },
];
export const PAYTR_DENY: Step[] = [
  { t: 'text', text: l('لم أرفع شيئًا. الالتزامات باقية محليًا في الفرع.', 'Nothing was pushed. The commits stay local on the branch.') },
  { t: 'run', state: 'denied', when: l('رفضتَ الرفع', 'You denied the push'), summary: l('الالتزامات محلية، ولم يُرفع شيء', 'Commits are local, nothing was pushed') },
];

export const CREATED_CARD = {
  title: l('فهرس لسجل الدخول حتى لا يبطؤ التقرير', 'Index the login log so the report stays fast'),
  body: l('أنشأها Claude من محادثة اللوحة. التقرير يقرأ السجل كاملًا كل مرة.', 'Created by Claude from a panel chat. The report reads the whole log each time.'),
};

export const STEP_LINES: L[] = [
  l('يعدّل 3 ملفات في src/features/refund', 'Editing 3 files in src/features/refund'),
  l('يشغّل pnpm typecheck', 'Running pnpm typecheck'),
  l('يشغّل اختبارات refund', 'Running the refund tests'),
];
