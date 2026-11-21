import { useRef, type KeyboardEvent } from 'react';
import { useT } from '@lab/i18n';
import { messages } from '../i18n';
import { cn, fillText, focusRing } from './atoms';
import { VIEWS, type Counts, type ViewId } from './model';

const countOf = (view: ViewId, c: Counts) => (view === 'needs' ? c.needs : view === 'new' ? c.new : view === 'mentions' ? c.mentions : 0);

/**
 * The four fixed views. They are filters of one stream, so a tab's number is its own breakdown and the page's single
 * counter (header) is the distinct union of them. Arrow keys move between tabs and flip with the page direction.
 */
export function ViewsBar({ view, counts, onChange, disabled }: { view: ViewId; counts: Counts; onChange: (v: ViewId) => void; disabled?: boolean }) {
  const t = useT(messages);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKey = (e: KeyboardEvent) => {
    const rtl = document.documentElement.dir === 'rtl';
    const step = e.key === 'ArrowRight' ? (rtl ? -1 : 1) : e.key === 'ArrowLeft' ? (rtl ? 1 : -1) : e.key === 'Home' ? -99 : e.key === 'End' ? 99 : 0;
    if (!step) return;
    e.preventDefault();
    const i = VIEWS.indexOf(view);
    const next = VIEWS[Math.max(0, Math.min(VIEWS.length - 1, Math.abs(step) === 99 ? (step < 0 ? 0 : VIEWS.length - 1) : i + step))]!;
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={t.views.label}
      onKeyDown={onKey}
      className="tl-tabs flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted p-1"
    >
      {VIEWS.map((v) => {
        const selected = v === view;
        const n = countOf(v, counts);
        return (
          <button
            key={v}
            ref={(el) => {
              refs.current[v] = el;
            }}
            type="button"
            role="tab"
            id={`tl-tab-${v}`}
            aria-selected={selected}
            aria-controls="tl-panel"
            aria-label={n > 0 ? fillText(t.tabCount, { label: t.views[v], n }) : undefined}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(
              'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3.5 text-body font-medium whitespace-nowrap transition-colors',
              selected ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
              focusRing,
            )}
          >
            {t.views[v]}
            {n > 0 && (
              <span
                aria-hidden
                className={cn(
                  'inline-grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-caption font-semibold tabular-nums',
                  selected ? 'bg-foreground text-background' : 'bg-card text-foreground ring-1 ring-border',
                )}
              >
                {n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
