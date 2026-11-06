import { useCallback, useState, useSyncExternalStore } from 'react';
import type { Role } from '@lab/mocks/hub-app';
import { docContent } from '@lab/mocks/hub-app/docs';
import { addLink, createCard, fmt, getCard, openCard, patchCard, setArchived, showToast } from './kit';
import { wbMessages } from './strings';
import { versionPrefix } from './store-keys';
import { CREATED_CARD, DEVICES, FOLDER_BRANCH, LIMITS, PAYTR_ALLOW, PAYTR_DENY, REPO_FOLDER, script, seedChats, SEED_RUNS, SEED_TEMPLATES, STEP_LINES, WAITS, type ApprovalRequest, type ChangedFile, type Chat, type DeviceId, type Draft, type Effort, type Item, type L, type Mode, type ModelId, type ProjectId, type Report, type Run, type RunState, type ScriptId, type Stage, DOC_STAGES, TASK_STAGES, type Step, type Template, type TurnEnd, type TurnMeta, type TurnStatus, type Usage } from './mock';

/** The state of the local bridge and of Claude behind it (docs/16 S1 Q8). */
export type EngineState = 'ok' | 'offline' | 'signed_out' | 'limit' | 'unknown';

export interface Attachment {
  kind: 'card' | 'doc' | 'file';
  key: string;
  /** A doc's path or a file's path. A card shows its key. */
  label: string;
}

export interface Revision {
  id: string;
  at: L;
  note: L;
  /** The text of this revision. `undefined` is the indexed text. */
  source?: string;
}
export interface DocState {
  current: string;
  source?: string;
  revisions: Revision[];
}

/** Remembered per device (docs/16 §7.1). Width lives with the layout. */
export interface Prefs {
  defaultMode: Mode;
  tipLevel: 'full' | 'compact';
  follow: boolean;
}

export interface WbState {
  engine: EngineState;
  chats: Chat[];
  activeId: string | null;
  runs: Run[];
  device: DeviceId;
  folder: string;
  project: ProjectId;
  persona: Role;
  /** Usage in the current window, from `rate_limit_info.utilization`. */
  usage: number;
  /** What goes with the next message. */
  attachments: Attachment[];
  /** The open card or doc is left out of the next message. */
  leaveOut: string | null;
  mode: Mode;
  model: ModelId;
  effort: Effort;
  templates: Template[];
  /** Evidence on cards. The sheet reads it. */
  evidence: Record<string, Report[]>;
  docs: Record<string, DocState>;
}

const fromUrl = () => new URLSearchParams(location.hash.split('?')[1] ?? '').get('wb');

const prefKey = (name: string) => `${versionPrefix()}:${name}`;
function readPref<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(prefKey(name));
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function writePref(name: string, value: unknown) {
  try {
    localStorage.setItem(prefKey(name), JSON.stringify(value));
  } catch {
    /* Kept for this session only. */
  }
}

let prefs: Prefs = {
  defaultMode: readPref<Mode>('defaultMode', 'execute'),
  tipLevel: readPref<'full' | 'compact'>('tipLevel', 'full'),
  follow: readPref('follow', true),
};
const prefListeners = new Set<() => void>();
export const usePrefs = () =>
  useSyncExternalStore(
    (fn) => {
      prefListeners.add(fn);
      return () => prefListeners.delete(fn);
    },
    () => prefs,
  );
export function setPref<K extends keyof Prefs>(name: K, value: Prefs[K]) {
  prefs = { ...prefs, [name]: value };
  writePref(name, value);
  prefListeners.forEach((l) => l());
}

const SEED_REPORT: Report = {
  cardKey: 'GTV-262',
  chatId: 'c-invite',
  summary: { ar: 'أُضيفت دعوة الأعضاء ونجحت كل الفحوص. لم يُرفع شيء.', en: 'Member invites are in, and every check passes. Nothing is pushed.' },
  files: [
    { path: 'apps/api/src/invites/invites.service.ts', added: 58, removed: 4 },
    { path: 'apps/web/src/components/members/invite-dialog.tsx', added: 112, removed: 0 },
  ],
  checks: [
    { command: 'pnpm check', passed: true, output: 'typecheck, lint and format: no problems.' },
    { command: 'pnpm test invites', passed: true, output: 'Tests: 12 passed, 12 total' },
  ],
  notChecked: [{ ar: 'وصول البريد الحقيقي: لا يوجد مفتاح بريد بعد.', en: 'Real mail delivery: there is no mail key yet.' }],
};

