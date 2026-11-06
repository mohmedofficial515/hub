'use client';

/**
 * @file store.tsx
 * @description The panel's state (docs/16 §7, §7.1). What a chat holds comes from the hooks in `features/chat`, kept live by `LiveProvider`. What is left here is the panel's own: which chat is open, what goes with the next message, and what this device remembers.
 * The acts are plain functions so a menu item or a key can call them, and they read the project from `WorkbenchProvider`. A refused write shows the API's own words and changes nothing here.
 */
import type {
  AnswerApprovalInput,
  ChatApprovalDto,
  ChatContext,
  ChatDocDraftDto,
  ChatDto,
  ChatEffort,
  ChatFullDto,
  ChatMode,
  ChatTurnStarted,
  DeviceDto,
  EngineStatus,
  PromptTemplateDto,
  TurnLimit,
} from '@hub/contracts';
import { type QueryClient, useQueries, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { showToast } from '@/components/common/toast';
import { fmt, openCard, useRoute } from '@/components/kit';
import { useCardQuery } from '@/features/cards/store';
import { chatKeys, honestStateOf, runningMessage } from '@/features/chat/live';
import { useChat, useChats, useEngine, usePromptTemplates, useTurnStatus } from '@/features/chat/queries';
import {
  type ChatStatus,
  chatStatusOf,
  claimsWith,
  engineBlocks,
  type EngineState,
  engineStateOf,
  followTargetOf,
  type Item,
  itemsOf,
  startingReasonOf,
} from '@/features/chat/thread-items';
import { useDevices } from '@/features/devices/queries';
import { useSession } from '@/features/session/session';
import { useProject } from '@/features/settings/queries';
import { del, get, patch, post } from '@/lib/api/client';
import { isHubError } from '@/lib/api/errors';
import { useLocale, useT } from '@/lib/i18n';

import type { ChatMessages } from './words';

export type { ChatStatus, EngineState, Item };
export { engineBlocks };

export type Mode = ChatMode;
/** `default` is Claude Code's own choice: no model is passed. */
export type ModelId = 'default' | 'sonnet' | 'opus' | 'haiku';
export type Effort = 'low' | 'medium' | 'high';
export const MODES: readonly Mode[] = ['ask', 'plan', 'execute'];
export const MODELS: readonly { id: ModelId; effort: boolean }[] = [
  { id: 'default', effort: true },
  { id: 'sonnet', effort: true },
  { id: 'opus', effort: true },
  { id: 'haiku', effort: false },
];
export const EFFORTS: readonly Effort[] = ['low', 'medium', 'high'];

export interface Attachment {
  kind: 'card' | 'doc' | 'file';
  key: string;
  /** A doc's path or a file's path. A card shows its key. */
  label: string;
}

/** Remembered per device (docs/16 §7.1). Width lives with the layout. */
export interface Prefs {
  defaultMode: Mode;
  follow: boolean;
  /** The one-time line that tells a touch user how to get explanations. */
  hintSeen: boolean;
}

interface Local {
  activeId: string | null;
  deviceId: string | null;
  folder: string | null;
  persona: string | null;
  attachments: Attachment[];
  /** The open card or doc is left out of the next message. */
  leaveOut: string | null;
  mode: Mode;
  model: ModelId;
  effort: Effort;
  /** The last request to bring something into view. The panel opens and the thread scrolls to it. */
  reveal: { chatId: string; kind: 'approval' | 'step'; stepId?: string; tick: number } | null;
  /** A suggestion waiting in the composer. */
  fill: { text: string; tick: number } | null;
  followed: string | null;
  followOffer: string | null;
  pageAside: boolean;
  /** The owner's answers to a draft's flags. They go to the server with Save. */
  answers: Record<string, Record<string, 'confirm' | 'remove' | 'keep_flagged'>>;
  /** Drafts the owner discarded with no save waiting: only this device knows. */
  discarded: Record<string, true>;
  /** Plans the owner set aside on this device. */
  plansAside: Record<string, true>;
  restored: Record<string, true>;
  /** The last Check again. */
  checked: { at: string; same: boolean; signIn: boolean } | null;
  checking: boolean;
}

const PREFIX = 'hub-panel';
function readLocal<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${PREFIX}:${name}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function writeLocal(name: string, value: unknown) {
  try {
    localStorage.setItem(`${PREFIX}:${name}`, JSON.stringify(value));
  } catch {
    /* Kept for this session only. */
  }
}

let prefs: Prefs = {
  defaultMode: readLocal<Mode>('defaultMode', 'execute'),
  follow: readLocal('follow', true),
  hintSeen: readLocal('hintSeen', false),
};
const prefListeners = new Set<() => void>();
const DEFAULT_PREFS = prefs;
export const usePrefs = () =>
  useSyncExternalStore(
    (fn) => {
      prefListeners.add(fn);
      return () => prefListeners.delete(fn);
    },
    () => prefs,
    () => DEFAULT_PREFS,
  );
export function setPref<K extends keyof Prefs>(name: K, value: Prefs[K]) {
  prefs = { ...prefs, [name]: value };
  writeLocal(name, value);
  prefListeners.forEach((l) => l());
}

/** Per device by nature. Blocked storage falls back to the default. */
export function useRemembered<T>(name: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readLocal(name, fallback));
  const update = useCallback(
    (next: T) => {
      setValue(next);
      writeLocal(name, next);
    },
    [name],
  );
  return [value, update];
}

