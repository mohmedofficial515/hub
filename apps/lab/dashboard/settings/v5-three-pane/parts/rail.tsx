import { useEffect, type ReactNode } from 'react';
import { Popover } from 'radix-ui';
import { Check, Crown, LayoutGrid, PanelLeftClose, PanelLeftOpen, Search, SlidersHorizontal, UserRound } from 'lucide-react';
import { SETTINGS_SECTIONS, type SectionId } from '@lab/mocks/settings';
import { cn } from './cn';
import { groupByKey } from './lib';
import { useStore, type Role } from './store';
import { Icon, listKeys, Tip } from './ui';

function RailItem({
  label,
  icon,
  active,
  onClick,
  badge,
  expanded,
  caption,
  ...rest
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
  badge?: ReactNode;
  expanded: boolean;
  /** Show the label under the icon even when the rail is narrow. */
  caption?: boolean;
} & Record<`data-${string}`, string>) {
  const btn = (
    <button
      type="button"
      data-nav
      aria-label={expanded ? undefined : label}
      aria-current={active ? 'true' : undefined}
      onClick={onClick}
      className={cn(
        'relative flex min-h-11 w-full items-center gap-3 rounded-xl text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        expanded ? 'px-3' : caption ? 'flex-col justify-center gap-0.5 py-1.5' : 'justify-center',
        active ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:bg-card/70 hover:text-foreground',
      )}
      {...rest}
    >
      <span className="relative inline-flex">
        {icon}
        {badge ? <span className="absolute -end-1.5 -top-1.5">{badge}</span> : null}
      </span>
      {expanded ? <span className={cn('truncate text-13', active ? 'font-bold text-foreground' : 'font-semibold')}>{label}</span> : caption ? <span className="max-w-full truncate text-10 font-bold leading-tight">{label}</span> : null}
    </button>
  );
  if (expanded) return btn;
  return (
    <Tip label={label}>
      <span className="block">{btn}</span>
    </Tip>
  );
}

const sectionBadge = (attention: boolean, unsaved: boolean) =>
  unsaved ? (
    <span className="block size-2.5 rounded-full bg-warning ring-2 ring-muted" aria-hidden />
  ) : attention ? (
    <span className="block size-2 rounded-full bg-warning/80 ring-2 ring-muted" aria-hidden />
  ) : null;

export function Rail() {
  const s = useStore();
  const { t, locale } = s;
  const expanded = s.railExpanded;

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && s.setRailExpanded(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, s]);

  const pick = (section: SectionId | 'prefs' | null) => {
    s.clearSearch();
    s.go({ section, pane: section ? 'list' : 'home' });
    s.setRailExpanded(false);
  };

  return (
    <nav
      aria-label={t.sections}
      className={cn(
        'z-30 flex h-full flex-col gap-1 border-e bg-muted/60 p-2 transition-[width] duration-200 motion-reduce:transition-none dark:bg-muted/30',
        expanded ? 'absolute inset-y-0 start-0 w-64 bg-muted shadow-2xl dark:bg-muted' : 'w-[4.25rem]',
      )}
    >
      <div className="grid gap-1" onKeyDown={listKeys}>
        <RailItem expanded={expanded} label={t.home} caption icon={<LayoutGrid className="size-5" aria-hidden />} active={!s.section && !s.group && !s.searching} onClick={() => pick(null)} />
        <RailItem
          expanded={expanded}
          label={`${t.search.label} (/)`}
          icon={<Search className="size-5" aria-hidden />}
          active={s.searching}
          onClick={() => {
            s.setRailExpanded(false);
            s.setPane('list');
            requestAnimationFrame(() => s.searchRef.current?.focus());
          }}
        />
        <div className="mx-2 my-1 h-px bg-border" aria-hidden />
        {SETTINGS_SECTIONS.map((sec) => {
          const groups = sec.groupKeys.map((k) => groupByKey.get(k)!).filter(Boolean);
          const attention = groups.some((g) => g.attention && !s.hidden(g.key));
          const unsaved = s.dirtyCount > 0 && !!s.group && sec.groupKeys.includes(s.group);
          return (
            <RailItem
              key={sec.id}
              expanded={expanded}
              label={sec.title[locale]}
              icon={<Icon name={sec.icon} className="size-5" />}
              active={s.section === sec.id && !s.searching}
              badge={sectionBadge(attention, unsaved)}
              onClick={() => pick(sec.id)}
              data-section={sec.id}
            />
          );
        })}
        <div className="mx-2 my-1 h-px bg-border" aria-hidden />
        <RailItem expanded={expanded} label={t.prefs.title} icon={<SlidersHorizontal className="size-5" aria-hidden />} active={s.section === 'prefs' && !s.searching} onClick={() => pick('prefs')} data-section="prefs" />
      </div>
      <div className="mt-auto grid gap-1">
        <RoleSwitch expanded={expanded} />
        <RailItem
          expanded={expanded}
          label={expanded ? t.collapseRail : t.expandRail}
          icon={expanded ? <PanelLeftClose className="size-5 rtl:-scale-x-100" aria-hidden /> : <PanelLeftOpen className="size-5 rtl:-scale-x-100" aria-hidden />}
          onClick={() => s.setRailExpanded(!expanded)}
        />
      </div>
    </nav>
  );
}

export function RoleSwitch({ expanded, inline }: { expanded?: boolean; inline?: boolean }) {
  const s = useStore();
  const { t } = s;
  const roles: Role[] = ['owner', 'admin'];
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`${t.role.label}: ${t.role[s.role]}`}
          className={cn(
            'flex min-h-11 items-center gap-3 rounded-xl text-start outline-none hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring',
            inline ? 'w-full border bg-card px-3' : expanded ? 'w-full px-3' : 'w-full justify-center',
          )}
        >
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-sm">
            {s.role === 'owner' ? <Crown className="size-4" aria-hidden /> : <UserRound className="size-4" aria-hidden />}
          </span>
          {expanded || inline ? (
            <span className="min-w-0">
              <span className="block text-11 text-muted-foreground">{t.role.label}</span>
              <span className="block truncate text-13 font-semibold">
                {t.role[s.role]} · {s.person}
              </span>
            </span>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side={inline ? 'top' : s.locale === 'ar' ? 'left' : 'right'} align="end" sideOffset={8} className="z-50 w-72 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl outline-none">
          <p className="px-2.5 pb-1 pt-1.5 text-12 font-semibold text-muted-foreground">{t.role.label}</p>
          {roles.map((r) => (
            <Popover.Close asChild key={r}>
              <button
                type="button"
                onClick={() => s.setRole(r)}
                aria-pressed={s.role === r}
                className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-start outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="mt-0.5 inline-flex size-4 shrink-0">{s.role === r ? <Check className="size-4 text-primary" aria-hidden /> : null}</span>
                <span>
                  <span className="block text-13 font-semibold">{t.role[r]}</span>
                  <span className="block text-12 text-muted-foreground">{r === 'owner' ? t.role.ownerHint : t.role.adminHint}</span>
                </span>
              </button>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
