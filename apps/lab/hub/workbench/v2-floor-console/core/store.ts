import { useCallback, useState, useSyncExternalStore } from 'react';
import type { Role } from '@lab/mocks/hub-app';
import { createCard, fmt, getCard, patchCard, setArchived, showToast } from './kit';
import { wbMessages } from './strings';
import { versionPrefix } from './store-keys';
import { CREATED_CARD, DEVICES, PAYTR_ALLOW, PAYTR_DENY, script, seedChats, SEED_RUNS, STEP_LINES, type ApprovalRequest, type Chat, type DeviceId, type Item, type L, type ProjectId, type Run, type RunState, type ScriptId, type Step, type TurnStatus } from './mock';

/** The state of the local bridge and of Claude behind it (docs/16 S1 Q8). */
export type EngineState = 'ok' | 'offline' | 'signed_out' | 'limit' | 'unknown';

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
  /** Cards that were added to the turn's context by hand (drag, or "add"). */
  pinned: string[];
}

const fromUrl = () => new URLSearchParams(location.hash.split('?')[1] ?? '').get('wb');

function initial(): WbState {
  const param = fromUrl();
  const engine: EngineState = param === 'offline' || param === 'signed_out' || param === 'limit' || param === 'unknown' ? param : 'ok';
  const chats = seedChats();
  const empty = param === 'empty';
  const stopped = param === 'stopped';
  if (stopped) {
    const fees = chats.find((c) => c.id === 'c-fees')!;
    fees.status = 'stopped';
    fees.items = [...fees.items, { kind: 'notice', id: 'n-stop', tone: 'stopped', text: { ar: 'أوقفتَ هذا الدور. ما اكتمل قبله باقٍ، ولم يبدأ شيء بعده.', en: 'You stopped this turn. What finished before it stays, and nothing after it started.' } }];
  }
  return {
    engine,
    chats,
    activeId: empty ? null : stopped ? 'c-fees' : 'c-paytr',
    runs: SEED_RUNS.map((r) => ({ ...r })),
    device: 'main',
    folder: 'F:/Goteav/backend',
    project: 'goteav',
    persona: 'owner',
    usage: engine === 'limit' ? 100 : 62,
    pinned: [],
  };
}

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

const patchChat = (id: string, fn: (c: Chat) => Chat) => set((s) => ({ ...s, chats: s.chats.map((c) => (c.id === id ? fn(c) : c)) }));
const push = (id: string, item: Item) => patchChat(id, (c) => ({ ...c, items: [...c.items, item] }));
const status = (id: string, value: TurnStatus) => patchChat(id, (c) => ({ ...c, status: value }));
const patchRun = (id: string, fn: (r: Run) => Run) => set((s) => ({ ...s, runs: s.runs.map((r) => (r.id === id ? fn(r) : r)) }));

// ── The turn player ─────────────────────────────────────────────────────────────────────────────

const turns = new Map<string, { stopped: boolean }>();
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

async function play(chatId: string, steps: Step[]) {
  const token = { stopped: false };
  turns.set(chatId, token);
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
        const call = { id: uid('call'), name: step.name, detail: step.detail, state: 'running' as const, result: step.result };
        patchChat(chatId, (c) => {
          const last = c.items[c.items.length - 1];
          if (last?.kind === 'tools') return { ...c, items: [...c.items.slice(0, -1), { ...last, calls: [...last.calls, call] }] };
          return { ...c, items: [...c.items, { kind: 'tools', id: uid('t'), calls: [call] }] };
        });
        await sleep(step.ms);
        if (token.stopped) return;
        patchChat(chatId, (c) => ({ ...c, items: c.items.map((it) => (it.kind === 'tools' ? { ...it, calls: it.calls.map((x) => (x.id === call.id ? { ...x, state: 'ok' } : x)) } : it)) }));
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
    }
  }
  status(chatId, 'idle');
  turns.delete(chatId);
}

const pendings = new Map<string, { allow: Step[]; deny: Step[] }>([['a-paytr', { allow: PAYTR_ALLOW, deny: PAYTR_DENY }]]);

// ── Actions the interface calls ─────────────────────────────────────────────────────────────────

