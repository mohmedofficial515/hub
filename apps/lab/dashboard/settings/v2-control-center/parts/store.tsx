/**
 * Page-wide state of the control centre: route (synced to the frame hash so Back and deep links work), the saved
 * value of every group, per-group drafts, versions and history, pending approval requests, personal preferences,
 * the prototype viewer/scenario switches and toasts. Nothing persists: a reload resets the session.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocale, useT, type Locale } from '@lab/i18n';
import {
  PREFERENCES,
  SETTINGS_GROUPS,
  SETTINGS_HISTORY,
  SETTINGS_NOW_ISO,
  getGroup,
  type FieldValue,
  type SettingsChange,
  type SettingsGroup,
  type SettingsHistoryEntry,
} from '@lab/mocks/settings';
import { messages, type Messages } from '../i18n';
import { fill } from './format';
import { diff, initialValues, same, valuesAt, type Values } from './model';

export type View = 'overview' | 'group' | 'prefs';
export type Panel = 'review' | 'history' | null;
export type Viewer = 'owner' | 'admin' | 'none';
export type Scenario = 'default' | 'loading' | 'error' | 'empty';
export type PrefTab = 'appearance' | 'tables' | 'notifications';

export interface Route {
  view: View;
  group?: string;
  field?: string;
  panel?: Panel;
  tab?: PrefTab;
}

export interface Meta {
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface Pending {
  by: string;
  at: string;
  changes: SettingsChange[];
  note: string;
}

export interface Toast {
  id: number;
  text: string;
}

/** The author of saves made in this session; rendered as "You". */
export const YOU = '__you__';

/** `draft=demo` in the hash preloads these edits, so the review sheet can be opened from a link. */
const DEMO_DRAFTS: Record<string, Values> = {
  refund_policy: { destination: 'WALLET', approvalThresholdUsd: 500, refundProcessingDays: 14, walletIncentivePercent: 5 },
  security: { 'lockout.maxFailures': 3, 'adminIpAllowlist.enabled': true, 'invites.ttlHours': 48 },
  flights: { priceLockMinutes: 20, maxPassengers: 8 },
};

interface Store {
  t: Messages;
  locale: Locale;
  dir: 'rtl' | 'ltr';
  route: Route;
  go: (route: Route, opts?: { replace?: boolean }) => void;
  viewer: Viewer;
  setViewer: (v: Viewer) => void;
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  /** Groups the viewer may open (payment gateway keys are owner only). */
  groups: SettingsGroup[];
  canSee: (key: string) => boolean;
  saved: Record<string, Values>;
  meta: Record<string, Meta>;
  history: Record<string, SettingsHistoryEntry[]>;
  drafts: Record<string, Values>;
  pending: Record<string, Pending | undefined>;
  restoreFrom: Record<string, number | undefined>;
  valueOf: (group: string, key: string) => FieldValue;
  setValue: (group: string, key: string, value: FieldValue) => void;
  resetFields: (group: string, keys: string[]) => void;
  discard: (group: string) => void;
  stageRestore: (group: string, version: number) => void;
  commit: (group: string, note: string) => number;
  sendForApproval: (group: string, note: string) => void;
  withdraw: (group: string) => void;
  needsApproval: (group: SettingsGroup) => boolean;
  prefs: Values;
  setPref: (key: string, value: FieldValue) => void;
  toasts: Toast[];
  toast: (text: string) => void;
  dismissToast: (id: number) => void;
  initialQuery: string;
  /** Bumped on every deep link so the same field can be highlighted twice. */
  focusNonce: number;
}

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore outside StoreProvider');
  return store;
}

// ─── Hash <-> route ──────────────────────────────────────────────────────────

function hashParts() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { path, params: new URLSearchParams(query) };
}

function readRoute(params: URLSearchParams): Route {
  const view = (['overview', 'group', 'prefs'] as const).find((v) => v === params.get('view')) ?? 'overview';
  const panel = params.get('panel');
  const tab = params.get('tab');
  return {
    view,
    group: params.get('g') ?? undefined,
    field: params.get('f') ?? undefined,
    panel: panel === 'review' || panel === 'history' ? panel : null,
    tab: tab === 'tables' || tab === 'notifications' ? tab : 'appearance',
  };
}

