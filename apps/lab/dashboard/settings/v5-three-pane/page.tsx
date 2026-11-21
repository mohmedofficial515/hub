import { useEffect, useRef } from 'react';
import { Dialog } from 'radix-ui';
import { TooltipProvider } from '@dash/components/ui/tooltip';
import { cn } from './parts/cn';
import { BackBtn, Crumbs, GroupEditor } from './parts/editor';
import { InspectorBody } from './parts/inspector';
import { Landing, SectionsList } from './parts/landing';
import { ListColumn, Results, SearchBox, useSettingsStatus } from './parts/list';
import { PreferencesEditor } from './parts/preferences';
import { Rail, RoleSwitch } from './parts/rail';
import { GuardDialog, ReviewDialog, Toast } from './parts/review';
import { EditorSkeleton, ListSkeleton, LoadError } from './parts/states';
import { StoreProvider, useStore } from './parts/store';
import { returnFocus, useBp } from './parts/ui';
import { SETTINGS_SECTIONS } from '@lab/mocks/settings';

export default function Page() {
  return (
    <TooltipProvider delayDuration={250}>
      <StoreProvider>
        <Explorer />
      </StoreProvider>
    </TooltipProvider>
  );
}

const typing = (el: Element | null) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable);

function Explorer() {
  const s = useStore();
  const bp = useBp();
  const { t, locale } = s;

  // Keyboard: "/" focuses search from anywhere; Esc closes the inline inspector.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dialogOpen = !!document.querySelector('[role="dialog"][data-state="open"]');
      if (e.key === '/' && !typing(document.activeElement) && !dialogOpen) {
        e.preventDefault();
        s.setPane(bp === 'sm' ? 'home' : 'list');
        requestAnimationFrame(() => requestAnimationFrame(() => s.searchRef.current?.focus()));
      }
      if (e.key === 'Escape' && !dialogOpen && bp === 'xl' && s.inspectorOpen && s.group && !typing(document.activeElement)) {
        s.setInspectorOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bp, s]);

  // Apply focus moves requested by navigation once the new pane has rendered.
  useEffect(() => {
    if (!s.focusReq) return;
    const sel = s.focusReq.sel;
    const attempt = () => {
      const active = document.activeElement;
      if (active && active !== document.body && active.matches(sel)) return;
      document.querySelector<HTMLElement>(sel)?.focus();
    };
    requestAnimationFrame(() => requestAnimationFrame(attempt));
    const late = window.setTimeout(attempt, 200);
    return () => window.clearTimeout(late);
  }, [s.focusReq]);

  const loading = s.scenario === 'loading';
  const failed = s.scenario === 'error';
  const hasEditor = !!(s.current || (s.section === 'prefs' && s.prefTab));

  const editor = failed ? (
    <LoadError />
  ) : loading ? (
    <EditorSkeleton />
  ) : s.current ? (
    <GroupEditor group={s.current} />
  ) : s.section === 'prefs' && s.prefTab ? (
    <PreferencesEditor tabId={s.prefTab} />
  ) : (
    <div className="h-full overflow-y-auto">
      <Landing />
    </div>
  );

  const sectionTitle = s.section === 'prefs' ? t.prefs.title : SETTINGS_SECTIONS.find((x) => x.id === s.section)?.title[locale];
  const list = loading ? (
    <ListSkeleton />
  ) : (
    <ListColumn
      header={
        bp === 'sm' ? (
          <div className="mb-2 flex items-center gap-2">
            <BackBtn label={t.editor.back} onClick={() => s.go({ section: null, pane: 'home' })} />
            <Crumbs items={[{ label: t.editor.breadcrumbRoot, onClick: () => s.go({ section: null, pane: 'home' }) }, ...(sectionTitle && !s.searching ? [{ label: sectionTitle }] : [])]} />
          </div>
        ) : null
      }
    />
  );

  let body;
  if (bp === 'sm') {
    body =
      s.pane === 'editor' && hasEditor ? (
        <main className="h-full min-w-0 flex-1">{editor}</main>
      ) : s.pane === 'list' || (s.pane !== 'home' && s.section) ? (
        <main className="h-full min-w-0 flex-1 bg-card">{list}</main>
      ) : (
        <main className="h-full min-w-0 flex-1 overflow-y-auto">
          <HomePane />
        </main>
      );
  } else {
    // 768: rail + editor; the groups list is a drawer over the editor so the form keeps the width.
    const drawer = bp === 'md';
    const closeDrawer = () => s.setPane(hasEditor ? 'editor' : 'home');
    body = (
      <>
        <Rail />
        {!drawer ? (
          <aside aria-label={sectionTitle ?? t.list.allGroups} className="h-full w-80 shrink-0 border-e bg-card lg:w-[19rem] xl:w-80">
            {list}
          </aside>
        ) : null}
        <main className="relative h-full min-w-0 flex-1">{editor}</main>
        {drawer && s.pane === 'list' ? (
          <div
            className="absolute inset-y-0 start-[4.25rem] end-0 z-20 flex"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                closeDrawer();
              }
            }}
          >
            <aside aria-label={sectionTitle ?? t.list.allGroups} className="h-full w-80 shrink-0 border-e bg-card shadow-2xl">
              {list}
            </aside>
            <button type="button" aria-label={t.list.close} onClick={closeDrawer} className="h-full flex-1 cursor-default bg-black/30 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" />
          </div>
        ) : null}
        {bp === 'xl' && s.current && s.inspectorOpen && !loading && !failed && !s.hidden(s.current.key) ? (
          <aside aria-label={t.inspector.title} className="h-full w-[22rem] shrink-0 border-s bg-card">
            <InspectorBody group={s.current} onClose={() => s.setInspectorOpen(false)} />
          </aside>
        ) : null}
      </>
    );
  }

  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-background text-foreground" data-bp={bp}>
      {body}
      <InspectorSheet />
      <ReviewDialog />
      <GuardDialog />
      <Toast />
    </div>
  );
}

