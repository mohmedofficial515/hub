// Page state: route (in the URL hash, so every view and field has a deep link), saved values per group, drafts per
// group (explicit save), personal preferences (instant), version history, role and lab scenario.
import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import {
  PREFERENCES,
  SETTINGS_GROUPS,
  SETTINGS_HISTORY,
  SETTINGS_NOW_ISO,
  type FieldValue,
  type SettingsHistoryEntry,
} from '@lab/mocks/settings';
import { useLocale, type Locale } from '@lab/i18n';
import { messages, type Messages } from '../i18n';
import { evaluate, type Check } from './readiness';
import { sameValue, type Role } from './data';

export type Mode = 'setup' | 'operate';
export type Scenario = 'default' | 'loading' | 'empty' | 'error';
export type View = 'overview' | 'group' | 'preferences';
export type Sheet = 'review' | 'history' | null;

export interface GroupMeta {
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface State {
  view: View;
  mode: Mode;
  group: string | null;
  focus: string | null;
  /** Bumps on every jump so the same field can be highlighted twice. */
  focusTick: number;
  sheet: Sheet;
  role: Role;
  scenario: Scenario;
  saved: Record<string, Record<string, FieldValue>>;
  meta: Record<string, GroupMeta>;
  history: Record<string, SettingsHistoryEntry[]>;
  drafts: Record<string, Record<string, FieldValue>>;
  restoreFrom: Record<string, number | undefined>;
  prefs: Record<string, FieldValue>;
  toast: { id: number; text: string } | null;
}

export type Action =
  | { type: 'go'; view: View; group?: string | null; focus?: string | null; sheet?: Sheet }
  | { type: 'mode'; mode: Mode }
  | { type: 'sheet'; sheet: Sheet }
  | { type: 'role'; role: Role }
  | { type: 'scenario'; scenario: Scenario }
  | { type: 'edit'; group: string; field: string; value: FieldValue }
  | { type: 'stage'; group: string; values: Record<string, FieldValue>; restoreFrom?: number }
  | { type: 'discard'; group: string }
  | { type: 'save'; group: string; note: string; pending: boolean }
  | { type: 'saveDirect'; group: string; values: Record<string, FieldValue> }
  | { type: 'pref'; key: string; value: FieldValue }
  | { type: 'toast'; text: string }
  | { type: 'toastClear' };

/** The author of local saves; rendered as "You". */
export const YOU = '@you';

// ---------------------------------------------------------------- URL hash

const OWN_KEYS = ['view', 'mode', 'group', 'focus', 'sheet', 'role', 'scenario'] as const;

function readHash(): URLSearchParams {
  const query = location.hash.split('?')[1] ?? '';
  return new URLSearchParams(query);
}

function writeHash(state: State) {
  const [path, query = ''] = location.hash.split('?');
  const params = new URLSearchParams(query);
  OWN_KEYS.forEach((k) => params.delete(k));
  if (state.view !== 'overview') params.set('view', state.view);
  params.set('mode', state.mode);
  if (state.view === 'group' && state.group) params.set('group', state.group);
  if (state.view === 'group' && state.focus) params.set('focus', state.focus);
  if (state.sheet) params.set('sheet', state.sheet);
  if (state.role !== 'owner') params.set('role', state.role);
  if (state.scenario !== 'default') params.set('scenario', state.scenario);
  const next = `${path}?${params.toString()}`;
  if (next !== location.hash) history.replaceState(null, '', next);
}

/** A shareable link to one field. */
export function fieldLink(group: string, field: string): string {
  const [path, query = ''] = location.hash.split('?');
  const params = new URLSearchParams(query);
  OWN_KEYS.forEach((k) => params.delete(k));
  params.set('view', 'group');
  params.set('group', group);
  params.set('focus', field);
  return `${location.origin}${location.pathname}${path}?${params.toString()}`;
}

const asRole = (v: string | null): Role => (v === 'admin' || v === 'none' ? v : 'owner');
const asScenario = (v: string | null): Scenario =>
  v === 'loading' || v === 'empty' || v === 'error' ? v : 'default';

// ---------------------------------------------------------------- initial state

const MODE_KEY = 'goteav-lab-v7:mode';
const DRAFT_KEY = 'goteav-lab-v7:drafts';

function readStore(storage: 'local' | 'session', key: string): string | null {
  try {
    return (storage === 'local' ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function writeStore(storage: 'local' | 'session', key: string, value: string) {
  try {
    (storage === 'local' ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    /* private mode or blocked storage: the page still works without it */
  }
}

function initialState(): State {
  const p = readHash();
  const saved: State['saved'] = {};
  const meta: State['meta'] = {};
  for (const g of SETTINGS_GROUPS) {
    saved[g.key] = Object.fromEntries(g.subsections.flatMap((s) => s.fields.map((f) => [f.key, f.value])));
    meta[g.key] = { version: g.version, updatedAt: g.updatedAt, updatedBy: g.updatedBy };
  }
  const prefs = Object.fromEntries(PREFERENCES.flatMap((tab) => tab.fields.map((f) => [f.key, f.value])));
  const view = (['group', 'preferences'] as const).find((v) => v === p.get('view')) ?? 'overview';
  const group = p.get('group');
  let drafts: State['drafts'] = {};
  let restoreFrom: State['restoreFrom'] = {};
  try {
    const raw = readStore('session', DRAFT_KEY);
    if (raw) ({ drafts = {}, restoreFrom = {} } = JSON.parse(raw));
  } catch {
    drafts = {};
  }
  const hasDraft = !!group && Object.keys(drafts[group] ?? {}).length > 0;
  const rawSheet = p.get('sheet');
  const sheet: Sheet = rawSheet === 'history' ? 'history' : rawSheet === 'review' && hasDraft ? 'review' : null;
  const scenario = asScenario(p.get('scenario'));
  // Mode: the link wins, then the viewer's last choice, then Operate once nothing waits for the owner.
  const hashMode = p.get('mode');
  const stored = readStore('local', MODE_KEY);
  const get = (id: string) => {
    const dot = id.indexOf('.');
    return saved[id.slice(0, dot)]?.[id.slice(dot + 1)];
  };
  const ownerDone = evaluate(get, { allDone: scenario === 'empty' }).every((c) => c.status !== 'todo');
  const mode: Mode =
    hashMode === 'operate' || hashMode === 'setup' ? hashMode : stored === 'operate' || stored === 'setup' ? stored : ownerDone ? 'operate' : 'setup';
  return {
    view: view === 'group' && !group ? 'overview' : view,
    mode,
    group,
    focus: p.get('focus'),
    focusTick: 1,
    sheet: view === 'group' ? sheet : null,
    role: asRole(p.get('role')),
    scenario,
    saved,
    meta,
    history: structuredClone(SETTINGS_HISTORY),
    drafts,
    restoreFrom,
    prefs,
    toast: null,
  };
}

// ---------------------------------------------------------------- reducer

let toastId = 0;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'go':
      return {
        ...state,
        view: action.view,
        group: action.group ?? (action.view === 'group' ? state.group : null),
        focus: action.focus ?? null,
        focusTick: state.focusTick + 1,
        sheet: action.sheet ?? null,
      };
    case 'mode':
      return { ...state, mode: action.mode };
    case 'sheet':
      return { ...state, sheet: action.sheet };
    case 'role':
      return { ...state, role: action.role };
    case 'scenario':
      return { ...state, scenario: action.scenario };
    case 'edit': {
      const draft = { ...(state.drafts[action.group] ?? {}) };
      if (sameValue(action.value, state.saved[action.group]?.[action.field])) delete draft[action.field];
      else draft[action.field] = action.value;
      return { ...state, drafts: { ...state.drafts, [action.group]: draft } };
    }
    case 'stage': {
      const draft = { ...(state.drafts[action.group] ?? {}) };
      for (const [field, value] of Object.entries(action.values)) {
        if (sameValue(value, state.saved[action.group]?.[field])) delete draft[field];
        else draft[field] = value;
      }
      return {
        ...state,
        drafts: { ...state.drafts, [action.group]: draft },
        restoreFrom: { ...state.restoreFrom, [action.group]: action.restoreFrom },
      };
    }
    case 'discard':
      return {
        ...state,
        drafts: { ...state.drafts, [action.group]: {} },
        restoreFrom: { ...state.restoreFrom, [action.group]: undefined },
      };
    case 'save': {
      const draft = state.drafts[action.group] ?? {};
      const fields = Object.keys(draft);
      if (!fields.length) return state;
      const cleared = {
        drafts: { ...state.drafts, [action.group]: {} },
        restoreFrom: { ...state.restoreFrom, [action.group]: undefined },
        sheet: null as Sheet,
      };
      // A change request waits for a second approver: nothing is applied yet.
      if (action.pending) return { ...state, ...cleared };
      return commit({ ...state, ...cleared }, action.group, draft, action.note);
    }
    case 'saveDirect':
      return commit(state, action.group, action.values, '');
    case 'pref':
      return { ...state, prefs: { ...state.prefs, [action.key]: action.value } };
    case 'toast':
      toastId += 1;
      return { ...state, toast: { id: toastId, text: action.text } };
    case 'toastClear':
      return { ...state, toast: null };
    default:
      return state;
  }
}

function commit(state: State, group: string, values: Record<string, FieldValue>, note: string): State {
  const before = state.saved[group] ?? {};
  const changes = Object.entries(values)
    .filter(([field, to]) => !sameValue(before[field], to))
    .map(([field, to]) => ({ field, from: before[field] ?? null, to }));
  if (!changes.length) return state;
  const version = state.meta[group].version + 1;
  const entry: SettingsHistoryEntry = {
    version,
    at: SETTINGS_NOW_ISO,
    by: YOU,
    note: note.trim() ? { ar: note.trim(), en: note.trim() } : null,
    changes,
  };
  const previous = state.history[group] ?? [];
  // The mock's first history entry is the current version; groups without history get a synthetic "current" row.
  const base: SettingsHistoryEntry[] = previous.length
    ? previous
    : [{ version: state.meta[group].version, at: state.meta[group].updatedAt, by: state.meta[group].updatedBy, note: null, changes: [] }];
  return {
    ...state,
    saved: { ...state.saved, [group]: { ...before, ...values } },
    meta: { ...state.meta, [group]: { version, updatedAt: SETTINGS_NOW_ISO, updatedBy: YOU } },
    history: { ...state.history, [group]: [entry, ...base] },
  };
}

// ---------------------------------------------------------------- context

interface Ctx {
  state: State;
  dispatch: Dispatch<Action>;
  t: Messages;
  lang: Locale;
  checks: Check[];
  /** Saved value by `<group>.<field>`. */
  get: (id: string) => FieldValue | undefined;
}

const SettingsCtx = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const lang = useLocale();
  const t = messages[lang];

  useEffect(() => writeHash(state), [state.view, state.mode, state.group, state.focus, state.sheet, state.role, state.scenario]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => writeStore('local', MODE_KEY, state.mode), [state.mode]);
  useEffect(() => writeStore('session', DRAFT_KEY, JSON.stringify({ drafts: state.drafts, restoreFrom: state.restoreFrom })), [state.drafts, state.restoreFrom]);

  // The gallery toolbar changes `scenario` / `role` through the hash.
  useEffect(() => {
    const onHash = () => {
      const p = readHash();
      dispatch({ type: 'scenario', scenario: asScenario(p.get('scenario')) });
      dispatch({ type: 'role', role: asRole(p.get('role')) });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const get = useMemo(() => {
    const saved = state.saved;
    return (id: string) => {
      const dot = id.indexOf('.');
      return saved[id.slice(0, dot)]?.[id.slice(dot + 1)];
    };
  }, [state.saved]);

  const checks = useMemo(() => evaluate(get, { allDone: state.scenario === 'empty' }), [get, state.scenario]);

  const value = useMemo(() => ({ state, dispatch, t, lang, checks, get }), [state, t, lang, checks, get]);
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error('useSettings outside SettingsProvider');
  return ctx;
}

/** Current value of a field: the draft when edited, else the saved value. */
export function effectiveValue(state: State, group: string, field: string): FieldValue | undefined {
  const draft = state.drafts[group];
  if (draft && field in draft) return draft[field];
  return state.saved[group]?.[field];
}

export function draftCount(state: State, group: string): number {
  return Object.keys(state.drafts[group] ?? {}).length;
}

export function displayAuthor(by: string, t: Messages): string {
  if (by === YOU) return t.history.you;
  if (by === 'System (defaults)') return t.history.system;
  return by;
}
