import { useCallback, useState, useSyncExternalStore } from 'react';
import type { Role } from '@lab/mocks/hub-app';
import { docContent } from '@lab/mocks/hub-app/docs';
import { actOn, addLink, createCard, fmt, getCard, openCard, patchCard, setArchived, showToast } from './kit';
import { wbMessages } from './strings';
import { versionPrefix } from './store-keys';
import { CREATED_CARD, DEVICES, FOLDER_BRANCH, LIMITS, PAYTR_ALLOW, PAYTR_DENY, REPO_FOLDER, script, seedChats, SEED_RUNS, SEED_TEMPLATES, STEP_LINES, WAITS, type ApprovalRequest, type ChangedFile, type Chat, type DeviceId, type Draft, type Effort, type Item, type L, type Mode, type ModelId, type ProjectId, type ReportedCheck, type Report, type Run, type RunState, type ScriptId, type Stage, DOC_STAGES, TASK_STAGES, type Step, type Template, type ToolCall, type TurnEnd, type TurnFailure, type TurnMeta, type TurnStatus, type Usage } from './mock';

/** The state of the local bridge and of Claude behind it (docs/16 S1 Q8, `TURN_FAILURES` in the contract, D53). */
export type EngineState = 'ok' | 'offline' | 'revoked' | 'signed_out' | 'limit' | 'limit_open' | 'unknown' | 'version_new' | 'version_old' | 'claude_missing' | 'billing' | 'overloaded' | 'session_missing' | 'folder_not_allowed' | 'folder_missing' | 'unreadable';
export const ENGINE_STATES: Exclude<EngineState, 'ok'>[] = ['offline', 'revoked', 'signed_out', 'limit', 'limit_open', 'unknown', 'version_new', 'version_old', 'claude_missing', 'billing', 'overloaded', 'session_missing', 'folder_not_allowed', 'folder_missing', 'unreadable'];
/** `honestStateOf` in `features/chat/live.ts`, one table: these have `composer: false`. Every other state has ended a turn or warns, and a new message may try. */
const BLOCKING = new Set<EngineState>(['offline', 'revoked', 'signed_out', 'limit', 'version_old', 'claude_missing']);
export const engineBlocks = (engine: EngineState) => BLOCKING.has(engine);
/** The reason a control is off, or none. A warning or a finished failure does not turn anything off. */
export const engineOff = (engine: EngineState): Extract<EngineState, 'offline' | 'revoked' | 'signed_out' | 'limit' | 'version_old' | 'claude_missing'> | null => (BLOCKING.has(engine) ? (engine as 'offline') : null);
const TURN_FAILURE: Partial<Record<EngineState, TurnFailure>> = { revoked: 'device_offline', signed_out: 'signed_out', limit: 'rate_limited', limit_open: 'rate_limited', unknown: 'unknown', version_old: 'version_out_of_range', claude_missing: 'claude_missing', billing: 'billing', overloaded: 'overloaded', session_missing: 'session_missing', folder_not_allowed: 'folder_not_allowed', folder_missing: 'folder_missing', unreadable: 'unreadable_event' };
/** A warning about a newer version does not end anything (D53). */
const endsTurn = (engine: EngineState) => engine !== 'ok' && engine !== 'version_new';

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
  /** The one-time line that tells a touch user how to get explanations. */
  hintSeen: boolean;
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
  /** The last request to bring something into view. The panel opens and the thread scrolls to it. */
  reveal: { chatId: string; kind: 'approval' | 'step'; stepId?: string; tick: number } | null;
  /** A suggestion waiting in the composer. */
  fill: { text: string; run?: () => void; tick: number } | null;
  /** The card "Follow the chat" opened by itself. */
  followed: string | null;
  /** The card Follow would have opened, had the page kept its room. The composer offers it (D54). */
  followOffer: string | null;
  /** The page has stepped aside for the sheet. */
  pageAside: boolean;
  /** The last "Check again" that found the same state. */
  checked: { at: string; signIn?: boolean } | null;
  checking: boolean;
}

const hashParams = () => new URLSearchParams(location.hash.split('?')[1] ?? '');
const fromUrl = () => hashParams().get('wb');
/** Prototype only: `?wbfast=1` shortens the 8 to 10 s start, so a long walk through the flows stays short. */
const fast = () => hashParams().get('wbfast') === '1';
/** S1 measured 8 to 10 s before anything arrives on a process with approvals on. */
const STARTING_MS = 8500;

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
  hintSeen: readPref('hintSeen', false),
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

/** A report from a VS Code chat: no step there can be verified, so its checks are claimed and it never moves by itself (§7.2). */
const SEED_REPORT: Report = {
  id: 'rep-seed',
  cardKey: 'GTV-262',
  origin: 'outside_panel',
  chatId: null,
  summary: { ar: 'أُضيفت دعوة الأعضاء ونجحت كل الفحوص. لم يُرفع شيء.', en: 'Member invites are in, and every check passes. Nothing is pushed.' },
  changedFiles: [
    { path: 'apps/api/src/invites/invites.service.ts', source: 'claimed' },
    { path: 'apps/web/src/components/members/invite-dialog.tsx', source: 'claimed' },
  ],
  filesFrom: 'claimed',
  checks: [
    { name: 'check', command: 'pnpm check', stepId: null, outcome: 'passed', note: null, verified: false, basis: 'outside_panel', runs: [] },
    { name: 'test', command: 'pnpm test invites', stepId: null, outcome: 'passed', note: null, verified: false, basis: 'outside_panel', runs: [] },
  ],
  notChecked: [{ ar: 'وصول البريد الحقيقي: لا يوجد مفتاح بريد بعد.', en: 'Real mail delivery: there is no mail key yet.' }],
  droppedChecks: [],
  counts: { total: 2, passed: 2, failed: 0, skipped: 0, verified: 0, failedRuns: 0 },
  move: { moved: false, reason: 'outside_panel', from: null, to: null },
  reportedAt: '2026-11-06T10:40:00.000Z',
};

