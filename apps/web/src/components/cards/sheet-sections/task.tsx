'use client';

/**
 * @file task.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/sheet-sections/task.tsx. Contract: apps/web/README.md.
 * The section reads as an execution procedure: where the task is on its path and what happens next, the reviewer's note, what it waits on,
 * what done means, then the facts.
 */
import { Check, ExternalLink, FileText, Plus } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

import { ActorChip } from '@/components/cards/avatar';
import { Pill, StatusBadge } from '@/components/cards/badges';
import { CardChip } from '@/components/cards/card-key';
import { focusRing } from '@/components/cards/meta';
import { CardPicker, DocPicker } from '@/components/cards/pickers';
import { RemoveLink } from '@/components/cards/remove-link';
import {
  ActionPanel,
  Checklist,
  Fact,
  Facts,
  NoteActionForm,
  type SectionProps,
  SubHeading,
} from '@/components/cards/sheet-sections/shared';
import { CopyButton } from '@/components/common/copy-button';
import { RelativeTime } from '@/components/common/relative-time';
import { Bidi, fill, fmt, Ltr } from '@/components/common/text';
import { showToast } from '@/components/common/toast';
import { setQuery, useRoute } from '@/components/shell/router';
import { Button } from '@/components/ui/button';
import { detectSecret, Field, SecretFilterError, Textarea, TextInput } from '@/components/ui/form';
import { actionsFor } from '@/features/cards/actions';
import { addLink, openBlockers, updateCard } from '@/features/cards/store';
import type { CardEvent, LinkKind, TaskCard } from '@/features/cards/types';
import { useSession } from '@/features/session/session';
import { saveTask } from '@/features/tasks/queries';
import { isHubError } from '@/lib/api/errors';
import { absolute, duration, hoursFromNow, nowMs } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';
import { cn } from '@/lib/utils';

import { EDIT, EditButton, isUrl } from './edit-bits';
import { TaskEditForm } from './task-edit';

const linkButton =
  'hit-44 inline-flex items-center gap-1 rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline';

/** Submit for review. The PR field starts from the task's own link, and a link that is not a full URL is refused here, before the sheet moves. */
function SubmitForm({
  initialPr,
  onSave,
  onCancel,
}: {
  initialPr: string;
  onSave: (prUrl: string, note: string) => void;
  onCancel: () => void;
}) {
  const t = useT(kitMessages).sections.task;
  const kit = useT(kitMessages);
  const invalidMessage = useT<{ edit: { prInvalid: string } }>('tasks').edit.prInvalid;
  const id = useId();
  const [pr, setPr] = useState(initialPr);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const secret = detectSecret(pr) ?? detectSecret(note);
  const badPr = !!pr.trim() && !isUrl(pr.trim());
  return (
    <ActionPanel
      onSubmit={() => {
        setTried(true);
        if (!secret && !badPr) onSave(pr.trim(), note.trim());
      }}
    >
      <Field id={`${id}-pr`} label={t.prOptional} error={tried && badPr ? invalidMessage : undefined}>
        <TextInput
          id={`${id}-pr`}
          dir="ltr"
          className="key text-start"
          placeholder="https://github.com/…/pull/123"
          value={pr}
          onChange={(e) => setPr(e.target.value)}
          aria-invalid={tried && badPr}
          aria-describedby={tried && badPr ? `${id}-pr-error` : undefined}
        />
      </Field>
      <Field id={`${id}-note`} label={t.submitNote}>
        <Textarea
          id={`${id}-note`}
          dir="auto"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={!!secret}
        />
      </Field>
      {secret && <SecretFilterError pattern={secret} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary">
          {t.saveSubmit}
        </Button>
        <Button onClick={onCancel}>{kit.cancel}</Button>
      </div>
    </ActionPanel>
  );
}

/**
 * Bind a branch. The task's own endpoint writes the task's branch and the card's together; a member who may only edit the card's content
 * writes the card's. A refusal keeps the text and says why.
 */
function BranchBinder({ card }: { card: TaskCard }) {
  const t = useT(kitMessages).sections.task;
  const kit = useT(kitMessages);
  const { ws } = useRoute();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn(linkButton, focusRing)}>
        {t.bindBranch}
      </button>
    );
  }
  const save = (branch: string) => {
    setBusy(true);
    const write = card.allowedActions.includes('task.edit_detail')
      ? saveTask(ws, card.key, {}, { branch })
      : updateCard(card.key, { branch });
    write
      .then(() => setOpen(false))
      .catch((e: unknown) =>
        showToast({ tone: 'error', message: isHubError(e) ? e.message : kit.actionFailed }),
      )
      .finally(() => setBusy(false));
  };
  return (
    <form
      className="flex flex-col gap-2"
      data-dirty={value.trim() ? 'true' : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) save(value.trim());
      }}
    >
      <Field id={id} label={t.branchLabel} hint={t.branchHint}>
        <div className="flex gap-2">
          <TextInput
            id={id}
            dir="ltr"
            autoFocus
            className="key min-w-0 text-start"
            placeholder="feat/…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" disabled={!value.trim()} busy={busy}>
            {t.saveBranch}
          </Button>
        </div>
      </Field>
    </form>
  );
}

