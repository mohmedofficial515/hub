'use client';

/**
 * @file studio.tsx
 * @description Schema Studio's shared state (docs/17 §4): the design, its names and the open draft, what is selected and how the diagram is drawn, and the two presses that reach Claude.
 * The view settings are remembered per member in this browser, behind try/catch, so a private window still works. Everything the team shares lives in the API.
 */
import {
  isPossible,
  type SchemaChange,
  type SchemaDoc,
  type SchemaDraftDto,
  schemaNamesPrompt,
  type SchemaStudioDto,
} from '@hub/contracts';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { fmt, showToast, useSession, useT } from '@/components/kit';
import { activeChatId, revealChat, send, setFolder, useMaybeWb } from '@/components/workbench/store';
import {
  useAttachDraftChat,
  useCreateDraft,
  useReviewDraft,
  useUpdateDraft,
} from '@/features/schema/queries';
import { isHubError } from '@/lib/api/errors';

import type messages from '../../../messages/en/schema.json';
import {
  type Annotations,
  annotationsOf,
  type Detail,
  type DomainTone,
  domainTones,
  type LabelMode,
  type Marks,
  marksOf,
  newChangeId,
} from './model';

export type SchemaMessages = typeof messages;
export const useSchemaWords = () => useT<SchemaMessages>('schema');

export type StudioView = 'diagram' | 'dictionary' | 'enums' | 'history';

export interface Selection {
  kind: 'model' | 'enum';
  name: string;
  field?: string | undefined;
}

export interface ChangeDraftInput {
  kind?: SchemaChange['kind'];
  target?: string;
  /** Editing a change already in the draft. */
  id?: string;
}

const PREFS_KEY = 'hub:schema:prefs';

interface Prefs {
  labels: LabelMode;
  detail: Detail;
  implied: boolean;
  hidden: string[];
}

const DEFAULT_PREFS: Prefs = { labels: 'ar', detail: 'keys', implied: true, hidden: [] };

function readPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(prefs: Prefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* A private window or blocked storage: the view simply is not remembered. */
  }
}

export interface Studio {
  data: SchemaStudioDto;
  doc: SchemaDoc;
  annotations: Annotations;
  tones: Map<string, DomainTone>;
  draft: SchemaDraftDto | null;
  marks: Marks;
  can: { annotate: boolean; draft: boolean; manage: boolean };
  view: StudioView;
  setView: (view: StudioView) => void;
  selection: Selection | null;
  /**
   * `focus` moves focus to the inspector's heading once it shows (a node opened by keyboard, a search pick, the dictionary), and closing it
   * puts focus back where it was (review B2). A mouse click on the diagram leaves focus alone.
   */
  select: (selection: Selection | null, options?: { focus?: boolean }) => void;
  /** Ticks each time the inspector should take focus. */
  inspectorFocus: number;
  /** Closes the inspector and returns focus to what opened it, or to the table on the diagram. */
  closeInspector: () => void;
  focus: string | null;
  setFocus: (model: string | null) => void;
  prefs: Prefs;
  setPrefs: (change: Partial<Prefs>) => void;
  /** A request for the diagram to centre on a table, with a tick so the same table twice still moves. */
  reveal: { model: string; tick: number } | null;
  revealModel: (model: string) => void;
  proposing: ChangeDraftInput | null;
  propose: (input: ChangeDraftInput | null) => void;
  saveChange: (change: SchemaChange) => Promise<void>;
  removeChange: (id: string) => void;
  moveChange: (id: string, by: -1 | 1) => void;
  reviewWithClaude: (draft?: SchemaDraftDto) => Promise<void>;
  syncNames: () => Promise<void>;
  suggestNames: (scope: { domain?: string; model?: string }) => Promise<void>;
}

const Ctx = createContext<Studio | null>(null);

export function useStudio(): Studio {
  const studio = useContext(Ctx);
  if (!studio) throw new Error('useStudio needs StudioProvider');
  return studio;
}