const withoutSettings = (key: string) => docContent(key).replace(/### 4\.3[\s\S]*?(?=## 5)/, '');

const hasEngine = (v: string | null): v is Exclude<EngineState, 'ok'> => ENGINE_STATES.includes(v as never);

function initial(): WbState {
  const param = fromUrl();
  const engine: EngineState = hasEngine(param) ? param : 'ok';
  const chats = seedChats();
  const empty = param === 'empty';
  const stopped = param === 'stopped';
  if (stopped) {
    const fees = chats.find((c) => c.id === 'c-fees')!;
    fees.status = 'stopped';
    fees.items = [...fees.items.filter((i) => i.kind !== 'turn'), { kind: 'notice', id: 'n-stop', tone: 'stopped', text: STOPPED_TEXT }, { kind: 'turn', id: 'turn-stop', meta: { state: 'stopped', mode: 'ask', model: 'sonnet', ms: 9000, steps: 2 } }];
  }
  const open = param && chats.some((c) => c.id === param) ? param : null;
  const runs = SEED_RUNS.map((r) => ({ ...r }));
  const base: WbState = {
    engine,
    chats,
    activeId: empty ? null : stopped ? 'c-fees' : (open ?? 'c-paytr'),
    runs,
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
    reveal: null,
    fill: null,
    followed: null,
    followOffer: null,
    pageAside: false,
    checked: null,
    checking: false,
  };
  return endsTurn(engine) ? { ...base, ...endRunning(base, engine) } : base;
}

/**
 * What a failure does to everything waiting on the engine. A dropped socket stops the turn as `interrupted`, and any other failure ends it as `failed` (docs/16 "Slice 3 engine as built").
 * Either way a pending approval is dead: nobody can answer it, and it must not offer Allow.
 */
function endRunning(s: Pick<WbState, 'chats' | 'runs'>, engine: EngineState): Pick<WbState, 'chats' | 'runs'> {
  const offline = engine === 'offline';
  const gone = offline || engine === 'revoked';
  let endedRun = false;
  const chats = s.chats.map((c) => {
    const pending = c.items.some((i) => (i.kind === 'approval' && i.request.status === 'pending') || (i.kind === 'question' && i.question.status === 'pending'));
    const running = c.status !== 'idle' && c.status !== 'stopped';
    if (!pending && !running) return c;
    const token = turns.get(c.id);
    if (token) token.stopped = true;
    turns.delete(c.id);
    clocks.delete(c.id);
    if (c.runId) endedRun = true;
    const items: Item[] = c.items.map((it) => {
      if (it.kind === 'approval' && it.request.status === 'pending') return { ...it, request: { ...it.request, status: 'stopped', stoppedBy: gone ? 'bridge' : 'engine' } };
      if (it.kind === 'question' && it.question.status === 'pending') return { ...it, question: { ...it.question, status: 'stopped', stoppedBy: gone ? 'bridge' : 'engine' } };
      if (it.kind === 'tools') return { ...it, calls: it.calls.map((x) => (x.state === 'running' ? { ...x, state: 'stopped' as const } : x)) };
      if (it.kind === 'protocol') return { ...it, stages: it.stages.map((g) => (g.state === 'running' ? { ...g, state: 'failed' as const } : g)) };
      return it;
    });
    items.push({ kind: 'turn', id: `turn-end-${c.id}-${Date.now()}`, meta: { state: gone ? 'interrupted' : 'failed', failure: gone ? 'device_offline' : TURN_FAILURE[engine], mode: c.mode, model: c.model } });
    return { ...c, status: 'idle' as const, items };
  });
  const runs = endedRun ? s.runs.map((r): Run => (r.state === 'waiting' || r.state === 'running' ? { ...r, state: 'interrupted', command: undefined, step: undefined, when: { ar: 'انقطع حين انتهت الجولة', en: 'Cut off when the turn ended' }, summary: { ar: 'لا يعاد تلقائيًا. راجع ما تغيّر ثم شغّله', en: 'Not restarted automatically. Check what changed, then run it' } } : r)) : s.runs;
  return { chats, runs };
}

const STOPPED_TEXT: L = { ar: 'أوقفتَ هذه الجولة. ما اكتمل قبله باقٍ، ولم يبدأ شيء بعده.', en: 'You stopped this turn. What finished before it stays, and nothing after it started.' };

const turns = new Map<string, { stopped: boolean }>();
const clocks = new Map<string, { start: number; steps: number; files: ChangedFile[]; startingFrom?: number }>();
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
let tick = 1;
const uid = (p: string) => `${p}-${nextId++}-${Date.now().toString(36)}`;
const fakeSession = () => `${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 6)}-4${Math.random().toString(16).slice(2, 5)}-a${Math.random().toString(16).slice(2, 5)}-${Math.random().toString(16).slice(2, 14)}`;

const patchChat = (id: string, fn: (c: Chat) => Chat) => set((s) => ({ ...s, chats: s.chats.map((c) => (c.id === id ? fn(c) : c)) }));
const push = (id: string, item: Item) => patchChat(id, (c) => ({ ...c, items: [...c.items, item] }));
const status = (id: string, value: TurnStatus) => patchChat(id, (c) => ({ ...c, status: value }));
const patchRun = (id: string, fn: (r: Run) => Run) => set((s) => ({ ...s, runs: s.runs.map((r) => (r.id === id ? fn(r) : r)) }));
const patchItem = (chatId: string, itemId: string, fn: (i: Item) => Item) => patchChat(chatId, (c) => ({ ...c, items: c.items.map((i) => (i.id === itemId ? fn(i) : i)) }));

// ── The turn player ─────────────────────────────────────────────────────────────────────────────

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

/** The layout says whether a card can open beside the page right now. Follow never makes the page step aside (D54), so otherwise it only offers the card. */
let followFits: () => boolean = () => true;
export const setFollowGate = (fn: () => boolean) => {
  followFits = fn;
};
export const setPageAside = (value: boolean) => {
  if (state.pageAside !== value) set((s) => ({ ...s, pageAside: value }));
};
export const clearFollowOffer = () => set((s) => ({ ...s, followOffer: null }));

function follow(key: string) {
  if (!prefs.follow || !getCard(key)) return;
  const segs = location.hash.split('?')[0].split('/');
  if (segs[4] === key) return;
  if (!followFits()) {
    set((s) => ({ ...s, followOffer: key }));
    return;
  }
  followedAt = Date.now();
  set((s) => ({ ...s, followed: key }));
  openCard(key, { opener: document.activeElement instanceof HTMLElement ? document.activeElement : null });
}

function endTurn(chatId: string, end: TurnEnd, usage: Usage | null | undefined, failure?: TurnFailure) {
  const chat = state.chats.find((c) => c.id === chatId);
  const clock = clocks.get(chatId);
  if (!chat || !clock) return;
  clocks.delete(chatId);
  const meta: TurnMeta = { state: end, failure, mode: chat.mode, model: chat.model, effort: chat.model === 'haiku' ? undefined : chat.effort, ms: Date.now() - clock.start, steps: clock.steps, files: clock.files.length ? clock.files : undefined };
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
        await sleep(fast() ? 900 : (step.ms ?? STARTING_MS));
        patchChat(chatId, (c) => ({ ...c, starting: undefined, live: { mode: c.mode, model: c.model, effort: c.effort } }));
        break;
      case 'retrying':
        status(chatId, 'retrying');
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
        const call: ToolCall = { id: uid('call'), name: step.name, detail: step.detail, state: 'running', result: step.result, input: step.input ?? `{ "input": ${JSON.stringify(step.detail)} }`, output: step.output, error: step.error, decision: step.decision, startedAt: new Date().toISOString() };
        patchChat(chatId, (c) => {
          const last = c.items[c.items.length - 1];
          if (last?.kind === 'tools') return { ...c, items: [...c.items.slice(0, -1), { ...last, calls: [...last.calls, call] }] };
          return { ...c, items: [...c.items, { kind: 'tools', id: uid('t'), calls: [call] }] };
        });
        if (step.name === 'mcp__hub__get_card') follow(step.detail);
        await sleep(step.ms);
        if (token.stopped) return;
        if (step.file) clock.files.push(step.file);
        patchChat(chatId, (c) => ({ ...c, items: c.items.map((it) => (it.kind === 'tools' ? { ...it, calls: it.calls.map((x) => (x.id === call.id ? { ...x, state: step.runState ?? (step.refused ? 'denied' : step.error ? 'failed' : 'ok'), ms: step.runState === 'running' ? undefined : step.ms } : x)) } : it)) }));
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
        pendings.set(step.request.approvalId, { allow: step.allow, deny: step.deny });
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
          return { ...c, items: c.items.map((i) => (i.id === at.id && i.kind === 'protocol' ? { ...i, stages: i.stages.map((g) => (g.id === step.id ? { ...g, state: step.state, note: step.state === 'pending' ? undefined : (step.note ?? g.note) } : g)) } : i)) };
        });
        await sleep(160);
        break;
      case 'plan':
        push(chatId, { kind: 'plan', id: uid('plan'), plan: step.plan });
        break;
      case 'started':
        agentStart(step.key);
        break;
      case 'report': {
        const answer = serverReport(chatId, step.report);
        if ('refused' in answer) {
          push(chatId, { kind: 'refused', id: uid('rr'), cardKey: step.report.card, checks: answer.refused });
          break;
        }
        const report = answer.report;
        push(chatId, { kind: 'report', id: report.id, report });
        addEvidence(report);
        if (report.move.moved) agentSubmit(report.cardKey);
        // A report with a failed check did not finish, whatever the stages said: `report_stage` is Claude's word (review N5).
        if (report.counts.failed) patchChat(chatId, (c) => ({ ...c, items: c.items.map((i) => (i.kind === 'protocol' ? { ...i, stages: i.stages.map((g) => (g.id === 'verify' ? { ...g, state: 'failed' as const } : g)) } : i)) }));
        break;
      }
      case 'question': {
        // A question pauses the running turn: Stop stays, the turn has not ended, and the answer resumes it.
        const id = uid('q');
        branches.set(id, step.branches);
        status(chatId, 'waiting');
        const q = step.question;
        const questions = 'questions' in q ? q.questions : [{ text: q.text, header: q.header, multiSelect: q.multiSelect, options: q.options }];
        push(chatId, { kind: 'question', id, question: { variant: q.variant, path: q.path, diff: q.diff, changedOn: q.changedOn, questions, expiresAt: '14:30', status: 'pending' } });
        return;
      }
      case 'draft': {
        const id = uid('dr');
        drafts.set(id, { onSave: step.onSave, onDiscard: step.onDiscard, onUpdate: step.onUpdate });
        endTurn(chatId, 'done', USUAL);
        status(chatId, 'idle');
        push(chatId, { kind: 'draft', id, draft: carryAnswers(chatId, step.draft) });
        turns.delete(chatId);
        return;
      }
      case 'draftState':
        patchChat(chatId, (c) => {
          const at = [...c.items].reverse().find((i) => i.kind === 'draft');
          return { ...c, items: c.items.map((i) => (i.id === at?.id && i.kind === 'draft' ? { ...i, draft: { ...i.draft, status: step.status, refusedCode: step.refusedCode ?? i.draft.refusedCode, savedVersion: step.savedVersion ?? i.draft.savedVersion } } : i)) };
        });
        break;
      case 'saved':
        applySave(chatId, step.doc, step.path);
        break;
      case 'links':
        endTurn(chatId, 'done', USUAL);
        status(chatId, 'idle');
        push(chatId, { kind: 'links', id: uid('ln'), doc: step.doc, keys: step.keys });
        turns.delete(chatId);
        return;
      case 'gaps':
        push(chatId, { kind: 'gaps', id: uid('gap'), report: step.report });
        break;
      case 'blocked':
        push(chatId, { kind: 'blocked', id: uid('blk'), name: step.name, command: step.command, mode: step.mode });
        break;
      case 'end':
        endTurn(chatId, step.state ?? 'done', step.usage === undefined ? USUAL : step.usage, step.failure);
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
const drafts = new Map<string, { onSave: Step[]; onDiscard: Step[]; onUpdate?: Step[] }>();

