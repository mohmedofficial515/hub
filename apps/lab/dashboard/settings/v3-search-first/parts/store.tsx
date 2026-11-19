// Page state: drafts per group (explicit Save), saved values and versions after a local save, history added in this
// session, pending second-approver requests, pinned fields, personal preferences (instant) and toasts.

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  SETTINGS_NOW_ISO,
  type FieldValue,
  type Localized,
  type SettingsChange,
  type SettingsHistoryEntry,
} from '@lab/mocks/settings';
import { entryOf, groupByKey, historyOf, same, waitsForApprover, type Role } from './model';

export type Scenario = 'default' | 'loading' | 'empty' | 'error';

export interface PendingRequest {
  id: string;
  by: string;
  at: string;
  changes: SettingsChange[];
}

export interface Toast {
  id: number;
  text: string;
  tone: 'done' | 'info';
}

export interface SaveResult {
  saved: { groupKey: string; version: number; count: number }[];
  requested: { groupKey: string; id: string; count: number }[];
}

type Values = Record<string, Record<string, FieldValue>>;

interface Store {
  role: Role;
  setRole: (role: Role) => void;
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  actor: string;
  saved: (groupKey: string, key: string) => FieldValue;
  value: (groupKey: string, key: string) => FieldValue;
  drafts: Values;
  setDraft: (groupKey: string, key: string, value: FieldValue) => void;
  discard: (groupKey?: string, key?: string) => void;
  dirtyCount: (groupKey?: string) => number;
  dirtyGroups: string[];
  version: (groupKey: string) => number;
  history: (groupKey: string) => SettingsHistoryEntry[];
  pending: Record<string, PendingRequest>;
  save: (groupKeys: string[], note: string) => SaveResult;
  draftNote: Record<string, string>;
  setDraftNote: (groupKey: string, note: string) => void;
  pinned: string[];
  togglePin: (id: string) => void;
  prefs: Record<string, FieldValue>;
  setPref: (groupKey: string, key: string, value: FieldValue) => void;
  resetPrefs: () => void;
  toasts: Toast[];
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(Ctx);
  if (!store) throw new Error('StoreProvider missing');
  return store;
}

const DEFAULT_PINS = ['maintenance.enabled', 'refund_policy.destination', 'security.lockout.maxFailures', 'markup_rules.defaultRule.percent'];

