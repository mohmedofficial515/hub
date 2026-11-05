'use client';

/**
 * @file settings-page.tsx
 * @description Eight tabs in `?tab=` (docs/09 §18). Ported from the approved design, pages/settings. Contract: apps/web/README.md.
 */
import { Tabs } from 'radix-ui';
import { useEffect, useRef } from 'react';

import {
  Button,
  cn,
  ErrorState,
  fmt,
  kitMessages,
  LoadingRegion,
  Ltr,
  num,
  PageContainer,
  PageHeader,
  plural,
  setQuery,
  Skeleton,
  SkeletonRows,
  tabTriggerClass,
  useLocale,
  useRoute,
  useSession,
  useT,
} from '@/components/kit';
import type { SettingsMessages } from '@/features/settings/messages';
import { useSettings, useSources } from '@/features/settings/queries';
import { isProblem, sourceState } from '@/features/settings/source-state';

import { AuditTab } from './parts/audit';
import { DevicesTab } from './parts/devices';
import { GeneralTab } from './parts/general';
import { NotificationsTab } from './parts/notifications';
import { RolesTab } from './parts/roles';
import { SourcesTab } from './parts/sources';
import { SystemTab } from './parts/system';
import { TokensTab } from './parts/tokens';

const TABS = [
  'general',
  'sources',
  'roles',
  'notifications',
  'tokens',
  'devices',
  'system',
  'audit',
] as const;
type SettingsTab = (typeof TABS)[number];
/** 09 §18.4, §18.5, docs/16 §5: these three belong to every member. The rest are owner and PM, with a 403 otherwise. */
const PERSONAL: readonly SettingsTab[] = ['notifications', 'tokens', 'devices'];
const isTab = (v: string | null): v is SettingsTab => !!v && (TABS as readonly string[]).includes(v);

const PANELS: Record<SettingsTab, () => React.JSX.Element> = {
  general: GeneralTab,
  sources: SourcesTab,
  roles: RolesTab,
  notifications: NotificationsTab,
  tokens: TokensTab,
  devices: DevicesTab,
  system: SystemTab,
  audit: AuditTab,
};

/**
 * The tab lives in `?tab=`, which the shell's "My tokens" menu item already uses. The card sheet also owns `tab` while
 * a card is open and clears it on close, so the current tab is latched here and put back in the URL afterwards.
 *
 * With no tab in the URL, a manager lands on Sources when a source has a problem. The landing waits for the answer, and is
 * latched too, or fixing the last problem would throw the member out of the page they are on.
 */
function useSettingsTab(fallback: SettingsTab | null) {
  const { query, cardKey } = useRoute();
  const raw = query.get('tab');
  const latched = useRef<SettingsTab | null>(null);
  if (!cardKey && isTab(raw)) latched.current = raw;
  latched.current ??= isTab(raw) ? raw : fallback;
  const current = latched.current;
  useEffect(() => {
    if (!cardKey && current && raw !== current) setQuery({ tab: current });
  }, [cardKey, raw, current]);
  return current;
}

export function SettingsPage() {
  const t = useT<SettingsMessages>('settings');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { isManager, loading, error } = useSession();
  const sources = useSources();
  const settings = useSettings().data;
  const problems = (sources.data ?? []).filter((s) => isProblem(sourceState(s, settings))).length;
  const landing: SettingsTab | null = loading
    ? null
    : !isManager
      ? 'notifications'
      : sources.isPending
        ? null
        : problems > 0
          ? 'sources'
          : 'general';
  const tab = useSettingsTab(landing);
  const visible = isManager ? TABS : PERSONAL;
  const allowed = !!tab && visible.includes(tab);
  const activeTab = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeTab.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [tab]);

  const header = <PageHeader title={t.title} meta={!loading && !isManager ? t.personalNote : undefined} />;

  if (error) {
    return (
      <PageContainer>
        {header}
        <ErrorState thing={t.errorThing} onRetry={() => window.location.reload()} />
      </PageContainer>
    );
  }

  if (!tab) {
    return (
      <PageContainer>
        {header}
        <LoadingRegion label={t.loading}>
          <div className="flex gap-3 overflow-hidden border-b border-border pb-2.5">
            {TABS.map((id) => (
              <Skeleton key={id} className="h-5 w-16 shrink-0" />
            ))}
          </div>
          <Skeleton className="h-6 w-40" />
          <SkeletonRows count={6} withAction />
        </LoadingRegion>
      </PageContainer>
    );
  }

  const Panel = PANELS[tab];
  return (
    <PageContainer>
      {header}
      <Tabs.Root
        value={allowed ? tab : ''}
        onValueChange={(next) => setQuery({ tab: next, actor: null, verb: null, from: null, to: null })}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        className="flex min-w-0 flex-col gap-6"
      >
        <Tabs.List
          aria-label={t.tabsLabel}
          className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] md:mx-0 md:px-0"
        >
          {visible.map((id) => (
            <Tabs.Trigger
              key={id}
              ref={id === tab ? activeTab : undefined}
              value={id}
              className={cn(tabTriggerClass, 'shrink-0 whitespace-nowrap')}
            >
              {t.tabs[id]}
              {id === 'sources' && problems > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive-soft px-1.5 text-caption font-medium text-destructive-soft-foreground tabular-nums">
                  <Ltr aria-hidden>{num(problems, locale)}</Ltr>
                  <span className="sr-only">{plural(problems, locale, t.sources.problemsSr)}</span>
                </span>
              )}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {allowed ? (
          <Tabs.Content value={tab} tabIndex={-1} className="flex min-w-0 flex-col gap-6 outline-none">
            <Panel />
          </Tabs.Content>
        ) : (
          <div className="flex flex-col items-center">
            <ErrorState
              forbiddenRole={fmt(t.forbiddenRoles, { owner: kit.roles.owner, pm: kit.roles.pm })}
              className="pb-4"
            />
            <Button onClick={() => setQuery({ tab: 'notifications' })}>{t.backToMine}</Button>
          </div>
        )}
      </Tabs.Root>
    </PageContainer>
  );
}