function addEvidence(report: Report) {
  set((s) => ({ ...s, evidence: { ...s.evidence, [report.cardKey]: [report, ...(s.evidence[report.cardKey] ?? [])] } }));
  patchCard(report.cardKey, (card) => {
    const at = card.lastEventAt;
    return {
    ...card,
    lastEventAt: at,
    events: [...card.events, { id: uid('ev'), seq: card.events.length + 1, kind: 'commented', actorKind: 'agent', actorId: 'u-owner', via: 'mcp', at, data: { excerpt: report.move.moved ? 'Claude: report added as evidence' : 'Claude: report added, the task stays' } }],
    };
  });
}

/** The command a step ran, from its exact input (`tool.input.command` in the contract). */
const commandOf = (call: ToolCall) => {
  try {
    return (JSON.parse(call.input ?? '{}') as { command?: string }).command;
  } catch {
    return undefined;
  }
};

/**
 * What the server does with `report_work` (docs/16 §7.2 as built). A check's `command` finds every step that ran it, the last run decides, and Claude's words cannot reach `verified` or the move. A check that
 * says passed while its last real run failed refuses the whole report: nothing lands on the card.
 */
function serverReport(chatId: string, input: Extract<Step, { t: 'report' }>['report']): { refused: { name: string; stepId: string }[] } | { report: Report } {
  const chat = state.chats.find((c) => c.id === chatId);
  const calls = chat?.items.flatMap((i) => (i.kind === 'tools' ? i.calls : [])) ?? [];
  const checks: ReportedCheck[] = input.checks.map((c) => {
    const found = c.command ? calls.filter((x) => commandOf(x) === c.command) : [];
    const runs = found.map((x) => ({ stepId: x.id, status: x.state === 'failed' ? ('failed' as const) : x.state === 'running' ? ('running' as const) : x.state === 'ok' ? ('passed' as const) : ('cut_off' as const), startedAt: x.startedAt ?? new Date().toISOString(), endedAt: x.ms !== undefined && x.startedAt ? new Date(Date.parse(x.startedAt) + x.ms).toISOString() : null, excerpt: x.error ?? x.output }));
    const last = runs[runs.length - 1];
    const basis: ReportedCheck['basis'] = !c.command ? 'no_command' : !last ? 'no_matching_step' : last.status === 'running' || last.status === 'cut_off' ? 'not_finished' : c.outcome !== 'passed' && last.status === 'passed' ? 'outcome_differs' : 'matched';
    return { name: c.name, command: c.command ?? null, stepId: last?.stepId ?? null, outcome: c.outcome, note: c.note ?? null, verified: c.outcome === 'passed' && basis === 'matched' && last?.status === 'passed', basis, runs };
  });
  const contradictions = checks.filter((c) => c.outcome === 'passed' && c.runs.at(-1)?.status === 'failed');
  if (contradictions.length) return { refused: contradictions.map((c) => ({ name: c.command ?? c.name, stepId: c.stepId ?? '' })) };
  const earlier = chat ? [...chat.items].reverse().find((i): i is Extract<Item, { kind: 'report' }> => i.kind === 'report')?.report : undefined;
  const droppedChecks = earlier ? earlier.checks.map((c) => c.name).filter((n) => !checks.some((c) => c.name === n)) : [];
  const counts = { total: checks.length, passed: checks.filter((c) => c.outcome === 'passed').length, failed: checks.filter((c) => c.outcome === 'failed').length, skipped: checks.filter((c) => c.outcome === 'skipped').length, verified: checks.filter((c) => c.verified).length, failedRuns: checks.reduce((n, c) => n + c.runs.filter((r) => r.status === 'failed').length, 0) };
  const card = getCard(input.card);
  const reason: Report['move']['reason'] = card?.type !== 'task' ? 'not_a_task' : !checks.length ? 'no_checks' : counts.failed || counts.skipped ? 'check_not_passed' : counts.verified < counts.total ? 'check_not_verified' : droppedChecks.length ? 'check_dropped' : card.status !== 'in_progress' ? 'wrong_status' : 'all_verified';
  const moved = reason === 'all_verified';
  const changedFiles = input.changedFiles ?? [];
  return { report: { id: uid('rep'), cardKey: input.card, origin: 'panel', chatId, summary: input.summary, checks, changedFiles, filesFrom: changedFiles.length ? 'bridge' : 'none', notChecked: input.notChecked, droppedChecks, counts, move: { moved, reason, from: moved ? 'in_progress' : null, to: moved ? 'in_review' : null }, reportedAt: new Date().toISOString() } };
}