export function StoreProvider({
  children,
  initialRole,
  initialScenario,
}: {
  children: ReactNode;
  initialRole: Role;
  initialScenario: Scenario;
}) {
  const [role, setRole] = useState<Role>(initialRole);
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [savedOver, setSavedOver] = useState<Values>({});
  const [drafts, setDrafts] = useState<Values>({});
  const [versions, setVersions] = useState<Record<string, number>>({});
  const [extraHistory, setExtraHistory] = useState<Record<string, SettingsHistoryEntry[]>>({});
  const [pending, setPending] = useState<Record<string, PendingRequest>>({});
  const [draftNote, setDraftNotes] = useState<Record<string, string>>({});
  const [pinned, setPinned] = useState<string[]>(() =>
    initialScenario === 'empty' ? [] : DEFAULT_PINS.filter((id) => !!entryOf(id.split('.')[0], id.split('.').slice(1).join('.'))),
  );
  const [prefs, setPrefs] = useState<Record<string, FieldValue>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const actor = role === 'owner' ? 'Sara Haddad' : 'Omar Kaya';

  const saved = useCallback(
    (groupKey: string, key: string): FieldValue => {
      if (groupKey.startsWith('pref:')) {
        const id = `pref.${groupKey.slice(5)}.${key}`;
        if (id in prefs) return prefs[id];
      }
      const over = savedOver[groupKey];
      if (over && key in over) return over[key];
      return entryOf(groupKey, key)?.field.value ?? null;
    },
    [savedOver, prefs],
  );

  const value = useCallback(
    (groupKey: string, key: string): FieldValue => {
      const d = drafts[groupKey];
      if (d && key in d) return d[key];
      return saved(groupKey, key);
    },
    [drafts, saved],
  );

  const setDraft = useCallback(
    (groupKey: string, key: string, next: FieldValue) => {
      setDrafts((prev) => {
        const group = { ...(prev[groupKey] ?? {}) };
        if (same(next, saved(groupKey, key))) delete group[key];
        else group[key] = next;
        const out = { ...prev };
        if (Object.keys(group).length) out[groupKey] = group;
        else delete out[groupKey];
        return out;
      });
    },
    [saved],
  );

  const discard = useCallback((groupKey?: string, key?: string) => {
    setDrafts((prev) => {
      if (!groupKey) return {};
      const out = { ...prev };
      if (key) {
        const group = { ...(out[groupKey] ?? {}) };
        delete group[key];
        if (Object.keys(group).length) out[groupKey] = group;
        else delete out[groupKey];
      } else delete out[groupKey];
      return out;
    });
    if (!groupKey || !key) setDraftNotes((prev) => (groupKey ? { ...prev, [groupKey]: '' } : {}));
  }, []);

  const dirtyCount = useCallback(
    (groupKey?: string) =>
      groupKey
        ? Object.keys(drafts[groupKey] ?? {}).length
        : Object.values(drafts).reduce((n, g) => n + Object.keys(g).length, 0),
    [drafts],
  );

  const version = useCallback((groupKey: string) => versions[groupKey] ?? groupByKey(groupKey)?.version ?? 1, [versions]);

  const history = useCallback(
    (groupKey: string): SettingsHistoryEntry[] => {
      const group = groupByKey(groupKey);
      const base = historyOf(groupKey);
      const own = extraHistory[groupKey] ?? [];
      if (scenario === 'empty') return own;
      if (base.length || !group) return [...own, ...base];
      return [
        ...own,
        { version: group.version, at: group.updatedAt, by: group.updatedBy, note: null, changes: [] },
      ];
    },
    [extraHistory, scenario],
  );

  const save = useCallback(
    (groupKeys: string[], note: string): SaveResult => {
      const result: SaveResult = { saved: [], requested: [] };
      const noteL: Localized | null = note.trim() ? { ar: note.trim(), en: note.trim() } : null;
      const nextSaved: Values = { ...savedOver };
      const nextVersions = { ...versions };
      const nextHistory = { ...extraHistory };
      const nextPending = { ...pending };
      for (const groupKey of groupKeys) {
        const draft = drafts[groupKey];
        if (!draft) continue;
        const group = groupByKey(groupKey);
        const apply: SettingsChange[] = [];
        const wait: SettingsChange[] = [];
        for (const [key, to] of Object.entries(draft)) {
          const entry = entryOf(groupKey, key);
          if (!entry) continue;
          const change = { field: key, from: saved(groupKey, key), to };
          (waitsForApprover(role, group, entry.field) ? wait : apply).push(change);
        }
        if (apply.length) {
          const v = (nextVersions[groupKey] ?? group?.version ?? 1) + 1;
          nextVersions[groupKey] = v;
          nextSaved[groupKey] = { ...(nextSaved[groupKey] ?? {}), ...Object.fromEntries(apply.map((c) => [c.field, c.to])) };
          nextHistory[groupKey] = [{ version: v, at: SETTINGS_NOW_ISO, by: actor, note: noteL, changes: apply }, ...(nextHistory[groupKey] ?? [])];
          result.saved.push({ groupKey, version: v, count: apply.length });
        }
        if (wait.length) {
          const id = `scr_${Math.random().toString(16).slice(2, 8)}`;
          nextPending[groupKey] = { id, by: actor, at: SETTINGS_NOW_ISO, changes: wait };
          result.requested.push({ groupKey, id, count: wait.length });
        }
      }
      setSavedOver(nextSaved);
      setVersions(nextVersions);
      setExtraHistory(nextHistory);
      setPending(nextPending);
      setDrafts((prev) => {
        const out = { ...prev };
        groupKeys.forEach((k) => delete out[k]);
        return out;
      });
      setDraftNotes((prev) => {
        const out = { ...prev };
        groupKeys.forEach((k) => delete out[k]);
        return out;
      });
      return result;
    },
    [savedOver, versions, extraHistory, pending, drafts, saved, role, actor],
  );

  const togglePin = useCallback((id: string) => {
    setPinned((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }, []);

  const setPref = useCallback((groupKey: string, key: string, next: FieldValue) => {
    setPrefs((prev) => ({ ...prev, [`pref.${groupKey.slice(5)}.${key}`]: next }));
  }, []);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'done') => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5000);
  }, []);

  const store = useMemo<Store>(
    () => ({
      role,
      setRole,
      scenario,
      setScenario,
      actor,
      saved,
      value,
      drafts,
      setDraft,
      discard,
      dirtyCount,
      dirtyGroups: Object.keys(drafts),
      version,
      history,
      pending,
      save,
      draftNote,
      setDraftNote: (groupKey, note) => setDraftNotes((prev) => ({ ...prev, [groupKey]: note })),
      pinned,
      togglePin,
      prefs,
      setPref,
      resetPrefs: () => setPrefs({}),
      toasts,
      toast,
      dismissToast: (id) => setToasts((prev) => prev.filter((x) => x.id !== id)),
    }),
    [role, scenario, actor, saved, value, drafts, setDraft, discard, dirtyCount, version, history, pending, save, draftNote, pinned, togglePin, prefs, setPref, toasts, toast],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
