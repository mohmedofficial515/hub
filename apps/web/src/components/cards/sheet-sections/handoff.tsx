'use client';

/**
 * @file handoff.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/sheet-sections/handoff.tsx. Contract: apps/web/README.md.
 */
import { ArrowRight, Check, Clock, Copy } from 'lucide-react';
import { useId, useState } from 'react';

import { ActorChip } from '@/components/cards/avatar';
import { Pill, RoleBadge } from '@/components/cards/badges';
import { CardChip } from '@/components/cards/card-key';
import { focusRing, type Tone } from '@/components/cards/meta';
import {
  ActionPanel,
  Fact,
  Facts,
  NoteActionForm,
  type SectionProps,
  SubHeading,
} from '@/components/cards/sheet-sections/shared';
import { copyText } from '@/components/common/copy-button';
import { RelativeTime } from '@/components/common/relative-time';
import { Bidi, fmt } from '@/components/common/text';
import { showToast } from '@/components/common/toast';
import { Button } from '@/components/ui/button';
import { Field, Textarea, TextInput } from '@/components/ui/form';
import { getCard, handoffAgeMs, isHandoffStale } from '@/features/cards/store';
import type { HandoffCard, OasdiffChange, Role, TaskCard } from '@/features/cards/types';
import { useHandoffStale } from '@/features/handoffs/queries';
import { duration } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Strings only this section needs. The card vocabulary stays in `kit/i18n.ts`. */
export { handoffAgeMs, isHandoffStale };

/** Breaking is danger everywhere. Warning is kept for "stale" (kit colour rule), so notable reads as information. */
export const severityTone: Record<HandoffCard['handoff']['severity'], Tone> = {
  breaking: 'danger',
  notable: 'info',
  info: 'muted',
};

/** "Copy prompt" with its words, for rows and the sheet (09 §9). */
export function CopyPromptButton({
  prompt,
  size = 'md',
  className,
  ...rest
}: {
  prompt: string;
  size?: 'sm' | 'md' | undefined;
  className?: string | undefined;
  'aria-describedby'?: string;
}) {
  const m = useT(kitMessages).sections.handoff;
  const [copied, setCopied] = useState(false);
  const Icon = copied ? Check : Copy;
  return (
    <Button
      size={size}
      className={className}
      {...rest}
      onClick={() =>
        void (async () => {
          await copyText(prompt);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
          showToast({ message: m.promptCopied });
        })()
      }
    >
      <Icon
        aria-hidden
        className={cn('size-3.5', copied && 'text-success-soft-foreground')}
        strokeWidth={1.75}
      />
      {m.copyPrompt}
    </Button>
  );
}

/**
 * The contract diff the critic praised: old value struck through, before and after labelled in words, so a change
 * is never only red and green. Exported for Handoffs and Today.
 */
export function ContractChange({ change }: { change: OasdiffChange }) {
  const t = useT(kitMessages);
  const s = t.sheet.handoff;
  return (
    <li className="flex flex-col gap-1.5 px-3 py-2.5">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <code dir="ltr" translate="no" className="key text-body-sm font-medium text-foreground">
          {change.endpoint}
        </code>
        <span className="text-body-sm text-muted-foreground">{change.change}</span>
      </p>
      {(change.before || change.after) && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-body-sm">
          {change.before && (
            <>
              <dt className="text-muted-foreground">{s.before}</dt>
              <dd>
                <code
                  dir="ltr"
                  translate="no"
                  className="key block truncate rounded-sm bg-destructive-soft px-2 py-1 text-start text-destructive-soft-foreground line-through decoration-1"
                >
                  {change.before}
                </code>
              </dd>
            </>
          )}
          {change.after && (
            <>
              <dt className="text-muted-foreground">{s.after}</dt>
              <dd>
                <code
                  dir="ltr"
                  translate="no"
                  className="key block truncate rounded-sm bg-success-soft px-2 py-1 text-start text-success-soft-foreground"
                >
                  {change.after}
                </code>
              </dd>
            </>
          )}
        </dl>
      )}
    </li>
  );
}

