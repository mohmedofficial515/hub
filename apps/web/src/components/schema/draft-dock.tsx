'use client';

/**
 * @file draft-dock.tsx
 * @description The open draft (docs/17 §4, D63), docked at the bottom of the page: its changes in order, its status, and the one press that starts the review with Claude in the panel.
 * Changes are proposed in a dialog from a table, a column or here. While Claude reviews or applies it, the dock says what is happening and opens that chat.
 */
import { SCHEMA_CHANGE_KINDS, type SchemaChange, type SchemaChangeKind } from '@hub/contracts';
import { AnimatePresence, motion } from 'framer-motion';
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
  Field,
  fmt,
  IconButton,
  Modal,
  num,
  RowMenu,
  Select,
  Textarea,
  TextInput,
  Tooltip,
  useLocale,
} from '@/components/kit';
import { useUpdateDraft } from '@/features/schema/queries';

import { newChangeId } from './model';
import { useSchemaWords, useStudio } from './studio';

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

  useEffect(() => {
    if (!proposing) return;
    setKind(existing?.kind ?? proposing.kind ?? 'change_field');
    setTarget(existing?.target ?? proposing.target ?? '');
    setSummary(existing?.summary ?? '');
    setDetail(existing?.detail ?? '');
    setReason(existing?.reason ?? '');
  }, [proposing, existing]);

  const submit = async () => {
    if (!target.trim() || !summary.trim()) return;
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
      </form>
    </Modal>
  );
}

export function DraftDock() {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const updateDraft = useUpdateDraft();
  const [open, setOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const draft = studio.draft;

  // A change just added opens the dock, so the owner sees where it went.
  const count = draft?.changes.length ?? 0;
  const [seen, setSeen] = useState(count);
  useEffect(() => {
    if (count > seen) setOpen(true);
    setSeen(count);
  }, [count, seen]);

  if (!studio.can.draft) return null;
  if (!draft) {
    return (
      <div className="schema-dock schema-dock-idle">
        <Button size="sm" variant="outline" onClick={() => studio.propose({})}>
          <Plus aria-hidden className="size-4" strokeWidth={1.75} />
          {t.actions.propose}
        </Button>
      </div>
    );
  }

  const status = draft.status;
  const editing = status === 'editing';
  const working = status === 'in_review' || status === 'applying';

  return (
    <motion.section
      layout
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="schema-dock"
      data-status={status}
      aria-label={t.draft.label}
    >
      <div className="schema-dock-head">
        <button
          type="button"
          className="schema-dock-toggle"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <span className="schema-dock-icon" aria-hidden>
            {working ? (
              <Loader2 className="size-4 motion-safe:animate-spin" strokeWidth={2} />
            ) : (
              <GitPullRequestDraft className="size-4" strokeWidth={2} />
            )}
          </span>
          <span className="min-w-0 text-start">
            <span className="block truncate font-semibold text-foreground">{draft.title}</span>
            <span className="block truncate text-caption text-muted-foreground">
              {t.draft.statuses[status]} · {fmt(t.draft.count, { n: num(count, locale) })}
            </span>
          </span>
          {open ? (
            <ChevronDown aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
          ) : (
            <ChevronUp aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
          )}
          <span className="sr-only">{open ? t.draft.collapse : t.draft.expand}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          {editing && (
            <IconButton label={t.actions.propose} onClick={() => studio.propose({})}>
              <Plus aria-hidden className="size-4" strokeWidth={1.75} />
            </IconButton>
          )}
          {working && draft.chatId ? (
            <Button size="sm" variant="outline" onClick={() => void studio.reviewWithClaude(draft)}>
              <MessageSquareText aria-hidden className="size-4" strokeWidth={1.75} />
              {t.draft.reopen}
            </Button>
          ) : null}
          {editing && (
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
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="schema-dock-body">
              <p className="text-body-sm text-muted-foreground">{t.draft.statusHints[status]}</p>
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
                      {editing && (
                        <RowMenu
                          label={change.summary}
                          items={[
                            {
                              label: t.draft.edit,
                              icon: Pencil,
                              onSelect: () => studio.propose({ id: change.id }),
                            },
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
              <div className="flex flex-wrap gap-2">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
    </motion.section>
  );
}
