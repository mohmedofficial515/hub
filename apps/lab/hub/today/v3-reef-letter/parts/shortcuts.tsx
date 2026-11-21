import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { messages } from '../i18n';
import { Kbd } from './atoms';
import { focusRing } from './type-meta';

/** One-key shortcuts must be switchable (WCAG 2.1.4). The switch sits here and in the page footer. */
export function ShortcutSwitch({ on, onChange, className }: { on: boolean; onChange: (next: boolean) => void; className?: string }) {
  const t = useT(messages);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn('inline-flex min-h-11 touch-manipulation items-center gap-2.5 rounded-lg text-body-sm text-foreground md:min-h-8', focusRing, className)}
    >
      <span className={cn('relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors duration-150', on ? 'border-foreground bg-foreground' : 'border-(--reef-control) bg-muted')}>
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 size-3.5 rounded-full transition-[inset-inline-start] duration-150 motion-reduce:transition-none',
            on ? 'start-[1.125rem] bg-background' : 'start-0.5 bg-muted-foreground',
          )}
        />
      </span>
      <span>{t.keys.toggle}</span>
      <span className="font-semibold">{on ? t.keys.on : t.keys.off}</span>
    </button>
  );
}

/** `?` lists the shortcuts (docs/08 §12). It stays centred, so it can never clip at any width. */
export function ShortcutsDialog({ open, onClose, on, onChange }: { open: boolean; onClose: () => void; on: boolean; onChange: (next: boolean) => void }) {
  const t = useT(messages);
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key !== 'Tab' || !panel.current) return;
      // Keep Tab inside the dialog while it is open.
      const items = [...panel.current.querySelectorAll<HTMLElement>('button')];
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      returnTo.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keys-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-popover p-5 text-popover-foreground shadow-md outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="keys-title" className="reef-h3 text-foreground">
              {t.keys.title}
            </h2>
            <p className="mt-0.5 text-body-sm text-muted-foreground">{t.keys.intro}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.keys.close}
            className={cn('-me-2 -mt-2 inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:size-9', focusRing)}
          >
            <X aria-hidden className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <ul className={cn('flex flex-col gap-2', !on && 'opacity-55')}>
          {t.keys.list.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 text-body-sm text-foreground">
              <span>{row.label}</span>
              <span className="flex shrink-0 gap-1">
                {row.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <ShortcutSwitch on={on} onChange={onChange} />
      </div>
    </div>
  );
}
