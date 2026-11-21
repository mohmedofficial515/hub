/**
 * Page state of the policy book: saved values (a copy of the mock), per-group drafts, versions and history (saves and restores are
 * forward only), second-approver requests, preferences (instant), the reader (owner / staff), routing and the toast.
 * Nothing is persisted: a reload resets the book.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SETTINGS_NOW_ISO, type FieldValue, type SettingsChange, type SettingsHistoryEntry } from '@lab/mocks/settings';
import { useLocale, useT, type Locale } from '@lab/i18n';
import { messages, type Messages } from '../i18n';
import { docOf, fieldOf, historySeed, initialValues, same, valuesAtVersion, type SearchFilter, type Values } from './model';

export type Viewer = 'owner' | 'staff';
export type Phase = 'ready' | 'loading' | 'empty' | 'error';
export type Route = { view: 'overview'; chapter?: string } | { view: 'group'; key: string } | { view: 'prefs' };
export interface Focus {
  docKey: string;
  fieldKey: string;
  nonce: number;
}
export interface Pending {
  changes: SettingsChange[];
  note: string;
  at: string;
}
export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

const NOW = SETTINGS_NOW_ISO;
/** Fields that drive an action, not a saved setting. */
const LOCAL_FIELDS = new Set(['whatsapp_provider:test.phone', 'whatsapp_provider:test.locale']);

interface Book {
  locale: Locale;
  t: Messages;
  viewer: Viewer;
  setViewer: (v: Viewer) => void;
  phase: Phase;
  setPhase: (p: Phase) => void;
  // values
  get: (docKey: string, fieldKey: string) => FieldValue;
  savedValue: (docKey: string, fieldKey: string) => FieldValue;
  isDirty: (docKey: string, fieldKey: string) => boolean;
  draftOf: (docKey: string) => Values;
  draftCount: (docKey: string) => number;
  setValue: (docKey: string, fieldKey: string, value: FieldValue) => void;
  resetFields: (docKey: string, keys: string[]) => void;
  discard: (docKey: string) => void;
  version: (docKey: string) => number;
  history: (docKey: string) => SettingsHistoryEntry[];
  stageRestore: (docKey: string, version: number) => boolean;
  restoring: (docKey: string) => number | undefined;
  commit: (docKey: string, note: string) => number;
  submitForApproval: (docKey: string, note: string) => void;
  pending: (docKey: string) => Pending | undefined;
  withdraw: (docKey: string) => void;
  lastChange: (docKey: string) => { by: string; at: string } | undefined;
  appliedAt: (docKey: string) => number | undefined;
  // permissions
  canSee: (docKey: string) => boolean;
  canSeeSubsection: (docKey: string, subId: string) => boolean;
  // ui
  route: Route;
  go: (route: Route, focus?: Omit<Focus, 'nonce'>) => void;
  focus: Focus | null;
  query: string;
  setQuery: (q: string) => void;
  filter: SearchFilter;
  setFilter: (f: SearchFilter) => void;
  advanced: boolean;
  setAdvanced: (on: boolean) => void;
  reviewOf: string | null;
  openReview: (docKey: string | null) => void;
  historyOf: string | null;
  openHistory: (docKey: string | null) => void;
  toast: Toast | null;
  notify: (text: string, action?: Toast['action']) => void;
  dismissToast: () => void;
}

const BookContext = createContext<Book | null>(null);

export function useBook(): Book {
  const ctx = useContext(BookContext);
  if (!ctx) throw new Error('useBook outside BookProvider');
  return ctx;
}

function readHash(): URLSearchParams {
  return new URLSearchParams(location.hash.split('?')[1] ?? '');
}

/** Keep the frame URL in step with the view (deep links), without firing a hash change. */
export function writeHash(params: Record<string, string | null>) {
  const [path, query = ''] = location.hash.split('?');
  const sp = new URLSearchParams(query);
  for (const [k, v] of Object.entries(params)) {
    if (v === null) sp.delete(k);
    else sp.set(k, v);
  }
  history.replaceState(null, '', `${location.pathname}${location.search}${path}?${sp.toString()}`);
}

function initialRoute(): { route: Route; focus: Focus | null; query: string } {
  const sp = readHash();
  const g = sp.get('g');
  const f = sp.get('f');
  const q = sp.get('q') ?? '';
  if (sp.get('view') === 'prefs') return { route: { view: 'prefs' }, focus: null, query: q };
  if (g && docOf(g)) {
    return { route: { view: 'group', key: g }, focus: f ? { docKey: g, fieldKey: f, nonce: 1 } : null, query: q };
  }
  return { route: { view: 'overview' }, focus: null, query: q };
}

