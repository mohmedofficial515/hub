import { useEffect, useRef } from 'react';
import { Tabs } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { Button, cn, ErrorState, fmt, isSourceProblem, kitMessages, LoadingRegion, Ltr, num, PageContainer, PageHeader, plural, setQuery, Skeleton, SkeletonRows, tabTriggerClass, useAdmin, useRoute, useSession } from '../../kit';
import { messages } from './i18n';
import { AuditTab } from './parts/audit';
import { GeneralTab } from './parts/general';
import { NotificationsTab } from './parts/notifications';
import { RolesTab } from './parts/roles';
import { SourcesTab } from './parts/sources';
import { SystemTab } from './parts/system';
import { TokensTab } from './parts/tokens';

const TABS = ['general', 'sources', 'roles', 'notifications', 'tokens', 'system', 'audit'] as const;
type SettingsTab = (typeof TABS)[number];
/** 09 §18.4, §18.5: these two belong to every member. The rest are owner and PM, with a 403 otherwise. */
const PERSONAL: SettingsTab[] = ['notifications', 'tokens'];
const isTab = (v: string | null): v is SettingsTab => !!v && (TABS as readonly string[]).includes(v);

const PANELS: Record<SettingsTab, () => React.JSX.Element> = {
  general: GeneralTab,
  sources: SourcesTab,
  roles: RolesTab,
  notifications: NotificationsTab,
  tokens: TokensTab,
  system: SystemTab,
  audit: AuditTab,
};

export default function Page() {
  const { scenario } = useSession();
  // A new scenario starts from fresh state.
  return <Settings key={scenario} />;
}

/**
 * The tab lives in `?tab=`, which the shell's "My tokens" menu item already uses. The card sheet also owns `tab` while
 * a card is open and clears it on close, so the current tab is latched here and put back in the URL afterwards.
 *
 * With no tab in the URL, a manager lands where the sidebar's red count points: Sources, when a source has a problem.
 * The landing is latched too, or fixing the last problem would throw the member out of the page they are on.
 */
function useSettingsTab(fallback: SettingsTab) {
  const { query, cardKey } = useRoute();
  const raw = query.get('tab');
  const latched = useRef<SettingsTab | null>(null);
  if (!cardKey && isTab(raw)) latched.current = raw;
  latched.current ??= isTab(raw) ? raw : fallback;
  const current = latched.current;
  useEffect(() => {
    if (!cardKey && raw !== current) setQuery({ tab: current });
  }, [cardKey, raw, current]);
  return current;
}

function Settings() {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { scenario, isManager, loading, error } = useSession();
  const admin = useAdmin(scenario);
  const problems = admin.sources.filter(isSourceProblem).length;
  const tab = useSettingsTab(isManager ? (problems > 0 ? 'sources' : 'general') : 'notifications');
  const visible = isManager ? TABS : PERSONAL;
  const allowed = visible.includes(tab);
  const activeTab = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeTab.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [tab]);

  const header = <PageHeader title={t.title} meta={isManager ? undefined : t.personalNote} />;

  if (error) {
    return (
      <PageContainer>
        {header}
        <ErrorState thing={t.errorThing} code="hub.workspaces.settings_unavailable" requestId="req_a41c07e" onRetry={() => setQuery({ scenario: null })} />
      </PageContainer>
    );
  }

  if (loading) {
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
      <Tabs.Root value={allowed ? tab : ''} onValueChange={(next) => setQuery({ tab: next, actor: null, verb: null, via: null, from: null, to: null })} dir={locale === 'ar' ? 'rtl' : 'ltr'} className="flex min-w-0 flex-col gap-6">
        <Tabs.List aria-label={t.tabsLabel} className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] md:mx-0 md:px-0">
          {visible.map((id) => (
            <Tabs.Trigger key={id} ref={id === tab ? activeTab : undefined} value={id} className={cn(tabTriggerClass, 'shrink-0 whitespace-nowrap')}>
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
            <ErrorState forbiddenRole={fmt(t.forbiddenRoles, { owner: kit.roles.owner, pm: kit.roles.pm })} code="hub.workspaces.forbidden" className="pb-4" />
            <Button onClick={() => setQuery({ tab: 'notifications' })}>{t.backToMine}</Button>
          </div>
        )}
      </Tabs.Root>
    </PageContainer>
  );
}
