import { LayoutDashboard, Globe, Palette, Radar } from 'lucide-react';
import { cn } from '@lab/utils';
import { registry, type App } from '../core/registry';
import type { Route } from './route';
import { StatusBadge } from './status';

const APPS: { app: App; label: string; Icon: typeof Globe }[] = [
  { app: 'web', label: 'Website', Icon: Globe },
  { app: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { app: 'hub', label: 'Hub', Icon: Radar },
];

export function Sidebar({ route, go }: { route: Route; go: (patch: Partial<Route>) => void }) {
  const isActive = (app: App, page: string, v: string) => route.app === app && route.page === page && route.a === v;

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-e border-white/10 bg-zinc-950 text-sm">
      <div className="px-4 pt-5 pb-4">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase">Goteav</p>
        <p className="text-base font-semibold text-zinc-100">Redesign Lab</p>
      </div>

      <Section title="Tokens">
        {APPS.map(({ app, label }) => (
          <Item key={app} active={isActive(app, '_tokens', 'preview')} onClick={() => go({ app, page: '_tokens', a: 'preview', b: null })}>
            <Palette className="size-3.5 text-zinc-500" /> {label}
          </Item>
        ))}
      </Section>

      {APPS.map(({ app, label, Icon }) => {
        const pages = registry.filter((p) => p.app === app);
        return (
          <Section key={app} title={label} icon={<Icon className="size-3.5" />}>
            {pages.length === 0 && (
              <p className="px-3 py-1 text-xs text-zinc-500">
                No pages yet — copy <code className="text-zinc-400">_templates/page</code>
              </p>
            )}
            {pages.map((p) => (
              <div key={p.slug} className="mb-2">
                <p className="truncate px-3 py-1 font-medium text-zinc-300">{p.slug}</p>
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
            ))}
          </Section>
        );
      })}
    </nav>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/5 px-2 py-3">
      <p className="mb-1 flex items-center gap-1.5 px-3 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function Item({ active, indent, onClick, children }: { active: boolean; indent?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