const markAgent = (key: string) => patchCard(key, (card) => ({ ...card, events: card.events.map((e, i) => (i === card.events.length - 1 ? { ...e, actorKind: 'agent' as const, via: 'mcp' as const } : e)) }));

/** `hub.start_task`: the skill really does start the task at stage 2, so the card moves and its buttons follow (review M11). */
function agentStart(key: string) {
  const card = getCard(key);
  if (card?.type !== 'task') return;
  if (card.status === 'backlog' || card.status === 'ready') {
    actOn(key, 'claim', 'u-owner');
    markAgent(key);
  }
  if (getCard(key)?.status === 'claimed') {
    actOn(key, 'start', 'u-owner');
    markAgent(key);
  }
}
/** D52: recorded as the agent's action, with its reason. */
function agentSubmit(key: string) {
  if (getCard(key)?.status !== 'in_progress') return;
  actOn(key, 'submit', 'u-owner', { note: 'Every check verified against a real step (D52)' });
  markAgent(key);
}

/** A redraft keeps the owner's answers on any claim whose text has not changed, so what they took out does not come back (review M5). */
function carryAnswers(chatId: string, next: Draft): Draft {
  const chat = state.chats.find((c) => c.id === chatId);
  const last = chat ? [...chat.items].reverse().find((i): i is Extract<Item, { kind: 'draft' }> => i.kind === 'draft')?.draft : undefined;
  if (!last) return next;
  return { ...next, claims: next.claims.map((claim) => ({ ...claim, answer: last.claims.find((o) => o.text.en === claim.text.en)?.answer ?? null })) };
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
  if (t.includes('pnpm test') || t.includes('اختبار')) return 'blocked';
  if (t.includes('git push') || t.includes('push') || t.includes('ارفع')) return 'push';
  if (t.includes('repopath') || t.includes('folder') || t.includes('مجلد')) return 'folders';
  if (t.includes('card') || t.includes('task') || t.includes('بطاقة') || t.includes('مهمة')) return 'create';
  if (t.includes('/hub:next')) return 'next';
  if (t.includes('/hub:suggest')) return 'suggest';
  return 'free';
};

