'use client';

/**
 * @file decision-edit.tsx
 * @description Edit a decision (08 §5.4 "Edit options", which the design left unbuilt): its question's title, context, decider, deadline, and, while it is open, its options.
 */
import type { UpdateCardInput } from '@hub/contracts';
import { useId, useState } from 'react';

import type { DecisionMessages } from '@/components/decisions/messages';
import {
  draftOf,
  draftTexts,
  type OptionDraft,
  OptionFields,
  optionsOf,
} from '@/components/decisions/option-fields';
import { setQuery, useRoute } from '@/components/shell/router';
import { detectSecret, Field, SecretFilterError, Select, TextInput } from '@/components/ui/form';
import type { DecisionCard, DecisionOption, Priority, Role } from '@/features/cards/types';
import { saveDecision } from '@/features/decisions/queries';
import { kitMessages, useT } from '@/lib/i18n';

import {
  ChangedElsewhere,
  FormActions,
  FormFailure,
  fromLocalInput,
  MarkdownField,
  toLocalInput,
  useEditWords,
  useSaveForm,
} from './edit-bits';
import { ActionPanel } from './shared';

const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3'];
const ROLES: Role[] = ['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa'];

export function DecisionEditForm({ card }: { card: DecisionCard }) {
  const w = useEditWords();
  const t = useT<DecisionMessages>('decisions');
  const kit = useT(kitMessages);
  const { ws } = useRoute();
  const id = useId();
  const { busy, failure, save } = useSaveForm();
  const d = card.decision;

  const canContent = card.allowedActions.includes('card.edit_content');
  const canRouting = card.allowedActions.includes('card.edit_routing');
  const canOptions = card.status === 'open' && card.allowedActions.includes('decision.edit_options');

  const [baseOptions] = useState(d.options);
  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(card.body ?? '');
  const [priority, setPriority] = useState(card.priority);
  const [decider, setDecider] = useState<Role>(d.deciderRole);
  const [due, setDue] = useState(toLocalInput(card.dueAt));
  const [options, setOptions] = useState<OptionDraft[]>(d.options.map(draftOf));
  const [tried, setTried] = useState(false);

  const named = optionsOf(options);
  const noTitle = !title.trim();
  const tooFew = canOptions && named.length < 2;
  const secret = [title, body, ...draftTexts(options)].map(detectSecret).find(Boolean) ?? null;
  const optionsChanged = JSON.stringify(baseOptions.map(draftOf)) !== JSON.stringify(options);

  const submit = () => {
    setTried(true);
    if (noTitle || tooFew || secret) return;
    const header: UpdateCardInput = {};
    if (canContent) {
      if (title.trim() !== card.title) header.title = title.trim();
      if ((body.trim() || null) !== (card.body ?? null)) header.body = body.trim() || null;
    }
    if (canRouting) {
      if (priority !== card.priority) header.priority = priority;
      if (decider !== d.deciderRole) header.ownerRole = decider;
      if (due !== toLocalInput(card.dueAt)) header.dueAt = fromLocalInput(due);
    }
    const nextOptions = canOptions && optionsChanged ? (named as DecisionOption[]) : null;
    void save(() => saveDecision(ws, card.key, header, nextOptions));
  };

  return (
    <ActionPanel onSubmit={submit}>
      <ChangedElsewhere changed={JSON.stringify(baseOptions) !== JSON.stringify(d.options)} />
      <Field
        id={`${id}-title`}
        label={t.new.question}
        required
        error={tried && noTitle ? w.titleRequired : undefined}
      >
        <TextInput
          id={`${id}-title`}
          dir="auto"
          disabled={!canContent}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={tried && noTitle}
        />
      </Field>
      <MarkdownField label={t.new.context} rows={3} value={body} onChange={setBody} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id={`${id}-who`} label={t.new.decider}>
          <Select
            id={`${id}-who`}
            disabled={!canRouting}
            value={decider}
            onChange={(e) => setDecider(e.target.value as Role)}
          >
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
            disabled={!canRouting}
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
        <Field id={`${id}-due`} label={t.new.due}>
          <TextInput
            id={`${id}-due`}
            type="datetime-local"
            dir="ltr"
            className="text-start"
            disabled={!canRouting}
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </Field>
      </div>
      {canOptions && (
        <OptionFields id={id} options={options} onChange={setOptions} tooFew={tried && tooFew} />
      )}
      {secret && <SecretFilterError pattern={secret} />}
      <FormFailure message={failure} />
      <FormActions busy={busy} onCancel={() => setQuery({ action: null })} />
    </ActionPanel>
  );
}
