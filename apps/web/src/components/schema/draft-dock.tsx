'use client';

/**
 * @file draft-dock.tsx
 * @description The open draft (docs/17 §4, D63): a pill in the map's toolbar with its state and count, and its changes in order in the side panel's Draft tab, with the one press that
 * starts the review with Claude in the panel. Changes are proposed in a dialog from a table, a column or here. While Claude reviews or applies it, the draft says so with a status
 * pill, not a coloured border (owner's choice on review B3), and opens that chat. The dialog refuses text that looks like a secret before anything is sent (review M12).
 */
import { SCHEMA_CHANGE_KINDS, type SchemaChange, type SchemaChangeKind } from '@hub/contracts';
import { motion } from 'framer-motion';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  GitPullRequestDraft,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import {
  Button,
  cn,
  ConfirmDialog,
  detectSecret,
  Field,
  IconButton,
  Modal,
  num,
  Pill,
  plural,
  RowMenu,
  SecretFilterError,
  Select,
  Textarea,
  TextInput,
  Tooltip,
  useLocale,
} from '@/components/kit';
import { useUpdateDraft } from '@/features/schema/queries';

import { newChangeId } from './model';
import { useChrome, useSchemaWords, useStudio } from './studio';

const KIND_TONE: Partial<Record<SchemaChangeKind, 'added' | 'changed' | 'removed'>> = {
  add_model: 'added',
  add_field: 'added',
  add_enum: 'added',
  add_relation: 'added',
  add_index: 'added',
  remove: 'removed',
};