const initial = (): Local => ({
  activeId: null,
  deviceId: readLocal<string | null>('device', null),
  folder: null,
  persona: readLocal<string | null>('persona', null),
  attachments: [],
  leaveOut: null,
  mode: prefs.defaultMode,
  model: readLocal<ModelId>('model', 'default'),
  effort: readLocal<Effort>('effort', 'medium'),
  reveal: null,
  fill: null,
  followed: null,
  followOffer: null,
  pageAside: false,
  answers: {},
  discarded: {},
  plansAside: {},
  restored: {},
  checked: null,
  checking: false,
});

let local = initial();
const listeners = new Set<() => void>();
const set = (fn: (s: Local) => Local) => {
  local = fn(local);
  listeners.forEach((l) => l());
};
const useLocal = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => local,
    () => local,
  );

let tick = 1;
const nextTick = () => (tick += 1);

/** Set by the provider: which project these acts are on. */
let scope: {
  ws: string;
  client: QueryClient | null;
  words: ChatMessages | null;
  failed: string;
  deviceId: string | null;
  folder: string | null;
} = { ws: '', client: null, words: null, failed: '', deviceId: null, folder: null };
const base = () => `workspaces/${scope.ws}/chats`;
const reread = (id?: string) => {
  const { client, ws } = scope;
  void client?.invalidateQueries({ queryKey: chatKeys.list(ws) });
  void client?.invalidateQueries({ queryKey: chatKeys.list(ws, true) });
  if (id) void client?.invalidateQueries({ queryKey: chatKeys.one(ws, id) });
};
const refused = (error: unknown) => {
  showToast({ tone: 'error', message: isHubError(error) ? error.message : scope.failed });
};

// ── Follow ───────────────────────────────────────────────────────────────────

/** A card opened by "Follow the chat" must not take focus or bring the sheet over the chat on a phone. */
let followedAt = 0;
export const wasFollowOpened = () => Date.now() - followedAt < 800;

/** The layout says whether a card can open beside the page right now. Follow never makes the page step aside (D54), so otherwise it only offers the card. */
let followFits: () => boolean = () => true;
export const setFollowGate = (fn: () => boolean) => {
  followFits = fn;
};
export const setPageAside = (value: boolean) => {
  if (local.pageAside !== value) set((s) => ({ ...s, pageAside: value }));
};
export const clearFollowOffer = () => set((s) => ({ ...s, followOffer: null }));

function follow(key: string, current: string | null) {
  if (!prefs.follow || current === key) return;
  if (!followFits()) {
    set((s) => ({ ...s, followOffer: key }));
    return;
  }
  followedAt = Date.now();
  set((s) => ({ ...s, followed: key, followOffer: null }));
  openCard(key);
}