function HomePane() {
  const s = useStore();
  const { t } = s;
  const st = useSettingsStatus();
  return (
    <div className="pb-8">
      <div className="sticky top-0 z-10 border-b bg-background/95 px-4 pb-3 pt-4 backdrop-blur">
        <h1 id="v5-home-title" tabIndex={-1} className="mb-2 text-22 font-extrabold outline-none">
          {t.title}
        </h1>
        <SearchBox autoFocusHint={false} />
        <p className="mt-2 text-12 text-muted-foreground">
          {t.landing.statusLine(st.groups, st.fields, st.changed)}
          {st.attention ? (
            <>
              {' · '}
              <span className="font-semibold text-warning-strong dark:text-warning">{t.landing.attentionCount(st.attention)}</span>
            </>
          ) : null}
        </p>
      </div>
      {s.searching ? (
        <Results />
      ) : (
        <>
          <div className="px-2 pt-3">
            <SectionsList />
          </div>
          <div className="mt-2 border-t">
            <Landing />
          </div>
          <div className="px-4">
            <RoleSwitch inline />
          </div>
        </>
      )}
    </div>
  );
}

/** Below 1280 px the inspector is a sheet: from the bottom on phones, from the end side on tablets. */
function InspectorSheet() {
  const s = useStore();
  const bp = useBp();
  const open = s.sheetOpen && bp !== 'xl' && !!s.current;
  const opener = useRef<Element | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={s.setSheetOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            opener.current = document.activeElement;
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocus(opener.current, '[data-act="history"]');
          }}
          className={cn(
            'fixed z-50 flex flex-col bg-card text-card-foreground shadow-2xl outline-none data-[state=open]:animate-in motion-reduce:animate-none',
            'inset-x-0 bottom-0 h-[82dvh] rounded-t-2xl data-[state=open]:slide-in-from-bottom-8',
            'md:inset-x-auto md:inset-y-0 md:end-0 md:h-full md:w-[24rem] md:rounded-none md:border-s md:ltr:data-[state=open]:slide-in-from-right-8 md:rtl:data-[state=open]:slide-in-from-left-8',
          )}
        >
          <Dialog.Title className="sr-only">{s.t.inspector.title}</Dialog.Title>
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border md:hidden" aria-hidden />
          {s.current ? <InspectorBody group={s.current} onClose={() => s.setSheetOpen(false)} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
