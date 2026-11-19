import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocale, useT } from '@lab/i18n';
import {
  PREFERENCES,
  SETTINGS_GROUPS,
  SETTINGS_HISTORY,
  SETTINGS_NOW_ISO,
  type Field,
  type FieldValue,
  type SectionId,
  type SettingsChange,
  type SettingsGroup,
  type SettingsHistoryEntry,
} from '@lab/mocks/settings';
import { messages, type Messages } from '../i18n';
import { fieldsOf, findField, groupByKey, hashParam, same, sectionOfGroup, writeHash, type FieldFlag, type PrefTabId } from './lib';

export type Role = 'owner' | 'admin';
/** Drill level below the 3-column width: home (sections / landing), list (groups or results), editor. */
export type Pane = 'home' | 'list' | 'editor';
export type Scenario = 'default' | 'loading' | 'error';

export interface Target {
  section?: SectionId | 'prefs' | null;
  group?: string | null;
  prefTab?: PrefTabId | null;
  field?: string | null;
  pane?: Pane;
}

export interface ReviewState {
  mode: 'save' | 'restore';
  groupKey: string;
  changes: SettingsChange[];
  restoreFrom?: number;
}

interface Pending {
  id: string;
  count: number;
}

const PEOPLE: Record<Role, string> = { owner: 'Sara Haddad', admin: 'Omar Kaya' };

function initialValues() {
  const out: Record<string, Record<string, FieldValue>> = {};
  for (const g of SETTINGS_GROUPS) out[g.key] = Object.fromEntries(fieldsOf(g).map((f) => [f.key, f.value]));
  return out;
}

function initialPrefs() {
  const out: Record<string, FieldValue> = {};
  for (const tab of PREFERENCES) for (const f of tab.fields) out[`${tab.id}.${f.key}`] = f.value;
  return out;
}

const HIDDEN_FOR_ADMIN = new Set(['payment_gateways']);