const WRITES = new Set<ScriptId>(['push', 'pushLong', 'folders', 'create', 'taskPass', 'taskFail', 'taskClaimed', 'runwork', 'blocked']);
const titleOf = (text: string | L): L => (typeof text === 'string' ? { ar: text.slice(0, 40), en: text.slice(0, 40) } : text);

function newChatRecord(s: WbState, opts: { title: L; folder?: string; mode: Mode; runId?: string }): Chat {
  const folder = opts.folder ?? s.folder;
  return { id: uid('c'), project: s.project, title: opts.title, device: s.device, folder, persona: s.persona, at: { ar: 'الآن', en: 'Now' }, items: [], status: 'idle', mode: opts.mode, model: s.model, effort: s.effort, session: fakeSession(), branch: FOLDER_BRANCH[folder], started: { ar: 'الآن', en: 'Now' }, runId: opts.runId };
}

export function send(opts: SendOptions) {
  const s = state;
  if (engineBlocks(s.engine)) return;
  const mode = opts.mode ?? s.mode;
  let chatId = opts.fresh ? null : s.activeId;
  const current = chatId ? s.chats.find((c) => c.id === chatId) : null;
  // One turn per chat (docs/16 §7): a busy chat keeps its turn, and this goes to a new one.
  if (current && current.status !== 'idle' && current.status !== 'stopped') chatId = null;
  // A new process, or a change to what the live one was started with: either way Claude restarts, and the line says so (§7.2).
  const stillRunning = !!chatId && !!current?.live;
  const reason: Chat['starting'] = !chatId ? 'new' : !stillRunning ? 'resume' : current!.live!.mode !== mode ? 'mode' : current!.live!.model !== s.model ? 'model' : current!.live!.effort !== s.effort ? 'effort' : undefined;
  const cold = !!reason;
  if (!chatId) {
    const chat = newChatRecord(s, { title: opts.title ?? titleOf(opts.text), folder: opts.folder, mode });
    chatId = chat.id;
    set((st) => ({ ...st, chats: [chat, ...st.chats], activeId: chat.id, folder: chat.folder }));
  } else {
    patchChat(chatId, (c) => ({ ...c, mode, model: s.model, effort: s.effort, status: 'idle', session: c.session ?? fakeSession() }));
  }
  patchChat(chatId, (c) => ({ ...c, starting: reason }));
  set((st) => ({ ...st, mode }));
  const key = opts.context?.cardKey ?? 'GTV-259';
  const card = getCard(key);
  // Attached things travel with this one message, then the tray is clear again.
  const more = s.attachments.map((a) => a.label).filter((k) => k !== opts.context?.cardKey);
  const typed = typeof opts.text === 'string';
  const said = typeof opts.text === 'string' ? opts.text : opts.text.en;
  let id = opts.script ?? (typed ? scriptFor(opts.text as string) : 'free');
  // In Execute, a request Ask would have refused simply runs.
  if (mode !== 'execute' && WRITES.has(id)) id = 'blocked';
  else if (mode === 'execute' && id === 'blocked') id = 'answer';
  else if (mode === 'plan' && id === 'free') id = 'plan';
  push(chatId, { kind: 'user', id: uid('u'), text: opts.text, context: more.length ? { ...opts.context, more } : opts.context, skill: opts.skill, script: id });
  if (s.attachments.length || s.leaveOut) set((st) => ({ ...st, attachments: [], leaveOut: null }));
  const reply = id === 'answer' && !opts.reply ? { ar: `شغّلت الأمر في هذا المجلد. النتيجة في الخطوة أعلاه.`, en: `I ran that in this folder. The result is in the step above.` } : opts.reply;
  void play(chatId, script(id, { key: opts.context?.view && !opts.context.cardKey ? opts.context.view : key, title: card && opts.context?.cardKey ? card.title : { ar: opts.context?.view ?? key, en: opts.context?.view ?? key }, reply, folder: opts.folder ?? s.folder, path: opts.context?.path, mode, command: /pnpm [a-z:]+/.exec(said)?.[0] }, cold));
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
        if (it.kind === 'approval' && it.request.status === 'pending') return { ...it, request: { ...it.request, status: 'stopped', stoppedBy: 'turn' } };
        if (it.kind === 'question' && it.question.status === 'pending') return { ...it, question: { ...it.question, status: 'stopped', stoppedBy: 'turn' } };
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
  // The bridge has gone: nothing can reach Claude, and the card no longer offers it (§ "Slice 3 engine as built").
  if (engineBlocks(state.engine)) return;
  patchChat(chatId, (c) => ({ ...c, items: c.items.map((it) => (it.kind === 'approval' && it.request.approvalId === request.approvalId ? { ...it, request: { ...it.request, status: allow ? 'allowed' : 'denied' } } : it)) }));
  const branch = pendings.get(request.approvalId);
  pendings.delete(request.approvalId);
  if (!allow) push(chatId, { kind: 'notice', id: uid('n'), tone: 'denied', text: { ar: 'رفضتَ. وصل الرفض إلى Claude ولم يُنفّذ الأمر.', en: 'You denied this. Claude was told, and the command never ran.' } });
  const chat = state.chats.find((c) => c.id === chatId);
  if (chat?.runId && allow) patchRun(chat.runId, (r) => ({ ...r, state: 'running', command: undefined, when: undefined, step: { ar: 'يرفع الفرع', en: 'Pushing the branch' } }));
  void play(chatId, branch ? (allow ? branch.allow : branch.deny) : []);
}