/** 08 §5.4: grouped by breaking and non-breaking, schema changes apart, "View raw" expands the JSON. */
export function HandoffDiffList({
  changes,
  schemas,
  files,
}: {
  changes?: OasdiffChange[] | undefined;
  schemas?: string[] | undefined;
  files?: string[] | undefined;
}) {
  const t = useT(kitMessages);
  const s = t.sheet.handoff;
  const [raw, setRaw] = useState(false);
  const breaking = changes?.filter((c) => c.severity === 'breaking') ?? [];
  const other = changes?.filter((c) => c.severity !== 'breaking') ?? [];
  const group = (title: string, tone: 'danger' | 'muted', list: OasdiffChange[]) =>
    list.length > 0 && (
      <div className="flex flex-col gap-1.5">
        <Pill tone={tone} className="self-start">
          {title}
        </Pill>
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {list.map((c, i) => (
            // Two changes on one endpoint are usual in oasdiff, so the endpoint alone is not a key.
            <ContractChange key={`${c.endpoint}:${i}`} change={c} />
          ))}
        </ul>
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      {group(s.breaking, 'danger', breaking)}
      {group(s.nonBreaking, 'muted', other)}
      {!!schemas?.length && (
        <p className="flex flex-wrap items-center gap-1.5 text-body-sm text-muted-foreground">
          {s.schemas}:
          {schemas.map((name) => (
            <code
              key={name}
              dir="ltr"
              translate="no"
              className="key rounded-sm bg-muted px-1.5 text-foreground"
            >
              {name}
            </code>
          ))}
        </p>
      )}
      {!!files?.length && (
        <ul className="flex flex-col gap-1 text-body-sm">
          {files.map((file) => (
            <li key={file}>
              <code dir="ltr" translate="no" className="key break-all text-foreground">
                {file}
              </code>
            </li>
          ))}
        </ul>
      )}
      {!!changes?.length && (
        <div>
          <Button size="sm" variant="ghost" onClick={() => setRaw((v) => !v)} aria-expanded={raw}>
            {raw ? s.hideRaw : s.viewRaw}
          </Button>
          {raw && (
            <pre
              dir="ltr"
              className="key mt-2 max-h-64 overflow-auto rounded-lg border border-border bg-muted p-3 text-start text-caption text-foreground"
            >
              {JSON.stringify(
                changes.map(({ endpoint, severity, before, after, change }) => ({
                  endpoint,
                  severity,
                  change,
                  before,
                  after,
                })),
                null,
                2,
              )}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

const SPECIALTY: Record<Role, TaskCard['task']['specialty']> = {
  owner: 'ops',
  pm: 'ops',
  accountant: 'ops',
  backend: 'backend',
  frontend: 'frontend',
  designer: 'design',
  qa: 'qa',
};

type ApplyMode = 'create' | 'link' | 'none';

/** 09 §9 "Apply…": create a task from the handoff, link an existing one, or record it with neither. */
function ApplyForm({
  card,
  onSave,
  onCancel,
}: {
  card: HandoffCard;
  onSave: SectionProps<'handoff'>['perform'];
  onCancel: () => void;
}) {
  const t = useT(kitMessages);
  const m = useT(kitMessages).sections.handoff;
  const id = useId();
  const [mode, setMode] = useState<ApplyMode>(card.handoff.appliedTaskKey ? 'link' : 'create');
  const [title, setTitle] = useState(card.title);
  const [taskKey, setTaskKey] = useState(card.handoff.appliedTaskKey ?? '');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  const linked = getCard(taskKey.trim().toUpperCase());
  const invalid = mode === 'link' && linked?.type !== 'task';

  const submit = () => {
    setTried(true);
    if (invalid) return;
    // docs/04 §3.13: the API creates the task in the same transaction when asked to.
    onSave('apply', {
      note: note.trim() || undefined,
      taskKey: mode === 'link' ? linked?.key : undefined,
      ...(mode === 'create'
        ? { createTask: { title: title.trim() || card.title, specialty: SPECIALTY[card.handoff.toRole] } }
        : {}),
    });
  };

  const choice = (value: ApplyMode, label: string, hint?: string) => (
    <label className="flex min-h-11 items-start gap-2 text-body-sm text-foreground md:min-h-0">
      <input
        type="radio"
        name={`${id}-mode`}
        checked={mode === value}
        onChange={() => setMode(value)}
        className={cn('mt-0.5 size-4 shrink-0 accent-primary', focusRing)}
      />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );

  return (
    <ActionPanel onSubmit={submit} labelledBy={`${id}-title`}>
      <SubHeading>
        <span id={`${id}-title`}>{m.howApplied}</span>
      </SubHeading>
      <div role="radiogroup" aria-labelledby={`${id}-title`} className="flex flex-col gap-2">
        {choice('create', m.createTask, card.handoff.prompt ? m.createTaskHint : undefined)}
        {mode === 'create' && (
          <Field id={`${id}-task-title`} label={m.taskTitle}>
            <TextInput
              id={`${id}-task-title`}
              dir="auto"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
        )}
        {choice('link', m.linkTask)}
        {mode === 'link' && (
          <Field id={`${id}-task-key`} label={m.taskKey} error={tried && invalid ? m.taskInvalid : undefined}>
            <TextInput
              id={`${id}-task-key`}
              dir="ltr"
              className="key text-start"
              placeholder="GTV-123"
              value={taskKey}
              onChange={(e) => setTaskKey(e.target.value)}
              aria-invalid={tried && invalid}
            />
          </Field>
        )}
        {choice('none', m.noTask)}
      </div>
      <Field id={`${id}-note`} label={t.sheet.fields.noteOptional}>
        <Textarea
          id={`${id}-note`}
          dir="auto"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary">
          {t.sheet.handoff.saveApply}
        </Button>
        <Button onClick={onCancel}>{t.cancel}</Button>
      </div>
    </ActionPanel>
  );
}

export function HandoffSection({ card, action, cancelAction, perform }: SectionProps<'handoff'>) {
  const t = useT(kitMessages);
  const m = useT(kitMessages).sections.handoff;
  const locale = useLocale();
  const h = card.handoff;
  const s = t.sheet.handoff;
  const stale = useHandoffStale()(card);
  const dismissal =
    card.status === 'dismissed'
      ? [...card.events].reverse().find((e) => e.data.reason)?.data.reason
      : undefined;
  return (
    <div className="flex flex-col gap-5">
      {action === 'acknowledge' && (
        <NoteActionForm
          hint={s.ackHint}
          noteLabel={t.sheet.fields.noteOptional}
          saveLabel={s.saveAck}
          onSave={(note) => perform('acknowledge', { note: note || undefined })}
          onCancel={cancelAction}
        />
      )}
      {action === 'apply' && <ApplyForm card={card} onSave={perform} onCancel={cancelAction} />}
      <Facts>
        <Fact label={s.route} wide>
          <span className="flex flex-wrap items-center gap-2">
            <RoleBadge role={h.fromRole} />
            <ArrowRight
              aria-hidden
              className="size-4 text-muted-foreground rtl:-scale-x-100"
              strokeWidth={1.75}
            />
            <RoleBadge role={h.toRole} />
          </span>
        </Fact>
        <Fact label={t.sheet.fields.kind}>{s.kinds[h.kind]}</Fact>
        <Fact label={t.sheet.fields.severity}>
          <Pill tone={severityTone[h.severity]}>{s.severities[h.severity]}</Pill>
        </Fact>
        {card.status === 'pending' && (
          <Fact label={t.status.pending} wide>
            {stale ? (
              <Pill tone="warning" icon={Clock}>
                {fmt(s.pendingAge, { d: duration(handoffAgeMs(card), locale) })}
              </Pill>
            ) : (
              fmt(s.pendingAge, { d: duration(handoffAgeMs(card), locale) })
            )}
          </Fact>
        )}
        {h.acknowledgedById && (
          <Fact label={m.ackBy} wide>
            <span className="flex flex-wrap items-center gap-2">
              <ActorChip memberId={h.acknowledgedById} />
              {h.acknowledgedAt && <RelativeTime iso={h.acknowledgedAt} className="text-muted-foreground" />}
            </span>
          </Fact>
        )}
        {h.appliedById && (
          <Fact label={m.appliedBy} wide>
            <span className="flex flex-wrap items-center gap-2">
              <ActorChip memberId={h.appliedById} />
              {h.appliedAt && <RelativeTime iso={h.appliedAt} className="text-muted-foreground" />}
            </span>
          </Fact>
        )}
        {typeof dismissal === 'string' && (
          <Fact label={m.reason} wide>
            <Bidi>{dismissal}</Bidi>
          </Fact>
        )}
      </Facts>
      <div className="flex flex-col gap-1">
        <SubHeading>{s.summary}</SubHeading>
        <p className="text-body text-foreground">
          <Bidi>{h.summary}</Bidi>
        </p>
      </div>
      {!!(h.payload.oasdiff?.length || h.payload.files?.length) && (
        <div className="flex flex-col gap-2">
          <SubHeading>{s.diff}</SubHeading>
          <HandoffDiffList changes={h.payload.oasdiff} schemas={h.payload.schemas} files={h.payload.files} />
        </div>
      )}
      {h.prompt && (
        <div className="flex flex-col gap-1.5">
          <SubHeading>{s.prompt}</SubHeading>
          <pre
            dir="ltr"
            className="key rounded-lg border border-border bg-muted p-3 text-start text-body-sm break-words whitespace-pre-wrap text-foreground"
          >
            {h.prompt}
          </pre>
          <CopyPromptButton prompt={h.prompt} className="self-start" />
        </div>
      )}
      {(h.sourceCardKey || h.appliedTaskKey) && (
        <Facts>
          {h.sourceCardKey && (
            <Fact label={s.source}>
              <CardChip k={h.sourceCardKey} />
            </Fact>
          )}
          {h.appliedTaskKey && (
            <Fact label={s.appliedTask}>
              <CardChip k={h.appliedTaskKey} />
            </Fact>
          )}
        </Facts>
      )}
    </div>
  );
}
