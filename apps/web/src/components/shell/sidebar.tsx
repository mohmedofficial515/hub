'use client';

/**
 * @file sidebar.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/shell/sidebar.tsx. Contract: apps/web/README.md.
 */
import {
  Check,
  ChevronsUpDown,
  FolderKanban,
  Keyboard,
  KeyRound,
  Languages,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sun,
  UserRound,
  X,
} from 'lucide-react';
import { Dialog, DropdownMenu } from 'radix-ui';

import {
  AppLink,
  Avatar,
  cn,
  fmt,
  focusRing,
  IconButton,
  Ltr,
  type MyCounts,
  navigate,
  num,
  plural,
  type PluralForms,
  setPreference,
  Tooltip,
  useMe,
  useMedia,
  useMyCounts,
  usePreference,
  useRoute,
  useSession,
} from '@/components/kit';
import { Ocellus } from '@/components/shell/ocellus';
import type { ViewId } from '@/components/shell/router';
import { goTo } from '@/components/shell/router';
import { type CounterKey, NAV_GROUPS, type ViewDef, views } from '@/components/shell/views';
import { signOut } from '@/features/session/auth';
import { portalRoot, useFocusReturn } from '@/lib/hooks';
import { useLocale, useT } from '@/lib/i18n';
import { messages, type ShellDict as ShellMessages } from '@/lib/i18n';
import { useSidebarFolded } from '@/lib/preferences';
import { setLocaleEverywhere, setTheme, useTheme } from '@/lib/theme';

interface Badge {
  value: number;
  danger?: boolean | undefined;
  label: string;
}

function badgeFor(
  counter: CounterKey | undefined,
  counts: MyCounts,
  t: ShellMessages,
  locale: 'ar' | 'en',
  manager: boolean,
  owner: boolean,
): Badge | null {
  if (!counter) return null;
  const say = (forms: PluralForms, n: number) => plural(n, locale, forms);
  switch (counter) {
    case 'inbox':
      return counts.inbox ? { value: counts.inbox, label: say(t.counts.inbox, counts.inbox) } : null;
    case 'timeline':
      return counts.newEvents
        ? { value: counts.newEvents, label: say(t.counts.timeline, counts.newEvents) }
        : null;
    case 'planning':
      return counts.planning
        ? { value: counts.planning, label: say(t.counts.planning, counts.planning) }
        : null;
    case 'tasks':
      return counts.tasksReady
        ? {
            value: counts.tasksReady,
            label: say(manager ? t.counts.tasksProject : t.counts.tasks, counts.tasksReady),
          }
        : null;
    case 'decisions':
      return counts.decisions.mine
        ? {
            value: counts.decisions.mine,
            danger: counts.decisions.overdue > 0,
            label: say(
              counts.decisions.overdue ? t.counts.decisionsOverdue : t.counts.decisions,
              counts.decisions.mine,
            ),
          }
        : null;
    case 'needs':
      return counts.needs.mine
        ? { value: counts.needs.mine, label: say(t.counts.needs, counts.needs.mine) }
        : null;
    case 'handoffs':
      return counts.handoffs.mine
        ? { value: counts.handoffs.mine, label: say(t.counts.handoffs, counts.handoffs.mine) }
        : null;
    case 'redesign':
      return owner && counts.redesigns.all
        ? { value: counts.redesigns.all, label: say(t.counts.redesign, counts.redesigns.all) }
        : null;
    case 'onboarding':
      return counts.onboarding
        ? { value: counts.onboarding, label: say(t.counts.onboarding, counts.onboarding) }
        : null;
    case 'members':
      return manager && counts.invites
        ? { value: counts.invites, label: say(t.counts.members, counts.invites) }
        : null;
    case 'settings':
      return manager && counts.sourceProblems
        ? { value: counts.sourceProblems, danger: true, label: say(t.counts.settings, counts.sourceProblems) }
        : null;
  }
}

