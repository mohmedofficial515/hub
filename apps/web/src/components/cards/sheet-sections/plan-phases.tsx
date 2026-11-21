'use client';

/**
 * @file plan-phases.tsx
 * @description The phases of a plan in its edit form (v5-live-plan, batch 1 follow-up): add, rename, a note, reorder and remove. Removing a phase that
 * steps still name asks where those steps go (another phase or none) and moves them in the same save, so the API's `hub.plans.phase_in_use` is never
 * reached from here. Each control is a native input or button, so the whole editor works from the keyboard.
 */
import { PLAN_PHASES_MAX } from '@hub/contracts';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { fmt } from '@/components/common/text';
import { Button, IconButton } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Field, Select, TextInput } from '@/components/ui/form';
import {
  freshPhaseId,
  moved,
  type PhaseDraft,
  type PhasedStep,
  removePhase,
  stepsIn,
} from '@/features/planning/phase-edit';
import { num } from '@/lib/format';
import { kitMessages, useLocale, useT } from '@/lib/i18n';

export interface PhaseWords {
  phases: string;
  phasesHint: string;
  phaseTitle: string;
  phaseNote: string;
  addPhase: string;
  movePhaseUp: string;
  movePhaseDown: string;
  removePhase: string;
  phaseRequired: string;
  stepPhase: string;
  noPhase: string;
  removePhaseTitle: string;
  removePhaseBody: string;
  removePhaseMoveTo: string;
  removePhaseConfirm: string;
}

/** The phase a step sits in, as a select. Shown only when the plan has phases. */
export function StepPhaseSelect({
  id,
  value,
  phases,
  words,
  onChange,
}: {
  id: string;
  value: string;
  phases: readonly PhaseDraft[];
  words: PhaseWords;
  onChange: (phaseId: string) => void;
}) {
  const locale = useLocale();
  return (
    <Field id={id} label={words.stepPhase} className="w-40">
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{words.noPhase}</option>
        {phases.map((phase, index) => (
          <option key={phase.uid} value={phase.id}>
            {phase.title.trim() || fmt(words.phaseTitle, { n: num(index, locale) })}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function PhasesEditor<S extends PhasedStep>({
  phases,
  steps,
  taken,
  tried,
  words,
  onChange,
}: {
  phases: PhaseDraft[];
  steps: S[];
  /** Ids the plan had when the form opened: a new phase never reuses one. */
  taken: readonly string[];
  tried: boolean;
  words: PhaseWords;
  onChange: (next: { phases: PhaseDraft[]; steps: S[] }) => void;
}) {
  const kit = useT(kitMessages);
  const locale = useLocale();
  const id = useId();
  const nextUid = useRef(0);
  const [removing, setRemoving] = useState<PhaseDraft | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const set = (uid: string, patch: Partial<PhaseDraft>) =>
    onChange({ phases: phases.map((phase) => (phase.uid === uid ? { ...phase, ...patch } : phase)), steps });
  const label = (phase: PhaseDraft) =>
    phase.title.trim() || fmt(words.phaseTitle, { n: num(phases.indexOf(phase), locale) });

  const askRemove = (phase: PhaseDraft) => {
    if (stepsIn(steps, phase.id) === 0) {
      onChange(removePhase(phases, steps, phase.id));
      return;
    }
    setMoveTo('');
    setRemoving(phase);
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-body font-semibold text-foreground">{words.phases}</legend>
      <p className="text-body-sm text-muted-foreground">{words.phasesHint}</p>
      {phases.length > 0 && (
        <ol className="flex flex-col gap-2">
          {phases.map((phase, i) => {
            const n = num(i, locale);
            const missing = tried && !phase.title.trim();
            return (
              <li
                key={phase.uid}
                data-phase-row
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5"
              >
                <div className="flex flex-wrap items-end gap-2">
                  <Field
                    id={`${id}-${phase.uid}`}
                    label={fmt(words.phaseTitle, { n })}
                    error={missing ? words.phaseRequired : undefined}
                    className="min-w-40 flex-1"
                  >
                    <TextInput
                      id={`${id}-${phase.uid}`}
                      dir="auto"
                      maxLength={200}
                      value={phase.title}
                      onChange={(e) => set(phase.uid, { title: e.target.value })}
                      aria-invalid={missing}
                    />
                  </Field>
                  <Field id={`${id}-${phase.uid}-note`} label={words.phaseNote} className="min-w-40 flex-1">
                    <TextInput
                      id={`${id}-${phase.uid}-note`}
                      dir="auto"
                      maxLength={300}
                      value={phase.note}
                      onChange={(e) => set(phase.uid, { note: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <IconButton
                    label={fmt(words.movePhaseUp, { n })}
                    disabled={i === 0}
                    onClick={() => onChange({ phases: moved(phases, i, -1), steps })}
                  >
                    <ArrowUp aria-hidden className="size-4" strokeWidth={1.75} />
                  </IconButton>
                  <IconButton
                    label={fmt(words.movePhaseDown, { n })}
                    disabled={i === phases.length - 1}
                    onClick={() => onChange({ phases: moved(phases, i, 1), steps })}
                  >
                    <ArrowDown aria-hidden className="size-4" strokeWidth={1.75} />
                  </IconButton>
                  <IconButton label={fmt(words.removePhase, { n })} onClick={() => askRemove(phase)}>
                    <X aria-hidden className="size-4" strokeWidth={1.75} />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <Button
        size="sm"
        className="self-start"
        disabled={phases.length >= PLAN_PHASES_MAX}
        onClick={() => {
          nextUid.current += 1;
          onChange({
            phases: [
              ...phases,
              { uid: `new-phase-${nextUid.current}`, id: freshPhaseId(phases, taken), title: '', note: '' },
            ],
            steps,
          });
        }}
      >
        <Plus aria-hidden className="size-3.5" strokeWidth={1.75} />
        {words.addPhase}
      </Button>
      <Modal
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? fmt(words.removePhaseTitle, { title: label(removing) }) : ''}
        description={
          removing ? fmt(words.removePhaseBody, { n: num(stepsIn(steps, removing.id), locale) }) : undefined
        }
        footer={
          <>
            <Button onClick={() => setRemoving(null)}>{kit.cancel}</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (removing) onChange(removePhase(phases, steps, removing.id, moveTo));
                setRemoving(null);
              }}
            >
              {words.removePhaseConfirm}
            </Button>
          </>
        }
      >
        {removing && (
          <Field id={`${id}-move-to`} label={words.removePhaseMoveTo}>
            <Select
              id={`${id}-move-to`}
              data-autofocus
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
            >
              <option value="">{words.noPhase}</option>
              {phases
                .filter((phase) => phase.uid !== removing.uid)
                .map((phase) => (
                  <option key={phase.uid} value={phase.id}>
                    {label(phase)}
                  </option>
                ))}
            </Select>
          </Field>
        )}
      </Modal>
    </fieldset>
  );
}