const withoutSettings = (key: string) => docContent(key).replace(/### 4\.3[\s\S]*?(?=## 5)/, '');

function initial(): WbState {
  const param = fromUrl();
  const engine: EngineState = param === 'offline' || param === 'signed_out' || param === 'limit' || param === 'unknown' ? param : 'ok';
  const chats = seedChats();
  const empty = param === 'empty';
  const stopped = param === 'stopped';
  if (stopped) {
    const fees = chats.find((c) => c.id === 'c-fees')!;
    fees.status = 'stopped';
    fees.items = [...fees.items.filter((i) => i.kind !== 'turn'), { kind: 'notice', id: 'n-stop', tone: 'stopped', text: STOPPED_TEXT }, { kind: 'turn', id: 'turn-stop', meta: { state: 'stopped', mode: 'ask', model: 'sonnet', ms: 9000, steps: 2 } }];
  }
  const open = param && chats.some((c) => c.id === param) ? param : null;
  return {
    engine,
    chats,
    activeId: empty ? null : stopped ? 'c-fees' : (open ?? 'c-paytr'),
    runs: SEED_RUNS.map((r) => ({ ...r })),
    device: chats.find((c) => c.id === open)?.device ?? 'main',
    folder: chats.find((c) => c.id === open)?.folder ?? 'F:/Goteav/backend',
    project: chats.find((c) => c.id === open)?.project ?? 'goteav',
    persona: 'owner',
    usage: engine === 'limit' ? 100 : 62,
    attachments: [],
    leaveOut: null,
    mode: empty ? prefs.defaultMode : (chats.find((c) => c.id === (open ?? 'c-paytr'))?.mode ?? prefs.defaultMode),
    model: chats.find((c) => c.id === (open ?? 'c-paytr'))?.model ?? 'sonnet',
    effort: chats.find((c) => c.id === (open ?? 'c-paytr'))?.effort ?? 'medium',
    templates: SEED_TEMPLATES,
    evidence: { 'GTV-262': [SEED_REPORT] },
    docs: {
      'GTV-180': {
        current: 'r3',
        revisions: [
          { id: 'r3', at: { ar: '3 نوفمبر 14:05', en: '3 Nov 14:05' }, note: { ar: 'إضافة إعدادات الإمساك', en: 'Added the hold settings' } },
          { id: 'r2', at: { ar: '28 أكتوبر 19:10', en: '28 Oct 19:10' }, note: { ar: 'قبل إعدادات الإمساك', en: 'Before the hold settings' }, source: withoutSettings('GTV-180') },
        ],
      },
    },
  };
}

const STOPPED_TEXT: L = { ar: 'أوقفتَ هذا الدور. ما اكتمل قبله باقٍ، ولم يبدأ شيء بعده.', en: 'You stopped this turn. What finished before it stays, and nothing after it started.' };

let state: WbState = initial();
const listeners = new Set<() => void>();
const set = (fn: (s: WbState) => WbState) => {
  state = fn(state);
  listeners.forEach((l) => l());
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const useWb = () => useSyncExternalStore(subscribe, () => state);
export const getWb = () => state;

let nextId = 1;
const uid = (p: string) => `${p}-${nextId++}-${Date.now().toString(36)}`;
const fakeSession = () => `${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 6)}-4${Math.random().toString(16).slice(2, 5)}-a${Math.random().toString(16).slice(2, 5)}-${Math.random().toString(16).slice(2, 14)}`;

const patchChat = (id: string, fn: (c: Chat) => Chat) => set((s) => ({ ...s, chats: s.chats.map((c) => (c.id === id ? fn(c) : c)) }));
const push = (id: string, item: Item) => patchChat(id, (c) => ({ ...c, items: [...c.items, item] }));
const status = (id: string, value: TurnStatus) => patchChat(id, (c) => ({ ...c, status: value }));
const patchRun = (id: string, fn: (r: Run) => Run) => set((s) => ({ ...s, runs: s.runs.map((r) => (r.id === id ? fn(r) : r)) }));
const patchItem = (chatId: string, itemId: string, fn: (i: Item) => Item) => patchChat(chatId, (c) => ({ ...c, items: c.items.map((i) => (i.id === itemId ? fn(i) : i)) }));

// ── The turn player ─────────────────────────────────────────────────────────────────────────────

const turns = new Map<string, { stopped: boolean }>();
const clocks = new Map<string, { start: number; steps: number; files: ChangedFile[] }>();
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const clockOf = (chatId: string) => {
  let clock = clocks.get(chatId);
  if (!clock) {
    clock = { start: Date.now(), steps: 0, files: [] };
    clocks.set(chatId, clock);
  }
  return clock;
};

/** A card opened by "Follow the chat" must not take focus or bring the sheet over the chat on a phone. */
let followedAt = 0;
export const wasFollowOpened = () => Date.now() - followedAt < 800;

function follow(key: string) {
  if (!prefs.follow || !getCard(key)) return;
  const segs = location.hash.split('?')[0].split('/');
  if (segs[4] === key) return;
  followedAt = Date.now();
  openCard(key, { opener: document.activeElement instanceof HTMLElement ? document.activeElement : null });
}

function endTurn(chatId: string, end: TurnEnd, usage: Usage | null | undefined) {
  const chat = state.chats.find((c) => c.id === chatId);
  const clock = clocks.get(chatId);
  if (!chat || !clock) return;
  clocks.delete(chatId);
  const meta: TurnMeta = { state: end, mode: chat.mode, model: chat.model, effort: chat.model === 'haiku' ? undefined : chat.effort, ms: Date.now() - clock.start, steps: clock.steps, files: clock.files.length ? clock.files : undefined };
  if (usage) meta.usage = usage;
  push(chatId, { kind: 'turn', id: uid('turn'), meta });
}

const USUAL: Usage = { input: 4800, output: 520, cacheRead: 21000 };

async function play(chatId: string, steps: Step[]) {
  const token = { stopped: false };
  turns.set(chatId, token);
  clockOf(chatId);
  for (const step of steps) {
    if (token.stopped) return;
    switch (step.t) {
      case 'starting':
        status(chatId, 'starting');
        await sleep(step.ms);
        break;
      case 'thinking':
        status(chatId, 'thinking');
        await sleep(step.ms);
        break;
      case 'tool': {
        status(chatId, 'tool');
        const clock = clockOf(chatId);
        clock.steps += 1;
        const call = { id: uid('call'), name: step.name, detail: step.detail, state: 'running' as const, result: step.result, input: step.input ?? `{ "input": ${JSON.stringify(step.detail)} }`, output: step.output, error: step.error, decision: step.decision };
        patchChat(chatId, (c) => {
          const last = c.items[c.items.length - 1];
          if (last?.kind === 'tools') return { ...c, items: [...c.items.slice(0, -1), { ...last, calls: [...last.calls, call] }] };
          return { ...c, items: [...c.items, { kind: 'tools', id: uid('t'), calls: [call] }] };
        });
        if (step.name === 'mcp__hub__get_card') follow(step.detail);
        await sleep(step.ms);
        if (token.stopped) return;
        if (step.file) clock.files.push(step.file);
        patchChat(chatId, (c) => ({ ...c, items: c.items.map((it) => (it.kind === 'tools' ? { ...it, calls: it.calls.map((x) => (x.id === call.id ? { ...x, state: step.error ? 'failed' : 'ok', ms: step.ms } : x)) } : it)) }));
        break;
      }
      case 'text': {
        status(chatId, 'streaming');
        const id = uid('x');
        push(chatId, { kind: 'text', id, text: step.text, shown: 0 });
        const total = Math.max(step.text.en.length, step.text.ar.length);
        const tick = 40;
        const inc = Math.max(0.012, tick / (total * 11));
        for (let shown = 0; shown < 1; shown += inc) {
          if (token.stopped) return;
          const value = Math.min(1, shown + inc);
          patchChat(chatId, (c) => ({ ...c, items: c.items.map((it) => (it.id === id && it.kind === 'text' ? { ...it, shown: value } : it)) }));
          await sleep(tick);
        }
        break;
      }
      case 'approval':
        pendings.set(step.request.id, { allow: step.allow, deny: step.deny });
        status(chatId, 'waiting');
        push(chatId, { kind: 'approval', id: uid('a'), request: step.request });
        return; // Waits for the owner. Answering plays the branch.
      case 'card': {
        const created = createCard({ type: 'task', title: CREATED_CARD.title.en, ownerRole: 'backend', priority: 'P1', body: CREATED_CARD.body.en, memberId: 'u-owner' });
        patchCard(created.key, (card) => ({ ...card, title: CREATED_CARD.title, body: CREATED_CARD.body, createdByKind: 'agent', createdVia: 'mcp' }));
        push(chatId, { kind: 'card', id: uid('c'), cardKey: created.key });
        const dict = wbMessages[document.documentElement.lang === 'en' ? 'en' : 'ar'];
        showToast({ message: fmt(dict.card.undo, { key: created.key }), onUndo: () => setArchived(created.key, 'u-owner', true) });
        break;
      }
      case 'run': {
        const runId = state.chats.find((c) => c.id === chatId)?.runId;
        if (runId) patchRun(runId, (r) => ({ ...r, state: step.state, when: step.when, summary: step.summary, command: undefined, step: undefined }));
        break;
      }
      case 'notice':
        push(chatId, { kind: 'notice', id: uid('n'), tone: step.tone, text: step.text });
        break;
      case 'protocol': {
        const ids = step.protocol === 'task' ? TASK_STAGES : DOC_STAGES;
        const stages: Stage[] = ids.map((id) => ({ id, state: 'pending' }));
        push(chatId, { kind: 'protocol', id: uid('proto'), protocol: step.protocol, target: step.target, stages });
        break;
      }
      case 'stage':
        patchChat(chatId, (c) => {
          const at = [...c.items].reverse().find((i) => i.kind === 'protocol');
          if (!at) return c;
          return { ...c, items: c.items.map((i) => (i.id === at.id && i.kind === 'protocol' ? { ...i, stages: i.stages.map((g) => (g.id === step.id ? { ...g, state: step.state, note: step.note ?? g.note } : g)) } : i)) };
        });
        await sleep(160);
        break;
      case 'plan':
        push(chatId, { kind: 'plan', id: uid('plan'), plan: step.plan });
        break;
      case 'report': {
        const report: Report = { ...step.report, chatId };
        push(chatId, { kind: 'report', id: uid('rep'), report });
        addEvidence(report);
        break;
      }
      case 'choice': {
        const id = uid('ch');
        branches.set(id, step.branches);
        endTurn(chatId, 'done', USUAL);
        status(chatId, 'idle');
        push(chatId, { kind: 'choice', id, choice: step.choice });
        turns.delete(chatId);
        return;
      }
      case 'draft': {
        const id = uid('dr');
        drafts.set(id, { onSave: step.onSave, onDiscard: step.onDiscard });
        endTurn(chatId, 'done', USUAL);
        status(chatId, 'idle');
        push(chatId, { kind: 'draft', id, draft: step.draft });
        turns.delete(chatId);
        return;
      }
      case 'saved':
        applySave(chatId, step.docKey, step.path);
        break;
      case 'links':
        endTurn(chatId, 'done', USUAL);
        status(chatId, 'idle');
        push(chatId, { kind: 'links', id: uid('ln'), docKey: step.docKey, keys: step.keys });
        turns.delete(chatId);
        return;
      case 'gaps':
        push(chatId, { kind: 'gaps', id: uid('gap'), report: step.report });
        break;
      case 'blocked':
        push(chatId, { kind: 'blocked', id: uid('blk'), text: step.text, wanted: step.wanted });
        break;
      case 'end':
        endTurn(chatId, step.state ?? 'done', step.usage === undefined ? USUAL : step.usage);
        break;
    }
  }
  endTurn(chatId, 'done', USUAL);
  status(chatId, 'idle');
  turns.delete(chatId);
  startNextRun();
}

const pendings = new Map<string, { allow: Step[]; deny: Step[] }>([['a-paytr', { allow: PAYTR_ALLOW, deny: PAYTR_DENY }]]);
const branches = new Map<string, Record<string, Step[]>>();
const drafts = new Map<string, { onSave: Step[]; onDiscard: Step[] }>();

function addEvidence(report: Report) {
  set((s) => ({ ...s, evidence: { ...s.evidence, [report.cardKey]: [report, ...(s.evidence[report.cardKey] ?? [])] } }));
  const at = new Date().toISOString();
  patchCard(report.cardKey, (card) => ({
    ...card,
    lastEventAt: at,
    events: [...card.events, { id: uid('ev'), seq: card.events.length + 1, kind: 'commented', actorKind: 'agent', actorId: 'u-owner', via: 'mcp', at, data: { excerpt: report.partial ? 'Claude: stopped at Verify, note added' : 'Claude: report added as evidence' } }],
  }));
}

// ── Actions the interface calls ─────────────────────────────────────────────────────────────────

export interface SendOptions {
  text: string | L;
  script?: ScriptId;
  context?: { view?: string; cardKey?: string; action?: string; path?: string };
  skill?: string;
  /** Start in a new chat rather than the open one. */
  fresh?: boolean;
  title?: L;
  /** The mode this turn needs, shown in the switch as it changes. */
  mode?: Mode;
  /** A canned reply for a suggested prompt. */
  reply?: L;
  folder?: string;
}

const scriptFor = (text: string): ScriptId => {
  const t = text.toLowerCase();
  if (t.includes('git push') || t.includes('push') || t.includes('ارفع')) return 'push';
  if (t.includes('repopath') || t.includes('folder') || t.includes('مجلد')) return 'folders';
  if (t.includes('card') || t.includes('task') || t.includes('بطاقة') || t.includes('مهمة')) return 'create';
  if (t.includes('/hub:next')) return 'next';
  if (t.includes('/hub:suggest')) return 'suggest';
  return 'free';
};

const WRITES = new Set<ScriptId>(['push', 'folders', 'create', 'taskPass', 'taskFail', 'runwork']);
const titleOf = (text: string | L): L => (typeof text === 'string' ? { ar: text.slice(0, 40), en: text.slice(0, 40) } : text);

function newChatRecord(s: WbState, opts: { title: L; folder?: string; mode: Mode; runId?: string }): Chat {
  const folder = opts.folder ?? s.folder;
  return { id: uid('c'), project: s.project, title: opts.title, device: s.device, folder, persona: s.persona, at: { ar: 'الآن', en: 'Now' }, items: [], status: 'idle', mode: opts.mode, model: s.model, effort: s.effort, session: fakeSession(), branch: FOLDER_BRANCH[folder], started: { ar: 'الآن', en: 'Now' }, runId: opts.runId };
}

export function send(opts: SendOptions) {
  const s = state;
  if (s.engine !== 'ok') return;
  const mode = opts.mode ?? s.mode;
  let chatId = opts.fresh ? null : s.activeId;
  const current = chatId ? s.chats.find((c) => c.id === chatId) : null;
  // One turn per chat (docs/16 §7): a busy chat keeps its turn, and this goes to a new one.
  if (current && current.status !== 'idle' && current.status !== 'stopped') chatId = null;
  const cold = !chatId;
  if (!chatId) {
    const chat = newChatRecord(s, { title: opts.title ?? titleOf(opts.text), folder: opts.folder, mode });
    chatId = chat.id;
    set((st) => ({ ...st, chats: [chat, ...st.chats], activeId: chat.id, folder: chat.folder }));
  } else {
    patchChat(chatId, (c) => ({ ...c, mode, model: s.model, effort: s.effort, status: 'idle', session: c.session ?? fakeSession() }));
  }
  set((st) => ({ ...st, mode }));
  const key = opts.context?.cardKey ?? 'GTV-259';
  const card = getCard(key);
  // Attached things travel with this one message, then the tray is clear again.
  const more = s.attachments.map((a) => a.label).filter((k) => k !== opts.context?.cardKey);
  const typed = typeof opts.text === 'string';
  let id = opts.script ?? (typed ? scriptFor(opts.text as string) : 'free');
  if (mode !== 'execute' && WRITES.has(id)) id = 'blocked';
  else if (mode === 'plan' && id === 'free') id = 'plan';
  push(chatId, { kind: 'user', id: uid('u'), text: opts.text, context: more.length ? { ...opts.context, more } : opts.context, skill: opts.skill, script: id });
  if (s.attachments.length || s.leaveOut) set((st) => ({ ...st, attachments: [], leaveOut: null }));
  void play(chatId, script(id, { key: opts.context?.view && !opts.context.cardKey ? opts.context.view : key, title: card && opts.context?.cardKey ? card.title : { ar: opts.context?.view ?? key, en: opts.context?.view ?? key }, reply: opts.reply, folder: opts.folder ?? s.folder, path: opts.context?.path, mode }, cold));
}

export function stopTurn(chatId: string) {
  const token = turns.get(chatId);
  if (token) token.stopped = true;
  turns.delete(chatId);
  patchChat(chatId, (c) => ({
    ...c,
    status: 'stopped',
    items: [
      ...c.items.map((it): Item => {
        if (it.kind === 'tools') return { ...it, calls: it.calls.map((x) => (x.state === 'running' ? { ...x, state: 'stopped' } : x)) };
        if (it.kind === 'approval' && it.request.state === 'pending') return { ...it, request: { ...it.request, state: 'cancelled' } };
        if (it.kind === 'protocol') return { ...it, stages: it.stages.map((g) => (g.state === 'running' ? { ...g, state: 'skipped' } : g)) };
        return it;
      }),
      { kind: 'notice', id: uid('n'), tone: 'stopped', text: STOPPED_TEXT },
    ],
  }));
  // No usage: an interrupt's `result` was seen in S1 without a check that it carries any, so this turn shows none.
  endTurn(chatId, 'stopped', null);
  startNextRun();
}

export function retryTurn(chatId: string) {
  const chat = state.chats.find((c) => c.id === chatId);
  const last = chat ? [...chat.items].reverse().find((i): i is Extract<Item, { kind: 'user' }> => i.kind === 'user') : null;
  if (!chat || !last || (chat.status !== 'idle' && chat.status !== 'stopped')) return;
  openChat(chatId);
  send({ text: last.text, script: last.script, context: last.context, skill: last.skill });
}

export function answerApproval(chatId: string, request: ApprovalRequest, allow: boolean) {
  patchChat(chatId, (c) => ({ ...c, items: c.items.map((it) => (it.kind === 'approval' && it.request.id === request.id ? { ...it, request: { ...it.request, state: allow ? 'allowed' : 'denied' } } : it)) }));
  const branch = pendings.get(request.id);
  pendings.delete(request.id);
  if (!allow) push(chatId, { kind: 'notice', id: uid('n'), tone: 'denied', text: { ar: 'رفضتَ. وصل الرفض إلى Claude ولم يُنفّذ الأمر.', en: 'You denied this. Claude was told, and the command never ran.' } });
  const chat = state.chats.find((c) => c.id === chatId);
  if (chat?.runId && allow) patchRun(chat.runId, (r) => ({ ...r, state: 'running', command: undefined, when: undefined, step: { ar: 'يرفع الفرع', en: 'Pushing the branch' } }));
  void play(chatId, branch ? (allow ? branch.allow : branch.deny) : []);
}

/** The owner's answer to a proposal, a failed check or a conflict. */
export function answerChoice(chatId: string, itemId: string, optionId: string) {
  patchItem(chatId, itemId, (i) => (i.kind === 'choice' ? { ...i, choice: { ...i.choice, chosen: optionId } } : i));
  const steps = branches.get(itemId)?.[optionId];
  branches.delete(itemId);
  if (steps) void play(chatId, steps);
}

export function runPlan(chatId: string, itemId: string) {
  patchItem(chatId, itemId, (i) => (i.kind === 'plan' ? { ...i, plan: { ...i.plan, state: 'running' } } : i));
  const chat = state.chats.find((c) => c.id === chatId);
  setMode('execute');
  const user = chat?.items.find((i): i is Extract<Item, { kind: 'user' }> => i.kind === 'user');
  const key = user?.context?.cardKey ?? 'GTV-288';
  openChat(chatId);
  send({ text: { ar: `نفّذ الخطة على ${key}.`, en: `Run the plan for ${key}.` }, script: 'taskPass', context: { cardKey: key }, mode: 'execute', folder: chat?.folder });
}
export const setPlanState = (chatId: string, itemId: string, value: 'scheduled' | 'set_aside') => patchItem(chatId, itemId, (i) => (i.kind === 'plan' ? { ...i, plan: { ...i.plan, state: value } } : i));

// Doc protocol ───────────────────────────────────────────────────────────────────────────────────

export function setFlag(chatId: string, itemId: string, flagId: string, value: 'confirmed' | 'left_out') {
  patchItem(chatId, itemId, (i) => (i.kind === 'draft' ? { ...i, draft: { ...i.draft, flags: i.draft.flags.map((f) => (f.id === flagId ? { ...f, state: value } : f)) } } : i));
}

export function saveDraft(chatId: string, itemId: string) {
  const answer = drafts.get(itemId);
  patchItem(chatId, itemId, (i) => (i.kind === 'draft' ? { ...i, draft: { ...i.draft, state: 'saved' } } : i));
  drafts.delete(itemId);
  if (answer) void play(chatId, answer.onSave);
}
export function discardDraft(chatId: string, itemId: string) {
  const answer = drafts.get(itemId);
  patchItem(chatId, itemId, (i) => (i.kind === 'draft' ? { ...i, draft: { ...i.draft, state: 'discarded' } } : i));
  drafts.delete(itemId);
  if (answer) void play(chatId, answer.onDiscard);
}

/** The text a draft adds: a flag still open stays marked as unverified, and one left out is gone. */
const draftText = (draft: Draft) =>
  draft.lines
    .filter((l) => l.t === 'add')
    .flatMap((l) => {
      const flag = l.flag ? draft.flags.find((f) => f.id === l.flag) : undefined;
      if (flag?.state === 'left_out') return [];
      if (flag?.state === 'open') return [`> **Not verified:** ${l.text}`];
      return [l.text];
    })
    .join('\n');

function applySave(chatId: string, docKey: string, path: string) {
  const chat = state.chats.find((c) => c.id === chatId);
  const draft = chat ? [...chat.items].reverse().find((i): i is Extract<Item, { kind: 'draft' }> => i.kind === 'draft')?.draft : undefined;
  const doc = state.docs[docKey] ?? { current: 'r1', revisions: [{ id: 'r1', at: { ar: 'سابقًا', en: 'Earlier' }, note: { ar: 'النص المفهرس', en: 'The indexed text' } }] };
  const base = doc.source ?? docContent(docKey);
  const text = draft ? draftText(draft) : '';
  const nextSource = draft?.before && base.includes(draft.before) ? base.replace(draft.before, `${text}\n\n${draft.before}`) : `${base}\n${text}\n`;
  const previous = doc.current;
  const n = Number(previous.slice(1)) + 1;
  const revision = `r${n}`;
  const entry: Revision = { id: revision, at: { ar: 'الآن', en: 'Now' }, note: { ar: 'مسودة من Claude بموافقتك', en: 'A draft from Claude, with your approval' }, source: nextSource };
  const kept = doc.revisions.map((r) => (r.id === previous ? { ...r, source: doc.source ?? r.source } : r));
  if (docKey) set((s) => ({ ...s, docs: { ...s.docs, [docKey]: { current: revision, source: nextSource, revisions: [entry, ...kept] } } }));
  push(chatId, { kind: 'saved', id: uid('sv'), docKey, path, revision, previous });
}

/** Restoring keeps today's text as a revision too, so a restore can itself be undone. */
export function restoreRevision(docKey: string, revisionId: string, locale: 'ar' | 'en', onDone?: () => void) {
  const doc = state.docs[docKey];
  const target = doc?.revisions.find((r) => r.id === revisionId);
  if (!doc || !target) return;
  const before = doc;
  const n = Math.max(...doc.revisions.map((r) => Number(r.id.slice(1)))) + 1;
  const entry: Revision = { id: `r${n}`, at: { ar: 'الآن', en: 'Now' }, note: { ar: `استرجاع ${revisionId}`, en: `Restored ${revisionId}` }, source: target.source };
  set((s) => ({ ...s, docs: { ...s.docs, [docKey]: { current: entry.id, source: target.source, revisions: [entry, ...doc.revisions] } } }));
  onDone?.();
  const t = wbMessages[locale];
  showToast({ message: fmt(t.doc.restored, { rev: revisionId }), onUndo: () => set((s) => ({ ...s, docs: { ...s.docs, [docKey]: before } })) });
}
export const markRestored = (chatId: string, itemId: string) => patchItem(chatId, itemId, (i) => (i.kind === 'saved' ? { ...i, restored: true } : i));

export function linkDoc(chatId: string, itemId: string, docKey: string, keys: string[]) {
  if (docKey) keys.forEach((k) => addLink(docKey, 'u-owner', 'relates', k));
  patchItem(chatId, itemId, (i) => (i.kind === 'links' ? { ...i, keys, done: true } : i));
  patchChat(chatId, (c) => {
    const at = [...c.items].reverse().find((i) => i.kind === 'protocol');
    return { ...c, items: c.items.map((i) => (i.id === at?.id && i.kind === 'protocol' ? { ...i, stages: i.stages.map((g) => (g.id === 'link' ? { ...g, state: 'done', note: { ar: `رُبطت ${keys.length} بطاقة.`, en: `Linked ${keys.length} cards.` } } : g)) } : i)) };
  });
}

// Starting the protocols ─────────────────────────────────────────────────────────────────────────

export const folderOfCard = (key: string) => {
  const card = getCard(key);
  return REPO_FOLDER[card?.repo ?? ''] ?? 'F:/Goteav/backend';
};
export const folderHeld = (s: WbState, folder: string) => s.runs.find((r) => r.folder === folder && (r.state === 'running' || r.state === 'waiting'));

export function startTask(key: string, fail = false) {
  if (state.engine !== 'ok') return;
  const folder = folderOfCard(key);
  send({ text: { ar: `نفّذ ${key} بخطوات المهمة.`, en: `Do ${key} with the task steps.` }, skill: '/hub:do-task', script: fail ? 'taskFail' : 'taskPass', context: { cardKey: key, action: 'run' }, fresh: true, title: { ar: `تنفيذ ${key}`, en: `Do ${key}` }, mode: 'execute', folder });
}
export function startDoc(kind: 'improve' | 'conflict' | 'document' | 'gaps', target?: { key: string; path?: string }) {
  if (state.engine !== 'ok') return;
  const key = target?.key ?? '';
  const by = {
    improve: { ar: `حسّن هذه الوثيقة: \u2066${target?.path ?? key}\u2069`, en: `Improve this doc: ${target?.path ?? key}`, script: 'docImprove' as const },
    conflict: { ar: `حسّن هذه الوثيقة: \u2066${target?.path ?? key}\u2069`, en: `Improve this doc: ${target?.path ?? key}`, script: 'docConflict' as const },
    document: { ar: `وثّق هذه المهمة: \u2066${key}\u2069`, en: `Document this task: ${key}`, script: 'docDocument' as const },
    gaps: { ar: 'ابحث عن النواقص في الوثائق', en: 'Find gaps in the docs', script: 'gaps' as const },
  }[kind];
  // Reading is free, and writing asks at Save, so a doc turn runs in Execute without taking anything for granted.
  send({ text: { ar: by.ar, en: by.en }, skill: kind === 'gaps' ? '/hub:find-gaps' : '/hub:write-doc', script: by.script, context: key ? { cardKey: key, path: target?.path, action: kind } : { view: 'docs', action: kind }, fresh: true, title: target?.path ? { ar: `وثيقة: \u2066${target.path.split('/').pop()}\u2069`, en: `Doc: ${target.path.split('/').pop()}` } : { ar: by.ar, en: by.en }, mode: kind === 'gaps' ? 'ask' : 'execute' });
}

export function setMode(mode: Mode) {
  set((s) => ({ ...s, mode, chats: s.chats.map((c) => (c.id === s.activeId ? { ...c, mode } : c)) }));
}
export const setModel = (model: ModelId) => set((s) => ({ ...s, model }));
export const setEffort = (effort: Effort) => set((s) => ({ ...s, effort }));

export function openChat(id: string | null) {
  set((s) => {
    const chat = s.chats.find((c) => c.id === id);
    return { ...s, activeId: id, mode: chat ? chat.mode : prefs.defaultMode, model: chat ? chat.model : s.model, effort: chat ? chat.effort : s.effort, folder: chat ? chat.folder : s.folder, device: chat ? chat.device : s.device, project: chat ? chat.project : s.project };
  });
}
export const newChat = () => openChat(null);
export const setEngine = (engine: EngineState) => set((s) => ({ ...s, engine, usage: engine === 'limit' ? 100 : 62 }));
export const setDevice = (device: DeviceId) => set((s) => ({ ...s, device }));
export const setFolder = (folder: string, project?: ProjectId) => set((s) => ({ ...s, folder, project: project ?? s.project }));
export const setPersona = (persona: Role) => set((s) => ({ ...s, persona }));

export const attach = (a: Attachment) => set((s) => (s.attachments.some((x) => x.key === a.key) ? s : { ...s, attachments: [...s.attachments, a] }));
export const detach = (key: string) => set((s) => ({ ...s, attachments: s.attachments.filter((a) => a.key !== key) }));
export const setLeaveOut = (key: string | null) => set((s) => ({ ...s, leaveOut: key }));

export function togglePin(id: string) {
  patchChat(id, (c) => ({ ...c, pinned: !c.pinned }));
}

/** A new chat from Hub's own copy, up to this message. Claude receives a summary of it: a session cannot resume from the middle. */
export function branchFrom(chatId: string, itemId: string) {
  const s = state;
  const chat = s.chats.find((c) => c.id === chatId);
  if (!chat) return;
  const at = chat.items.findIndex((i) => i.id === itemId);
  const items = chat.items.slice(0, at + 1).filter((i) => i.kind !== 'approval' && i.kind !== 'choice' && i.kind !== 'draft');
  const user = chat.items[at];
  const message: L = user?.kind === 'user' ? titleOf(user.text) : chat.title;
  const fresh: Chat = { ...newChatRecord(s, { title: { ar: `فرع: ${chat.title.ar}`, en: `Branch: ${chat.title.en}` }, folder: chat.folder, mode: chat.mode }), items, session: undefined, from: { title: chat.title, message }, project: chat.project, model: chat.model, effort: chat.effort };
  set((st) => ({ ...st, chats: [fresh, ...st.chats], activeId: fresh.id }));
}

export function exportMarkdown(chat: Chat, locale: 'ar' | 'en') {
  const said = (t: string | L) => (typeof t === 'string' ? t : t[locale]);
  const lines = [`# ${chat.title[locale]}`, '', `- Folder: \`${chat.folder}\``, chat.branch ? `- Branch: \`${chat.branch}\`` : '', chat.session ? `- Session: \`${chat.session}\`` : '', ''].filter((x, i) => x || i < 2 || i === 5);
  for (const it of chat.items) {
    if (it.kind === 'user') lines.push(`## You`, '', said(it.text), '');
    else if (it.kind === 'text') lines.push(`## Claude`, '', it.text[locale], '');
    else if (it.kind === 'tools') lines.push(...it.calls.map((c) => `- \`${c.name}\` \`${c.detail}\`${c.error ? ' (failed)' : ''}`), '');
    else if (it.kind === 'approval') lines.push(`> Approval: \`${it.request.command}\`: ${it.request.state}`, '');
    else if (it.kind === 'notice') lines.push(`> ${it.text[locale]}`, '');
    else if (it.kind === 'plan') lines.push(`## Plan: ${it.plan.title[locale]}`, '', ...it.plan.steps.map((p, i) => `${i + 1}. ${p[locale]}`), '');
    else if (it.kind === 'report') lines.push(`## Report on ${it.report.cardKey}`, '', it.report.summary[locale], '', ...it.report.checks.map((c) => `- \`${c.command}\`: ${c.passed ? 'passed' : 'failed'}`), '');
  }
  return lines.join('\n');
}

export function deleteChat(id: string, undoLabel: L, locale: 'ar' | 'en') {
  const wasActive = state.activeId === id;
  patchChat(id, (c) => ({ ...c, deleted: true }));
  if (wasActive) openChat(null);
  showToast({
    message: undoLabel[locale],
    onUndo: () => {
      patchChat(id, (c) => ({ ...c, deleted: false }));
      if (wasActive) openChat(id);
    },
  });
}

export const archiveCreated = (key: string, memberId: string, archived: boolean) => setArchived(key, memberId, archived);

export function saveTemplate(name: string, text: string) {
  set((s) => ({ ...s, templates: [...s.templates, { id: uid('tpl'), project: s.project, name: { ar: name, en: name }, text: { ar: text, en: text } }] }));
}
export const removeTemplate = (id: string) => set((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) }));