function NavItem({
  view,
  collapsed,
  badge,
  onNavigate,
}: {
  view: ViewDef;
  collapsed: boolean;
  badge: Badge | null;
  onNavigate?: (() => void) | undefined;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const { view: current, known } = useRoute();
  const active = known && current === view.id;
  const Icon = view.icon;
  const label = t.nav[view.id];
  const pill = view.id === 'timeline';
  const link = (
    <AppLink
      view={view.id}
      aria-current={active ? 'page' : undefined}
      aria-label={
        collapsed || badge
          ? `${label}${badge ? `${locale === 'ar' ? '، ' : ', '}${badge.label}` : ''}`
          : undefined
      }
      onClick={onNavigate}
      className={cn(
        'relative flex min-h-11 items-center gap-2.5 rounded-md text-body transition-colors duration-120 lg:min-h-9',
        collapsed ? 'justify-center px-0' : 'px-2.5',
        active
          ? 'bg-accent font-semibold text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        focusRing,
      )}
    >
      {active && (
        <span aria-hidden className="absolute inset-y-1.5 -start-2 w-0.75 rounded-full bg-foreground" />
      )}
      <Icon aria-hidden className="size-4.5 shrink-0" strokeWidth={1.75} />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {badge &&
        (collapsed ? (
          <span
            aria-hidden
            className={cn(
              'absolute end-1.5 top-1 size-2 rounded-full ring-2 ring-(--sidebar)',
              badge.danger ? 'bg-destructive' : 'bg-muted-foreground',
            )}
          />
        ) : (
          <span
            aria-hidden
            className={cn(
              'inline-flex h-5 min-w-5 shrink-0 items-center justify-center px-1.5 text-caption font-medium tabular-nums',
              pill ? 'rounded-full border border-border' : 'rounded-full',
              badge.danger
                ? 'bg-destructive-soft text-destructive-soft-foreground'
                : pill
                  ? 'text-muted-foreground'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            <Ltr>{num(badge.value, locale)}</Ltr>
          </span>
        ))}
    </AppLink>
  );
  if (!collapsed) return link;
  return (
    <Tooltip side={locale === 'ar' ? 'left' : 'right'} content={badge ? `${label}: ${badge.label}` : label}>
      {link}
    </Tooltip>
  );
}

const menuItem =
  'flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2.5 text-body-sm text-foreground outline-none select-none data-[highlighted]:bg-accent lg:min-h-9';
const menuContent =
  'z-[75] min-w-52 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md';

/** docs/15 §5: lists projects and has "New project". The word is Project; routes and code keep `workspace`. */
function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const { workspace } = useSession();
  const { data } = useMe();
  const others = (data?.workspaces ?? []).filter((w) => w.slug !== workspace?.slug && w.status !== 'closed');
  return (
    <DropdownMenu.Root dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <DropdownMenu.Trigger
        aria-label={workspace ? fmt(t.sidebar.switchFrom, { name: workspace.name }) : t.sidebar.switchTo}
        className={cn(
          'flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md text-start transition-colors duration-120 hover:bg-accent',
          collapsed ? 'justify-center' : 'px-1.5',
          focusRing,
        )}
      >
        <Ocellus />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">
              {workspace?.name}
            </span>
            <ChevronsUpDown
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
          </>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalRoot()}>
        <DropdownMenu.Content align="start" sideOffset={4} collisionPadding={12} className={menuContent}>
          <DropdownMenu.Label className="px-2.5 py-1.5 text-caption text-muted-foreground">
            {t.sidebar.workspace}
          </DropdownMenu.Label>
          <DropdownMenu.Item disabled aria-current="true" className={cn(menuItem, 'font-semibold')}>
            <Check aria-hidden className="size-4 shrink-0" strokeWidth={2} />
            {workspace?.name}
            <Ltr mono className="ms-auto text-caption text-muted-foreground">
              {workspace?.keyPrefix}
            </Ltr>
          </DropdownMenu.Item>
          {others.map((w) => (
            <DropdownMenu.Item
              key={w.slug}
              onSelect={() => goTo(`/${locale}/${w.slug}/today`)}
              className={menuItem}
            >
              {w.name}
              <Ltr mono className="ms-auto text-caption text-muted-foreground">
                {w.keyPrefix}
              </Ltr>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item onSelect={() => goTo(`/${locale}/workspaces?new=1`)} className={menuItem}>
            <Plus aria-hidden className="size-4" strokeWidth={1.75} />
            {t.sidebar.newProject}
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => goTo(`/${locale}/workspaces`)} className={menuItem}>
            <FolderKanban aria-hidden className="size-4" strokeWidth={1.75} />
            {t.sidebar.allWorkspaces}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Profile, tokens, shortcuts, sign out (08 §2). The sidebar's foot and the header avatar both open it. */
export function MemberMenu({
  onShortcuts,
  trigger,
  side = 'top',
}: {
  onShortcuts: () => void;
  trigger: React.ReactNode;
  side?: 'top' | 'bottom' | undefined;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const { me } = useSession();
  return (
    <DropdownMenu.Root dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalRoot()}>
        <DropdownMenu.Content
          side={side}
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className={menuContent}
        >
          <DropdownMenu.Label className="px-2.5 py-1.5 text-body-sm font-medium text-foreground">
            {me.name}
          </DropdownMenu.Label>
          <DropdownMenu.Item
            onSelect={() => navigate('members', { query: { profile: 'me' } })}
            className={menuItem}
          >
            <UserRound aria-hidden className="size-4" strokeWidth={1.75} />
            {t.sidebar.profile}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => navigate('settings', { query: { tab: 'tokens' } })}
            className={menuItem}
          >
            <KeyRound aria-hidden className="size-4" strokeWidth={1.75} />
            {t.sidebar.tokens}
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={onShortcuts} className={menuItem}>
            <Keyboard aria-hidden className="size-4" strokeWidth={1.75} />
            {t.sidebar.shortcuts}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item onSelect={() => void signOut(locale)} className={menuItem}>
            <LogOut aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
            {t.sidebar.signOut}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Sidebar contents: one body for the desktop rail and the phone drawer. */
function SidebarBody({
  collapsed,
  onNavigate,
  onShortcuts,
  drawer = false,
}: {
  collapsed: boolean;
  onNavigate?: (() => void) | undefined;
  onShortcuts: () => void;
  drawer?: boolean | undefined;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const { me, isManager, isOwner } = useSession();
  const counts = useMyCounts();
  const dark = useTheme() === 'dark';
  const Collapse = collapsed ? PanelLeftOpen : PanelLeftClose;
  const badge = (view: ViewDef) => badgeFor(view.counter, counts, t, locale, isManager, isOwner);
  const top = views.filter((v) => v.group === null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn('flex shrink-0 items-center gap-1 p-2', collapsed && 'flex-col')}>
        <WorkspaceSwitcher collapsed={collapsed} />
        {drawer ? (
          <Dialog.Close asChild>
            <IconButton label={t.sidebar.closeMenu}>
              <X aria-hidden className="size-4" strokeWidth={1.75} />
            </IconButton>
          </Dialog.Close>
        ) : (
          <IconButton
            label={collapsed ? t.sidebar.expand : t.sidebar.collapse}
            aria-expanded={!collapsed}
            aria-keyshortcuts="[ ]"
            onClick={() => setPreference('sidebarCollapsed', !collapsed)}
          >
            <Collapse aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
          </IconButton>
        )}
      </div>

      <nav
        aria-label={t.sidebar.label}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-2 [scrollbar-width:thin]"
      >
        <ul className="flex flex-col gap-0.5">
          {top.map((view) => (
            <li key={view.id}>
              <NavItem view={view} collapsed={collapsed} badge={badge(view)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        {NAV_GROUPS.map((group) => (
          <section key={group} aria-labelledby={`nav-${group}${drawer ? '-d' : ''}`} className="mt-3">
            {collapsed ? (
              <div className="mx-2 mb-2 h-px bg-border">
                <span id={`nav-${group}${drawer ? '-d' : ''}`} className="sr-only">
                  {t.groups[group]}
                </span>
              </div>
            ) : (
              <h2
                id={`nav-${group}${drawer ? '-d' : ''}`}
                className="px-2.5 pb-1 text-caption font-medium text-muted-foreground"
              >
                {t.groups[group]}
              </h2>
            )}
            <ul className="flex flex-col gap-0.5">
              {views
                .filter((v) => v.group === group)
                .map((view) => (
                  <li key={view.id}>
                    <NavItem view={view} collapsed={collapsed} badge={badge(view)} onNavigate={onNavigate} />
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </nav>

      <div
        className={cn('flex shrink-0 items-center gap-1 border-t border-border p-2', collapsed && 'flex-col')}
      >
        <MemberMenu
          onShortcuts={onShortcuts}
          trigger={
            <button
              type="button"
              aria-label={t.sidebar.me}
              className={cn(
                'flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md text-start transition-colors duration-120 hover:bg-accent lg:min-h-9',
                collapsed ? 'justify-center' : 'px-1.5',
                focusRing,
              )}
            >
              <Avatar member={me} size="sm" />
              {!collapsed && (
                <span className="min-w-0 flex-1 truncate text-body-sm text-foreground">{me.name}</span>
              )}
            </button>
          }
        />
        <IconButton
          label={`${t.sidebar.language}: ${locale === 'ar' ? t.sidebar.toEnglish : t.sidebar.toArabic}`}
          onClick={() => setLocaleEverywhere(locale === 'ar' ? 'en' : 'ar')}
        >
          <Languages aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
        <IconButton
          label={dark ? t.sidebar.themeToLight : t.sidebar.themeToDark}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
        >
          {dark ? (
            <Sun aria-hidden className="size-4" strokeWidth={1.75} />
          ) : (
            <Moon aria-hidden className="size-4" strokeWidth={1.75} />
          )}
        </IconButton>
      </div>
    </div>
  );
}

/** 08 §7: 248 px from 1280, 56 px icons from 1024 (a stored preference overrides both), a drawer below that. */
export function useSidebarCollapsed() {
  const pref = usePreference('sidebarCollapsed');
  const wide = useMedia('(min-width: 1280px)', true);
  const folded = useSidebarFolded();
  return folded || (pref ?? !wide);
}

export function DesktopSidebar({ onShortcuts }: { onShortcuts: () => void }) {
  const collapsed = useSidebarCollapsed();
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 border-e border-border bg-(--sidebar) transition-[width] duration-200 ease-out motion-reduce:transition-none lg:block',
        collapsed ? 'w-14' : 'w-62',
      )}
    >
      <SidebarBody collapsed={collapsed} onShortcuts={onShortcuts} />
    </aside>
  );
}

/** Under 1024 px the sidebar is a drawer from the start edge, opened from the header. */
export function SidebarDrawer({
  open,
  onOpenChange,
  onShortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShortcuts: () => void;
}) {
  const t = useT(messages);
  const onCloseAutoFocus = useFocusReturn(open, () => document.getElementById('hub-nav-button'));
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={portalRoot()}>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-(--scrim) motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 lg:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed inset-y-0 start-0 z-50 w-[min(84vw,20rem)] border-e border-border bg-(--sidebar) outline-none motion-safe:animate-in motion-safe:duration-200 motion-safe:slide-in-from-start lg:hidden"
        >
          <Dialog.Title className="sr-only">{t.sidebar.label}</Dialog.Title>
          <SidebarBody
            collapsed={false}
            drawer
            onNavigate={() => onOpenChange(false)}
            onShortcuts={() => {
              onOpenChange(false);
              onShortcuts();
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export type { ViewId };