const STEPS = ['backlog', 'ready', 'claimed', 'in_progress', 'in_review', 'done'] as const;

/** backlog → ready → claimed → in progress → in review → done, as `NeedStatusStepper`. Cancelled is a side state, shown as its badge. */
export function TaskStepper({ status }: { status: string }) {
  const t = useT(kitMessages);
  if (status === 'cancelled') return <StatusBadge status="cancelled" className="self-start" />;
  const at = STEPS.indexOf(status as (typeof STEPS)[number]);
  return (
    <ol
      aria-label={t.sections.task.stages}
      data-task-stepper
      className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body-sm"
    >
      {STEPS.map((step, i) => {
        const done = i < at || (i === at && step === 'done');
        const current = i === at;
        return (
          <li key={step} className="flex items-center gap-1.5" aria-current={current ? 'step' : undefined}>
            {i > 0 && <span aria-hidden className="h-px w-3 bg-border" />}
            <span
              aria-hidden
              className={cn(
                'flex size-5 items-center justify-center rounded-full border',
                done && 'border-success bg-success-soft text-success-soft-foreground',
                current && !done && 'border-foreground text-foreground',
                !done && !current && 'border-border text-muted-foreground',
              )}
            >
              {done ? (
                <Check className="size-3" strokeWidth={2.25} />
              ) : (
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    current ? 'bg-foreground' : 'bg-muted-foreground/50',
                  )}
                />
              )}
            </span>
            <span className={cn(current ? 'font-medium text-foreground' : 'text-muted-foreground')}>
              {t.status[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The one sentence under the stepper: what this member does next, or who the task waits on. From the API's own action list. */
function NextStep({ card }: { card: TaskCard }) {
  const t = useT(kitMessages);
  const n = t.sections.task.next;
  const { me, roles } = useSession();
  const task = card.task;
  const available = actionsFor(card, roles, me.id);
  const can = (action: string) => available.some((a) => a.action === action && a.enabled);
  const blocker = openBlockers(card)[0];
  const mine = !!task.claimedById && task.claimedById === me.id;
  const command = `/hub:next ${card.key}`;

  let line: ReactNode = null;
  switch (card.status) {
    case 'backlog':
      if (can('mark_ready')) line = n.backlog;
      break;
    case 'ready': {
      const needsRole = available.find((a) => a.action === 'claim')?.needsRole;
      if (blocker) line = fill(n.blocked, { key: <Ltr mono>{blocker}</Ltr> });
      else if (can('claim')) line = fill(n.claim, { cmd: <CopyButton compact text={command} /> });
      else if (needsRole) line = fmt(n.waitsRole, { role: t.roles[needsRole] });
      else line = n.waits;
      break;
    }
    case 'claimed':
    case 'in_progress':
      if (mine) line = card.status === 'claimed' ? n.start : n.submit;
      else if (task.claimedById)
        line = fill(n.heldBy, {
          who: <ActorChip memberId={task.claimedById} />,
          when: task.claimedAt ? <RelativeTime iso={task.claimedAt} /> : '',
        });
      break;
    case 'in_review':
      line = can('complete') ? n.review : n.waitsReview;
      break;
    case 'done':
      if (task.doneAt) line = fill(n.done, { when: <RelativeTime iso={task.doneAt} /> });
      break;
  }
  if (!line) return null;
  return (
    <p data-task-next className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body-sm text-foreground">
      {line}
    </p>
  );
}

/** The last status move, when it carries the words its owner must read: the reviewer's note on a task sent back, or why it was cancelled. */
function lastMove(events: readonly CardEvent[]): CardEvent | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i]?.kind === 'status_changed') return events[i];
  }
  return undefined;
}

function MoveNote({ card }: { card: TaskCard }) {
  const t = useT(kitMessages).sections.task;
  const move = lastMove(card.events);
  const reason = move?.data['reason'];
  if (!move || typeof reason !== 'string' || !reason.trim()) return null;
  const sentBack =
    card.status === 'in_progress' && move.data['from'] === 'in_review' && move.data['to'] === 'in_progress';
  const cancelled = card.status === 'cancelled';
  if (!sentBack && !cancelled) return null;
  return (
    <section
      data-task-move-note
      aria-label={sentBack ? t.reviewNote : t.cancelReason}
      className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm">
        <span className="font-semibold text-foreground">{sentBack ? t.reviewNote : t.cancelReason}</span>
        <ActorChip kind={move.actorKind} memberId={move.actorId} name={move.actorName} />
        <RelativeTime iso={move.at} className="text-muted-foreground" />
      </div>
      <p className="text-body whitespace-pre-wrap text-foreground">
        <Bidi>{reason}</Bidi>
      </p>
    </section>
  );
}

/** 08 §5.4 TaskSection: where it stands and what is next, what it waits on, what done means, the prompt that starts the work, and the facts. */
export function TaskSection({ card, action, cancelAction, perform }: SectionProps<'task'>) {
  const t = useT(kitMessages).sections.task;
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { me, isManager } = useSession();
  const task = card.task;
  const s = kit.sheet.task;
  const [picker, setPicker] = useState<'blocker' | 'doc' | null>(null);

  const closed = card.status === 'done' || card.status === 'cancelled';
  const blockers = card.links.filter((l) => l.kind === 'blocked_by');
  const blockerKeys = blockers.map((l) => l.key);
  const stillOpen = openBlockers(card);
  const canEdit = !closed && (isManager || card.createdById === me.id || task.claimedById === me.id);
  const branch = task.branch ?? card.branch;
  const canBind =
    !closed &&
    !branch &&
    (card.allowedActions.includes('task.edit_detail') || card.allowedActions.includes('card.edit_content'));
  const command = `/hub:next ${card.key}`;
  const longPrompt = task.prompt && task.prompt !== command ? task.prompt : null;
  const working = card.status === 'claimed' || card.status === 'in_progress';
  const showPrompt = working || (card.status === 'ready' && !!longPrompt);
  const prNumber = task.prUrl ? /(\d+)\/?$/.exec(task.prUrl)?.[1] : undefined;
  const h = card.dueAt ? hoursFromNow(card.dueAt) : null;
  const editable =
    !card.archivedAt &&
    ['card.edit_content', 'card.edit_routing', 'task.edit_detail'].some((a) =>
      card.allowedActions.includes(a),
    );
  // Where the task came from: the plan, decision or handoff it answers. Docs stay in Links.
  const origins = card.links.filter(
    (l) => (l.kind === 'parent' || l.kind === 'relates') && (l.card?.type ?? 'task') !== 'doc',
  );

  // One link at a time, so a refusal (a loop, a link already there) names the key it refused.
  const addLinks = async (kind: LinkKind, keys: string[]) => {
    for (const key of keys) {
      try {
        await addLink(card.key, kind, key);
      } catch (e) {
        showToast({ tone: 'error', message: isHubError(e) ? e.message : kit.actionFailed });
        return;
      }
    }
  };

  if (action === EDIT && editable) return <TaskEditForm card={card} />;

  return (
    <div className="flex flex-col gap-5">
      {editable && <EditButton />}

      <div className="flex flex-col gap-2">
        <TaskStepper status={card.status} />
        <NextStep card={card} />
      </div>

      <MoveNote card={card} />

      {action === 'submit_review' && (
        <SubmitForm
          initialPr={task.prUrl ?? ''}
          onSave={(prUrl, note) =>
            perform('submit_review', { prUrl: prUrl || undefined, note: note || undefined })
          }
          onCancel={cancelAction}
        />
      )}
      {action === 'resume' && (
        <NoteActionForm
          noteLabel={t.reopenNote}
          required
          requiredMessage={t.reopenRequired}
          saveLabel={t.saveReopen}
          // `resume` takes `{ reason }`: the note lands on its event, and the box above shows it to the claimer.
          onSave={(note) => perform('resume', { reason: note })}
          onCancel={cancelAction}
        />
      )}

      {(blockers.length > 0 || canEdit) && (
        <div className="flex flex-col gap-1.5">
          {blockers.length > 0 && <SubHeading>{kit.sheet.links.kinds.blocked_by}</SubHeading>}
          {blockers.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {blockers.map((l) => (
                <li key={l.key} className="flex min-w-0 items-center">
                  <CardChip
                    k={l.key}
                    card={l.card}
                    showTitle
                    showStatus
                    className={cn(
                      'h-auto min-h-8 min-w-0 py-1',
                      !stillOpen.includes(l.key) && 'border-dashed',
                    )}
                  />
                  {!card.archivedAt && <RemoveLink cardKey={card.key} link={l} />}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={() => setPicker('blocker')}
                className={cn(linkButton, focusRing)}
              >
                <Plus aria-hidden className="size-3.5" strokeWidth={2} />
                {t.addBlocker}
              </button>
              <button type="button" onClick={() => setPicker('doc')} className={cn(linkButton, focusRing)}>
                <FileText aria-hidden className="size-3.5" strokeWidth={1.75} />
                {t.addDoc}
              </button>
            </div>
          )}
        </div>
      )}

      {task.acceptance ? (
        <div data-task-acceptance className="flex flex-col gap-2">
          <SubHeading>{s.acceptance}</SubHeading>
          <Checklist markdown={task.acceptance} />
        </div>
      ) : (
        !closed &&
        editable && (
          <div data-task-acceptance className="flex flex-col gap-1.5">
            <SubHeading>{s.acceptance}</SubHeading>
            <p className="text-body-sm text-muted-foreground">{t.noAcceptance}</p>
            <button
              type="button"
              onClick={() => setQuery({ action: EDIT })}
              className={cn(linkButton, 'self-start', focusRing)}
            >
              {t.addAcceptance}
            </button>
          </div>
        )
      )}

      {showPrompt && (
        <div className="flex flex-col gap-2">
          <SubHeading>{s.prompt}</SubHeading>
          {longPrompt && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-3">
              <pre
                dir="ltr"
                translate="no"
                className="key min-w-0 flex-1 text-start text-body-sm whitespace-pre-wrap text-foreground"
              >
                {longPrompt}
              </pre>
              <CopyButton text={longPrompt} showText={false} label={t.copyPrompt} />
            </div>
          )}
          {/* 09 §6 `tasks.openInClaude`: a mono line with its copy button. Ready says it in the next step already. */}
          {working && (
            <p className="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
              {fill(t.pasteHint, { cmd: <CopyButton compact text={command} /> })}
            </p>
          )}
        </div>
      )}

      {origins.length > 0 && (
        <div data-task-origins className="flex flex-col gap-1.5">
          <SubHeading>{t.comesFrom}</SubHeading>
          <ul className="flex flex-wrap gap-2">
            {origins.map((l) => (
              <li key={`${l.kind}-${l.key}`} className="min-w-0">
                <CardChip k={l.key} card={l.card} showTitle showStatus className="h-auto min-h-8 py-1" />
              </li>
            ))}
          </ul>
        </div>
      )}

      <Facts>
        <Fact label={s.specialty}>{s.specialties[task.specialty]}</Fact>
        {task.effort && (
          <Fact label={s.effort}>
            <Ltr mono>{task.effort}</Ltr>
          </Fact>
        )}
        {card.dueAt && (
          <Fact label={kit.sheet.fields.due}>
            <span title={absolute(card.dueAt, locale)} className="flex flex-wrap items-center gap-2">
              <RelativeTime iso={card.dueAt} />
              {!closed && h !== null && h < 0 && (
                <Pill tone="danger">
                  {fmt(t.overdue, { d: duration(Date.parse(card.dueAt) - nowMs(), locale) })}
                </Pill>
              )}
              {!closed && h !== null && h >= 0 && h <= 24 && (
                <Pill tone="warning">
                  {fmt(t.dueSoon, {
                    d: duration(Date.parse(card.dueAt) - nowMs(), locale, { nominative: true }),
                  })}
                </Pill>
              )}
            </span>
          </Fact>
        )}
        <Fact label={s.origin}>{s.origins[task.origin]}</Fact>
        <Fact label={s.claimer} wide={!!task.claimedById}>
          {task.claimedById ? (
            <span className="flex flex-wrap items-center gap-2">
              <ActorChip memberId={task.claimedById} />
              {task.claimedAt && <RelativeTime iso={task.claimedAt} className="text-muted-foreground" />}
            </span>
          ) : (
            <span className="text-muted-foreground">{s.unclaimed}</span>
          )}
        </Fact>
        {task.startedAt && (
          <Fact label={t.started}>
            <RelativeTime iso={task.startedAt} />
          </Fact>
        )}
        {task.doneAt && (
          <Fact label={t.finished}>
            <RelativeTime iso={task.doneAt} />
          </Fact>
        )}
        <Fact label={kit.sheet.fields.branch} wide>
          {branch ? (
            <code dir="ltr" translate="no" className="key break-all">
              {branch}
            </code>
          ) : canBind ? (
            <BranchBinder card={card} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Fact>
        {task.prUrl && (
          <Fact label={t.pr} wide>
            <a
              href={task.prUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-4 hover:underline',
                focusRing,
              )}
            >
              {fmt(t.openPr, { n: prNumber ?? '' })}
              <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
            </a>
          </Fact>
        )}
      </Facts>

      <CardPicker
        open={picker === 'blocker'}
        onOpenChange={(open) => !open && setPicker(null)}
        title={t.blockerTitle}
        exclude={[card.key, ...blockerKeys]}
        onConfirm={(keys) => void addLinks('blocked_by', keys)}
      />
      <DocPicker
        open={picker === 'doc'}
        onOpenChange={(open) => !open && setPicker(null)}
        title={t.docTitle}
        exclude={card.links.filter((l) => l.kind === 'relates').map((l) => l.key)}
        onConfirm={(keys) => void addLinks('relates', keys)}
      />
    </div>
  );
}