function useStoreValue() {
  const t = useT(messages) as Messages;
  const locale = useLocale();

  const initialGroup = hashParam('g');
  const initialPref = hashParam('pref') as PrefTabId | null;
  const [role, setRoleState] = useState<Role>(hashParam('as') === 'admin' ? 'admin' : 'owner');
  const [scenario, setScenario] = useState<Scenario>(() => {
    const s = hashParam('scenario');
    return s === 'loading' || s === 'error' ? s : 'default';
  });

  const [section, setSection] = useState<SectionId | 'prefs' | null>(() => {
    if (initialPref) return 'prefs';
    if (initialGroup && groupByKey.get(initialGroup)) return groupByKey.get(initialGroup)!.section;
    const s = hashParam('s');
    return (s as SectionId | 'prefs' | null) ?? null;
  });
  const [group, setGroup] = useState<string | null>(initialGroup && groupByKey.get(initialGroup) ? initialGroup : null);
  const [prefTab, setPrefTab] = useState<PrefTabId | null>(initialPref);
  const [pane, setPane] = useState<Pane>(() => {
    const p = hashParam('p');
    if (p === 'home' || p === 'list' || p === 'editor') return p;
    return initialGroup || initialPref ? 'editor' : hashParam('s') ? 'list' : 'home';
  });

  const [values, setValues] = useState(initialValues);
  const [prefValues, setPrefValues] = useState(initialPrefs);
  const [prefApplied, setPrefApplied] = useState<string | null>(null);
  const [versions, setVersions] = useState(() => Object.fromEntries(SETTINGS_GROUPS.map((g) => [g.key, g.version])));
  const [meta, setMeta] = useState(() => Object.fromEntries(SETTINGS_GROUPS.map((g) => [g.key, { at: g.updatedAt, by: g.updatedBy }])));
  const [history, setHistory] = useState<Record<string, SettingsHistoryEntry[]>>(() => ({ ...SETTINGS_HISTORY }));
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [draft, setDraft] = useState<Record<string, FieldValue>>({});

  const [focus, setFocus] = useState<string | null>(hashParam('f'));
  const [flash, setFlash] = useState<{ key: string; n: number } | null>(() => (hashParam('f') ? { key: hashParam('f')!, n: 1 } : null));
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(() => hashParam('inspector') !== '0');
  const [inspectorTab, setInspectorTab] = useState<'field' | 'history'>(hashParam('tab') === 'history' ? 'history' : 'field');
  const [sheetOpen, setSheetOpen] = useState(hashParam('sheet') === '1');

  const [query, setQuery] = useState(hashParam('q') ?? '');
  const [flags, setFlags] = useState<Set<FieldFlag>>(new Set());
  const [guard, setGuard] = useState<Target | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [railExpanded, setRailExpanded] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const afterSave = useRef<Target | null>(null);

  const dirtyCount = Object.keys(draft).length;
  const hidden = useCallback((key: string) => role === 'admin' && HIDDEN_FOR_ADMIN.has(key), [role]);

  const say = useCallback((text: string) => setToast({ text, id: Date.now() }), []);

  /** A focus move requested by navigation (drill in / Back), applied by the shell after the panes render. */
  const [focusReq, setFocusReq] = useState<{ sel: string; n: number } | null>(null);
  const requestFocus = useCallback((sel: string) => setFocusReq({ sel, n: Date.now() }), []);

  // History: navigation-level changes (section, group, preference tab, drill pane) push an entry so browser / device Back goes up
  // one level; in-page changes (the focused field) only replace the current entry.
  const fromPop = useRef(false);
  const lastNav = useRef<string | null>(null);
  useEffect(() => {
    const nav = JSON.stringify([group, section, prefTab, pane]);
    const push = lastNav.current !== null && lastNav.current !== nav && !fromPop.current;
    writeHash(
      {
        g: group,
        pref: section === 'prefs' ? prefTab : null,
        s: !group && section && !(section === 'prefs' && prefTab) ? section : null,
        p: pane,
        f: focus,
      },
      push,
    );
    lastNav.current = nav;
    fromPop.current = false;
  }, [group, section, prefTab, pane, focus]);

  const commit = useCallback((target: Target) => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && !target.field && target.pane) {
      if (target.pane === 'editor') requestFocus('#v5-pane-title');
      else if (target.pane === 'list') requestFocus(group && target.group === undefined ? `[data-group="${group}"]` : '#v5-list-title');
      else if (target.pane === 'home') requestFocus(section ? `[data-section="${section}"]` : '#v5-home-title');
    }
    const nextGroup = target.group === undefined ? group : target.group;
    if (nextGroup !== group) setDraft({});
    if (target.section !== undefined) setSection(target.section);
    else if (nextGroup) setSection(groupByKey.get(nextGroup)?.section ?? null);
    setGroup(nextGroup ?? null);
    if (target.prefTab !== undefined) setPrefTab(target.prefTab);
    if (nextGroup) setPrefTab(null);
    setFocus(target.field ?? null);
    setFlash(target.field ? { key: target.field, n: Date.now() } : null);
    if (target.field) setInspectorTab('field');
    if (target.pane) setPane(target.pane);
  }, [group, section, requestFocus]);

  /** Navigate, asking first when the open group has unsaved edits and the target leaves it. */
  const go = useCallback(
    (target: Target) => {
      const leaving = target.group !== undefined && target.group !== group;
      if (dirtyCount > 0 && leaving) {
        setGuard(target);
        return;
      }
      commit(target);
    },
    [commit, dirtyCount, group],
  );

  const live = useRef({ dirtyCount, group, commit });
  live.current = { dirtyCount, group, commit };
  useEffect(() => {
    const onPop = () => {
      const g = hashParam('g');
      const pref = hashParam('pref') as PrefTabId | null;
      const sec = hashParam('s') as SectionId | 'prefs' | null;
      const p = hashParam('p') as Pane | null;
      const target: Target = {
        group: g && groupByKey.get(g) ? g : null,
        section: pref ? 'prefs' : g ? groupByKey.get(g)?.section ?? null : sec,
        prefTab: pref,
        pane: p ?? (g || pref ? 'editor' : sec ? 'list' : 'home'),
        field: hashParam('f'),
      };
      const { dirtyCount: dirty, group: open, commit: run } = live.current;
      if (dirty > 0 && target.group !== open) {
        // Undo the browser's step and ask first; "Discard" then navigates for real.
        window.history.go(1);
        setGuard(target);
        return;
      }
      fromPop.current = true;
      run(target);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const current = group ? groupByKey.get(group) ?? null : null;

  const valueOf = useCallback((key: string, field: Field) => values[key]?.[field.key] ?? field.value, [values]);
  const draftValue = useCallback(
    (field: Field) => (field.key in draft ? draft[field.key] : valueOf(group ?? '', field)),
    [draft, group, valueOf],
  );

  const edit = useCallback(
    (field: Field, value: FieldValue) => {
      if (!group) return;
      const saved = values[group]?.[field.key];
      setDraft((d) => {
        const next = { ...d };
        if (same(saved, value)) delete next[field.key];
        else next[field.key] = value;
        return next;
      });
    },
    [group, values],
  );

  const discard = useCallback(() => {
    setDraft({});
    say(t.toast.discarded);
  }, [say, t]);

  const needsApproval = useCallback(
    (g: SettingsGroup, keys: string[]) =>
      role === 'admin' &&
      keys.some((k) => {
        const f = findField(g, k);
        return !!f && ((g.approval === 'second-approver' && f.control === 'security') || !!f.twoPerson);
      }),
    [role],
  );

  const openReview = useCallback(() => {
    if (!group) return;
    const changes = Object.entries(draft).map(([field, to]) => ({ field, from: values[group][field], to }));
    if (changes.length) setReview({ mode: 'save', groupKey: group, changes });
  }, [draft, group, values]);

  const openRestore = useCallback(
    (version: number) => {
      if (!group) return;
      const g = groupByKey.get(group)!;
      const state = { ...values[group] };
      for (const entry of history[group] ?? []) {
        if (entry.version <= version) break;
        for (const c of entry.changes) state[c.field] = c.from;
      }
      const changes = Object.keys(state)
        .filter((k) => !same(state[k], values[group][k]) && findField(g, k))
        .map((k) => ({ field: k, from: values[group][k], to: state[k] }));
      setReview({ mode: 'restore', groupKey: group, changes, restoreFrom: version });
    },
    [group, history, values],
  );

  const confirmReview = useCallback(
    (reason: string) => {
      if (!review) return;
      const g = groupByKey.get(review.groupKey)!;
      const title = g.title[locale];
      if (review.mode === 'save' && needsApproval(g, review.changes.map((c) => c.field))) {
        const id = `scr_${Math.random().toString(16).slice(2, 8)}`;
        setPending((p) => ({ ...p, [g.key]: { id, count: review.changes.length } }));
        setDraft({});
        say(t.toast.sent(id));
      } else {
        const next = (versions[g.key] ?? g.version) + 1;
        const at = SETTINGS_NOW_ISO;
        setValues((v) => ({ ...v, [g.key]: { ...v[g.key], ...Object.fromEntries(review.changes.map((c) => [c.field, c.to])) } }));
        setVersions((v) => ({ ...v, [g.key]: next }));
        setMeta((m) => ({ ...m, [g.key]: { at, by: PEOPLE[role] } }));
        const note = reason.trim()
          ? { ar: reason.trim(), en: reason.trim() }
          : review.mode === 'restore'
            ? { ar: `استعادة الإصدار ${review.restoreFrom}`, en: `Restored version ${review.restoreFrom}` }
            : null;
        const prevHistory = history[g.key]?.length
          ? history[g.key]
          : [{ version: versions[g.key] ?? g.version, at: meta[g.key].at, by: meta[g.key].by, note: null, changes: [] }];
        setHistory((h) => ({ ...h, [g.key]: [{ version: next, at, by: PEOPLE[role], note, changes: review.changes }, ...prevHistory] }));
        setDraft({});
        say(review.mode === 'restore' ? t.toast.restored(review.restoreFrom!, next) : t.toast.saved(title, next));
      }
      setReview(null);
      if (afterSave.current) {
        const target = afterSave.current;
        afterSave.current = null;
        commit(target);
      }
    },
    [commit, history, locale, meta, needsApproval, review, role, say, t, versions],
  );

  const resolveGuard = useCallback(
    (choice: 'save' | 'discard' | 'stay') => {
      const target = guard;
      setGuard(null);
      if (!target || choice === 'stay') return;
      if (choice === 'discard') {
        setDraft({});
        commit({ ...target });
        return;
      }
      afterSave.current = target;
      openReview();
    },
    [commit, guard, openReview],
  );

  const setPref = useCallback((tab: PrefTabId, field: Field, value: FieldValue) => {
    setPrefValues((p) => ({ ...p, [`${tab}.${field.key}`]: value }));
    setPrefApplied(`${tab}.${field.key}`);
  }, []);

  const prefValue = useCallback((tab: PrefTabId, field: Field) => prefValues[`${tab}.${field.key}`] ?? field.value, [prefValues]);

  const setRole = useCallback(
    (r: Role) => {
      setRoleState(r);
      if (r === 'admin' && group && HIDDEN_FOR_ADMIN.has(group)) commit({ group: null, pane: 'list' });
    },
    [commit, group],
  );

  const toggleFlag = useCallback((flag: FieldFlag) => {
    setFlags((f) => {
      const next = new Set(f);
      if (next.has(flag)) next.delete(flag);
      else next.add(flag);
      return next;
    });
  }, []);

  const searching = query.trim().length > 0 || flags.size > 0;

  return {
    t,
    locale,
    role,
    setRole,
    person: PEOPLE[role],
    scenario,
    setScenario,
    section,
    group,
    current,
    prefTab,
    pane,
    setPane,
    values,
    versions,
    meta,
    history,
    pending,
    draft,
    dirtyCount,
    valueOf,
    draftValue,
    edit,
    discard,
    focus,
    setFocus,
    flash,
    inspectorOpen,
    setInspectorOpen,
    inspectorTab,
    setInspectorTab,
    sheetOpen,
    setSheetOpen,
    query,
    setQuery,
    flags,
    toggleFlag,
    clearSearch: () => {
      setQuery('');
      setFlags(new Set());
    },
    searching,
    searchRef,
    guard,
    resolveGuard,
    review,
    setReview: (r: ReviewState | null) => {
      if (!r) afterSave.current = null;
      setReview(r);
    },
    openReview,
    openRestore,
    confirmReview,
    needsApproval,
    go,
    hidden,
    toast,
    say,
    dismissToast: () => setToast(null),
    focusReq,
    requestFocus,
    prefValue,
    setPref,
    prefApplied,
    railExpanded,
    setRailExpanded,
    sectionOfGroup,
  };
}

export type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
