import { useEffect, useState } from 'react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';

export type LabState = 'ready' | 'loading' | 'empty' | 'error';
const STATES: LabState[] = ['ready', 'loading', 'empty', 'error'];

const read = (): LabState => {
  const value = new URLSearchParams(location.hash.split('?')[1] ?? '').get('state');
  return STATES.includes(value as LabState) ? (value as LabState) : 'ready';
};

/** Lab only: the page state lives in the frame's hash (`&state=loading|empty|error`), so a screenshot URL can name it. */
export function useLabState(): [LabState, (s: LabState) => void] {
  const [state, setState] = useState<LabState>(read);
  useEffect(() => {
    const on = () => setState(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const set = (s: LabState) => {
    const [path, query = ''] = location.hash.split('?');
    const params = new URLSearchParams(query);
    if (s === 'ready') params.delete('state');
    else params.set('state', s);
    location.hash = `${path}?${params.toString()}`;
  };
  return [state, set];
}

/** Lab chrome, not part of the design: a dashed bar under the page to switch states. */
export function LabPreview({ value, onChange }: { value: LabState; onChange: (s: LabState) => void }) {
  const t = useT(messages);
  return (
    <div className="mt-10 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border-strong p-2 text-xs text-ink-muted">
      <span className="px-1">{t.lab.label}</span>
      {STATES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          aria-pressed={value === s}
          className={cn('min-h-8 cursor-pointer rounded px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring', value === s ? 'bg-surface-3 font-semibold text-ink' : 'hover:bg-surface-2')}
        >
          {t.lab[s]}
        </button>
      ))}
    </div>
  );
}
