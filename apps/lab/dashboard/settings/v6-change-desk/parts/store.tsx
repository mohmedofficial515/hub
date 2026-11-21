// The change desk state: applied values, the draft ticket, versions, this session's applied tickets, route and toasts.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocale, useT, type Locale } from '@lab/i18n';
import { getGroup, PREFERENCES, SETTINGS_GROUPS, type FieldValue, type FlatField, type SettingsChange } from '@lab/mocks/settings';
import { messages, type Messages } from '../i18n';
import {
  canonicalId,
  FIELD_INDEX,
  INITIAL_VALUES,
  INITIAL_VERSIONS,
  needsSecondApprover,
  riskOf,
  type SessionHistory,
  type TimelineEntry,
} from './data';
import { NOW, sameValue } from './format';

export type View = 'overview' | 'group' | 'review' | 'timeline' | 'asof' | 'prefs';
export interface Route {
  v: View;
  g?: string;
  f?: string;
  d?: string;
}
export type Role = 'owner' | 'staff';
export type Scenario = 'default' | 'loading' | 'error' | 'empty';

// ---------- hash routing (keeps the lab's lang/theme/scenario params) ----------
function hashParts(): { path: string; params: URLSearchParams } {
  const raw = location.hash.replace(/^#/, '');
  const [path = '', query = ''] = raw.split('?');
  return { path, params: new URLSearchParams(query) };
}
export function readRoute(): Route {
  const { params } = hashParts();
  const v = (params.get('v') as View) || 'overview';
  return { v, g: params.get('g') ?? undefined, f: params.get('f') ?? undefined, d: params.get('d') ?? undefined };
}
function writeHash(mut: (p: URLSearchParams) => void, replace = false) {
  const { path, params } = hashParts();
  mut(params);
  const next = `#${path}?${params.toString()}`;
  if (replace) history.replaceState(null, '', next);
  else location.hash = next;
}
export function readParam(name: string): string | null {
  return hashParts().params.get(name);
}

export interface Draft {
  to: FieldValue;
  at: number;
  /** Group version the change was staged against (a newer server version makes it stale, like a 409). */
  base: number;
}

const STORAGE_KEY = 'goteav.settings.draft.v1:sara-haddad';
interface Stored {
  draft: Record<string, Draft>;
  ticketNo: number;
  savedAt: string;
}
function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Stored;
    return v && typeof v === 'object' && v.draft ? v : null;
  } catch {
    return null;
  }
}
function writeStored(v: Stored | null) {
  try {
    if (!v || Object.keys(v.draft).length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* storage blocked: the draft lives for this page only */
  }
}

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export interface ApplyResult {
  groupKey: string;
  status: 'pending' | 'applied' | 'waiting' | 'failed';
  version?: number;
  requestId?: string;
  /** Who saved the newer version when the apply failed with a conflict. */
  by?: string;
}

const ticketCodeOf = (n: number) => `CHG-${String(n).padStart(4, '0')}`;

interface Store {
  t: Messages;
  l: Locale;
  role: Role;
  setRole: (r: Role) => void;
  scenario: Scenario;
  route: Route;
  go: (r: Route) => void;
  values: Record<string, FieldValue>;
  versions: Record<string, number>;
  updated: Record<string, { at: string; by: string }>;
  draft: Record<string, Draft>;
  ticketCode: string;
  session: SessionHistory;
  /** Current (draft over applied) value. */
  get: (id: string) => FieldValue;
  getApplied: (id: string) => FieldValue;
  stage: (field: FlatField, to: FieldValue, quiet?: boolean) => void;
  stageMany: (items: { field: FlatField; to: FieldValue }[]) => number;
  unstage: (id: string) => void;
  discardAll: () => void;
  applyGroup: (groupKey: string, reason: string, opts: { fail?: boolean; force?: boolean }) => ApplyResult;
  finishTicket: () => void;
  prefs: Record<string, FieldValue>;
  setPref: (key: string, v: FieldValue, label: string) => void;
  resetPrefs: () => void;
  toasts: Toast[];
  toast: (text: string, action?: Toast['action']) => void;
  dismiss: (id: number) => void;
  trayOpen: boolean;
  setTrayOpen: (o: boolean) => void;
  pulse: number;
  /** Set when the draft was restored from this browser on load. */
  restored: { count: number; savedAt: string } | null;
  dismissRestored: () => void;
  /** Groups whose server version moved after their changes were staged. */
  staleGroups: string[];
  rebase: (groupKey: string) => void;
  saveNow: (id: string) => ApplyResult | null;
}

const Ctx = createContext<Store | null>(null);

export function useDesk(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useDesk outside provider');
  return s;
}

/** A sample draft across three groups (hash `draft=sample`), so the ticket can be seen without clicking. */
const SAMPLE: [string, FieldValue][] = [
  ['markup_rules.defaultRule.percent', 6.5],
  ['refund_policy.refundProcessingDays', 7],
  ['security.lockout.maxFailures', 3],
  ['tax.pricesIncludeTax', false],
  ['refund_policy.approvalThresholdUsd', 100],
];

const PREF_DEFAULTS: Record<string, FieldValue> = Object.fromEntries(PREFERENCES.flatMap((tab) => tab.fields.map((f) => [f.key, f.value])));

export function DeskProvider({ children }: { children: ReactNode }) {
  const t = useT(messages);
  const l = useLocale();
  const [route, setRoute] = useState<Route>(readRoute);
  const [role, setRoleState] = useState<Role>(() => (readParam('role') === 'staff' ? 'staff' : 'owner'));
  const scenario = (readParam('scenario') as Scenario) || 'default';
  const [values, setValues] = useState(INITIAL_VALUES);
  const staleParam = readParam('stale');
  const [versions, setVersions] = useState(() =>
    staleParam && staleParam in INITIAL_VERSIONS ? { ...INITIAL_VERSIONS, [staleParam]: INITIAL_VERSIONS[staleParam] + 1 } : INITIAL_VERSIONS,
  );
  const [updated, setUpdated] = useState<Record<string, { at: string; by: string }>>(() =>
    Object.fromEntries(SETTINGS_GROUPS.map((g) => [g.key, { at: g.updatedAt, by: g.updatedBy }])),
  );
  const [initial] = useState(() => {
    if (readParam('draft') === 'sample') {
      const d = Object.fromEntries(
        SAMPLE.map(([id, to], i) => [id, { to, at: i, base: INITIAL_VERSIONS[FIELD_INDEX.get(id)?.groupKey ?? ''] ?? 0 }]),
      );
      return { draft: d as Record<string, Draft>, ticketNo: 427, restored: null };
    }
    const stored = readStored();
    if (stored && Object.keys(stored.draft).length) {
      return { draft: stored.draft, ticketNo: stored.ticketNo || 427, restored: { count: Object.keys(stored.draft).length, savedAt: stored.savedAt } };
    }
    return { draft: {} as Record<string, Draft>, ticketNo: 427, restored: null };
  });
  const [draft, setDraft] = useState<Record<string, Draft>>(initial.draft);
  const [ticketNo, setTicketNo] = useState(initial.ticketNo);
  const [restored, setRestored] = useState(initial.restored);
  const firstStage = useRef(Object.keys(initial.draft).length > 0);
  const [session, setSession] = useState<SessionHistory>({});
  const [prefs, setPrefs] = useState(PREF_DEFAULTS);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [trayOpen, setTrayOpen] = useState(false);
  const [pulse, setPulse] = useState(0);
  const toastId = useRef(1);
  const clock = useRef(100);

  // Persist the ticket in this browser (per viewer) and guard leaving the page while it holds changes.
  useEffect(() => {
    if (readParam('draft') === 'sample') return;
    writeStored({ draft, ticketNo, savedAt: new Date().toISOString() });
  }, [draft, ticketNo]);
  useEffect(() => {
    if (Object.keys(draft).length === 0) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [draft]);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((r: Route) => {
    writeHash((p) => {
      for (const k of ['v', 'g', 'f', 'd']) p.delete(k);
      p.set('v', r.v);
      if (r.g) p.set('g', r.g);
      if (r.f) p.set('f', r.f);
      if (r.d) p.set('d', r.d);
    });
    setTrayOpen(false);
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    writeHash((p) => (r === 'staff' ? p.set('role', 'staff') : p.delete('role')), true);
  }, []);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (text: string, action?: Toast['action']) => {
      const id = toastId.current++;
      setToasts((all) => [...all.slice(-2), { id, text, action }]);
      window.setTimeout(() => dismiss(id), action ? 7000 : 4000);
    },
    [dismiss],
  );

  const getApplied = useCallback((id: string) => values[id] ?? null, [values]);
  const get = useCallback((id: string) => (id in draft ? draft[id].to : (values[id] ?? null)), [draft, values]);

  const stage = useCallback(
    (field: FlatField, to: FieldValue, quiet = true) => {
      const id = canonicalId(field);
      const g = FIELD_INDEX.get(id)?.groupKey ?? field.groupKey;
      const adding = !sameValue(values[id], to);
      setDraft((d) => {
        const next = { ...d };
        if (!adding) delete next[id];
        else next[id] = { to, at: d[id]?.at ?? clock.current++, base: d[id]?.base ?? versions[g] ?? 0 };
        return next;
      });
      setPulse((p) => p + 1);
      if (adding && !firstStage.current) {
        firstStage.current = true;
        toast(t.ticket.firstToast(ticketCodeOf(ticketNo)), { label: t.ticket.open, run: () => setTrayOpen(true) });
      } else if (!quiet) toast(t.ticket.stagedToast(field.label[l]));
    },
    [values, versions, toast, t, l, ticketNo],
  );

  const stageMany = useCallback(
    (items: { field: FlatField; to: FieldValue }[]) => {
      setDraft((d) => {
        const next = { ...d };
        for (const { field, to } of items) {
          const id = canonicalId(field);
          if (sameValue(values[id], to)) delete next[id];
          else next[id] = { to, at: d[id]?.at ?? clock.current++, base: d[id]?.base ?? versions[FIELD_INDEX.get(id)?.groupKey ?? field.groupKey] ?? 0 };
        }
        return next;
      });
      setPulse((p) => p + 1);
      return items.filter(({ field, to }) => !sameValue(values[canonicalId(field)], to)).length;
    },
    [values, versions],
  );

  const unstage = useCallback((id: string) => {
    setDraft((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  }, []);

  const discardAll = useCallback(() => {
    const saved = draft;
    const n = Object.keys(saved).length;
    setDraft({});
    toast(t.ticket.discarded(n), { label: t.ticket.undo, run: () => setDraft(saved) });
  }, [draft, toast, t]);

  const ticketCode = ticketCodeOf(ticketNo);

  /** Apply one group of the ticket (sequential apply is a proposal; the backend saves one group at a time). */
  const applyGroup = useCallback(
    (groupKey: string, reason: string, opts: { fail?: boolean; force?: boolean }): ApplyResult => {
      const ids = Object.keys(draft).filter((id) => FIELD_INDEX.get(id)?.groupKey === groupKey && !FIELD_INDEX.get(id)?.proposed);
      const stale = ids.some((id) => (draft[id].base ?? versions[groupKey]) < versions[groupKey]);
      const by = updated[groupKey]?.by ?? getGroup(groupKey)?.updatedBy;
      if (opts.fail || (stale && !opts.force)) return { groupKey, status: 'failed', by };
      const fields = ids.map((id) => FIELD_INDEX.get(id)!);
      const waits = role === 'staff' && fields.some(needsSecondApprover);
      if (waits) {
        const requestId = `scr_${(groupKey.length * 7919 + ids.length * 104729).toString(16).slice(-6)}`;
        setDraft((d) => {
          const next = { ...d };
          for (const id of ids) delete next[id];
          return next;
        });
        return { groupKey, status: 'waiting', requestId };
      }
      const version = (versions[groupKey] ?? 0) + 1;
      const at = new Date(NOW.getTime() + 60_000).toISOString();
      const changes: SettingsChange[] = fields.map((f) => ({ field: f.key, from: values[f.id] ?? null, to: draft[f.id].to }));
      const entry: TimelineEntry = { version, at, by: t.me, note: reason ? { ar: reason, en: reason } : null, changes, groupKey, ticket: ticketCode };
      setValues((v) => {
        const next = { ...v };
        for (const f of fields) next[f.id] = draft[f.id].to;
        return next;
      });
      setVersions((v) => ({ ...v, [groupKey]: version }));
      setUpdated((u) => ({ ...u, [groupKey]: { at, by: t.me } }));
      setSession((s) => ({ ...s, [groupKey]: [entry, ...(s[groupKey] ?? [])] }));
      setDraft((d) => {
        const next = { ...d };
        for (const id of ids) delete next[id];
        return next;
      });
      return { groupKey, status: 'applied', version };
    },
    [draft, role, versions, values, t, ticketCode, updated],
  );

  const staleGroups = useMemo(
    () => [...new Set(Object.entries(draft).filter(([id, d]) => { const g = FIELD_INDEX.get(id)?.groupKey ?? ''; return d.base < (versions[g] ?? 0); }).map(([id]) => FIELD_INDEX.get(id)?.groupKey ?? ''))],
    [draft, versions],
  );
  const rebase = useCallback(
    (groupKey: string) =>
      setDraft((d) => {
        const next = { ...d };
        for (const [id, x] of Object.entries(next)) if (FIELD_INDEX.get(id)?.groupKey === groupKey) next[id] = { ...x, base: versions[groupKey] };
        return next;
      }),
    [versions],
  );
  /** Fast path: a ticket of one low-risk change applies at once, with no review page. */
  const saveNow = useCallback(
    (id: string) => {
      const f = FIELD_INDEX.get(id);
      if (!f) return null;
      const r = applyGroup(f.groupKey, '', {});
      if (r.status === 'applied') {
        toast(t.ticket.savedNow(f.label[l], r.version!));
        setTicketNo((n) => n + 1);
      } else if (r.status === 'failed') toast(t.review.failedBody(r.by ?? ''));
      return r;
    },
    [applyGroup, toast, t, l],
  );
  const dismissRestored = useCallback(() => setRestored(null), []);

  const finishTicket = useCallback(() => setTicketNo((n) => n + 1), []);

  const setPref = useCallback(
    (key: string, v: FieldValue, label: string) => {
      setPrefs((p) => ({ ...p, [key]: v }));
      if (key === 'theme' && (v === 'light' || v === 'dark')) {
        document.documentElement.classList.toggle('dark', v === 'dark');
        document.documentElement.style.colorScheme = v;
        writeHash((p) => p.set('theme', v), true);
      }
      if (key === 'language' && (v === 'ar' || v === 'en')) writeHash((p) => p.set('lang', v));
      toast(t.prefs.applied(label));
    },
    [toast, t],
  );
  const resetPrefs = useCallback(() => {
    setPrefs(PREF_DEFAULTS);
    toast(t.prefs.resetDone);
  }, [toast, t]);

  const value = useMemo<Store>(
    () => ({
      t,
      l,
      role,
      setRole,
      scenario,
      route,
      go,
      values,
      versions,
      updated,
      draft,
      ticketCode,
      session,
      get,
      getApplied,
      stage,
      stageMany,
      unstage,
      discardAll,
      applyGroup,
      finishTicket,
      prefs,
      setPref,
      resetPrefs,
      toasts,
      toast,
      dismiss,
      trayOpen,
      setTrayOpen,
      pulse,
      restored,
      dismissRestored,
      staleGroups,
      rebase,
      saveNow,
    }),
    [t, l, role, setRole, scenario, route, go, values, versions, updated, draft, ticketCode, session, get, getApplied, stage, stageMany, unstage, discardAll, applyGroup, finishTicket, prefs, setPref, resetPrefs, toasts, toast, dismiss, trayOpen, pulse, restored, dismissRestored, staleGroups, rebase, saveNow],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ---------- derived draft view ----------
export interface StagedItem {
  id: string;
  field: FlatField;
  from: FieldValue;
  to: FieldValue;
  at: number;
}

export function useStaged(): { items: StagedItem[]; byGroup: { groupKey: string; items: StagedItem[] }[] } {
  const { draft, values } = useDesk();
  return useMemo(() => {
    const items = Object.entries(draft)
      .map(([id, d]) => ({ id, field: FIELD_INDEX.get(id)!, from: values[id] ?? null, to: d.to, at: d.at }))
      .filter((x) => !!x.field)
      .sort((a, b) => a.at - b.at);
    const order = SETTINGS_GROUPS.map((g) => g.key);
    const map = new Map<string, StagedItem[]>();
    for (const it of items) map.set(it.field.groupKey, [...(map.get(it.field.groupKey) ?? []), it]);
    const byGroup = [...map.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([groupKey, list]) => ({ groupKey, items: list }));
    return { items, byGroup };
  }, [draft, values]);
}

export function ticketStats(items: StagedItem[], role: Role) {
  const high = items.filter((i) => riskOf(i.field) === 'high').length;
  const security = items.filter((i) => i.field.control === 'security').length;
  const waitGroups = new Set(items.filter((i) => needsSecondApprover(i.field)).map((i) => i.field.groupKey));
  const groups = new Set(items.map((i) => i.field.groupKey)).size;
  return { high, security, waitGroups: role === 'staff' ? waitGroups.size : 0, secondApproverGroups: waitGroups.size, groups };
}

export const groupOf = (key: string) => getGroup(key);