// ── Queue ───────────────────────────────────────────────────────────────────────────────────────

const activeRuns = (s: WbState) => s.runs.filter((r) => r.state === 'running' || r.state === 'waiting');

function beginRun(runId: string) {
  const s = state;
  const run = s.runs.find((r) => r.id === runId);
  if (!run) return;
  const chat = newChatRecord(s, { title: { ar: `تشغيل: ${run.title.ar}`, en: `Run: ${run.title.en}` }, folder: run.folder, mode: 'execute', runId });
  chat.items = [{ kind: 'user', id: uid('u'), text: run.cardKey ? { ar: `نفّذ ${run.cardKey}.`, en: `Do ${run.cardKey}.` } : run.title, context: run.cardKey ? { cardKey: run.cardKey } : undefined }];
  set((st) => ({ ...st, chats: [chat, ...st.chats], runs: st.runs.map((r) => (r.id === runId ? { ...r, state: 'running', chatId: chat.id, when: undefined, step: { ar: 'يبدأ Claude في المجلد', en: 'Starting Claude in the folder' } } : r)) }));
  const card = run.cardKey ? getCard(run.cardKey) : undefined;
  void play(chat.id, script('runwork', { key: run.cardKey ?? run.title.en, title: card?.title ?? run.title }, true));
}

