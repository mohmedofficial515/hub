'use client';

/**
 * @file plan.tsx
 * @description Sheet section for a Plan (docs/15 §4): the written approach in Markdown, ordered steps, and every saved text with restore. A plan's text lives on `card.body`, and the API
 * keeps each previous text on its `plan_revised` event. Tasks are created from the action bar ("Create tasks from steps"), and each step then shows its task live.
 */
import { ArrowDown, ArrowUp, Check, ChevronDown, Circle, History, Plus, RotateCcw, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { ActorChip } from '@/components/cards/avatar';
import { RoleBadge } from '@/components/cards/badges';
import { CardChip } from '@/components/cards/card-key';
import { focusRing } from '@/components/cards/meta';
import { MarkdownView } from '@/components/common/markdown';
import { RelativeTime } from '@/components/common/relative-time';
import { ErrorState, SkeletonRows } from '@/components/common/states';
import { Bidi, fill, fmt, Ltr } from '@/components/common/text';
import { showToast } from '@/components/common/toast';
import { StepRunMenu } from '@/components/queue/run-entry';
import { setQuery } from '@/components/shell/router';
import { Button, IconButton } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { detectSecret, Field, SecretFilterError, Select, TextInput } from '@/components/ui/form';
import { useMaybeWb } from '@/components/workbench/store';
import type { PlanCard, PlanStep, Priority, Role } from '@/features/cards/types';
import { linkedOfType, restoreRevision, savePlan, usePlanRevisions } from '@/features/planning/queries';
import { isHubError } from '@/lib/api/errors';
import { num } from '@/lib/format';
import { useUnsavedGuard } from '@/lib/hooks';
import { kitMessages, useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

import {
  ChangedElsewhere,
  EDIT,
  EditButton,
  FormActions,
  FormFailure,
  MarkdownField,
  parseTags,
  useEditWords,
  useSaveForm,
} from './edit-bits';
import { ActionPanel, type SectionProps, SubHeading } from './shared';

const ROLES: Role[] = ['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa'];
const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3'];

interface PlanWords {
  plan: {
    fromIdea: string;
    stepTitle: string;
    stepRole: string;
    noRole: string;
    addStep: string;
    moveUp: string;
    moveDown: string;
    removeStep: string;
    stepsHint: string;
    stepRequired: string;
    tasksHint: string;
    revisions: string;
    revision: string;
    current: string;
    replacedBy: string;
    show: string;
    hide: string;
    restore: string;
    restoreTitle: string;
    restoreBody: string;
    restored: string;
    noRevisions: string;
    revisionsThing: string;
    emptyText: string;
  };
}

interface StepDraft {
  /** Stable while editing, whether or not the API has given the step an id yet. */
  uid: string;
  id?: string | undefined;
  title: string;
  role: string;
  taskKey?: string | undefined;
}

function StepsEditor({
  steps,
  onChange,
  tried,
}: {
  steps: StepDraft[];
  onChange: (next: StepDraft[]) => void;
  tried: boolean;
}) {
  const p = useT<PlanWords>('planning').plan;
  const kit = useT(kitMessages);
  const s = kit.sections.plan;
  const locale = useLocale();
  const id = useId();
  const nextUid = useRef(0);
  const set = (uid: string, patch: Partial<StepDraft>) =>
    onChange(steps.map((step) => (step.uid === uid ? { ...step, ...patch } : step)));
  const move = (at: number, by: number) => {
    const next = [...steps];
    const [item] = next.splice(at, 1);
    if (item) next.splice(at + by, 0, item);
    onChange(next);
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-body font-semibold text-foreground">{s.steps}</legend>
      <p className="text-body-sm text-muted-foreground">{p.stepsHint}</p>
      <ol className="flex flex-col gap-2">
        {steps.map((step, i) => {
          const n = num(i + 1, locale);
          const missing = tried && !step.title.trim();
          return (
            <li key={step.uid} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5">
              <div className="flex flex-wrap items-end gap-2">
                <Field
                  id={`${id}-${step.uid}`}
                  label={fmt(p.stepTitle, { n })}
                  error={missing ? p.stepRequired : undefined}
                  className="min-w-40 flex-1"
                >
                  <TextInput
                    id={`${id}-${step.uid}`}
                    dir="auto"
                    value={step.title}
                    onChange={(e) => set(step.uid, { title: e.target.value })}
                    aria-invalid={missing}
                  />
                </Field>
                <Field id={`${id}-${step.uid}-role`} label={p.stepRole} className="w-32">
                  <Select
                    id={`${id}-${step.uid}-role`}
                    value={step.role}
                    onChange={(e) => set(step.uid, { role: e.target.value })}
                  >
                    <option value="">{p.noRole}</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {kit.roles[r]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="flex items-center gap-1">
                {step.taskKey && <CardChip k={step.taskKey} type="task" className="me-auto" />}
                <IconButton
                  label={fmt(p.moveUp, { n })}
                  disabled={i === 0}
                  className={cn(!step.taskKey && i === 0 && 'ms-auto')}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp aria-hidden className="size-4" strokeWidth={1.75} />
                </IconButton>
                <IconButton
                  label={fmt(p.moveDown, { n })}
                  disabled={i === steps.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown aria-hidden className="size-4" strokeWidth={1.75} />
                </IconButton>
                <IconButton
                  label={fmt(p.removeStep, { n })}
                  onClick={() => onChange(steps.filter((other) => other.uid !== step.uid))}
                >
                  <X aria-hidden className="size-4" strokeWidth={1.75} />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ol>
      <Button
        size="sm"
        className="self-start"
        onClick={() => {
          nextUid.current += 1;
          onChange([...steps, { uid: `new-${nextUid.current}`, title: '', role: '' }]);
        }}
      >
        <Plus aria-hidden className="size-3.5" strokeWidth={1.75} />
        {p.addStep}
      </Button>
    </fieldset>
  );
}

function PlanEditForm({ card }: { card: PlanCard }) {
  const w = useEditWords();
  const s = useT(kitMessages).sections.plan;
  const id = useId();
  const { busy, failure, save } = useSaveForm();
  const [baseBody] = useState(card.body ?? '');
  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(card.body ?? '');
  const [priority, setPriority] = useState(card.priority);
  const [tags, setTags] = useState(card.tags.join(', '));
  const [steps, setSteps] = useState<StepDraft[]>(
    card.plan.steps.map((step) => ({
      uid: step.id,
      id: step.id,
      title: step.title,
      role: step.role ?? '',
      taskKey: step.taskKey,
    })),
  );
  const [tried, setTried] = useState(false);
  const [baseSteps] = useState(steps);
  useUnsavedGuard(
    title !== card.title ||
      body !== baseBody ||
      priority !== card.priority ||
      tags !== card.tags.join(', ') ||
      JSON.stringify(steps) !== JSON.stringify(baseSteps),
  );

  const noTitle = !title.trim();
  const blankStep = steps.some((step) => !step.title.trim());
  const secret =
    [title, body, tags, ...steps.map((step) => step.title)].map(detectSecret).find(Boolean) ?? null;

  const submit = () => {
    setTried(true);
    if (noTitle || blankStep || secret) return;
    void save(() =>
      savePlan(card.key, {
        title: title.trim(),
        body,
        priority,
        tags: parseTags(tags),
        steps: steps.map((step) => ({
          ...(step.id ? { id: step.id } : {}),
          title: step.title.trim(),
          ...(step.role ? { role: step.role as Role } : {}),
          done: false,
        })),
      }),
    );
  };

  return (
    <ActionPanel onSubmit={submit}>
      <ChangedElsewhere changed={baseBody !== (card.body ?? '')} />
      <Field
        id={`${id}-title`}
        label={w.title}
        required
        error={tried && noTitle ? w.titleRequired : undefined}
      >
        <TextInput
          id={`${id}-title`}
          dir="auto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={tried && noTitle}
        />
      </Field>
      <MarkdownField label={s.body} rows={12} value={body} onChange={setBody} />
      <StepsEditor steps={steps} onChange={setSteps} tried={tried} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${id}-priority`} label={w.priority}>
          <Select
            id={`${id}-priority`}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-tags`} label={w.tags} hint={w.tagsHint}>
          <TextInput id={`${id}-tags`} dir="auto" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
      </div>
      {secret && <SecretFilterError pattern={secret} />}
      <FormFailure message={failure} />
      <FormActions busy={busy} onCancel={() => setQuery({ action: null })} />
    </ActionPanel>
  );
}

function Revisions({ card, canRestore }: { card: PlanCard; canRestore: boolean }) {
  const p = useT<PlanWords>('planning').plan;
  const kit = useT(kitMessages);
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const query = usePlanRevisions(card.key, open);
  const rows = query.data ?? [];
  const n = (revision: number) => fmt(p.revision, { n: num(revision, locale) });

  const restore = (revision: number) => {
    restoreRevision(card.key, revision)
      .then(() => showToast({ message: fill(p.restored, { n: <Ltr>{num(revision, locale)}</Ltr> }) }))
      .catch((error: unknown) =>
        showToast({ tone: 'error', message: isHubError(error) ? error.message : kit.actionFailed }),
      );
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'hit-44 inline-flex items-center gap-1.5 self-start rounded-sm text-body font-semibold text-foreground underline-offset-4 hover:underline',
          focusRing,
        )}
      >
        <History aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
        {p.revisions}
        <ChevronDown
          aria-hidden
          className={cn(
            'size-3.5 transition-transform duration-120 motion-reduce:transition-none',
            open && 'rotate-180',
          )}
          strokeWidth={1.75}
        />
      </button>
      {open &&
        (query.isPending ? (
          <SkeletonRows count={2} withAction={false} />
        ) : query.isError ? (
          <ErrorState thing={p.revisionsThing} onRetry={() => void query.refetch()} />
        ) : rows.length <= 1 ? (
          <p className="text-body-sm text-muted-foreground">{p.noRevisions}</p>
        ) : (
          <ol className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {rows.map((row) => (
              <li key={row.revision} className="flex flex-col gap-2 p-3">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body-sm">
                  <span className="font-semibold text-foreground">{n(row.revision)}</span>
                  {row.current && <span className="text-muted-foreground">{p.current}</span>}
                  {row.savedAt && <RelativeTime iso={row.savedAt} className="text-muted-foreground" />}
                  {row.actor && (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      {p.replacedBy}
                      <ActorChip kind={row.actor.kind} memberId={row.actor.userId ?? undefined} />
                    </span>
                  )}
                  {!row.current && (
                    <span className="ms-auto flex items-center gap-1.5">
                      <Button
                        size="sm"
                        aria-expanded={shown === row.revision}
                        onClick={() => setShown(shown === row.revision ? null : row.revision)}
                      >
                        {shown === row.revision ? p.hide : p.show}
                      </Button>
                      {canRestore && (
                        <Button size="sm" onClick={() => setConfirm(row.revision)}>
                          <RotateCcw aria-hidden className="size-3.5" strokeWidth={1.75} />
                          {p.restore}
                        </Button>
                      )}
                    </span>
                  )}
                </div>
                {shown === row.revision &&
                  (row.body ? (
                    <div className="rounded-md bg-muted p-3">
                      <MarkdownView source={row.body} />
                    </div>
                  ) : (
                    <p className="text-body-sm text-muted-foreground">{p.emptyText}</p>
                  ))}
              </li>
            ))}
          </ol>
        ))}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(value) => !value && setConfirm(null)}
        title={confirm === null ? '' : fmt(p.restoreTitle, { n: num(confirm, locale) })}
        description={p.restoreBody}
        confirmLabel={p.restore}
        destructive={false}
        onConfirm={() => {
          if (confirm !== null) restore(confirm);
        }}
      />
    </div>
  );
}

function StepLine({ step, run }: { step: PlanStep; run?: { cardKey: string; index: number } | undefined }) {
  return (
    <li className="flex items-start gap-2 text-body text-foreground">
      {step.done ? (
        <Check aria-hidden className="mt-1 size-4 shrink-0 text-success-soft-foreground" strokeWidth={1.75} />
      ) : (
        <Circle aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      )}
      <span className={cn('min-w-0 flex-1', step.done && 'text-muted-foreground')}>
        <Bidi>{step.title}</Bidi>
      </span>
      {step.role && <RoleBadge role={step.role} outline={false} className="text-body-sm" />}
      {step.taskKey && <CardChip k={step.taskKey} type="task" showStatus />}
      {run && !step.done && <StepRunMenu cardKey={run.cardKey} index={run.index} title={step.title} />}
    </li>
  );
}

export function PlanSection({ card, action }: SectionProps<'plan'>) {
  const s = useT(kitMessages).sections.plan;
  const p = useT<PlanWords>('planning').plan;
  const locale = useLocale();
  const { steps } = card.plan;
  const done = steps.filter((step) => step.done).length;
  const withoutTask = steps.filter((step) => !step.taskKey).length;
  const idea = linkedOfType(card, 'idea');
  const canEdit = !card.archivedAt && card.allowedActions.includes('plan.update');
  const canRestore = !card.archivedAt && card.allowedActions.includes('plan.restore_revision');
  const wb = useMaybeWb();

  if (action === EDIT && canEdit) return <PlanEditForm card={card} />;

  return (
    <div className="flex flex-col gap-5">
      {canEdit && <EditButton />}
      {idea && (
        <p className="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
          {p.fromIdea}
          <CardChip k={idea.key} type="idea" title={idea.card?.title} showTitle className="max-w-full" />
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <SubHeading>{s.steps}</SubHeading>
        {steps.length === 0 ? (
          <p className="text-body text-muted-foreground">{s.noSteps}</p>
        ) : (
          <>
            <p className="text-body-sm text-muted-foreground">
              {fmt(s.progress, { done: num(done, locale), total: num(steps.length, locale) })}
              {withoutTask > 0 && ` · ${fmt(p.tasksHint, { n: num(withoutTask, locale) })}`}
            </p>
            <ul className="flex flex-col gap-2">
              {steps.map((step, index) => (
                <StepLine
                  key={step.id}
                  step={step}
                  run={card.archivedAt || !wb ? undefined : { cardKey: card.key, index }}
                />
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <SubHeading>{s.body}</SubHeading>
        {card.body ? (
          <MarkdownView source={card.body} />
        ) : (
          <p className="text-body text-muted-foreground">{s.noBody}</p>
        )}
      </div>
      <Revisions card={card} canRestore={canRestore} />
    </div>
  );
}
