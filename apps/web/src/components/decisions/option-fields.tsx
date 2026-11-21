'use client';

/**
 * @file option-fields.tsx
 * @description The options of a decision as a form: the New decision dialog and the sheet's edit form both use it. An option that already exists keeps its id,
 * so editing never loses what the API knows about it.
 */
import { Plus, X } from 'lucide-react';

import { Button, Field, fmt, IconButton, num, Textarea, TextInput, useLocale, useT } from '@/components/kit';
import type { DecisionOption } from '@/features/cards/types';

import type { DecisionMessages } from './messages';

export interface OptionDraft {
  id?: string | undefined;
  title: string;
  pros: string;
  cons: string;
  cost: string;
  recommended: boolean;
}

export const MAX_OPTIONS = 8;

export const emptyOption = (): OptionDraft => ({
  title: '',
  pros: '',
  cons: '',
  cost: '',
  recommended: false,
});

export const draftOf = (option: DecisionOption): OptionDraft => ({
  id: option.id,
  title: option.title,
  pros: option.pros.join('\n'),
  cons: option.cons.join('\n'),
  cost: option.cost ?? '',
  recommended: !!option.recommended,
});

const lines = (text: string) =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

/** What the API takes. A draft with no title is not an option yet, so it is left out. */
export const optionsOf = (drafts: OptionDraft[]) =>
  drafts
    .filter((o) => o.title.trim())
    .map((o) => ({
      ...(o.id ? { id: o.id } : {}),
      title: o.title.trim(),
      pros: lines(o.pros),
      cons: lines(o.cons),
      ...(o.cost.trim() ? { cost: o.cost.trim() } : {}),
      recommended: o.recommended,
    }));

export const draftTexts = (drafts: OptionDraft[]) => drafts.flatMap((o) => [o.title, o.pros, o.cons, o.cost]);

export function OptionFields({
  id,
  options,
  onChange,
  tooFew,
}: {
  id: string;
  options: OptionDraft[];
  onChange: (next: OptionDraft[]) => void;
  /** Show the "at least two" error. */
  tooFew: boolean;
}) {
  const n = useT<DecisionMessages>('decisions').new;
  const locale = useLocale();
  const update = (i: number, patch: Partial<OptionDraft>) =>
    onChange(
      options.map((o, at) =>
        at === i ? { ...o, ...patch } : patch.recommended ? { ...o, recommended: false } : o,
      ),
    );
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-body font-semibold text-foreground">{n.options}</legend>
      <p className="text-body-sm text-muted-foreground">{n.optionsHint}</p>
      {options.map((o, i) => {
        const label = fmt(n.option, { n: num(i + 1, locale) });
        return (
          <div
            key={o.id ?? `new-${i}`}
            role="group"
            aria-label={label}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-end gap-2">
              <Field id={`${id}-o${i}`} label={label} required className="min-w-0 flex-1">
                <TextInput
                  id={`${id}-o${i}`}
                  dir="auto"
                  placeholder={n.optionTitle}
                  value={o.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                />
              </Field>
              {options.length > 2 && (
                <IconButton
                  label={fmt(n.removeOption, { n: num(i + 1, locale) })}
                  onClick={() => onChange(options.filter((_, at) => at !== i))}
                >
                  <X aria-hidden className="size-4" strokeWidth={1.75} />
                </IconButton>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id={`${id}-p${i}`} label={n.pros} hint={n.perLine}>
                <Textarea
                  id={`${id}-p${i}`}
                  dir="auto"
                  rows={2}
                  value={o.pros}
                  onChange={(e) => update(i, { pros: e.target.value })}
                />
              </Field>
              <Field id={`${id}-c${i}`} label={n.cons} hint={n.perLine}>
                <Textarea
                  id={`${id}-c${i}`}
                  dir="auto"
                  rows={2}
                  value={o.cons}
                  onChange={(e) => update(i, { cons: e.target.value })}
                />
              </Field>
            </div>
            <Field id={`${id}-m${i}`} label={n.cost}>
              <TextInput
                id={`${id}-m${i}`}
                dir="auto"
                value={o.cost}
                onChange={(e) => update(i, { cost: e.target.value })}
              />
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-body-sm text-foreground md:min-h-0">
              <input
                type="checkbox"
                checked={o.recommended}
                onChange={(e) => update(i, { recommended: e.target.checked })}
                className="size-4 shrink-0 accent-primary"
              />
              {n.recommended}
            </label>
          </div>
        );
      })}
      {tooFew && (
        <p role="alert" className="text-body-sm font-medium text-destructive-soft-foreground">
          {n.needTwo}
        </p>
      )}
      {options.length < MAX_OPTIONS && (
        <Button size="sm" className="self-start" onClick={() => onChange([...options, emptyOption()])}>
          <Plus aria-hidden className="size-3.5" strokeWidth={1.75} />
          {n.addOption}
        </Button>
      )}
    </fieldset>
  );
}
