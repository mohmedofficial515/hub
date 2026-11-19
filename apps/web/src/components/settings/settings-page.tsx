'use client';

/**
 * @file settings-page.tsx
 * @description The tabs in `?tab=` (docs/09 §18). Backups (docs/16 D61 to D63) shows for the owner alone. Ported from the approved design, pages/settings. Contract: apps/web/README.md.
 */
import { Tabs } from 'radix-ui';
import { Fragment, useEffect, useId, useRef } from 'react';

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
import { useHasDraft } from '@/features/settings/drafts';
import type { SettingsMessages } from '@/features/settings/messages';
import { useSettings, useSources } from '@/features/settings/queries';
import { isProblem, sourceState } from '@/features/settings/source-state';
import { useScrollCue } from '@/lib/scroll-cue';

import { AppearanceTab } from './parts/appearance';
import { AuditTab } from './parts/audit';
import { BackupsTab } from './parts/backups';
import { DevicesTab } from './parts/devices';
import { GeneralTab } from './parts/general';
import { NotificationsTab } from './parts/notifications';
import { QueueTab } from './parts/queue';
import { RolesTab } from './parts/roles';
import { SourcesTab } from './parts/sources';
import { SystemTab } from './parts/system';
import { TokensTab } from './parts/tokens';

const TABS = [
  'appearance',
  'notifications',
  'tokens',
  'devices',
  'queue',
  'general',
  'sources',
  'roles',
  'audit',
  'system',
  'backups',
] as const;
type SettingsTab = (typeof TABS)[number];
/** 09 §18.4, §18.5, docs/16 §5 and §9: these five belong to every member. The rest are owner and PM, with a 403 otherwise. */
const PERSONAL: readonly SettingsTab[] = ['appearance', 'notifications', 'tokens', 'devices', 'queue'];
type TabGroup = 'mine' | 'project' | 'server';
/** The strip reads in three named runs: what is mine, what is the project's, what is this machine's. */
const GROUPS: { id: TabGroup; tabs: readonly SettingsTab[] }[] = [
  { id: 'mine', tabs: PERSONAL },
  { id: 'project', tabs: ['general', 'sources', 'roles', 'audit'] },
  { id: 'server', tabs: ['system', 'backups'] },
];
const groupOf = (tab: SettingsTab) => GROUPS.find((g) => g.tabs.includes(tab))!.id;
const isTab = (v: string | null): v is SettingsTab => !!v && (TABS as readonly string[]).includes(v);

const PANELS: Record<SettingsTab, () => React.JSX.Element> = {
  appearance: AppearanceTab,
  general: GeneralTab,
  sources: SourcesTab,
  roles: RolesTab,
  notifications: NotificationsTab,
  tokens: TokensTab,
  devices: DevicesTab,
  queue: QueueTab,
  system: SystemTab,
  backups: BackupsTab,
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

/** One tab. A tab holding unsaved edits carries a dot, and says so to a screen reader through its description, so its name stays the tab's. */
function SettingsTrigger({
  id,
  label,
  describedBy,
  triggerRef,
  children,
}: {
  id: SettingsTab;
  label: string;
  describedBy: string;
  triggerRef: React.Ref<HTMLButtonElement> | undefined;
  children?: React.ReactNode;
}) {
  const t = useT<SettingsMessages>('settings');
  const drafted = useHasDraft(id);
  const draftId = `${describedBy}-${id}-draft`;
  return (
    <Tabs.Trigger
      ref={triggerRef}
      value={id}
      aria-describedby={drafted ? `${describedBy} ${draftId}` : describedBy}
      className={cn(tabTriggerClass, 'shrink-0 whitespace-nowrap')}
    >
      {label}
      {drafted && (
        <>
          <span aria-hidden data-unsaved-dot className="size-1.5 shrink-0 rounded-full bg-foreground" />
          <span id={draftId} hidden>
            {t.unsavedTab}
          </span>
        </>
      )}
      {children}
    </Tabs.Trigger>
  );
}

export function SettingsPage() {
  const t = useT<SettingsMessages>('settings');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { isManager, isOwner, loading, error } = useSession();
  const sources = useSources();
  const settings = useSettings().data;
  const problems = (sources.data ?? []).filter((s) => isProblem(sourceState(s, settings))).length;
  const landing: SettingsTab | null = loading
    ? null
    : !isManager
      ? 'appearance'
      : sources.isPending
        ? null
        : problems > 0
          ? 'sources'
          : 'general';
  const tab = useSettingsTab(landing);
  // Backups belong to the machine, and only its owner manages them.
  const visible = isManager ? TABS.filter((id) => id !== 'backups' || isOwner) : PERSONAL;
  const allowed = !!tab && visible.includes(tab);
  const activeTab = useRef<HTMLButtonElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const uid = useId();
  const ready = !!tab && !loading;

  // The selected tab comes into view once it exists: on a direct load it appears only after the session answers (review M2).
  useEffect(() => {
    activeTab.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [tab, ready, visible.length]);
  useScrollCue(strip, [ready, visible.length]);

  const header = <PageHeader title={t.title} meta={!loading && !isManager ? t.personalNote : undefined} />;

  if (error) {
    return (
      <PageContainer>
        {header}
        <ErrorState thing={t.errorThing} onRetry={() => window.location.reload()} />
      </PageContainer>
    );
  }

  // While the session loads nobody is a manager yet, so deciding now would flash "no access" at the owner (review M1).
  if (!ready) {
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
          ref={strip}
          aria-label={t.tabsLabel}
          className="scroll-cue -mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] md:mx-0 md:px-0"
        >
          {visible.map((id, index) => {
            const group = groupOf(id);
            const opensGroup = index === 0 || groupOf(visible[index - 1]!) !== group;
            return (
              <Fragment key={id}>
                {opensGroup && (
                  <>
                    {index > 0 && <span aria-hidden className="h-4 w-px shrink-0 self-center bg-border" />}
                    <span
                      id={`${uid}-group-${group}`}
                      aria-hidden
                      className="shrink-0 self-center ps-3 pe-1 text-caption font-medium text-muted-foreground first:ps-0"
                    >
                      {t.tabGroups[group]}
                    </span>
                  </>
                )}
                <SettingsTrigger
                  id={id}
                  label={t.tabs[id]}
                  describedBy={`${uid}-group-${group}`}
                  triggerRef={id === tab ? activeTab : undefined}
                >
                  {id === 'sources' && problems > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive-soft px-1.5 text-caption font-medium text-destructive-soft-foreground tabular-nums">
                      <Ltr aria-hidden>{num(problems, locale)}</Ltr>
                      <span className="sr-only">{plural(problems, locale, t.sources.problemsSr)}</span>
                    </span>
                  )}
                </SettingsTrigger>
              </Fragment>
            );
          })}
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
            <Button onClick={() => setQuery({ tab: 'appearance' })}>{t.backToMine}</Button>
          </div>
        )}
      </Tabs.Root>
    </PageContainer>
  );
}