// ── Acts ─────────────────────────────────────────────────────────────────────

export interface SendOptions {
  text: string;
  context?: ChatContext | undefined;
  mode?: Mode | undefined;
  /** Start a new chat, keeping a busy one's turn. */
  fresh?: boolean | undefined;
}

const modelArg = (): { model?: string } => (local.model === 'default' ? {} : { model: local.model });
const effortArg = (): { effort?: ChatEffort } => {
  const carries = MODELS.find((m) => m.id === local.model)?.effort;
  return carries ? { effort: local.effort } : {};
};

/** The current chat, or a new one when asked, or when the device or folder has changed since it began. */
async function chatToSend(fresh: boolean, mode: Mode): Promise<string | null> {
  const { deviceId, folder, client, ws } = scope;
  if (!deviceId || !folder) return null;
  const active = local.activeId ? client?.getQueryData<ChatFullDto>(chatKeys.one(ws, local.activeId)) : null;
  if (!fresh && local.activeId && (!active || (active.deviceId === deviceId && active.folder === folder))) {
    return local.activeId;
  }
  const chat = await post<ChatDto>(base(), { device: deviceId, folder, mode, ...modelArg(), ...effortArg() });
  set((s) => ({ ...s, activeId: chat.id }));
  writeLocal(`active:${scope.ws}`, chat.id);
  return chat.id;
}

/** False when it was refused, so the composer can give the words back. */
export async function send(options: SendOptions): Promise<boolean> {
  const mode = options.mode ?? local.mode;
  if (mode !== local.mode) set((s) => ({ ...s, mode }));
  try {
    const id = await chatToSend(options.fresh ?? false, mode);
    if (!id) return false;
    const attachments = local.attachments.map((a) =>
      a.kind === 'file' ? { kind: 'file' as const, path: a.key } : { kind: a.kind, key: a.key },
    );
    const context: ChatContext = {
      ...options.context,
      ...(attachments.length ? { attachments } : {}),
    };
    await post<ChatTurnStarted>(`${base()}/${id}/messages`, {
      text: options.text,
      context,
      mode,
      ...modelArg(),
      ...effortArg(),
    });
    set((s) => ({ ...s, attachments: [], leaveOut: null, followOffer: null }));
    reread(id);
    return true;
  } catch (error) {
    refused(error);
    return false;
  }
}

export const stopTurn = (id: string) => void post(`${base()}/${id}/stop`).catch(refused);

export const retryTurn = (id: string) =>
  void post(`${base()}/${id}/retry`, { mode: local.mode, ...modelArg(), ...effortArg() })
    .then(() => reread(id))
    .catch(refused);

const answer = (chatId: string, id: string, input: AnswerApprovalInput) =>
  post(`${base()}/${chatId}/approvals/${id}`, input)
    .catch(refused)
    .finally(() => reread(chatId));

export const answerApproval = (chatId: string, request: ChatApprovalDto, allow: boolean) =>
  void answer(chatId, request.id, { decision: allow ? 'allow' : 'deny' });

export const answerQuestion = (chatId: string, id: string, answers: Record<string, string>) =>
  void answer(chatId, id, { decision: 'allow', answers });

export const declineQuestion = (chatId: string, id: string) => void answer(chatId, id, { decision: 'deny' });

export function setClaimAnswer(
  draftId: string,
  claimId: string,
  value: 'confirm' | 'remove' | 'keep_flagged' | null,
) {
  set((s) => {
    const { [claimId]: _gone, ...rest } = s.answers[draftId] ?? {};
    return { ...s, answers: { ...s.answers, [draftId]: value ? { ...rest, [claimId]: value } : rest } };
  });
}

