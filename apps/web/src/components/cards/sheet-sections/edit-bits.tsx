'use client';

/**
 * @file edit-bits.tsx
 * @description What the sheet's edit forms share (task, decision, idea, plan). Editing is `?action=edit`: the sheet already treats any open form as "the form's save is
 * the one filled button", and a reload stays in the form.
 */
import { Pencil } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

import { MarkdownView } from '@/components/common/markdown';
import { showToast } from '@/components/common/toast';
import { setQuery } from '@/components/shell/router';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/form';
import { Segmented } from '@/components/ui/segmented';
import { isHubError } from '@/lib/api/errors';
import { type CardAction, kitMessages, useT } from '@/lib/i18n';

export const EDIT = 'edit' as CardAction;

export interface EditWords {
  edit: string;
  save: string;
  saved: string;
  title: string;
  titleRequired: string;
  body: string;
  priority: string;
  tags: string;
  tagsHint: string;
  write: string;
  preview: string;
  nothingToPreview: string;
  changedElsewhere: string;
}

export const useEditWords = () => useT<{ edit: EditWords }>('planning').edit;

export function EditButton({ label }: { label?: string | undefined }) {
  const w = useEditWords();
  return (
    <Button size="sm" className="self-start" onClick={() => setQuery({ action: EDIT })}>
      <Pencil aria-hidden className="size-3.5" strokeWidth={1.75} />
      {label ?? w.edit}
    </Button>
  );
}

/** Save, report, and leave the form. The form stays open with its text when the API refuses. */
export function useSaveForm() {
  const t = useT(kitMessages);
  const w = useEditWords();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const save = async (write: () => Promise<unknown>) => {
    setBusy(true);
    setFailure(null);
    try {
      await write();
      setQuery({ action: null });
      showToast({ message: w.saved });
    } catch (error) {
      setFailure(isHubError(error) ? error.message : t.actionFailed);
    } finally {
      setBusy(false);
    }
  };
  return { busy, failure, save };
}

export function FormFailure({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-body-sm font-medium text-destructive-soft-foreground">
      {message}
    </p>
  );
}

/** A live change arrived while this form was open. The draft stays; saving would replace what the other person wrote. */
export function ChangedElsewhere({ changed }: { changed: boolean }) {
  const w = useEditWords();
  if (!changed) return null;
  return (
    <p
      role="status"
      className="rounded-md bg-warning-soft px-3 py-2 text-body-sm text-warning-soft-foreground"
    >
      {w.changedElsewhere}
    </p>
  );
}

export function FormActions({
  busy,
  saveLabel,
  onCancel,
}: {
  busy: boolean;
  saveLabel?: string | undefined;
  onCancel: () => void;
}) {
  const t = useT(kitMessages);
  const w = useEditWords();
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" variant="primary" busy={busy}>
        {saveLabel ?? w.save}
      </Button>
      <Button onClick={onCancel}>{t.cancel}</Button>
    </div>
  );
}

/** Markdown with a Write and a Preview side, in the same place, so the form does not jump. */
export function MarkdownField({
  label,
  hint,
  value,
  onChange,
  rows = 8,
  invalid = false,
  error,
}: {
  label: ReactNode;
  hint?: ReactNode | undefined;
  value: string;
  onChange: (next: string) => void;
  rows?: number | undefined;
  invalid?: boolean | undefined;
  error?: ReactNode | undefined;
}) {
  const w = useEditWords();
  const id = useId();
  const [side, setSide] = useState<'write' | 'preview'>('write');
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <div className="flex flex-col gap-2">
        <Segmented
          label={typeof label === 'string' ? label : w.write}
          value={side}
          onChange={setSide}
          options={[
            { value: 'write', label: w.write },
            { value: 'preview', label: w.preview },
          ]}
          className="self-start"
        />
        {side === 'write' ? (
          <Textarea
            id={id}
            dir="auto"
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={invalid || undefined}
          />
        ) : (
          <div className="min-h-24 rounded-md border border-border bg-card p-3">
            {value.trim() ? (
              <MarkdownView source={value} />
            ) : (
              <p className="text-body-sm text-muted-foreground">{w.nothingToPreview}</p>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}

export const parseTags = (text: string) => [
  ...new Set(
    text
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  ),
];

/** `datetime-local` to and from what the API speaks. */
export const toLocalInput = (iso: string | undefined) => {
  if (!iso) return '';
  const at = new Date(iso);
  return new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);
