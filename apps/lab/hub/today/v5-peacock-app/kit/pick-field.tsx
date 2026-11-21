import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { CardType } from '@lab/mocks/hub-app';
import { TypeDot } from './badges';
import { Button } from './button';
import { getCard } from './card-store';
import { matchKey } from './keys';
import { focusRing } from './meta';
import { CardPicker, DocPicker } from './pickers';
import { Ltr, fmt } from './text';

const messages = {
  ar: { add: 'اختر', remove: 'أزل {key}' },
  en: { add: 'Choose', remove: 'Remove {key}' },
};

/**
 * A form field holding picked cards or docs: a label, the picks as removable chips, and a button that opens `CardPicker`
 * or `DocPicker` (09 §19). Use it for "blocks", "related docs" and "link to a change card" in create dialogs.
 */
export function PickField({
  label,
  hint,
  keys,
  onChange,
  picker = 'card',
  types,
  multi = true,
  className,
}: {
  label: string;
  hint?: string;
  keys: string[];
  onChange: (keys: string[]) => void;
  picker?: 'card' | 'doc';
  types?: CardType[];
  multi?: boolean;
  className?: string;
}) {
  const t = useT(messages);
  const [open, setOpen] = useState(false);
  // Inside another dialog, the outer focus trap takes the picker's autoFocus away, and focus lands on Close. Put it back.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      dialogs[dialogs.length - 1]?.querySelector<HTMLElement>('input')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);
  return (
    <div role="group" aria-label={label} className={cn('flex flex-col gap-1.5', className)}>
      <p className="text-body-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {keys.map((key) => {
          const card = getCard(key);
          const remove = fmt(t.remove, { key });
          return (
            <span key={key} className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-border bg-card ps-2.5 text-caption text-foreground">
              {card && <TypeDot type={card.type} />}
              <Ltr mono className="shrink-0">
                {key}
              </Ltr>
              <button
                type="button"
                aria-label={remove}
                title={remove}
                onClick={() => onChange(keys.filter((k) => k !== key))}
                className={cn('hit-44 me-0.5 inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground', focusRing)}
              >
                <X aria-hidden className="size-3.5" strokeWidth={1.75} />
              </button>
            </span>
          );
        })}
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus aria-hidden className="size-3.5" strokeWidth={1.75} />
          {t.add}
        </Button>
      </div>
      {hint && <p className="text-body-sm text-muted-foreground">{hint}</p>}
      {/* The picker portals out, but React still bubbles its keys here: its Ctrl+Enter must not submit the form around this field. */}
      <div
        onKeyDown={(e) => {
          if (matchKey(e, 'Enter')) e.stopPropagation();
        }}
      >
        {picker === 'card' ? (
          <CardPicker open={open} onOpenChange={setOpen} value={keys} types={types} multi={multi} onConfirm={onChange} title={label} />
        ) : (
          <DocPicker open={open} onOpenChange={setOpen} value={keys} onConfirm={onChange} title={label} />
        )}
      </div>
    </div>
  );
}