const ROUTE_KEYS = ['view', 'g', 'f', 'panel', 'tab', 'q', 'draft'];

export function routeHash(route: Route): string {
  const { path, params } = hashParts();
  for (const key of ROUTE_KEYS) params.delete(key);
  if (route.view !== 'overview') params.set('view', route.view);
  if (route.group) params.set('g', route.group);
  if (route.field) params.set('f', route.field);
  if (route.panel) params.set('panel', route.panel);
  if (route.view === 'prefs' && route.tab && route.tab !== 'appearance') params.set('tab', route.tab);
  return `#/${path}?${params.toString()}`;
}

export function fieldLink(group: string, field?: string): string {
  return `${location.origin}${location.pathname}${routeHash({ view: 'group', group, field })}`;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const t = useT(messages);
  const boot = useMemo(() => hashParts().params, []);

  const [route, setRoute] = useState<Route>(() => readRoute(boot));
  const [viewer, setViewer] = useState<Viewer>(() => {
    const v = boot.get('viewer');
    return v === 'admin' || v === 'none' ? v : 'owner';
  });
  const [scenario, setScenario] = useState<Scenario>(() => {
    const s = boot.get('scenario');
    return s === 'loading' || s === 'error' || s === 'empty' ? s : 'default';
  });
  const [saved, setSaved] = useState<Record<string, Values>>(() => Object.fromEntries(SETTINGS_GROUPS.map((g) => [g.key, initialValues(g)])));
  const [meta, setMeta] = useState<Record<string, Meta>>(() =>
    Object.fromEntries(SETTINGS_GROUPS.map((g) => [g.key, { version: g.version, updatedAt: g.updatedAt, updatedBy: g.updatedBy }])),
  );
  const [history, setHistory] = useState<Record<string, SettingsHistoryEntry[]>>(() => ({ ...SETTINGS_HISTORY }));
  const [drafts, setDrafts] = useState<Record<string, Values>>(() => {
    const g = boot.get('g');
    return boot.get('draft') === 'demo' && g && DEMO_DRAFTS[g] ? { [g]: DEMO_DRAFTS[g] } : {};
  });
  const [pending, setPending] = useState<Record<string, Pending | undefined>>({});
  const [restoreFrom, setRestoreFrom] = useState<Record<string, number | undefined>>({});
  const [prefs, setPrefs] = useState<Values>(() => Object.fromEntries(PREFERENCES.flatMap((tab) => tab.fields.map((f) => [f.key, f.value]))));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [focusNonce, setFocusNonce] = useState(0);
  const toastId = useRef(0);

  const go = useCallback((next: Route, opts?: { replace?: boolean }) => {
    setRoute(next);
    if (next.field) setFocusNonce((n) => n + 1);
    const hash = routeHash(next);
    if (opts?.replace) history_replace(hash);
    else window.history.pushState(null, '', hash);
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(readRoute(hashParts().params));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const toast = useCallback((text: string) => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((list) => [...list.slice(-2), { id, text }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 4200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), []);

  const canSee = useCallback(
    (key: string) => {
      if (viewer === 'none') return false;
      if (key === 'payment_gateways') return viewer === 'owner';
      return true;
    },
    [viewer],
  );
  const groups = useMemo(() => SETTINGS_GROUPS.filter((g) => canSee(g.key)), [canSee]);

  const valueOf = useCallback(
    (group: string, key: string): FieldValue => {
      const draft = drafts[group];
      if (draft && key in draft) return draft[key];
      return saved[group]?.[key] ?? null;
    },
    [drafts, saved],
  );

  const setValue = useCallback(
    (group: string, key: string, value: FieldValue) => {
      setDrafts((all) => {
        const next = { ...(all[group] ?? {}) };
        if (same(saved[group]?.[key], value)) delete next[key];
        else next[key] = value;
        const out = { ...all, [group]: next };
        if (Object.keys(next).length === 0) delete out[group];
        return out;
      });
    },
    [saved],
  );

  const resetFields = useCallback(
    (group: string, keys: string[]) => {
      const g = getGroup(group);
      if (!g) return;
      const defaults = new Map(g.subsections.flatMap((s) => s.fields).map((f) => [f.key, f.default]));
      for (const key of keys) setValue(group, key, defaults.get(key) ?? null);
    },
    [setValue],
  );

  const discard = useCallback((group: string) => {
    setDrafts((all) => {
      const out = { ...all };
      delete out[group];
      return out;
    });
    setRestoreFrom((all) => ({ ...all, [group]: undefined }));
  }, []);

  const stageRestore = useCallback(
    (group: string, version: number) => {
      const g = getGroup(group);
      if (!g) return;
      const target = valuesAt(saved[group], history[group] ?? [], version);
      const changes = diff(g, saved[group], target);
      setDrafts((all) => ({ ...all, [group]: Object.fromEntries(changes.map((c) => [c.key, c.to])) }));
      setRestoreFrom((all) => ({ ...all, [group]: version }));
    },
    [saved, history],
  );

  const commit = useCallback(
    (group: string, note: string): number => {
      const g = getGroup(group);
      const draft = drafts[group];
      if (!g || !draft) return meta[group]?.version ?? 0;
      const changes = diff(g, saved[group], draft);
      const version = (meta[group]?.version ?? 0) + 1;
      setSaved((all) => ({ ...all, [group]: { ...all[group], ...draft } }));
      setMeta((all) => ({ ...all, [group]: { version, updatedAt: SETTINGS_NOW_ISO, updatedBy: YOU } }));
      setHistory((all) => ({
        ...all,
        [group]: [
          {
            version,
            at: SETTINGS_NOW_ISO,
            by: YOU,
            note: note ? { ar: note, en: note } : null,
            changes: changes.map((c) => ({ field: c.key, from: c.from, to: c.to })),
          },
          ...(all[group] ?? []),
        ],
      }));
      discard(group);
      return version;
    },
    [drafts, saved, meta, discard],
  );

  const sendForApproval = useCallback(
    (group: string, note: string) => {
      const g = getGroup(group);
      const draft = drafts[group];
      if (!g || !draft) return;
      const changes = diff(g, saved[group], draft);
      setPending((all) => ({ ...all, [group]: { by: YOU, at: SETTINGS_NOW_ISO, note, changes: changes.map((c) => ({ field: c.key, from: c.from, to: c.to })) } }));
      discard(group);
    },
    [drafts, saved, discard],
  );

  const withdraw = useCallback((group: string) => setPending((all) => ({ ...all, [group]: undefined })), []);

  const needsApproval = useCallback(
    (group: SettingsGroup) => viewer !== 'owner' && group.approval === 'second-approver',
    [viewer],
  );

  const setPref = useCallback((key: string, value: FieldValue) => setPrefs((all) => ({ ...all, [key]: value })), []);

  const value: Store = {
    t,
    locale,
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    route,
    go,
    viewer,
    setViewer,
    scenario,
    setScenario,
    groups,
    canSee,
    saved,
    meta,
    history,
    drafts,
    pending,
    restoreFrom,
    valueOf,
    setValue,
    resetFields,
    discard,
    stageRestore,
    commit,
    sendForApproval,
    withdraw,
    needsApproval,
    prefs,
    setPref,
    toasts,
    toast,
    dismissToast,
    initialQuery: boot.get('q') ?? '',
    focusNonce,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function history_replace(hash: string) {
  window.history.replaceState(null, '', hash);
}

/** "You" for saves made in this session, the stored name otherwise. */
export function who(t: Messages, by: string): string {
  return by === YOU ? t.history.you : by;
}

export async function copyText(text: string, t: Messages, toast: (s: string) => void, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast(fill(t.toast.copyFailed, { url: text }));
  }
}
