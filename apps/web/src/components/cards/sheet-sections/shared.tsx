'use client';

/**
 * @file shared.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/sheet-sections/shared.tsx. Contract: apps/web/README.md.
 */
import { Check } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { MarkdownView } from '@/components/common/markdown';
import { Bidi, fmt } from '@/components/common/text';
import { Button } from '@/components/ui/button';
import { Field, focusFirstInvalid, Textarea } from '@/components/ui/form';
import type { ActionPayload } from '@/features/cards/rules';
import type { HubCard } from '@/features/cards/types';
import { num } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { type CardAction, kitMessages } from '@/lib/i18n';
import { matchKey } from '@/lib/keys';
import { cn } from '@/lib/utils';

/**
 * What every type section receives. A section shows the type's fields and, when `action` is one of its forms, the
 * form for it (Decide…, Deliver…). To add a section for a new card shape, write it here and register it in
 * `sheet-sections/index.ts`.
 */
export interface SectionProps<T extends HubCard['type'] = HubCard['type']> {
  card: Extract<HubCard, { type: T }>;
  /** The action the sheet is open on, or null. */
  action: CardAction | null;
  /** Leave the form without saving. */
  cancelAction: () => void;
  /** Save: writes, shows the toast with Undo, closes the sheet. */
  perform: (action: CardAction, payload?: ActionPayload) => void;
}

/** A labelled facts grid: `<Facts><Fact label="…">value</Fact></Facts>` */
export function Facts({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-3 text-body-sm', className)}>{children}</dl>;
}

export function Fact({
  label,
  children,
  wide = false,
}: {
  label: string | undefined;
  children: ReactNode;
  wide?: boolean | undefined;
}) {
  return (
    <div className={cn('min-w-0', wide && 'col-span-2')}>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-body font-semibold text-foreground">{children}</h3>;
}

/** The form panel a sheet opens on: moves focus to its first control when it appears. */
export function ActionPanel({
  children,
  onSubmit,
  labelledBy,
}: {
  children: ReactNode;
  onSubmit: () => void;
  labelledBy?: string | undefined;
}) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>(
      'input, textarea, select, button[type="submit"], [role="radio"]',
    );
    first?.focus({ preventScroll: false });
    ref.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  const submit = () => {
    onSubmit();
    // A refused form renders its errors on the next frame. A form that saved is gone by then.
    requestAnimationFrame(() => focusFirstInvalid(ref.current));
  };
  return (
    <form
      ref={ref}
      aria-labelledby={labelledBy}
      // The sheet asks before Esc or Close throws away what was typed here (08 §5.7).
      onInput={(e) => {
        e.currentTarget.dataset['dirty'] = 'true';
      }}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (matchKey(e, 'Enter') && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          submit();
        }
      }}
      className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3.5"
    >
      {children}
    </form>
  );
}

/** The plain form most actions need: one note, optional or required, and a save button. */
export function NoteActionForm({
  title,
  hint,
  noteLabel,
  required = false,
  requiredMessage,
  saveLabel,
  destructive = false,
  onSave,
  onCancel,
}: {
  title?: ReactNode | undefined;
  hint?: ReactNode | undefined;
  noteLabel: string;
  required?: boolean | undefined;
  requiredMessage?: string | undefined;
  saveLabel: string;
  destructive?: boolean | undefined;
  onSave: (note: string) => void;
  onCancel: () => void;
}) {
  const t = useT(kitMessages);
  const id = useId();
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const missing = required && !note.trim();
  const submit = () => {
    setTried(true);
    if (!missing) onSave(note.trim());
  };
  return (
    <ActionPanel onSubmit={submit}>
      {title && <SubHeading>{title}</SubHeading>}
      {hint && <p className="text-body-sm text-muted-foreground">{hint}</p>}
      <Field
        id={id}
        label={noteLabel}
        required={required}
        error={tried && missing ? requiredMessage : undefined}
      >
        <Textarea
          id={id}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={tried && missing}
          aria-describedby={tried && missing ? `${id}-error` : undefined}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={destructive ? 'destructive' : 'primary'}>
          {saveLabel}
        </Button>
        <Button onClick={onCancel}>{t.cancel}</Button>
      </div>
    </ActionPanel>
  );
}

/** A checklist line: any list marker (`-`, `*`, `+`, `1.`), then `[ ]`, `[x]` or `[X]`. */
const CHECK_LINE = /^(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.*)$/;

export interface ChecklistItem {
  done: boolean;
  text: string;
}

/** What a criteria text holds: its checklist lines, and whether every non-empty line is one of them. */
export function parseChecklist(markdown: string): { items: ChecklistItem[]; onlyItems: boolean } {
  const lines = markdown.split('\n').filter((line) => line.trim());
  const items = lines.flatMap((line) => {
    const m = CHECK_LINE.exec(line.trim());
    return m ? [{ done: m[1] !== ' ', text: m[2] ?? '' }] : [];
  });
  return { items, onlyItems: items.length > 0 && items.length === lines.length };
}

/**
 * Acceptance criteria, read-only (08 §5.4: ticking is a comment by the claimer). A pure checklist draws as one with its progress; any other
 * text (plain bullets from an import, a numbered list, free prose from an agent) draws as Markdown, so no line is ever dropped.
 */
export function Checklist({ markdown }: { markdown: string }) {
  const t = useT(kitMessages);
  const locale = useLocale();
  const w = t.sections.task;
  const { items, onlyItems } = parseChecklist(markdown);
  const done = items.filter((item) => item.done).length;
  const progress = items.length > 0 && (
    <p className="text-body-sm text-muted-foreground">
      {fmt(w.acceptanceProgress, { done: num(done, locale), total: num(items.length, locale) })}
    </p>
  );
  if (!onlyItems) {
    return (
      <div className="flex flex-col gap-2">
        {progress}
        <MarkdownView source={markdown} dir="auto" headingOffset={2} copyCodeLabel={t.sheet.copyCode} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {progress}
      <ul className="flex flex-col gap-1.5 text-body">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              aria-hidden
              className={cn(
                'mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border',
                item.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
              )}
            >
              {item.done && <Check className="size-3" strokeWidth={2.5} />}
            </span>
            <span className="min-w-0 text-foreground">
              <Bidi>{item.text}</Bidi>
              <span className="sr-only"> ({item.done ? w.criterionDone : w.criterionOpen})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
