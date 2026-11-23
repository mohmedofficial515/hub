import { useEffect, useState } from 'react';
import { ChevronDown, LayoutDashboard, Globe, Palette, Radar } from 'lucide-react';
import { cn } from '@lab/utils';
import { registry, type App } from '../core/registry';
import type { Route } from './route';
import { StatusBadge } from './status';

const APPS: { app: App; label: string; Icon: typeof Globe }[] = [
  { app: 'web', label: 'Website', Icon: Globe },
  { app: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { app: 'hub', label: 'Hub', Icon: Radar },
];

/**
 * One app at a time: a filter picks Website, Dashboard or Hub, and its pages are an accordion where exactly one page is always open, so the list
 * never sprawls. Opening a version elsewhere (a link, the toolbar) opens its app and page here too.
 */
export function Sidebar({ route, go }: { route: Route; go: (patch: Partial<Route>) => void }) {
  const isActive = (app: App, page: string, v: string) => route.app === app && route.page === page && route.a === v;
  const [app, setApp] = useState<App>(route.app ?? 'web');
  const pages = registry.filter((p) => p.app === app);
  const [open, setOpen] = useState<string | null>(route.page && route.page !== '_tokens' ? route.page : null);

  // Follow the route: a version opened from anywhere shows its app and page.
  useEffect(() => {
    if (route.app) setApp(route.app);
    if (route.page && route.page !== '_tokens') setOpen(route.page);
  }, [route.app, route.page]);

  // Always one page open: the one picked if it belongs to this app, else the first.
  const openSlug = pages.some((p) => p.slug === open) ? open : (pages[0]?.slug ?? null);

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col border-e border-white/10 bg-zinc-950 text-sm">
      <div className="px-4 pt-5 pb-3">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase">Goteav</p>
        <p className="text-base font-semibold text-zinc-100">Redesign Lab</p>
      </div>

      <div role="tablist" aria-label="App" className="mx-3 mb-3 grid grid-cols-3 gap-1 rounded-lg bg-white/5 p-1">
        {APPS.map(({ app: a, label, Icon }) => {
          const count = registry.filter((p) => p.app === a).length;
          return (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={app === a}
              title={`${label} · ${count} pages`}
              onClick={() => setApp(a)}
              className={cn(
                'flex min-h-9 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:text-zinc-100',
                app === a && 'bg-zinc-800 text-zinc-50 shadow-sm',
              )}
            >
              <Icon className="size-3.5" />
              <span className="leading-tight">{label}</span>
              <span className="text-[10px] leading-none text-zinc-500 tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/5 px-2 py-2">
        <Item active={isActive(app, '_tokens', 'preview')} onClick={() => go({ app, page: '_tokens', a: 'preview', b: null })}>
          <Palette className="size-3.5 text-zinc-500" /> Tokens
        </Item>

        {pages.length === 0 && (
          <p className="px-3 py-2 text-xs text-zinc-500">
            No pages yet — copy <code className="text-zinc-400">_templates/page</code>
          </p>
        )}

        <div className="mt-1 flex flex-col gap-0.5">
          {pages.map((p) => {
            const expanded = p.slug === openSlug;
            const panelId = `lab-page-${app}-${p.slug}`;
            return (
              <div key={p.slug} className={cn('rounded-lg', expanded && 'bg-white/[0.03]')}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setOpen(p.slug)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100',
                    expanded && 'text-zinc-100',
                  )}
                >
                  <span className="flex-1 truncate">{p.slug}</span>
                  <span className="text-[11px] text-zinc-500 tabular-nums">{p.versions.length}</span>
                  <ChevronDown
                    aria-hidden
                    className={cn('size-3.5 text-zinc-500 transition-transform motion-reduce:transition-none', expanded && 'rotate-180')}
                  />
                </button>
                {expanded && (
                  <div id={panelId} className="pb-2">
                    {p.liveUrl && (
                      <Item indent active={isActive(app, p.slug, 'live')} onClick={() => go({ app, page: p.slug, a: 'live', b: null })}>
                        <span className="size-1.5 rounded-full bg-emerald-400" /> live
                      </Item>
                    )}
                    {p.versions.map((v) => (
                      <Item key={v.id} indent active={isActive(app, p.slug, v.id)} onClick={() => go({ app, page: p.slug, a: v.id, b: null })}>
                        <span className="flex-1 truncate">{v.id}</span>
                        <StatusBadge status={v.status} />
                      </Item>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function Item({ active, indent, onClick, children }: { active: boolean; indent?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-start text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100',
        indent && 'ps-5',
        active && 'bg-white/10 text-zinc-50',
      )}
    >
      {children}
    </button>
  );
}
