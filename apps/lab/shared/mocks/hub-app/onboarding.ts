// Onboarding fixtures, shaped after GET /workspaces/{ws}/onboarding (04 §3.23) and settings `onboarding.paths` (03 §4.2).
// 04 returns one group per role; 09 §13 asks for the union without duplicates, so an item carries the roles whose path
// holds it and the page lists each item once.
//
// Progress lives here so the sidebar count can read it through `navExtras` in ./index. Pages write through the two
// functions below and then call the kit's `notifyCardStore`.

import type { L, Role } from '../hub-today';

const l = (ar: string, en: string): L => ({ ar, en });

export type StepKind = 'doc' | 'card' | 'url' | 'action';
export type StepPhase = 'read' | 'setup' | 'work';

export interface OnboardingStep {
  id: string;
  kind: StepKind;
  phase: StepPhase;
  roles: Role[];
  title: L;
  /** One line: why this step is on the path. */
  why: L;
  /** Doc path, card key, view name or action id. */
  ref: string;
  minutes?: number;
  /** A command the member runs in Claude Code. */
  command?: string;
  /** Hub ticks this itself when the event arrives; the member cannot tick it. */
  auto?: L;
  /** The view an action step opens. */
  view?: 'settings' | 'tasks' | 'docs';
  query?: Record<string, string>;
}

const ALL: Role[] = ['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa'];
const BUILDERS: Role[] = ['backend', 'frontend', 'designer', 'qa'];
const MONEY: Role[] = ['owner', 'pm', 'accountant'];

