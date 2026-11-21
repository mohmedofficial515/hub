'use client';

/**
 * @file idea.tsx
 * @description Sheet section for an Idea (docs/15 §4): problem and notes in Markdown, editable, and "Turn into a plan", which lands on the new plan.
 */
import { useId, useState } from 'react';

import { CardChip } from '@/components/cards/card-key';
import { focusRing } from '@/components/cards/meta';
import { MarkdownView } from '@/components/common/markdown';
import { fill, Ltr } from '@/components/common/text';
import { showToast } from '@/components/common/toast';
import { AppLink, openCard, setQuery } from '@/components/shell/router';
import { detectSecret, Field, SecretFilterError, Select, TextInput } from '@/components/ui/form';
import type { Priority, Role } from '@/features/cards/types';
import { excerptOf } from '@/features/planning/model';
import { linkedOfType, saveIdea, turnIntoPlan } from '@/features/planning/queries';
import { isHubError } from '@/lib/api/errors';
import { useUnsavedGuard } from '@/lib/hooks';
import { kitMessages, useT } from '@/lib/i18n';
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

interface IdeaWords {
  idea: {
    role: string;
    noRole: string;
    body: string;
    toPlanTitle: string;
    toPlanHint: string;
    planTitle: string;
    planBody: string;
    toPlanSave: string;
    turned: string;
    toPlanStudio: string;
  };
}

type IdeaProps = SectionProps<'idea'>;

function IdeaEditForm({ card }: { card: IdeaProps['card'] }) {
  const w = useEditWords();
  const s = useT(kitMessages).sections.idea;
  const kit = useT(kitMessages);
  const words = useT<IdeaWords>('planning').idea;
  const id = useId();
  const { busy, failure, save } = useSaveForm();
  const d = card.idea;
  const [base] = useState({ problem: d.problem, notes: d.notes });
  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(card.body ?? '');
  const [problem, setProblem] = useState(d.problem ?? '');
  const [notes, setNotes] = useState(d.notes ?? '');
  const [role, setRole] = useState<string>(d.role ?? '');
  const [priority, setPriority] = useState(card.priority);
  const [tags, setTags] = useState(card.tags.join(', '));
  const [tried, setTried] = useState(false);
  useUnsavedGuard(
    title !== card.title ||
      body !== (card.body ?? '') ||
      problem !== (base.problem ?? '') ||
      notes !== (base.notes ?? '') ||
      role !== (d.role ?? '') ||
      priority !== card.priority ||
      tags !== card.tags.join(', '),
  );

  const noTitle = !title.trim();
  const secret = [title, body, problem, notes, tags].map(detectSecret).find(Boolean) ?? null;

  const submit = () => {
    setTried(true);
    if (noTitle || secret) return;
    void save(() =>
      saveIdea(card.key, {
        title: title.trim(),
        body: body.trim() || null,
        problem: problem.trim() || null,
        notes: notes.trim() || null,
        role: (role || null) as Role | null,
        priority,
        tags: parseTags(tags),
      }),
    );
  };

  return (
    <ActionPanel onSubmit={submit}>
      <ChangedElsewhere changed={base.problem !== d.problem || base.notes !== d.notes} />
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
      <MarkdownField label={s.problem} rows={5} value={problem} onChange={setProblem} />
      <MarkdownField label={s.notes} rows={6} value={notes} onChange={setNotes} />
      <MarkdownField label={words.body} rows={8} value={body} onChange={setBody} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${id}-role`} label={words.role}>
          <Select id={`${id}-role`} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{words.noRole}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {kit.roles[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-priority`} label={w.priority}>
          <Select
            id={`${id}-priority`}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id={`${id}-tags`} label={w.tags} hint={w.tagsHint}>
        <TextInput id={`${id}-tags`} dir="auto" value={tags} onChange={(e) => setTags(e.target.value)} />
      </Field>
      {secret && <SecretFilterError pattern={secret} />}
      <FormFailure message={failure} />
      <FormActions busy={busy} onCancel={() => setQuery({ action: null })} />
    </ActionPanel>
  );
}

function ToPlanForm({ card, onCancel }: { card: IdeaProps['card']; onCancel: () => void }) {
  const words = useT<IdeaWords>('planning').idea;
  const w = useEditWords();
  const kit = useT(kitMessages);
  const id = useId();
  const seed = [card.idea.problem, card.idea.notes, card.body].filter(Boolean).join('\n\n');
  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(seed);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const noTitle = !title.trim();
  const secret = detectSecret(title) ?? detectSecret(body);

  const submit = () => {
    setTried(true);
    if (noTitle || secret || busy) return;
    setBusy(true);
    setFailure(null);
    turnIntoPlan(card.key, { title: title.trim(), ...(body.trim() ? { body: body.trim() } : {}) })
      .then((planKey) => {
        if (!planKey) {
          setQuery({ action: null });
          return;
        }
        showToast({ message: fill(words.turned, { key: <Ltr mono>{planKey}</Ltr> }) });
        openCard(planKey);
      })
      .catch((error: unknown) => {
        setFailure(isHubError(error) ? error.message : kit.actionFailed);
      })
      .finally(() => setBusy(false));
  };

  return (
    <ActionPanel onSubmit={submit}>
      <SubHeading>{words.toPlanTitle}</SubHeading>
      <p className="text-body-sm text-muted-foreground">{words.toPlanHint}</p>
      <AppLink
        view="planning"
        query={{ studio: 'plan', idea: card.key, plan: null, action: null, chat: null, tab: null }}
        className={cn(
          'hit-44 self-start rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline',
          focusRing,
        )}
      >
        {words.toPlanStudio}
      </AppLink>
      <Field
        id={`${id}-title`}
        label={words.planTitle}
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
      <MarkdownField label={words.planBody} rows={6} value={body} onChange={setBody} />
      {secret && <SecretFilterError pattern={secret} />}
      <FormFailure message={failure} />
      <FormActions busy={busy} saveLabel={words.toPlanSave} onCancel={onCancel} />
    </ActionPanel>
  );
}

export function IdeaSection({ card, action, cancelAction }: IdeaProps) {
  const s = useT(kitMessages).sections.idea;
  const d = card.idea;
  const plan = linkedOfType(card, 'plan');
  const canEdit = !card.archivedAt && card.allowedActions.includes('idea.update');

  if (action === EDIT && canEdit) return <IdeaEditForm card={card} />;

  return (
    <div className="flex flex-col gap-5">
      {action === 'to_plan' && <ToPlanForm card={card} onCancel={cancelAction} />}
      {canEdit && <EditButton />}
      <div className="flex flex-col gap-1.5">
        <SubHeading>{s.problem}</SubHeading>
        {d.problem ? (
          <MarkdownView source={d.problem} />
        ) : (
          <p className="text-body text-muted-foreground">{s.noProblem}</p>
        )}
      </div>
      {d.notes && (
        <div className="flex flex-col gap-1.5">
          <SubHeading>{s.notes}</SubHeading>
          <MarkdownView source={d.notes} />
        </div>
      )}
      {plan && (
        <div className="flex flex-col gap-1.5">
          <SubHeading>{s.planLink}</SubHeading>
          <CardChip
            k={plan.key}
            type="plan"
            title={plan.card?.title ?? excerptOf(d.problem, 60)}
            showTitle
            showStatus
            className="h-auto min-h-8 self-start py-1"
          />
        </div>
      )}
    </div>
  );
}
