'use client';

/**
 * @file new-decision.tsx
 * @description Ported from v5 `pages/decisions/parts/new-decision.tsx`. 09 §7 "New decision": what the generic `+` dialog leaves out. Create and open, as the rest of the app does.
 */
import { useEffect, useId, useState } from 'react';

import {
  Button,
  createCard,
  detectSecret,
  Field,
  kitMessages,
  matchKey,
  Modal,
  openCard,
  PickField,
  SecretFilterError,
  Select,
  Textarea,
  TextInput,
  useT,
} from '@/components/kit';
import type { DecisionCard, Role } from '@/features/cards/types';
import { isHubError } from '@/lib/api/errors';

import type { DecisionMessages } from './messages';
import { draftTexts, emptyOption, type OptionDraft, OptionFields, optionsOf } from './option-fields';

type Kind = DecisionCard['decision']['kind'];

const KINDS: Kind[] = ['product', 'technical', 'financial', 'design'];
export const DECIDER_ROLES: Role[] = ['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa'];
/** 09 §7: financial → accountant, product → owner, technical → the role lead, then pm, design → owner. */
const DECIDER_BY_KIND: Record<Kind, Role> = {
  financial: 'accountant',
  product: 'owner',
  technical: 'pm',
  design: 'owner',
};

export function NewDecisionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT<DecisionMessages>('decisions');
  const kit = useT(kitMessages);
  const id = useId();
  const n = t.new;

  const [question, setQuestion] = useState('');
  const [kind, setKind] = useState<Kind>('product');
  const [context, setContext] = useState('');
  const [decider, setDecider] = useState<Role>('owner');
  const [due, setDue] = useState('');
  const [options, setOptions] = useState<OptionDraft[]>([emptyOption(), emptyOption()]);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [docs, setDocs] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuestion('');
    setKind('product');
    setContext('');
    setDecider('owner');
    setDue('');
    setOptions([emptyOption(), emptyOption()]);
    setBlocks([]);
    setDocs([]);
    setTried(false);
    setFailure(null);
  }, [open]);

  const named = optionsOf(options);
  const noQuestion = !question.trim();
  const tooFew = named.length < 2;
  const secret = [question, context, ...draftTexts(options)].map(detectSecret).find(Boolean) ?? null;

  const create = async () => {
    setTried(true);
    setFailure(null);
    if (noQuestion || tooFew || secret || busy) return;
    setBusy(true);
    try {
      const card = await createCard({
        type: 'decision',
        title: question.trim(),
        ...(context.trim() ? { body: context.trim() } : {}),
        priority: 'P2',
        // Left empty, the API applies `decisions.default_due_days` (03 §7).
        ...(due ? { dueAt: new Date(due).toISOString() } : {}),
        links: [
          ...blocks.map((key) => ({ kind: 'blocks' as const, key })),
          ...docs.map((key) => ({ kind: 'relates' as const, key })),
        ],
        detail: { kind, question: question.trim(), options: named, deciderRole: decider },
      });
      onOpenChange(false);
      window.setTimeout(() => openCard(card.key), 0);
    } catch (error) {
      setFailure(isHubError(error) ? error.message : kit.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={n.title}
      className="md:max-w-2xl"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{kit.cancel}</Button>
          <Button variant="primary" busy={busy} onClick={() => void create()}>
            {n.create}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
        onKeyDown={(e) => {
          if (matchKey(e, 'Enter') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void create();
          }
        }}
      >
        <Field
          id={`${id}-q`}
          label={n.question}
          hint={n.questionHint}
          required
          error={tried && noQuestion ? n.required : undefined}
        >
          <TextInput
            id={`${id}-q`}
            dir="auto"
            autoFocus
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            aria-invalid={tried && noQuestion}
          />
        </Field>
        <Field id={`${id}-ctx`} label={n.context} hint={n.contextHint}>
          <Textarea
            id={`${id}-ctx`}
            dir="auto"
            rows={2}
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id={`${id}-kind`} label={n.kind}>
            <Select
              id={`${id}-kind`}
              value={kind}
              onChange={(e) => {
                const next = e.target.value as Kind;
                setKind(next);
                setDecider(DECIDER_BY_KIND[next]);
              }}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t.kinds[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`${id}-who`} label={n.decider}>
            <Select id={`${id}-who`} value={decider} onChange={(e) => setDecider(e.target.value as Role)}>
              {DECIDER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {kit.roles[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`${id}-due`} label={n.due} hint={n.dueHint}>
            <TextInput
              id={`${id}-due`}
              type="datetime-local"
              dir="ltr"
              className="text-start"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </Field>
        </div>
        <p className="-mt-2 text-body-sm text-muted-foreground">{n.deciderHint}</p>

        <OptionFields id={id} options={options} onChange={setOptions} tooFew={tried && tooFew} />

        <PickField label={n.blocks} hint={n.blocksHint} keys={blocks} onChange={setBlocks} />
        <PickField label={n.docs} keys={docs} onChange={setDocs} picker="doc" />
        {secret && <SecretFilterError pattern={secret} />}
        {failure && (
          <p role="alert" className="text-body-sm text-destructive-soft-foreground">
            {failure}
          </p>
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
