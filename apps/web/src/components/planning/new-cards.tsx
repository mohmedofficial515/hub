'use client';

/**
 * @file new-cards.tsx
 * @description New plan and New idea, written by hand. Each creates and opens, as the rest of the app does; the sheet holds everything else. A new idea
 * usually starts in the Idea Studio (`studio/idea-studio.tsx`); this form is its way round when there is no research to do, or no Claude to do it.
 */
import { type ReactNode, useEffect, useId, useState } from 'react';

import {
  Button,
  createCard,
  detectSecret,
  Field,
  kitMessages,
  matchKey,
  Modal,
  type NewCardInput,
  openCard,
  type Role,
  SecretFilterError,
  Select,
  Textarea,
  TextInput,
  useT,
} from '@/components/kit';
import { isHubError } from '@/lib/api/errors';

import type { PlanningMessages } from './messages';

const ROLES: Role[] = ['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa'];

function useCreate(onDone: () => void) {
  const kit = useT(kitMessages);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const create = async (input: NewCardInput) => {
    setBusy(true);
    setFailure(null);
    try {
      const card = await createCard(input);
      onDone();
      // Wait for the dialog's own focus return, so the sheet records the right opener.
      window.setTimeout(() => openCard(card.key), 0);
    } catch (error) {
      setFailure(isHubError(error) ? error.message : kit.actionFailed);
    } finally {
      setBusy(false);
    }
  };
  return { busy, failure, create };
}

function FormBody({
  children,
  onSubmit,
  secret,
  failure,
}: {
  children: ReactNode;
  onSubmit: () => void;
  secret: string | null;
  failure: string | null;
}) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      onKeyDown={(e) => {
        if (matchKey(e, 'Enter') && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onSubmit();
        }
      }}
    >
      {children}
      {secret && <SecretFilterError pattern={secret} />}
      {failure && (
        <p role="alert" className="text-body-sm text-destructive-soft-foreground">
          {failure}
        </p>
      )}
      <button type="submit" hidden aria-hidden tabIndex={-1} />
    </form>
  );
}

export function NewPlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT<PlanningMessages>('planning');
  const kit = useT(kitMessages);
  const n = t.newPlanForm;
  const id = useId();
  const { busy, failure, create } = useCreate(() => onOpenChange(false));
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [steps, setSteps] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setBody('');
    setSteps('');
    setTried(false);
  }, [open]);

  const missing = !title.trim();
  const secret = [title, body, steps].map(detectSecret).find(Boolean) ?? null;
  const submit = () => {
    setTried(true);
    if (missing || secret || busy) return;
    void create({
      type: 'plan',
      title: title.trim(),
      ...(body.trim() ? { body: body.trim() } : {}),
      detail: {
        steps: steps
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => ({ title: line, done: false })),
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      dirty={Boolean(title.trim() || body.trim() || steps.trim())}
      title={n.title}
      className="md:max-w-2xl"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{kit.cancel}</Button>
          <Button variant="primary" busy={busy} onClick={submit}>
            {n.create}
          </Button>
        </>
      }
    >
      <FormBody onSubmit={submit} secret={secret} failure={failure}>
        <Field
          id={`${id}-t`}
          label={n.titleLabel}
          required
          error={tried && missing ? t.edit.titleRequired : undefined}
        >
          <TextInput
            id={`${id}-t`}
            dir="auto"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={tried && missing}
          />
        </Field>
        <Field id={`${id}-b`} label={n.body} hint={n.bodyHint}>
          <Textarea
            id={`${id}-b`}
            dir="auto"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
        <Field id={`${id}-s`} label={n.steps} hint={n.stepsHint}>
          <Textarea
            id={`${id}-s`}
            dir="auto"
            rows={4}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
          />
        </Field>
      </FormBody>
    </Modal>
  );
}

/** An idea in a few fields: its title, the problem, notes and a role. Nothing is researched: it is the owner's own record. */
export function NewIdeaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT<PlanningMessages>('planning');
  const kit = useT(kitMessages);
  const n = t.newIdeaForm;
  const id = useId();
  const { busy, failure, create } = useCreate(() => onOpenChange(false));
  const [title, setTitle] = useState('');
  const [problem, setProblem] = useState('');
  const [notes, setNotes] = useState('');
  const [role, setRole] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setProblem('');
    setNotes('');
    setRole('');
    setTried(false);
  }, [open]);

  const missing = !title.trim();
  const secret = [title, problem, notes].map(detectSecret).find(Boolean) ?? null;
  const submit = () => {
    setTried(true);
    if (missing || secret || busy) return;
    void create({
      type: 'idea',
      title: title.trim(),
      detail: {
        ...(problem.trim() ? { problem: problem.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(role ? { role } : {}),
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      dirty={Boolean(title.trim() || problem.trim() || notes.trim())}
      title={n.title}
      className="md:max-w-2xl"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{kit.cancel}</Button>
          <Button variant="primary" busy={busy} onClick={submit}>
            {n.create}
          </Button>
        </>
      }
    >
      <FormBody onSubmit={submit} secret={secret} failure={failure}>
        <Field
          id={`${id}-t`}
          label={n.titleLabel}
          required
          error={tried && missing ? t.edit.titleRequired : undefined}
        >
          <TextInput
            id={`${id}-t`}
            dir="auto"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={tried && missing}
          />
        </Field>
        <Field id={`${id}-p`} label={n.problem}>
          <Textarea
            id={`${id}-p`}
            dir="auto"
            rows={4}
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
          />
        </Field>
        <Field id={`${id}-n`} label={n.notes}>
          <Textarea
            id={`${id}-n`}
            dir="auto"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <Field id={`${id}-r`} label={n.role} className="sm:max-w-60">
          <Select id={`${id}-r`} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{n.noRole}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {kit.roles[r]}
              </option>
            ))}
          </Select>
        </Field>
      </FormBody>
    </Modal>
  );
}