const sameFolder = (a: string, b: string) =>
  a.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase() ===
  b.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();

export function StudioProvider({
  data,
  children,
}: {
  data: SchemaStudioDto & { snapshot: NonNullable<SchemaStudioDto['snapshot']> };
  children: ReactNode;
}) {
  const t = useSchemaWords();
  const session = useSession();
  const wb = useMaybeWb();
  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraft();
  const reviewDraft = useReviewDraft();
  const attachChat = useAttachDraftChat();

  const [view, setView] = useState<StudioView>('diagram');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [prefs, setPrefsState] = useState<Prefs>(readPrefs);
  const [reveal, setReveal] = useState<Studio['reveal']>(null);
  const [proposing, setProposing] = useState<ChangeDraftInput | null>(null);

  const doc = data.snapshot.schema;
  const annotations = useMemo(() => annotationsOf(data.annotations), [data.annotations]);
  const tones = useMemo(() => domainTones(doc), [doc]);
  const draft = useMemo(
    () =>
      data.drafts.find(
        (entry) => entry.status === 'editing' || entry.status === 'in_review' || entry.status === 'applying',
      ) ?? null,
    [data.drafts],
  );
  const marks = useMemo(
    () => marksOf(doc, draft?.changes ?? [], data.snapshot.changes),
    [doc, draft, data.snapshot.changes],
  );
  const can = useMemo(
    () => ({
      annotate: isPossible('schema.annotate', session.roles),
      draft: isPossible('schema.draft', session.roles),
      manage: isPossible('schema.manage', session.roles),
    }),
    [session.roles],
  );

  const setPrefs = useCallback((change: Partial<Prefs>) => {
    setPrefsState((before) => {
      const next = { ...before, ...change };
      writePrefs(next);
      return next;
    });
  }, []);

  const [inspectorFocus, setInspectorFocus] = useState(0);
  const opener = useRef<HTMLElement | null>(null);
  const select = useCallback((next: Selection | null, options?: { focus?: boolean }) => {
    setSelection(next);
    if (next && options?.focus) {
      const active = document.activeElement as HTMLElement | null;
      if (active && !active.closest('.schema-inspector')) opener.current = active;
      setInspectorFocus((tick) => tick + 1);
    }
  }, []);
  const closeInspector = useCallback(() => {
    const was = selection;
    setSelection(null);
    const back =
      (opener.current?.isConnected ? opener.current : null) ??
      (was
        ? document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(was.name)}"]`)
        : null);
    opener.current = null;
    window.setTimeout(() => back?.focus({ preventScroll: true }), 0);
  }, [selection]);
  const revealModel = useCallback(
    (model: string) => setReveal((before) => ({ model, tick: (before?.tick ?? 0) + 1 })),
    [],
  );

  const failed = useCallback(
    (error: unknown) =>
      showToast({ message: isHubError(error) ? error.message : t.draft.refused, tone: 'error' }),
    [t],
  );

  /** The open draft, or a new one titled with today's date. Changes can only go to a draft being edited. */
  const editableDraft = useCallback(async (): Promise<SchemaDraftDto> => {
    if (draft) return draft;
    const date = new Intl.DateTimeFormat(document.documentElement.lang || 'ar', {
      day: 'numeric',
      month: 'short',
    }).format(new Date());
    return createDraft.mutateAsync({ title: fmt(t.draft.untitled, { date }), changes: [] });
  }, [draft, createDraft, t]);

  const saveChange = useCallback(
    async (change: SchemaChange) => {
      try {
        const target = await editableDraft();
        const exists = target.changes.some((entry) => entry.id === change.id);
        const changes = exists
          ? target.changes.map((entry) => (entry.id === change.id ? change : entry))
          : [...target.changes, change];
        await updateDraft.mutateAsync({
          id: target.id,
          changes,
          ...(target.status === 'editing' ? {} : { status: 'editing' as const }),
        });
        showToast({ message: t.change.added, tone: 'success' });
      } catch (error) {
        failed(error);
        throw error;
      }
    },
    [editableDraft, updateDraft, t, failed],
  );

  const removeChange = useCallback(
    (id: string) => {
      if (!draft) return;
      updateDraft.mutate(
        { id: draft.id, changes: draft.changes.filter((entry) => entry.id !== id) },
        { onError: failed },
      );
    },
    [draft, updateDraft, failed],
  );

  const moveChange = useCallback(
    (id: string, by: -1 | 1) => {
      if (!draft) return;
      const index = draft.changes.findIndex((entry) => entry.id === id);
      const to = index + by;
      if (index < 0 || to < 0 || to >= draft.changes.length) return;
      const changes = [...draft.changes];
      const [moved] = changes.splice(index, 1);
      changes.splice(to, 0, moved!);
      updateDraft.mutate({ id: draft.id, changes }, { onError: failed });
    },
    [draft, updateDraft, failed],
  );

  /** The chat runs in the schema's own folder, so Claude reads and edits the files there. */
  const pointPanelAtSource = useCallback((): boolean => {
    if (!wb) {
      showToast({ message: t.draft.noPanel, tone: 'error' });
      return false;
    }
    const path = data.source?.path ?? '';
    const folder = wb.folders.find((entry) => sameFolder(entry, path));
    if (!folder) {
      showToast({ message: fmt(t.draft.noFolder, { folder: path }), tone: 'error' });
      return false;
    }
    setFolder(folder);
    return true;
  }, [wb, data.source, t]);

  const reviewWithClaude = useCallback(
    async (given?: SchemaDraftDto) => {
      const target = given ?? draft;
      if (!target) return;
      if (target.chatId && target.status !== 'editing') {
        revealChat(target.chatId);
        return;
      }
      if (!pointPanelAtSource()) return;
      try {
        const { prompt } = await reviewDraft.mutateAsync(target.id);
        const sent = await send({ text: prompt, mode: 'plan', fresh: true, context: { page: 'schema' } });
        if (!sent) {
          showToast({ message: t.draft.refused, tone: 'error' });
          return;
        }
        const chatId = activeChatId();
        if (chatId) {
          revealChat(chatId);
          attachChat.mutate({ id: target.id, chatId });
        }
        showToast({ message: t.draft.sent, tone: 'success' });
      } catch (error) {
        failed(error);
      }
    },
    [draft, pointPanelAtSource, reviewDraft, attachChat, t, failed],
  );

  const syncNames = useCallback(async () => {
    try {
      const target = await editableDraft();
      await reviewWithClaude(target);
    } catch (error) {
      failed(error);
    }
  }, [editableDraft, reviewWithClaude, failed]);

  const suggestNames = useCallback(
    async (scope: { domain?: string; model?: string }) => {
      if (!pointPanelAtSource()) return;
      const sent = await send({
        text: schemaNamesPrompt(scope),
        mode: 'execute',
        fresh: true,
        context: { page: 'schema' },
      });
      if (!sent) {
        showToast({ message: t.draft.refused, tone: 'error' });
        return;
      }
      const chatId = activeChatId();
      if (chatId) revealChat(chatId);
      showToast({ message: t.toasts.namesSent, tone: 'success' });
    },
    [pointPanelAtSource, t],
  );

  const studio: Studio = {
    data,
    doc,
    annotations,
    tones,
    draft,
    marks,
    can,
    view,
    setView,
    selection,
    select,
    inspectorFocus,
    closeInspector,
    focus,
    setFocus,
    prefs,
    setPrefs,
    reveal,
    revealModel,
    proposing,
    propose: setProposing,
    saveChange,
    removeChange,
    moveChange,
    reviewWithClaude,
    syncNames,
    suggestNames,
  };
  return <Ctx.Provider value={studio}>{children}</Ctx.Provider>;
}

export { newChangeId };