/** Save is Allow on `save_doc`, with the owner's answers (§7.2 as built). The server refuses with a flag open, and what it refuses it writes on the draft. */
export function saveDraft(chatId: string, draft: ChatDocDraftDto, save: ChatApprovalDto) {
  const claims = claimsWith(draft, local.answers[draft.id] ?? {}).flatMap((claim) =>
    claim.status === 'unverified' && claim.answer ? [{ id: claim.id, answer: claim.answer }] : [],
  );
  void answer(chatId, save.id, { decision: 'allow', doc: { claims } });
}

/** A deny's note tells Claude what to change, and with no save waiting the owner's words go as a message. */
export function redraft(chatId: string, draft: ChatDocDraftDto, save: ChatApprovalDto | null, note: string) {
  if (save) void answer(chatId, save.id, { decision: 'deny', note });
  else void send({ text: note });
  void draft;
}

export function discardDraft(
  chatId: string,
  draft: ChatDocDraftDto,
  save: ChatApprovalDto | null,
  note: string,
) {
  set((s) => ({ ...s, discarded: { ...s.discarded, [draft.id]: true } }));
  if (save) void answer(chatId, save.id, { decision: 'deny', note });
}

export const markRestored = (draftId: string) =>
  set((s) => ({ ...s, restored: { ...s.restored, [draftId]: true } }));

export const setPlanAside = (id: string) =>
  set((s) => ({ ...s, plansAside: { ...s.plansAside, [id]: true } }));

export const setMode = (mode: Mode) => set((s) => ({ ...s, mode }));
export function setModel(model: ModelId) {
  writeLocal('model', model);
  set((s) => ({ ...s, model }));
}
export function setEffort(effort: Effort) {
  writeLocal('effort', effort);
  set((s) => ({ ...s, effort }));
}

export function openChat(id: string | null) {
  writeLocal(`active:${scope.ws}`, id);
  set((s) => ({
    ...s,
    activeId: id,
    mode: id ? s.mode : prefs.defaultMode,
    followOffer: null,
    checked: null,
  }));
}
export const newChat = () => openChat(null);

export function setDevice(deviceId: string) {
  writeLocal('device', deviceId);
  set((s) => ({ ...s, deviceId, checked: null }));
}
export function setFolder(folder: string) {
  writeLocal(`folder:${scope.ws}`, folder);
  set((s) => ({ ...s, folder }));
}
export function setPersona(persona: string) {
  writeLocal('persona', persona);
  set((s) => ({ ...s, persona }));
}

export const attach = (a: Attachment) =>
  set((s) => (s.attachments.some((x) => x.key === a.key) ? s : { ...s, attachments: [...s.attachments, a] }));
export const detach = (key: string) =>
  set((s) => ({ ...s, attachments: s.attachments.filter((a) => a.key !== key) }));
export const setLeaveOut = (key: string | null) => set((s) => ({ ...s, leaveOut: key }));

export function revealApproval(chatId: string) {
  openChatKeepingMode(chatId);
  set((s) => ({ ...s, reveal: { chatId, kind: 'approval', tick: nextTick() } }));
}
export function revealStep(chatId: string, stepId: string) {
  openChatKeepingMode(chatId);
  set((s) => ({ ...s, reveal: { chatId, kind: 'step', stepId, tick: nextTick() } }));
}
function openChatKeepingMode(id: string) {
  if (local.activeId === id) return;
  writeLocal(`active:${scope.ws}`, id);
  set((s) => ({ ...s, activeId: id }));
}

/** Puts words in the composer and sets their mode. Nothing is sent (D51). */
export function fillComposer(text: string, mode?: Mode) {
  set((s) => ({ ...s, mode: mode ?? s.mode, fill: { text, tick: nextTick() } }));
}

export function togglePin(chat: Pick<ChatDto, 'id' | 'pinned'>) {
  patch(`${base()}/${chat.id}`, { pinned: !chat.pinned })
    .then(() => reread(chat.id))
    .catch(refused);
}

export function branchFrom(chatId: string, messageId: string) {
  post<ChatDto>(`${base()}/${chatId}/branch`, { message: messageId })
    .then((chat) => {
      reread();
      openChat(chat.id);
    })
    .catch(refused);
}

export async function exportChat(chatId: string) {
  return get<{ fileName: string; markdown: string }>(`${base()}/${chatId}/export`);
}

