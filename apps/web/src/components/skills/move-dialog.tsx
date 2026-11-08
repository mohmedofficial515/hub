'use client';

/**
 * @file move-dialog.tsx
 * @description Move to Hub (docs/16 §11, D64): it asks first, says the personal folder stays as it is and that both copies load on this machine, and offers another name when Hub
 * already has this one or the folder's name does not fit Hub's naming. The server copies; nothing here touches the personal folder.
 */
import { SKILL_NAME_PATTERN, type SkillSummary } from '@hub/contracts';
import { useEffect, useId, useState } from 'react';

import { Button, Field, fill, fmt, Ltr, Modal, showToast, TextInput, useT } from '@/components/kit';
import { useMoveSkill } from '@/features/skills/queries';
import { isHubError } from '@/lib/api/errors';

import type { SkillsMessages } from './words';

/** A name Hub can take: the folder's own when it fits, else a cleaned one. */
export function hubNameFor(name: string, taken: readonly string[]): string {
  const clean =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 56) || 'skill';
  if (!taken.includes(clean)) return clean;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${clean}-${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${clean}-copy`;
}

export function MoveDialog({
  skill,
  hubNames,
  onOpenChange,
  onMoved,
}: {
  skill: SkillSummary | null;
  /** Names Hub already has, so the dialog can offer a free one at once. */
  hubNames: readonly string[];
  onOpenChange: (open: boolean) => void;
  onMoved?: ((name: string) => void) | undefined;
}) {
  const t = useT<SkillsMessages>('skills').move;
  const id = useId();
  const move = useMoveSkill();
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const taken = skill?.nameInHub ? [...hubNames, skill.name] : hubNames;
  const fits = !!skill && SKILL_NAME_PATTERN.test(skill.name) && !taken.includes(skill.name);
  const needsName = !!skill && !fits;

  useEffect(() => {
    if (!skill) return;
    setTarget(hubNameFor(skill.name, skill.nameInHub ? [...hubNames, skill.name] : hubNames));
    setError(null);
  }, [skill, hubNames]);

  const name = needsName ? target : (skill?.name ?? '');
  const invalid = needsName && (!SKILL_NAME_PATTERN.test(target) || target.length > 64);

  const confirm = () => {
    if (!skill || invalid || move.isPending) return;
    move.mutate(
      { name: skill.name, ...(name !== skill.name ? { as: name } : {}) },
      {
        onSuccess: (written) => {
          showToast({ message: fmt(t.done, { name: written.skill.name }) });
          onOpenChange(false);
          onMoved?.(written.skill.name);
        },
        onError: (failure) => {
          if (isHubError(failure, 'hub.skills.name_taken')) setError(fmt(t.clash, { name }));
          else setError(isHubError(failure) ? failure.message : t.failed);
        },
      },
    );
  };

  return (
    <Modal
      open={!!skill}
      onOpenChange={onOpenChange}
      title={fill(t.title, { name: <Ltr mono>{skill?.name ?? ''}</Ltr> })}
      description={t.body}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t.cancel}</Button>
          <Button
            variant="primary"
            busy={move.isPending}
            disabled={invalid}
            data-skill-move-confirm
            onClick={confirm}
          >
            {t.confirm}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-body text-foreground">
        <p>{fill(t.devices, { command: <Ltr mono>{`/hub:${name}`}</Ltr> })}</p>
        <p className="text-muted-foreground">{t.both}</p>
        {skill?.nameInHub && (
          <p data-skill-move-clash className="text-body-sm text-foreground">
            {fill(t.clash, { name: <Ltr mono>{skill.name}</Ltr> })}
          </p>
        )}
        {needsName && (
          <Field id={`${id}-name`} label={t.name} hint={t.nameHint} error={invalid ? t.invalid : undefined}>
            <TextInput
              id={`${id}-name`}
              dir="ltr"
              data-autofocus
              data-skill-move-name
              className="key text-start"
              spellCheck={false}
              maxLength={64}
              value={target}
              onChange={(event) => {
                setError(null);
                setTarget(event.target.value.toLowerCase());
              }}
            />
          </Field>
        )}
        {error && (
          <p role="alert" data-skill-move-error className="text-body-sm text-destructive-soft-foreground">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