/** Every step in reading order. A role's path is the steps naming it; several roles merge without duplicates. */
export const onboardingSteps: OnboardingStep[] = [
  { id: 'what', kind: 'doc', phase: 'read', roles: ALL, title: l('ما هي جوتيف', 'What Goteav is'), why: l('الصورة كلها في خمس دقائق: من نخدم وماذا نبيع.', 'The whole picture in five minutes: who we serve and what we sell.'), ref: 'docs/README.md', minutes: 5 },
  { id: 'arch', kind: 'doc', phase: 'read', roles: BUILDERS, title: l('خريطة السياقات في وثيقة المعمارية', 'The context map in the architecture doc'), why: l('تعرف أين يقع عملك قبل أن تلمس الكود.', 'So you know where your work sits before you touch code.'), ref: 'docs/01-architecture.md', minutes: 15 },
  { id: 'api', kind: 'doc', phase: 'read', roles: ['frontend'], title: l('خطة ربط API في لوحة التحكم', 'The dashboard API integration plan'), why: l('طبقة واحدة لكل الطلبات، ولا توكنات في المتصفح.', 'One layer for every call, and no tokens in the browser.'), ref: 'docs/api-integration/README.md', minutes: 10 },
  { id: 'money', kind: 'doc', phase: 'read', roles: [...MONEY, 'backend'], title: l('الدفع وDuffel في ADR 0005', 'Payments and Duffel in ADR 0005'), why: l('لماذا لا تصل بيانات البطاقة إلى الخادم، ومن أين يُدفع لـDuffel.', 'Why card data never reaches the backend, and where Duffel is paid from.'), ref: 'docs/adr/0005-payments-tokenised-and-duffel-balance.md', minutes: 5 },
  { id: 'safety', kind: 'doc', phase: 'read', roles: [...MONEY, 'backend', 'qa'], title: l('أمان التأكيد، وثيقة 21', 'Confirmation safety, doc 21'), why: l('القاعدة التي تحكم كل استرداد: من يتحمل التكلفة إذا رفضت شركة الطيران.', 'The rule behind every refund: who carries the cost when an airline refuses.'), ref: 'docs/21-confirmation-safety.md', minutes: 12 },
  { id: 'hub', kind: 'doc', phase: 'read', roles: ALL, title: l('كيف يعمل Hub مع Claude Code', 'How Hub works with Claude Code'), why: l('لا يكتب Hub بالذكاء الاصطناعي. جهازك هو من يكتب، عبر MCP.', 'Hub writes no AI text. Your own machine does, through MCP.'), ref: 'docs/05-mcp-and-claude-code.md', minutes: 8 },
  { id: 'pack', kind: 'action', phase: 'setup', roles: ALL, title: l('ثبّت حزمة الفريق', 'Install the team pack'), why: l('الأمر جاهز بتوكنك في صفحة التوكنات. تحتاجه مرة واحدة.', 'The command is ready with your token on the tokens page. You need it once.'), ref: 'install_pack', view: 'settings', query: { tab: 'tokens' }, auto: l('يُعلَّم تلقائيًا عند أول استخدام لتوكنك.', 'Ticks itself the first time your token is used.') },
  { id: 'session', kind: 'action', phase: 'setup', roles: ALL, title: l('شغّل الأمر مرة في Claude Code', 'Run this once in Claude Code'), why: l('يقرأ موجزك ويبدأ أول جلسة باسمك.', 'It reads your brief and starts your first session.'), ref: 'first_session', command: '/hub:start', auto: l('يُعلَّم تلقائيًا عند وصول أول سجل جلسة.', 'Ticks itself when your first session log arrives.') },
  { id: 'notify', kind: 'url', phase: 'setup', roles: ALL, title: l('اختر كيف تصلك التنبيهات', 'Choose how alerts reach you'), why: l('القرارات المتأخرة لا تنتظر حتى تفتح Hub.', 'Overdue decisions should not wait until you open Hub.'), ref: 'settings/notifications', view: 'settings', query: { tab: 'notifications' }, minutes: 2 },
  { id: 'claim', kind: 'action', phase: 'work', roles: BUILDERS, title: l('احجز أول مهمة لك', 'Claim your first task'), why: l('المهام الجاهزة لدورك في صفحة المهام، أو من الأمر /hub:next.', 'Ready tasks for your role are on the Tasks page, or through /hub:next.'), ref: 'first_claim', view: 'tasks', query: { status: 'ready' }, auto: l('يُعلَّم تلقائيًا عند أول حجز.', 'Ticks itself on your first claim.') },
  { id: 'decide', kind: 'card', phase: 'work', roles: MONEY, title: l('راجع القرارات التي تنتظرك', 'Go through the decisions waiting for you'), why: l('الخيارات والتكلفة والموعد في مكان واحد.', 'Options, cost and deadline in one place.'), ref: 'decisions', minutes: 5 },
];

// ── Progress ─────────────────────────────────────────────────────────────────────────────────────

/** Steps each member has done. Sara has 2 left, matching the catalogue's sidebar count; the owner has finished. */
const progress: Record<string, Set<string>> = {
  'u-sara': new Set(['what', 'arch', 'hub', 'pack', 'session', 'claim']),
};

/** Steps of a set of roles, in order, each once. */
export const stepsFor = (roles: Role[]) => onboardingSteps.filter((s) => s.roles.some((r) => roles.includes(r)));

export const isStepDone = (memberId: string, step: OnboardingStep) => (memberId === 'u-owner' ? !ownerOpen.has(step.id) : !!progress[memberId]?.has(step.id));

const ownerOpen = new Set<string>();

/** `POST` / `DELETE …/onboarding/{itemId}/done`. */
export function setStepDone(memberId: string, stepId: string, done: boolean) {
  if (memberId === 'u-owner') {
    if (done) ownerOpen.delete(stepId);
    else ownerOpen.add(stepId);
    return;
  }
  const set = progress[memberId] ?? (progress[memberId] = new Set());
  if (done) set.add(stepId);
  else set.delete(stepId);
}

/** The sidebar's number. */
export const stepsLeft = (memberId: string, roles: Role[]) => stepsFor(roles).filter((s) => !isStepDone(memberId, s)).length;