export function deleteChat(id: string, deleted: string) {
  del(`${base()}/${id}`)
    .then(() => {
      if (local.activeId === id) openChat(null);
      reread(id);
      showToast({
        message: deleted,
        onUndo: () =>
          void post(`${base()}/${id}/restore`)
            .then(() => reread(id))
            .catch(refused),
      });
    })
    .catch(refused);
}

export function saveTemplate(title: string, body: string, saved: string) {
  post<PromptTemplateDto>(`workspaces/${scope.ws}/prompt-templates`, { title, body })
    .then(() => {
      void scope.client?.invalidateQueries({ queryKey: chatKeys.templates(scope.ws) });
      showToast({ message: saved });
    })
    .catch(refused);
}
export function removeTemplate(id: string) {
  del(`workspaces/${scope.ws}/prompt-templates/${id}`)
    .then(() => void scope.client?.invalidateQueries({ queryKey: chatKeys.templates(scope.ws) }))
    .catch(refused);
}

/** Check again: asks the device past its cache, and the honest state follows from the answer. */
export function checkEngine(before: EngineState) {
  const { deviceId, client, ws } = scope;
  if (!deviceId) return;
  set((s) => ({ ...s, checking: true }));
  get<EngineStatus>(`${base()}/engine`, { device: deviceId, fresh: 'true' })
    .then((engine) => {
      client?.setQueryData(chatKeys.engine(ws, deviceId), engine);
      set((s) => ({
        ...s,
        checking: false,
        checked: {
          at: engine.checkedAt,
          same: before !== 'ok',
          signIn: before === 'signed_out' && engine.signedIn !== false,
        },
      }));
    })
    .catch((error: unknown) => {
      set((s) => ({ ...s, checking: false }));
      refused(error);
    });
}

// ── The provider ─────────────────────────────────────────────────────────────

export interface PanelChat {
  id: string;
  title: string;
  folder: string;
  deviceId: string;
  deviceName: string;
  branch: string | null;
  session: string | null;
  mode: Mode;
  model: string | null;
  pinned: boolean;
  createdAt: string;
  claudeVersion: string | null;
  skills: readonly string[];
  mcpServers: readonly string[];
  status: ChatStatus;
  starting: ReturnType<typeof startingReasonOf>;
  retry: { attempt?: number | undefined; retryInMs?: number | undefined } | null;
  items: Item[];
  from: string | null;
  raw: ChatFullDto;
}

export interface Wb extends Local {
  chats: ChatDto[];
  chat: PanelChat | undefined;
  devices: DeviceDto[];
  device: DeviceDto | null;
  deviceName: string;
  folders: readonly string[];
  folderNow: string | null;
  engine: EngineState;
  engineStatus: EngineStatus | null;
  resetsAt: number | null;
  templates: PromptTemplateDto[];
  /** The latest limit the engine reported, in any message of the open chat. */
  usage: TurnLimit | null;
  /** Approvals and questions waiting in any chat, oldest chat first. */
  waiting: { id: string; title: string; count: number }[];
  pending: number;
  roles: readonly string[];
  /** The device and folder are known. Until then a send has nowhere to go. */
  ready: boolean;
}

const Ctx = createContext<Wb | null>(null);

export function useWb(): Wb {
  const wb = useContext(Ctx);
  if (!wb) throw new Error('useWb needs WorkbenchProvider');
  return wb;
}

/** The workbench when there is one: the sheet also shows on the lab's own page, which has no panel. */
export const useMaybeWb = () => useContext(Ctx);

export const panelOwes = (wb: Wb | null) => !!wb && wb.pending > 0;