export function ChangeDialog() {
  const studio = useStudio();
  const t = useSchemaWords();
  const id = useId();
  const proposing = studio.proposing;
  const existing = proposing?.id
    ? studio.draft?.changes.find((change) => change.id === proposing.id)
    : undefined;
  const [kind, setKind] = useState<SchemaChangeKind>('change_field');
  const [target, setTarget] = useState('');
  const [summary, setSummary] = useState('');
  const [detail, setDetail] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!proposing) return;
    setSecret(null);
    // A table's most common change is a new column; a column's is a change to it.
    const given = proposing.target ?? '';
    setKind(
      existing?.kind ?? proposing.kind ?? (given && !given.includes('.') ? 'add_field' : 'change_field'),
    );
    setTarget(existing?.target ?? proposing.target ?? '');
    setSummary(existing?.summary ?? '');
    setDetail(existing?.detail ?? '');
    setReason(existing?.reason ?? '');
  }, [proposing, existing]);

  const submit = async () => {
    if (!target.trim() || !summary.trim()) return;
    const found = [target, summary, detail, reason].map(detectSecret).find(Boolean) ?? null;
    setSecret(found);
    if (found) return;
    setBusy(true);
    const change: SchemaChange = {
      id: existing?.id ?? newChangeId(),
      kind,
      target: target.trim(),
      summary: summary.trim(),
      ...(detail.trim() ? { detail: detail.trim() } : {}),
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    };
    try {
      await studio.saveChange(change);
      studio.propose(null);
    } catch {
      /* The toast said why; the dialog keeps the words. */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={proposing !== null}
      onOpenChange={(open) => !open && studio.propose(null)}
      title={existing ? t.change.editTitle : t.change.title}
      footer={
        <>
          <Button variant="ghost" onClick={() => studio.propose(null)}>
            {t.change.cancel}
          </Button>
          <Button
            variant="primary"
            busy={busy}
            disabled={!target.trim() || !summary.trim()}
            onClick={() => void submit()}
          >
            {existing ? t.change.update : t.change.save}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field id={`${id}-kind`} label={t.change.kind}>
          <Select
            id={`${id}-kind`}
            value={kind}
            onChange={(event) => setKind(event.target.value as SchemaChangeKind)}
          >
            {SCHEMA_CHANGE_KINDS.map((value) => (
              <option key={value} value={value}>
                {t.change.kinds[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-target`} label={t.change.target} hint={t.change.targetHint} required>
          <TextInput
            id={`${id}-target`}
            dir="ltr"
            className="font-mono"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            required
          />
        </Field>
        <Field id={`${id}-summary`} label={t.change.summary} hint={t.change.summaryHint} required>
          <TextInput
            id={`${id}-summary`}
            value={summary}
            maxLength={2000}
            onChange={(event) => setSummary(event.target.value)}
            required
          />
        </Field>
        <Field id={`${id}-detail`} label={t.change.detail} hint={t.change.detailHint}>
          <Textarea
            id={`${id}-detail`}
            dir="ltr"
            rows={4}
            className="font-mono text-body-sm"
            value={detail}
            maxLength={2000}
            onChange={(event) => setDetail(event.target.value)}
          />
        </Field>
        <Field id={`${id}-reason`} label={t.change.reason} hint={t.change.reasonHint}>
          <Textarea
            id={`${id}-reason`}
            rows={2}
            value={reason}
            maxLength={2000}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        {secret && <SecretFilterError pattern={secret} />}
      </form>
    </Modal>
  );
}

/** The draft in the toolbar: what state it is in and how many changes it holds. A press opens it in the side panel; with no draft it proposes the first change. */
export function DraftPill() {
  const studio = useStudio();
  const chrome = useChrome();
  const t = useSchemaWords();
  const locale = useLocale();
  const draft = studio.draft;
  if (!studio.can.draft) return null;
  if (!draft) {
    return (
      <Tooltip content={t.actions.propose}>
        <IconButton label={t.actions.propose} className="schema-tool" onClick={() => studio.propose({})}>
          <Plus aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
      </Tooltip>
    );
  }
  const working = draft.status === 'in_review' || draft.status === 'applying';
  const open = chrome.panel === 'draft';
  return (
    <button
      type="button"
      className="schema-draft-pill"
      data-status={draft.status}
      aria-pressed={open}
      onClick={() => chrome.setPanel(open ? null : 'draft')}
    >
      {working ? (
        <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" strokeWidth={2} />
      ) : (
        <GitPullRequestDraft aria-hidden className="size-4" strokeWidth={1.75} />
      )}
      <span className="schema-draft-pill-label">{t.draft.label}</span>
      <span className="schema-draft-pill-count">{num(draft.changes.length, locale)}</span>
      <span className="sr-only">
        {t.draft.statuses[draft.status]} · {plural(draft.changes.length, locale, t.draft.count)}
      </span>
    </button>
  );
}

/** The open draft in the side panel (D63): its changes in order, its status, and the one press that starts the review with Claude. */
export function DraftPanel() {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const updateDraft = useUpdateDraft();
  const [discarding, setDiscarding] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const draft = studio.draft;

  if (!draft) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-body-sm text-muted-foreground">{t.draft.empty}</p>
        {studio.can.draft && (
          <Button size="sm" variant="outline" onClick={() => studio.propose({})}>
            <Plus aria-hidden className="size-4" strokeWidth={1.75} />
            {t.actions.propose}
          </Button>
        )}
      </div>
    );
  }

  const status = draft.status;
  const count = draft.changes.length;
  const editing = status === 'editing';
  const working = status === 'in_review' || status === 'applying';

  return (
    <section className="flex flex-col gap-4 p-4" aria-label={t.draft.label}>
      <header className="flex flex-col gap-1.5">
        <h3 className="text-title-sm font-semibold text-foreground">{draft.title}</h3>
        <p className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
          <Pill tone={working ? 'info' : 'muted'} className="shrink-0">
            {t.draft.statuses[status]}
          </Pill>
          <span>{plural(count, locale, t.draft.count)}</span>
        </p>
        <p className="text-body-sm text-muted-foreground">{t.draft.statusHints[status]}</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {editing && studio.can.draft && (
          <Tooltip content={t.draft.reviewTip}>
            <Button
              size="sm"
              variant="primary"
              busy={reviewing}
              onClick={() => {
                setReviewing(true);
                void studio.reviewWithClaude(draft).finally(() => setReviewing(false));
              }}
            >
              <Bot aria-hidden className="size-4" strokeWidth={1.75} />
              {t.draft.review}
            </Button>
          </Tooltip>
        )}
        {working && draft.chatId && (
          <Button size="sm" variant="outline" onClick={() => void studio.reviewWithClaude(draft)}>
            <MessageSquareText aria-hidden className="size-4" strokeWidth={1.75} />
            {t.draft.reopen}
          </Button>
        )}
        {editing && studio.can.draft && (
          <Button size="sm" variant="outline" onClick={() => studio.propose({})}>
            <Plus aria-hidden className="size-4" strokeWidth={1.75} />
            {t.actions.propose}
          </Button>
        )}
      </div>
      {count === 0 ? (
        <p className="text-body-sm text-muted-foreground">{t.draft.empty}</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {draft.changes.map((change, index) => (
            <motion.li
              key={change.id}
              layout
              className="schema-change"
              data-mark={KIND_TONE[change.kind] ?? 'changed'}
            >
              <span className="schema-change-index">{num(index + 1, locale)}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="schema-chip" data-mark={KIND_TONE[change.kind] ?? 'changed'}>
                    {t.change.kinds[change.kind]}
                  </span>
                  <span className="font-mono text-body-sm text-foreground" dir="ltr">
                    {change.target}
                  </span>
                </p>
                <p className="mt-0.5 text-body-sm text-foreground">{change.summary}</p>
                {change.detail && (
                  <pre className="schema-code mt-1 whitespace-pre-wrap" dir="ltr">
                    {change.detail}
                  </pre>
                )}
                {change.reason && (
                  <p className="mt-0.5 text-caption text-muted-foreground">{change.reason}</p>
                )}
              </div>
              {editing && studio.can.draft && (
                <RowMenu
                  label={change.summary}
                  items={[
                    { label: t.draft.edit, icon: Pencil, onSelect: () => studio.propose({ id: change.id }) },
                    ...(index > 0
                      ? [
                          {
                            label: t.draft.moveUp,
                            icon: ChevronUp,
                            onSelect: () => studio.moveChange(change.id, -1),
                          },
                        ]
                      : []),
                    ...(index < count - 1
                      ? [
                          {
                            label: t.draft.moveDown,
                            icon: ChevronDown,
                            onSelect: () => studio.moveChange(change.id, 1),
                          },
                        ]
                      : []),
                    {
                      label: t.draft.remove,
                      icon: Trash2,
                      onSelect: () => studio.removeChange(change.id),
                      destructive: true,
                    },
                  ]}
                />
              )}
            </motion.li>
          ))}
        </ol>
      )}
      {studio.can.draft && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {status === 'in_review' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => updateDraft.mutate({ id: draft.id, status: 'editing' })}
            >
              <Undo2 aria-hidden className="size-4" strokeWidth={1.75} />
              {t.draft.backToEditing}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className={cn('text-destructive-soft-foreground')}
            onClick={() => setDiscarding(true)}
          >
            <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
            {t.draft.discard}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={t.draft.discardTitle}
        description={t.draft.discardBody}
        confirmLabel={t.draft.discard}
        destructive
        onConfirm={() => {
          updateDraft.mutate({ id: draft.id, status: 'discarded' });
          setDiscarding(false);
        }}
      />
    </section>
  );
}