/** The next run in line starts when the slot and its folder are free (docs/16 §9). */
export function startNextRun() {
  const s = state;
  if (s.engine !== 'ok' || activeRuns(s).length >= LIMITS.atOnce) return;
  const next = s.runs.find((r) => r.state === 'next' && !folderHeld(s, r.folder));
  if (next) window.setTimeout(() => beginRun(next.id), 800);
}

export function runNow(opts: { title: L; cardKey?: string; folder: string }): RunState {
  const s = state;
  const held = !!folderHeld(s, opts.folder);
  const blocked = held || activeRuns(s).length >= LIMITS.atOnce || s.engine === 'limit';
  const id = uid('r');
  if (blocked) {
    const run: Run = { id, title: opts.title, cardKey: opts.cardKey, folder: opts.folder, state: 'next', when: held ? WAITS.folder : WAITS.slot };
    set((st) => ({ ...st, runs: [...st.runs, run] }));
    return 'next';
  }
  const run: Run = { id, title: opts.title, cardKey: opts.cardKey, folder: opts.folder, state: 'next' };
  set((st) => ({ ...st, runs: [...st.runs, run] }));
  beginRun(id);
  return 'running';
}

export function schedule(opts: { title: L; cardKey?: string; folder: string; when: L; repeat: boolean }) {
  const run: Run = { id: uid('r'), title: opts.title, cardKey: opts.cardKey, folder: opts.folder, state: 'scheduled', when: opts.when, repeat: opts.repeat };
  set((st) => ({ ...st, runs: [...st.runs, run] }));
  return run.id;
}

