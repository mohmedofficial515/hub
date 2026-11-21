'use client';

/**
 * @file skill-editor.tsx
 * @description New skill and Edit (docs/16 §11, D64): the name (new only), when Claude should use it, whether a person types it, and its Markdown. The owner's alone. A save over a newer
 * text is refused by the server and said here plainly; a value that looks like a secret is caught before sending, as every free-text form does.
 */
import { SKILL_NAME_PATTERN, type SkillDetail } from '@hub/contracts';
import { useEffect, useId, useState } from 'react';

import {
  Button,
  detectSecret,
  Field,
  fill,
  fmt,
  Ltr,
  MarkdownView,
  Modal,
  SecretFilterError,
  Segmented,
  showToast,
  Textarea,
  TextInput,
  useT,
} from '@/components/kit';
import { useCreateSkill, useUpdateSkill } from '@/features/skills/queries';
import { isHubError } from '@/lib/api/errors';

import type { SkillsMessages } from './words';

export interface SkillDraft {
  name: string;
  description: string;
  body: string;
  userInvocable: boolean;
}

const EMPTY: SkillDraft = { name: '', description: '', body: '', userInvocable: true };

export function SkillEditor({
  open,
  onOpenChange,
  skill,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The skill to edit. Absent: a new one. */
  skill?: SkillDetail | null | undefined;
  onSaved?: ((name: string) => void) | undefined;
}) {
  const t = useT<SkillsMessages>('skills');
  const e = t.editor;
  const id = useId();
  const create = useCreateSkill();
  const update = useUpdateSkill(skill?.name ?? '');
  const [draft, setDraft] = useState<SkillDraft>(EMPTY);
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<{ name?: string; form?: string }>({});
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  useEffect(() => {
    if (!open) return;
    setDraft(
      skill
        ? {
            name: skill.name,
            description: skill.description,
            body: skill.body,
            userInvocable: skill.userInvocable,
          }
        : EMPTY,
    );
    setTried(false);
    setProblem({});
    setMode('write');
  }, [open, skill]);

  const editing = !!skill;
  const nameError = editing
    ? undefined
    : (problem.name ??
      (SKILL_NAME_PATTERN.test(draft.name) && draft.name.length <= 64 ? undefined : e.nameInvalid));
  const descriptionError = draft.description.trim() ? undefined : e.descriptionRequired;
  const secret = detectSecret(`${draft.description}\n${draft.body}`);
  const busy = create.isPending || update.isPending;
  const command = `/hub:${draft.name || 'name'}`;

  const save = () => {
    setTried(true);
    setProblem({});
    if (nameError || descriptionError || secret || busy) return;
    const done = (name: string, message: string) => {
      showToast({ message: fmt(message, { name }) });
      onOpenChange(false);
      onSaved?.(name);
    };
    const failed = (error: unknown) => {
      if (isHubError(error, 'hub.skills.name_taken')) setProblem({ name: e.nameTaken });
      else if (isHubError(error, 'hub.skills.stale_base')) setProblem({ form: e.stale });
      else setProblem({ form: isHubError(error) ? error.message : e.failed });
    };
    if (skill) {
      update.mutate(
        {
          description: draft.description.trim(),
          body: draft.body,
          userInvocable: draft.userInvocable,
          baseHash: skill.hash,
        },
        { onSuccess: (written) => done(written.skill.name, e.saved), onError: failed },
      );
    } else {
      create.mutate(
        {
          name: draft.name,
          description: draft.description.trim(),
          body: draft.body,
          userInvocable: draft.userInvocable,
        },
        { onSuccess: (written) => done(written.skill.name, e.created), onError: failed },
      );
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      className="md:max-w-2xl"
      title={editing ? fill(e.editTitle, { name: <Ltr mono>{skill.name}</Ltr> }) : e.createTitle}
      description={editing ? e.editNote : e.createNote}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{e.cancel}</Button>
          <Button variant="primary" busy={busy} data-skill-save onClick={save}>
            {editing ? e.save : e.create}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        {!editing && (
          <Field
            id={`${id}-name`}
            label={e.name}
            hint={e.nameHint}
            required
            error={tried || problem.name ? nameError : undefined}
          >
            <TextInput
              id={`${id}-name`}
              dir="ltr"
              data-autofocus
              data-skill-name
              className="key text-start"
              spellCheck={false}
              autoComplete="off"
              maxLength={64}
              value={draft.name}
              onChange={(event) => {
                setProblem(({ name: _name, ...rest }) => rest);
                setDraft((d) => ({ ...d, name: event.target.value.toLowerCase() }));
              }}
            />
          </Field>
        )}
        <Field
          id={`${id}-description`}
          label={e.description}
          hint={e.descriptionHint}
          required
          error={tried ? descriptionError : undefined}
        >
          <Textarea
            id={`${id}-description`}
            dir="auto"
            rows={2}
            maxLength={1024}
            data-skill-description
            {...(editing ? { 'data-autofocus': true } : {})}
            value={draft.description}
            onChange={(event) => setDraft((d) => ({ ...d, description: event.target.value }))}
          />
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-body text-foreground md:min-h-0">
          <input
            type="checkbox"
            className="size-4 accent-(--primary)"
            data-skill-typed
            checked={draft.userInvocable}
            onChange={(event) => setDraft((d) => ({ ...d, userInvocable: event.target.checked }))}
          />
          <span>{fill(e.typed, { command: <Ltr mono>{command}</Ltr> })}</span>
        </label>
        <div className="flex flex-col gap-2">
          {/* The text is Markdown, so it can be read as the skill's page shows it before it is saved (knowledge-13). */}
          <Segmented
            label={e.bodyMode}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'write', label: e.write },
              { value: 'preview', label: e.preview },
            ]}
            className="self-start"
          />
          <Field id={`${id}-body`} label={e.body} hint={e.bodyHint}>
            {mode === 'write' ? (
              <Textarea
                id={`${id}-body`}
                dir="auto"
                rows={12}
                data-skill-body
                className="key"
                value={draft.body}
                onChange={(event) => setDraft((d) => ({ ...d, body: event.target.value }))}
              />
            ) : (
              <div
                id={`${id}-body`}
                data-skill-preview
                className="max-h-96 min-w-0 overflow-auto rounded-md border border-border p-3 text-body text-foreground"
              >
                {draft.body.trim() ? (
                  <MarkdownView source={draft.body} dir="auto" headingOffset={3} />
                ) : (
                  <p className="text-body-sm text-muted-foreground">{e.previewEmpty}</p>
                )}
              </div>
            )}
          </Field>
        </div>
        {secret && <SecretFilterError pattern={secret} />}
        {problem.form && (
          <p role="alert" className="text-body-sm text-destructive-soft-foreground">
            {problem.form}
          </p>
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
