// v7 Readiness journey: the whole settings experience in one page. Overview = launch readiness (dial + journey) or
// the day-to-day index; group pages are guided steppers; personal preferences are a short instant step set.
// State routing only (URL hash keeps view, group, field and sheet), data from `@lab/mocks/settings`.
import { LayoutGrid, Palette, Route } from 'lucide-react';
import { TooltipProvider } from '@dash/components/ui/tooltip';
import { GroupPage } from './parts/group-page';
import { useNav } from './parts/nav';
import { Overview } from './parts/overview';
import { Preferences } from './parts/preferences';
import { SettingsSearch } from './parts/search';
import { ErrorState, Forbidden, LabControls, OverviewSkeleton, Toast } from './parts/states';
import { SettingsProvider, useSettings, type Mode } from './parts/store';
import { Btn, Segmented } from './parts/ui';

export default function Page() {
  return (
    <SettingsProvider>
      <TooltipProvider delayDuration={200}>
        <Shell />
      </TooltipProvider>
    </SettingsProvider>
  );
}

function Shell() {
  const { state, dispatch } = useSettings();
  let body;
  if (state.role === 'none') body = <Forbidden />;
  else if (state.scenario === 'error') body = <ErrorState onRetry={() => dispatch({ type: 'scenario', scenario: 'default' })} />;
  else if (state.scenario === 'loading') body = <OverviewSkeleton />;
  else if (state.view === 'group' && state.group) body = <GroupPage key={state.group} groupKey={state.group} />;
  else if (state.view === 'preferences') body = <Preferences />;
  else body = <Overview />;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1180px] px-4 pt-6 pb-10 sm:px-6 lg:px-8 lg:pt-8">
        {state.view === 'overview' || state.role === 'none' || state.scenario !== 'default' && state.scenario !== 'empty' ? <TopBar /> : <SlimBar />}
        {body}
        <LabControls />
      </div>
      <Toast />
    </main>
  );
}

function TopBar() {
  const { state, dispatch, t } = useSettings();
  const nav = useNav();
  const disabled = state.role === 'none' || state.scenario === 'loading' || state.scenario === 'error';
  return (
    <header className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-26 font-extrabold leading-tight tracking-tight sm:text-32">{t.page.title}</h1>
          <p className="mt-1 max-w-[60ch] text-14 text-muted-foreground">{t.page.subtitle}</p>
        </div>
        {!disabled ? (
          <Btn variant="outline" onClick={nav.preferences} className="min-w-11 shrink-0 px-3 sm:px-4" aria-label={`${t.page.preferences}: ${t.page.preferencesHint}`}>
            <Palette aria-hidden />
            <span className="hidden sm:inline">{t.page.preferences}</span>
          </Btn>
        ) : null}
      </div>
      {!disabled ? (
        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
          <SettingsSearch className="min-w-0 flex-1" />
          <div className="flex flex-col gap-1">
            <Segmented<Mode>
              label={t.mode.label}
              value={state.mode}
              onChange={(mode) => dispatch({ type: 'mode', mode })}
              size="lg"
              stretch
              className="md:w-auto"
              options={[
                { value: 'setup', label: t.mode.setup, icon: <Route aria-hidden /> },
                { value: 'operate', label: t.mode.operate, icon: <LayoutGrid aria-hidden /> },
              ]}
            />
          </div>
        </div>
      ) : null}
      {!disabled ? (
        <p className="mt-2 text-12 text-muted-foreground md:text-end">{state.mode === 'setup' ? t.mode.setupHint : t.mode.operateHint}</p>
      ) : null}
    </header>
  );
}

function SlimBar() {
  return (
    <div className="mb-4 flex justify-end">
      <SettingsSearch className="w-full md:max-w-md" />
    </div>
  );
}