export const setRunState = (id: string, next: RunState) => patchRun(id, (r) => ({ ...r, state: next }));
export function removeRun(id: string) {
  const before = state.runs;
  set((st) => ({ ...st, runs: st.runs.filter((r) => r.id !== id) }));
  return () => set((st) => ({ ...st, runs: before }));
}

export const runNeedsYou = (s: WbState) => s.runs.filter((r) => r.state === 'waiting').length;
export const runActive = (s: WbState) => s.runs.filter((r) => r.state === 'running').length;

/** Anything in any chat that waits for the owner: the count every direction must keep visible while the panel is closed. */
export const approvalsPending = (s: WbState) => s.chats.reduce((n, c) => n + c.items.filter((it) => it.kind === 'approval' && it.request.state === 'pending').length, 0);

export const firstWaitingChat = (s: WbState) => s.chats.find((c) => c.items.some((it) => it.kind === 'approval' && it.request.state === 'pending'));

// A running run keeps moving so the panel never looks staged.
let stepIndex = 0;
window.setInterval(() => {
  const run = state.runs.find((r) => r.state === 'running' && r.cardKey === 'GTV-260');
  if (!run) return;
  stepIndex = (stepIndex + 1) % STEP_LINES.length;
  patchRun(run.id, (r) => ({ ...r, step: STEP_LINES[stepIndex] }));
}, 4200);

// ── Remembered sizes ────────────────────────────────────────────────────────────────────────────

/** Per device by nature: localStorage. Blocked storage (private window, lab iframe) falls back to the default. */
export function useRemembered<T>(name: string, fallback: T): [T, (value: T) => void] {
  const key = `${versionPrefix()}:${name}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  });
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* Kept for this session only. */
      }
    },
    [key],
  );
  return [value, update];
}

export const deviceOf = (id: DeviceId) => DEVICES.find((d) => d.id === id)!;