/** The owner's answer to a proposal, a failed check or a conflict. */
export function answerQuestion(chatId: string, itemId: string, answers: Record<string, string>, branch?: string) {
  if (engineBlocks(state.engine)) return;
  patchItem(chatId, itemId, (i) => (i.kind === 'question' ? { ...i, question: { ...i.question, status: 'answered', answers } } : i));
  const all = branches.get(itemId);
  branches.delete(itemId);
  const steps = all?.[branch ?? 'answered'];
  if (steps) void play(chatId, steps);
}
export function declineQuestion(chatId: string, itemId: string) {
  patchItem(chatId, itemId, (i) => (i.kind === 'question' ? { ...i, question: { ...i.question, status: 'declined' } } : i));
  const all = branches.get(itemId);
  branches.delete(itemId);
  void play(chatId, all?.declined ?? [{ t: 'text', text: { ar: 'لن أفترض شيئًا. أخبرني حين تقرر.', en: 'I will not assume anything. Tell me when you decide.' } }, { t: 'end', usage: USUAL }]);
}

/** Pressing Run this plan fills the composer with `planToPrompt`, and it stays there until sent (D51, `chat-results.ts`). This is what Send does with it. */
export function runPlan(chatId: string, itemId: string, prompt: string) {
  patchItem(chatId, itemId, (i) => (i.kind === 'plan' ? { ...i, plan: { ...i.plan, state: 'running' } } : i));
  const chat = state.chats.find((c) => c.id === chatId);
  setMode('execute');
  const user = chat?.items.find((i): i is Extract<Item, { kind: 'user' }> => i.kind === 'user');
  const key = user?.context?.cardKey ?? 'GTV-288';
  openChat(chatId);
  send({ text: prompt, script: 'taskPass', skill: '/hub:work', context: { cardKey: key }, mode: 'execute', folder: chat?.folder });
}
export const setPlanState = (chatId: string, itemId: string, value: 'proposed' | 'scheduled' | 'set_aside', when?: L) => patchItem(chatId, itemId, (i) => (i.kind === 'plan' ? { ...i, plan: { ...i.plan, state: value, when } } : i));

// Doc protocol ───────────────────────────────────────────────────────────────────────────────────

/** `answer` goes back with the save, on the approval (`answerApprovalSchema.doc.claims`). */
export function setClaimAnswer(chatId: string, itemId: string, claimId: string, value: 'confirm' | 'remove' | 'keep_flagged' | null) {
  patchItem(chatId, itemId, (i) => (i.kind === 'draft' ? { ...i, draft: { ...i.draft, claims: i.draft.claims.map((f) => (f.id === claimId ? { ...f, answer: value } : f)) } } : i));
}