const ENDED_RECHECK_MS = 60_000;
const DEVICES_REFRESH_MS = 15_000;

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const { ws, cardKey } = useRoute();
  const client = useQueryClient();
  const t = useT<ChatMessages>('chat');
  const failed = useT('kit').actionFailed;
  const session = useSession();
  const localState = useLocal();
  const chats = useChats();
  const devicesQuery = useDevices(DEVICES_REFRESH_MS);
  const devices = useMemo(() => devicesQuery.data ?? [], [devicesQuery.data]);
  const templates = usePromptTemplates();
  const project = useProject();
  const folders = useMemo(() => project.data?.repoPaths ?? [], [project.data?.repoPaths]);

  const remembered = useRef(ws);
  useEffect(() => {
    // A chat and a folder belong to one project.
    remembered.current = ws;
    set((s) => ({
      ...s,
      activeId: readLocal<string | null>(`active:${ws}`, null),
      folder: readLocal<string | null>(`folder:${ws}`, null),
      attachments: [],
      leaveOut: null,
    }));
  }, [ws]);

  const device =
    devices.find((d) => d.id === localState.deviceId) ?? devices.find((d) => d.online) ?? devices[0] ?? null;
  const folderNow =
    localState.folder && folders.includes(localState.folder) ? localState.folder : (folders[0] ?? null);

  const chatQuery = useChat(localState.activeId);
  const full = chatQuery.data;
  // A chat deleted on another device, or from another project, is not an open chat.
  useEffect(() => {
    if (localState.activeId && chatQuery.isError) openChat(null);
  }, [localState.activeId, chatQuery.isError]);
  const now = useTurnStatus(localState.activeId);

  const lastTurn = full ? ([...full.messages].reverse().find((m) => m.role === 'assistant') ?? null) : null;
  const engineDevice = full?.deviceId ?? device?.id ?? null;
  const engineQuery = useEngine(
    engineDevice && (full ? full.deviceOnline : device?.online) ? engineDevice : null,
  );
  const engineStatus = engineQuery.data ?? null;

  // A limit clears by itself at `resetsAt`, with nothing arriving to say so.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), ENDED_RECHECK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const honest = honestStateOf(
    full ?? { deviceOnline: device?.online ?? false, deviceRevoked: false },
    lastTurn,
    engineStatus,
    clock,
  );
  const engine: EngineState =
    !full && devices.length === 0 && devicesQuery.isSuccess
      ? 'no_device'
      : !full && !folderNow && project.isSuccess
        ? 'no_folder'
        : !devicesQuery.isSuccess && !full
          ? 'ok'
          : engineStateOf(honest, lastTurn?.failure ?? null);

  // A pause exists only in a running chat, so reading those is enough for the count.
  const running = useMemo(() => (chats.data ?? []).filter((c) => c.running), [chats.data]);
  const runningFull = useQueries({
    queries: running.map((chat) => ({
      queryKey: chatKeys.one(ws, chat.id),
      queryFn: () => get<ChatFullDto>(`${base()}/${chat.id}`),
    })),
  });
  const waiting = runningFull.flatMap((query, index) => {
    const chat = running[index];
    const count = query.data?.messages.reduce(
      (n, m) =>
        n +
        m.approvals.filter((a) => a.status === 'pending').length +
        m.questions.filter((q) => q.status === 'pending').length,
      0,
    );
    return chat && count ? [{ id: chat.id, title: chat.title, count }] : [];
  });
  const pending = waiting.reduce((n, w) => n + w.count, 0);

  const chat = useMemo<PanelChat | undefined>(() => {
    if (!full) return undefined;
    const lastEngine = [...full.messages].reverse().find((m) => m.claudeVersion);
    const facts = [...full.messages].reverse().find((m) => m.engineFacts)?.engineFacts;
    return {
      id: full.id,
      title: full.title,
      folder: full.folder,
      deviceId: full.deviceId,
      deviceName: full.deviceName,
      branch: full.branch,
      session: full.sessionId,
      mode: full.mode,
      model: lastEngine?.model ?? full.model,
      pinned: full.pinned,
      createdAt: full.createdAt,
      claudeVersion: lastEngine?.claudeVersion ?? null,
      skills: facts?.skills ?? [],
      mcpServers: facts?.mcpServers ?? [],
      status: chatStatusOf(full, now),
      starting: startingReasonOf(full),
      retry: now?.state === 'retrying' ? { attempt: now.attempt, retryInMs: now.retryInMs } : null,
      items: itemsOf(full),
      from: full.parentChatId ? (chats.data?.find((c) => c.id === full.parentChatId)?.title ?? '') : null,
      raw: full,
    };
  }, [full, now, chats.data]);

  // The composer's mode follows the chat that was opened, once.
  const syncedChat = useRef<string | null>(null);
  useEffect(() => {
    if (!full || syncedChat.current === full.id) return;
    syncedChat.current = full.id;
    set((s) => ({ ...s, mode: full.mode }));
  }, [full]);

  // Follow the chat: only for a turn running now, so reopening an old chat opens nothing.
  const followTarget = followTargetOf(full ? runningMessage(full) : null);
  const lastFollowed = useRef<string | null>(null);
  useEffect(() => {
    if (!followTarget || lastFollowed.current === followTarget) return;
    lastFollowed.current = followTarget;
    follow(followTarget, cardKey ?? null);
  }, [followTarget, cardKey]);

  scope = { ws, client, words: t, failed, deviceId: device?.id ?? null, folder: folderNow };

  const usage = useMemo(() => {
    for (const message of [...(full?.messages ?? [])].reverse()) {
      if (message.limit) return message.limit;
    }
    return null;
  }, [full]);

  const value: Wb = {
    ...localState,
    chats: chats.data ?? [],
    chat,
    devices,
    device: full ? (devices.find((d) => d.id === full.deviceId) ?? device) : device,
    deviceName: full?.deviceName ?? device?.name ?? '',
    folders,
    folderNow: full?.folder ?? folderNow,
    engine,
    engineStatus,
    resetsAt: honest.resetsAt,
    templates: templates.data ?? [],
    usage,
    waiting,
    pending,
    roles: session.me.roles,
    ready: devicesQuery.isSuccess && project.isSuccess,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ── Where the owner is ───────────────────────────────────────────────────────

export type AskAction = 'explain' | 'plan' | 'redesign';

/** What the panel knows from where the owner is: project, page and open card (docs/16 §7). */
export function useWorkContext() {
  const route = useRoute();
  const nav = useT('shell').nav;
  const session = useSession();
  const card = useCardQuery(route.cardKey ?? '').data ?? null;
  const docParam = route.view === 'docs' ? route.query.get('doc') : null;
  const docCard = useCardQuery(docParam ?? '').data;
  const doc = docCard?.type === 'doc' ? { key: docCard.key, path: docCard.doc.path } : null;
  return {
    projectName: session.workspace?.name ?? '',
    view: route.view,
    pageName: nav[route.view] ?? '',
    cardKey: card?.key ?? null,
    card,
    doc,
    docCard: docCard ?? null,
    targetLabel: card ? card.key : (nav[route.view] ?? ''),
  };
}

/** "Explain this" and friends, for the open card or the page. No retyping. A busy chat keeps its turn, so this opens a new one. */
export function useAsk() {
  const t = useT<ChatMessages>('chat').panel;
  const ctx = useWorkContext();
  const wb = useWb();
  const locale = useLocale();
  void locale;
  return (action: AskAction, key?: string | null) => {
    const cardKey = key === undefined ? ctx.cardKey : key;
    const status = wb.chat?.status;
    const busy = !!status && status !== 'idle' && status !== 'stopped';
    if (busy) showToast({ message: t.context.busy });
    void send({
      mode: action === 'explain' ? 'ask' : action === 'plan' ? 'plan' : 'execute',
      text: fmt(t.context.prompt[action], { target: cardKey ?? ctx.pageName }),
      context: cardKey ? { card: cardKey } : { page: ctx.pageName },
      fresh: true,
    });
  };
}

/** Starts a Hub skill on a card: it runs at once, in Execute, and its tooltip has said so (D51). */
export function startSkill(text: string, context: ChatContext) {
  return send({ text, mode: 'execute', fresh: true, context });
}

export const chatIsBusy = (status: ChatStatus | undefined) =>
  !!status && status !== 'idle' && status !== 'stopped';
