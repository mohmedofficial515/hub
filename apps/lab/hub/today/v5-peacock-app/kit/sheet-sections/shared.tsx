import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { HubCard } from '@lab/mocks/hub-app';
import { Button } from '../button';
import type { ActionPayload } from '../card-store';
import { Field, focusFirstInvalid, Textarea } from '../form';
import { matchKey } from '../keys';
import { kitMessages, type CardAction } from '../i18n';

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
export function Facts({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-3 text-body-sm', className)}>{children}</dl>;
}

export function Fact({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
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
export function ActionPanel({ children, onSubmit, labelledBy }: { children: ReactNode; onSubmit: () => void; labelledBy?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>('input, textarea, select, button[type="submit"], [role="radio"]');
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
  title?: ReactNode;
  hint?: ReactNode;
  noteLabel: string;
  required?: boolean;
  requiredMessage?: string;
  saveLabel: string;
  destructive?: boolean;
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
      <Field id={id} label={noteLabel} required={required} error={tried && missing ? requiredMessage : undefined}>
        <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={tried && missing} aria-describedby={tried && missing ? `${id}-error` : undefined} />
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

/** `- [x] item` lines as a read-only checklist (08 §5.4: ticking is a comment by the claimer). */
export function Checklist({ markdown }: { markdown: string }) {
  const items = markdown
    .split('\n')
    .map((line) => /^- \[( |x)\] (.*)$/.exec(line.trim()))
    .filter((m): m is RegExpExecArray => !!m);
  return (
    <ul className="flex flex-col gap-1.5 text-body">
      {items.map((m, i) => (
        <li key={i} className="flex items-start gap-2">
          <input type="checkbox" checked={m[1] === 'x'} readOnly tabIndex={-1} aria-label={m[2]} className="mt-1 size-4 shrink-0 accent-primary" />
          <span className="text-foreground">{m[2]}</span>
        </li>
      ))}
    </ul>
  );
}