/** Unanswered flags hold the save: Allow on `save_doc` is refused with `hub.docs.draft_flags_open`, so the button says what is missing. */
export const openFlags = (draft: Draft) => draft.claims.filter((c) => c.status === 'unverified' && !c.answer);
export const keptFlags = (draft: Draft) => draft.claims.filter((c) => c.answer === 'keep_flagged');

export function saveDraft(chatId: string, itemId: string) {
  const answer = drafts.get(itemId);
  const item = state.chats.find((c) => c.id === chatId)?.items.find((i) => i.id === itemId);
  if (item?.kind === 'draft' && openFlags(item.draft).length) return;
  patchItem(chatId, itemId, (i) => (i.kind === 'draft' ? { ...i, draft: { ...i.draft, status: 'saving' } } : i));
  drafts.delete(itemId);
  if (answer) void play(chatId, answer.onSave);
}
/** The server found a duplicate, and the owner chose to update it instead of adding a second doc. */
export function updateExistingInstead(chatId: string, itemId: string) {
  const answer = drafts.get(itemId);
  patchItem(chatId, itemId, (i) => (i.kind === 'draft' ? { ...i, draft: { ...i.draft, status: 'dropped' } } : i));
  drafts.delete(itemId);
  if (answer?.onUpdate) void play(chatId, answer.onUpdate);
}
export function discardDraft(chatId: string, itemId: string) {
  const answer = drafts.get(itemId);
  patchItem(chatId, itemId, (i) => (i.kind === 'draft' ? { ...i, draft: { ...i.draft, status: 'dropped' } } : i));
  drafts.delete(itemId);
  if (answer) void play(chatId, answer.onDiscard);
}

/** The text a draft adds, as `applyClaimAnswers` does on the server: one taken out is gone, one confirmed is written plainly, and one kept wears `> Unverified: ` on its own line. */
const draftText = (draft: Draft) =>
  draft.lines
    .filter((l) => l.t === 'add')
    .flatMap((l) => {
      const claim = l.flag ? draft.claims.find((f) => f.id === l.flag) : undefined;
      if (claim?.answer === 'remove') return [];
      return claim?.answer === 'keep_flagged' ? [`> Unverified: ${l.text}`] : [l.text];
    })
    .join('\n');

