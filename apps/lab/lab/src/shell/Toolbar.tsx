import { Columns2, ExternalLink, Moon, NotebookText, Square, Sun } from 'lucide-react';
import { cn } from '@lab/utils';
import { registry } from '../core/registry';
import { frameHash, SCENARIOS } from '../core/view';
import { WIDTHS, type Route } from './route';

export function Toolbar({ route, go }: { route: Route; go: (patch: Partial<Route>) => void }) {
  const page = registry.find((p) => p.app === route.app && p.slug === route.page);
  const choices = [...(page?.liveUrl ? ['live'] : []), ...(page?.versions.map((v) => v.id) ?? [])];
  const canCompare = choices.length > 1;
  const comparing = route.b !== null;

  const toggleCompare = () => {
    if (comparing) return go({ b: null });
    const other = choices.find((c) => c === 'v1-baseline' && c !== route.a) ?? choices.find((c) => c !== route.a);
    go({ b: other ?? null });
  };

  const popout =
    route.app && route.page && route.a && route.a !== 'live'
      ? `${import.meta.env.BASE_URL}frame-${route.app}.html${frameHash(route.page, route.a, route)}`
      : null;

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-300">
      <p className="me-auto truncate font-medium text-zinc-100">
        {route.app ? `${route.app} / ${route.page === '_tokens' ? 'tokens' : route.page}` : 'Select a page'}
      </p>

      {canCompare && (
        <div className="flex items-center gap-2">
          <Toggle active={comparing} onClick={toggleCompare} title="Side-by-side">
            {comparing ? <Columns2 className="size-4" /> : <Square className="size-4" />}
          </Toggle>
          {comparing && (
            <>
              <Select value={route.a ?? ''} options={choices} onChange={(a) => go({ a })} />
              <span className="text-zinc-600">vs</span>
              <Select value={route.b ?? ''} options={choices} onChange={(b) => go({ b })} />
            </>
          )}
        </div>
      )}

      {route.page && route.page !== '_tokens' && (
        <Select value={route.scenario} options={SCENARIOS} onChange={(scenario) => go({ scenario })} />
      )}
      <Segmented value={route.width} options={WIDTHS} onChange={(width) => go({ width })} />
      <Segmented
        value={route.lang}
        options={[
          { value: 'ar', label: 'AR · RTL' },
          { value: 'en', label: 'EN · LTR' },
        ]}
        onChange={(lang) => go({ lang })}
      />
      <Toggle active={route.theme === 'dark'} onClick={() => go({ theme: route.theme === 'dark' ? 'light' : 'dark' })} title="Theme">
        {route.theme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </Toggle>
      <Toggle active={route.notes} onClick={() => go({ notes: !route.notes })} title="Status & notes">
        <NotebookText className="size-4" />
      </Toggle>
      {popout && (
        <a href={popout} target="_blank" rel="noreferrer" title="Open frame in new tab" className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100">
          <ExternalLink className="size-4" />
        </a>
      )}
    </header>
  );
}

function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg bg-white/5 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn('rounded-md px-2.5 py-1 text-xs transition-colors', o.value === value ? 'bg-white/15 text-zinc-50' : 'text-zinc-400 hover:text-zinc-100')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn('rounded-md p-1.5 transition-colors', active ? 'bg-white/15 text-zinc-50' : 'text-zinc-400 hover:bg-white/10 hover:text-zinc-100')}
    >
      {children}
    </button>
  );
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-zinc-200">
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