export function BookProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const t = useT(messages);
  const boot = useMemo(initialRoute, []);
  const [viewer, setViewer] = useState<Viewer>(() => (readHash().get('viewer') === 'staff' ? 'staff' : 'owner'));
  const [phase, setPhase] = useState<Phase>(() => {
    const s = readHash().get('state');
    return s === 'loading' || s === 'empty' || s === 'error' ? s : 'ready';
  });
  const [saved, setSaved] = useState(() => {
    // The frame's own theme and language are the reader's current preferences.
    const values = initialValues();
    const sp = readHash();
    const prefs = values['prefs:appearance'];
    if (prefs) {
      prefs.theme = sp.get('theme') === 'dark' ? 'dark' : 'light';
      prefs.language = sp.get('lang') === 'en' ? 'en' : 'ar';
    }
    return values;
  });
  const [drafts, setDrafts] = useState<Record<string, Values>>({});
  const [versions, setVersions] = useState<Record<string, number>>({});
  const [hist, setHist] = useState(historySeed);
  const [pend, setPend] = useState<Record<string, Pending | undefined>>({});
  const [restore, setRestore] = useState<Record<string, number | undefined>>({});
  const [changedBy, setChangedBy] = useState<Record<string, { by: string; at: string }>>({});
  const [applied, setApplied] = useState<Record<string, number>>({});
  const [route, setRoute] = useState<Route>(boot.route);
  const [focus, setFocus] = useState<Focus | null>(boot.focus);
  const [query, setQueryState] = useState(boot.query);
  const [filter, setFilterState] = useState<SearchFilter>('all');
  const [advanced, setAdvancedState] = useState(() => readHash().get('adv') === '1');
  const [reviewOf, openReview] = useState<string | null>(null);
  const [historyOf, openHistory] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastId = useRef(0);

  // The lab toolbar (or the frame URL) can switch theme and language: keep the preference sentence truthful.
  useEffect(() => {
    const sync = () => {
      const sp = readHash();
      const theme = sp.get('theme') === 'dark' ? 'dark' : 'light';
      const language = sp.get('lang') === 'en' ? 'en' : 'ar';
      setSaved((s) => {
        const cur = s['prefs:appearance'];
        if (!cur || ((cur.theme === theme || cur.theme === 'system') && cur.language === language)) return s;
        return { ...s, 'prefs:appearance': { ...cur, theme: cur.theme === 'system' ? 'system' : theme, language } };
      });
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const get = useCallback(
    (docKey: string, fieldKey: string): FieldValue => {
      const d = drafts[docKey];
      if (d && fieldKey in d) return d[fieldKey];
      return saved[docKey]?.[fieldKey] ?? null;
    },
    [drafts, saved],
  );
  const savedValue = useCallback((docKey: string, fieldKey: string) => saved[docKey]?.[fieldKey] ?? null, [saved]);
  const isDirty = useCallback((docKey: string, fieldKey: string) => !!drafts[docKey] && fieldKey in drafts[docKey], [drafts]);
  const draftOf = useCallback((docKey: string) => drafts[docKey] ?? {}, [drafts]);
  const draftCount = useCallback((docKey: string) => Object.keys(drafts[docKey] ?? {}).length, [drafts]);

  const notify = useCallback((text: string, action?: Toast['action']) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text, action });
  }, []);

  const setValue = useCallback(
    (docKey: string, fieldKey: string, value: FieldValue) => {
      const doc = docOf(docKey);
      if (!doc) return;
      if (doc.scope === 'prefs' || LOCAL_FIELDS.has(`${docKey}:${fieldKey}`)) {
        setSaved((s) => ({ ...s, [docKey]: { ...s[docKey], [fieldKey]: value } }));
        if (doc.scope === 'prefs') setApplied((a) => ({ ...a, [docKey]: Date.now() }));
        return;
      }
      setDrafts((all) => {
        const current = { ...(all[docKey] ?? {}) };
        if (same(saved[docKey]?.[fieldKey], value)) delete current[fieldKey];
        else current[fieldKey] = value;
        const next = { ...all };
        if (Object.keys(current).length) next[docKey] = current;
        else delete next[docKey];
        return next;
      });
    },
    [saved],
  );

  const resetFields = useCallback(
    (docKey: string, keys: string[]) => {
      for (const key of keys) {
        const field = fieldOf(docKey, key);
        if (field && !field.readOnly && !field.structured) setValue(docKey, key, field.default);
      }
    },
    [setValue],
  );

  const discard = useCallback(
    (docKey: string) => {
      const before = drafts[docKey];
      const restoringFrom = restore[docKey];
      if (!before) return;
      setDrafts((all) => {
        const next = { ...all };
        delete next[docKey];
        return next;
      });
      setRestore((r) => ({ ...r, [docKey]: undefined }));
      const title = docOf(docKey)?.title[locale] ?? docKey;
      notify(t.ui.discarded.replace('{group}', title), {
        label: t.ui.undo,
        run: () => {
          setDrafts((all) => ({ ...all, [docKey]: before }));
          setRestore((r) => ({ ...r, [docKey]: restoringFrom }));
        },
      });
    },
    [drafts, restore, locale, notify, t],
  );

  const version = useCallback((docKey: string) => versions[docKey] ?? docOf(docKey)?.group?.version ?? 1, [versions]);
  const historyFn = useCallback((docKey: string) => hist[docKey] ?? [], [hist]);

  const stageRestore = useCallback(
    (docKey: string, v: number) => {
      const target = valuesAtVersion(saved[docKey] ?? {}, hist[docKey] ?? [], v);
      const draft: Values = {};
      for (const [k, value] of Object.entries(target)) if (!same(saved[docKey]?.[k], value)) draft[k] = value;
      if (!Object.keys(draft).length) return false;
      setDrafts((all) => ({ ...all, [docKey]: draft }));
      setRestore((r) => ({ ...r, [docKey]: v }));
      return true;
    },
    [saved, hist],
  );

  const changesOf = useCallback(
    (docKey: string): SettingsChange[] =>
      Object.entries(drafts[docKey] ?? {}).map(([field, to]) => ({ field, from: saved[docKey]?.[field] ?? null, to })),
    [drafts, saved],
  );

  const commit = useCallback(
    (docKey: string, note: string) => {
      const next = version(docKey) + 1;
      const changes = changesOf(docKey);
      const draft = drafts[docKey] ?? {};
      setSaved((s) => ({ ...s, [docKey]: { ...s[docKey], ...draft } }));
      setDrafts((all) => {
        const n = { ...all };
        delete n[docKey];
        return n;
      });
      setVersions((v) => ({ ...v, [docKey]: next }));
      const entry: SettingsHistoryEntry = {
        version: next,
        at: NOW,
        by: t.ui.you,
        note: note.trim() ? { ar: note.trim(), en: note.trim() } : null,
        changes,
      };
      setHist((h) => ({ ...h, [docKey]: [entry, ...(h[docKey] ?? [])] }));
      setRestore((r) => ({ ...r, [docKey]: undefined }));
      setChangedBy((c) => ({ ...c, [docKey]: { by: t.ui.you, at: NOW } }));
      return next;
    },
    [version, changesOf, drafts, t],
  );

  const submitForApproval = useCallback(
    (docKey: string, note: string) => {
      setPend((p) => ({ ...p, [docKey]: { changes: changesOf(docKey), note, at: NOW } }));
      setDrafts((all) => {
        const n = { ...all };
        delete n[docKey];
        return n;
      });
      setRestore((r) => ({ ...r, [docKey]: undefined }));
    },
    [changesOf],
  );

  const withdraw = useCallback(
    (docKey: string) => {
      setPend((p) => ({ ...p, [docKey]: undefined }));
      notify(t.ui.withdrawn);
    },
    [notify, t],
  );

  const canSee = useCallback((docKey: string) => !(viewer === 'staff' && docKey === 'payment_gateways'), [viewer]);
  const canSeeSubsection = useCallback(
    (docKey: string, subId: string) => !(viewer === 'staff' && docKey === 'whatsapp_provider' && subId === 'credentials'),
    [viewer],
  );

  const go = useCallback((next: Route, f?: Omit<Focus, 'nonce'>) => {
    setRoute(next);
    setFocus(f ? { ...f, nonce: Date.now() } : null);
    setQueryState('');
    setFilterState('all');
    writeHash({
      g: next.view === 'group' ? next.key : null,
      f: f ? f.fieldKey : null,
      view: next.view === 'prefs' ? 'prefs' : null,
      q: null,
    });
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!f) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
    writeHash({ q: q || null });
  }, []);

  const setAdvanced = useCallback((on: boolean) => {
    setAdvancedState(on);
    writeHash({ adv: on ? '1' : null });
  }, []);

  const value: Book = {
    locale,
    t,
    viewer,
    setViewer,
    phase,
    setPhase,
    get,
    savedValue,
    isDirty,
    draftOf,
    draftCount,
    setValue,
    resetFields,
    discard,
    version,
    history: historyFn,
    stageRestore,
    restoring: (docKey) => restore[docKey],
    commit,
    submitForApproval,
    pending: (docKey) => pend[docKey],
    withdraw,
    lastChange: (docKey) => changedBy[docKey],
    appliedAt: (docKey) => applied[docKey],
    canSee,
    canSeeSubsection,
    route,
    go,
    focus,
    query,
    setQuery,
    filter,
    setFilter: setFilterState,
    advanced,
    setAdvanced,
    reviewOf,
    openReview,
    historyOf,
    openHistory,
    toast,
    notify,
    dismissToast: () => setToast(null),
  };

  return <BookContext.Provider value={value}>{children}</BookContext.Provider>;
}

/** The value as it should read for a field of a doc (current draft or saved). */
export function useValueGetter(docKey: string) {
  const { get } = useBook();
  return useCallback((key: string) => get(docKey, key), [get, docKey]);
}