function applySave(chatId: string, doc: string, path: string) {
  const chat = state.chats.find((c) => c.id === chatId);
  const draft = chat ? [...chat.items].reverse().find((i): i is Extract<Item, { kind: 'draft' }> => i.kind === 'draft')?.draft : undefined;
  const docKey = doc;
  const held = state.docs[docKey] ?? { current: 'r1', revisions: [{ id: 'r1', at: { ar: 'سابقًا', en: 'Earlier' }, note: { ar: 'النص المفهرس', en: 'The indexed text' } }] };
  const base = held.source ?? (docKey ? docContent(docKey) : '');
  const text = draft ? draftText(draft) : '';
  const nextSource = draft?.before && base.includes(draft.before) ? base.replace(draft.before, `${text}\n\n${draft.before}`) : `${base}\n${text}\n`;
  const previous = held.current;
  const n = Number(previous.slice(1)) + 1;
  const revision = `r${n}`;
  const entry: Revision = { id: revision, at: { ar: 'الآن', en: 'Now' }, note: { ar: 'مسودة من Claude بموافقتك', en: 'A draft from Claude, with your approval' }, source: nextSource };
  const kept = held.revisions.map((r) => (r.id === previous ? { ...r, source: held.source ?? r.source } : r));
  if (docKey) set((s) => ({ ...s, docs: { ...s.docs, [docKey]: { current: revision, source: nextSource, revisions: [entry, ...kept] } } }));
  push(chatId, { kind: 'saved', id: uid('sv'), doc: docKey, path, revision, previous });
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

export function linkDoc(chatId: string, itemId: string, doc: string, keys: string[]) {
  const docKey = doc;
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

export function startTask(key: string, variant: 'pass' | 'fail' | 'claimed' | 'refused' | 'cut' = 'pass') {
  if (engineBlocks(state.engine)) return;
  const folder = folderOfCard(key);
  send({ text: { ar: `نفّذ ${key} بخطوات المهمة.`, en: `Do ${key} with the task steps.` }, skill: '/hub:work', script: variant === 'fail' ? 'taskFail' : variant === 'claimed' ? 'taskClaimed' : variant === 'refused' ? 'taskRefused' : variant === 'cut' ? 'taskCut' : 'taskPass', context: { cardKey: key, action: 'run' }, fresh: true, title: { ar: `تنفيذ ${key}`, en: `Do ${key}` }, mode: 'execute', folder });
}
export function startDoc(kind: 'improve' | 'conflict' | 'document' | 'gaps' | 'arabic', target?: { key: string; path?: string }) {
  if (engineBlocks(state.engine)) return;
  const key = target?.key ?? '';
  const by = {
    improve: { ar: `حسّن هذه الوثيقة: \u2066${target?.path ?? key}\u2069`, en: `Improve this doc: ${target?.path ?? key}`, script: 'docImprove' as const },
    conflict: { ar: `حسّن هذه الوثيقة: \u2066${target?.path ?? key}\u2069`, en: `Improve this doc: ${target?.path ?? key}`, script: 'docConflict' as const },
    document: { ar: `وثّق هذه المهمة: \u2066${key}\u2069`, en: `Document this task: ${key}`, script: 'docDocument' as const },
    arabic: { ar: 'حسّن هذه الوثيقة: \u2066docs/ar/21-confirmation-safety.md\u2069', en: 'Improve this doc: docs/ar/21-confirmation-safety.md', script: 'docArabic' as const },
    gaps: { ar: 'ابحث عن النواقص في الوثائق', en: 'Find gaps in the docs', script: 'gaps' as const },
  }[kind];
  // Reading is free, and writing asks at Save, so a doc turn runs in Execute without taking anything for granted.
  send({ text: { ar: by.ar, en: by.en }, skill: '/hub:doc', script: by.script, context: key ? { cardKey: key, path: target?.path, action: kind } : { view: 'docs', action: kind }, fresh: true, title: target?.path ? { ar: `وثيقة: \u2066${target.path.split('/').pop()}\u2069`, en: `Doc: ${target.path.split('/').pop()}` } : { ar: by.ar, en: by.en }, mode: kind === 'gaps' ? 'ask' : 'execute' });
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
export function setEngine(engine: EngineState) {
  set((s) => ({ ...s, engine, checked: null, usage: engine === 'limit' ? 100 : 62, ...(endsTurn(engine) ? endRunning(s, engine) : {}) }));
  if (!engineBlocks(engine)) startNextRun();
}

let checks = 0;
/**
 * `engineStatus` (contract): `signedIn` can be null, and S1 says only a turn reveals a signed-out Claude. So a check can clear the block but cannot promise the sign-in, and it says so.
 * The first check of a limit or a missing bridge finds the same state, so that answer can be seen too. A real limit clears at `resetsAt` with no press.
 */
export function checkEngine() {
  set((s) => ({ ...s, checking: true }));
  window.setTimeout(
    () => {
      const engine = state.engine;
      const time = new Date().toTimeString().slice(0, 5);
      checks += 1;
      if (engine === 'signed_out') {
        checks = 0;
        set((s) => ({ ...s, engine: 'ok', checking: false, checked: { at: time, signIn: true } }));
        return;
      }
      if (checks % 2 === 1) {
        set((s) => ({ ...s, checking: false, checked: { at: time } }));
        return;
      }
      checks = 0;
      set((s) => ({ ...s, engine: 'ok', usage: 62, checking: false, checked: null }));
      startNextRun();
    },
    fast() ? 200 : 900,
  );
}
export const clearChecked = () => set((s) => ({ ...s, checked: null }));

/** Brings the pending approval into view and focus, on an open chat too. The panel listens, and opens if it has to. */
export function revealApproval(chatId: string) {
  openChat(chatId);
  set((s) => ({ ...s, reveal: { chatId, kind: 'approval', tick: tick++ } }));
}
export function revealStep(chatId: string, stepId: string) {
  openChat(chatId);
  set((s) => ({ ...s, reveal: { chatId, kind: 'step', stepId, tick: tick++ } }));
}

/** A suggestion goes into the box. It never sends itself (D51). `run` is what Enter does, if the text is left as it is. */
export function fillComposer(text: string, mode: Mode | undefined, run?: () => void) {
  if (mode) setMode(mode);
  set((s) => ({ ...s, fill: { text, run, tick: tick++ } }));
}
export function panelOwes(s: WbState) {
  const chat = s.chats.find((c) => c.id === s.activeId);
  return !!chat?.items.some((i) => (i.kind === 'approval' && i.request.status === 'pending') || (i.kind === 'plan' && i.plan.state === 'proposed') || (i.kind === 'draft' && i.draft.status === 'open') || (i.kind === 'question' && i.question.status === 'pending') || (i.kind === 'links' && !i.done));
}
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
  const items = chat.items.slice(0, at + 1).filter((i) => i.kind !== 'approval' && i.kind !== 'question' && i.kind !== 'draft');
  const user = chat.items[at];
  const message: L = user?.kind === 'user' ? titleOf(user.text) : chat.title;
  // A branch copies words, not the session, so it has no live process.
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
    else if (it.kind === 'approval') lines.push(`> Approval: \`${it.request.command}\`: ${it.request.status}`, '');
    else if (it.kind === 'notice') lines.push(`> ${it.text[locale]}`, '');
    else if (it.kind === 'plan') lines.push(`## Plan${it.plan.structured ? `: ${it.plan.structured.title[locale]}` : ''}`, '', ...(it.plan.structured ? it.plan.structured.steps.map((p, i) => `${i + 1}. ${p.title[locale]}`) : [it.plan.plan[locale]]), '');
    else if (it.kind === 'report') lines.push(`## Report on ${it.report.cardKey}`, '', it.report.summary[locale], '', ...it.report.checks.map((c) => `- \`${c.command ?? c.name}\`: ${c.outcome}${c.verified ? ', verified' : ''}`), '');
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
  if (engineBlocks(s.engine) || activeRuns(s).length >= LIMITS.atOnce) return;
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
export const approvalsPending = (s: WbState) => s.chats.reduce((n, c) => n + c.items.filter((it) => (it.kind === 'approval' && it.request.status === 'pending') || (it.kind === 'question' && it.question.status === 'pending')).length, 0);

export const firstWaitingChat = (s: WbState) => s.chats.find((c) => c.items.some((it) => (it.kind === 'approval' && it.request.status === 'pending') || (it.kind === 'question' && it.question.status === 'pending')));

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