export interface SendOptions {
  text: string | L;
  script?: ScriptId;
  context?: { view?: string; cardKey?: string; action?: string };
  skill?: string;
  /** Start in a new chat rather than the open one. */
  fresh?: boolean;
  title?: L;
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

const titleOf = (text: string | L): L => (typeof text === 'string' ? { ar: text.slice(0, 40), en: text.slice(0, 40) } : text);

export function send(opts: SendOptions) {
  const s = state;
  if (s.engine !== 'ok') return;
  let chatId = opts.fresh ? null : s.activeId;
  const current = chatId ? s.chats.find((c) => c.id === chatId) : null;
  // One turn per chat (docs/16 §7): a busy chat keeps its turn, and this goes to a new one.
  if (current && (current.status !== 'idle' && current.status !== 'stopped')) chatId = null;
  const cold = !chatId;
  if (!chatId) {
    chatId = uid('c');
    const chat: Chat = { id: chatId, project: s.project, title: opts.title ?? titleOf(opts.text), device: s.device, folder: s.folder, persona: s.persona, at: { ar: 'الآن', en: 'Now' }, items: [], status: 'idle' };
    set((st) => ({ ...st, chats: [chat, ...st.chats], activeId: chatId }));
  }
  const key = opts.context?.cardKey ?? 'GTV-259';
  const card = getCard(key);
  const target = { key: opts.context?.view && !opts.context.cardKey ? opts.context.view : key, title: card && opts.context?.cardKey ? card.title : { ar: opts.context?.view ?? key, en: opts.context?.view ?? key } };
  // Pinned cards travel with this one message, then the tray is clear again.
  const more = s.pinned.filter((k) => k !== opts.context?.cardKey);
  push(chatId, { kind: 'user', id: uid('u'), text: opts.text, context: more.length ? { ...opts.context, more } : opts.context, skill: opts.skill });
  if (s.pinned.length) set((st) => ({ ...st, pinned: [] }));
  const id = opts.script ?? (typeof opts.text === 'string' ? scriptFor(opts.text) : 'free');
  void play(chatId, script(id, target, cold));
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
        return it;
      }),
      { kind: 'notice', id: uid('n'), tone: 'stopped', text: { ar: 'أوقفتَ هذا الدور. ما اكتمل قبله باقٍ، ولم يبدأ شيء بعده.', en: 'You stopped this turn. What finished before it stays, and nothing after it started.' } },
    ],
  }));
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

export const openChat = (id: string | null) => set((s) => ({ ...s, activeId: id }));
export const newChat = () => openChat(null);
export const setEngine = (engine: EngineState) => set((s) => ({ ...s, engine, usage: engine === 'limit' ? 100 : 62 }));
export const setDevice = (device: DeviceId) => set((s) => ({ ...s, device }));
export const setFolder = (folder: string, project?: ProjectId) => set((s) => ({ ...s, folder, project: project ?? s.project }));
export const setPersona = (persona: Role) => set((s) => ({ ...s, persona }));
export const pinCard = (key: string) => set((s) => (s.pinned.includes(key) ? s : { ...s, pinned: [...s.pinned, key] }));
export const unpinCard = (key: string) => set((s) => ({ ...s, pinned: s.pinned.filter((k) => k !== key) }));

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

// ── Queue ───────────────────────────────────────────────────────────────────────────────────────

export function runNow(opts: { title: L; cardKey?: string; folder: string }): RunState {
  const s = state;
  const folderBusy = s.runs.some((r) => r.folder === opts.folder && (r.state === 'running' || r.state === 'waiting'));
  const active = s.runs.filter((r) => r.state === 'running' || r.state === 'waiting').length;
  const blocked = folderBusy || active >= 2 || s.engine === 'limit';
  const id = uid('r');
  if (blocked) {
    const run: Run = {
      id,
      title: opts.title,
      cardKey: opts.cardKey,
      folder: opts.folder,
      state: 'next',
      when: folderBusy ? { ar: 'ينتظر فراغ المجلد: تشغيل واحد لكل مجلد', en: 'Waits for the folder: one run per folder' } : { ar: 'ينتظر مكانًا: تشغيلان في وقت واحد', en: 'Waits for a slot: two at a time' },
    };
    set((st) => ({ ...st, runs: [run, ...st.runs] }));
    return 'next';
  }
  const chatId = uid('c');
  const chat: Chat = { id: chatId, project: s.project, title: { ar: `تشغيل: ${opts.title.ar}`, en: `Run: ${opts.title.en}` }, device: s.device, folder: opts.folder, persona: s.persona, at: { ar: 'الآن', en: 'Now' }, items: [{ kind: 'user', id: uid('u'), text: opts.cardKey ? { ar: `نفّذ ${opts.cardKey}.`, en: `Do ${opts.cardKey}.` } : opts.title, context: opts.cardKey ? { cardKey: opts.cardKey } : undefined }], status: 'idle', runId: id };
  const run: Run = { id, title: opts.title, cardKey: opts.cardKey, folder: opts.folder, state: 'running', chatId, step: { ar: 'يبدأ Claude في المجلد', en: 'Starting Claude in the folder' } };
  set((st) => ({ ...st, chats: [chat, ...st.chats], runs: [run, ...st.runs] }));
  const card = opts.cardKey ? getCard(opts.cardKey) : undefined;
  void play(chatId, script('runwork', { key: opts.cardKey ?? opts.title.en, title: card?.title ?? opts.title }, true));
  return 'running';
}

export function schedule(opts: { title: L; cardKey?: string; folder: string; when: L; repeat: boolean }) {
  const run: Run = { id: uid('r'), title: opts.title, cardKey: opts.cardKey, folder: opts.folder, state: 'scheduled', when: opts.when, repeat: opts.repeat };
  set((st) => ({ ...st, runs: [run, ...st.runs] }));
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

// The seeded run keeps moving so the panel never looks staged.
let stepIndex = 0;
window.setInterval(() => {
  const run = state.runs.find((r) => r.id === 'r-refund');
  if (!run || run.state !== 'running') return;
  stepIndex = (stepIndex + 1) % STEP_LINES.length;
  patchRun('r-refund', (r) => ({ ...r, step: STEP_LINES[stepIndex] }));
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
