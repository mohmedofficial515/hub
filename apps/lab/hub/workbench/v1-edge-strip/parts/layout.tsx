import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRight, Hand, History, ListChecks, MessagesSquare, Plus, SquareTerminal, X } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { DesktopSidebar } from '../../../today/v5-peacock-app/shell/sidebar';
import { Button, cn, closeCard, fmt, focusRing, IconButton, Kbd, counted, Segmented, Tooltip, useMedia, useRoute } from '../core/kit';
import { Composer, RunPickers } from '../core/composer';
import { Header } from '../core/header';
import { AskButtons, ContextChips, DemoMenu, DoNext, EmptyChat, EngineNotice, HistoryList, RunIcon, RunsFootnote, RunsList, VsCodeButton, VsCodeDialog } from '../core/panels';
import { Resizer } from '../core/resizer';
import { useFoldSidebar, ViewOutlet, useToggleKey, type ShellControls } from '../core/shell';
import { DockedSheet } from '../core/sheet';
import { approvalsPending, firstWaitingChat, newChat, openChat, useRemembered, useWb } from '../core/store';
import { wbMessages } from '../core/strings';
import { Thread, useChatState } from '../core/thread';
import { messages } from '../i18n';

type PanelView = 'chat' | 'history' | 'runs';

const STRIP = 52;
const MIN_PANEL = 340;
const DEFAULT_PANEL = 440;
const MIN_PAGE = 340;
const SHEET_BESIDE = 460;

const subscribeWidth = (fn: () => void) => {
  window.addEventListener('resize', fn);
  return () => window.removeEventListener('resize', fn);
};
const useWindowWidth = () => useSyncExternalStore(subscribeWidth, () => document.getElementById('hub-root')?.clientWidth ?? window.innerWidth);

/** The always-there strip at the page edge. The panel opens from it and closes back into it, so a waiting approval never goes out of sight. */
function Strip({ open, view, onToggle, onView, onOpenChat }: { open: boolean; view: PanelView; onToggle: () => void; onView: (v: PanelView) => void; onOpenChat: (id: string) => void }) {
  const t = useT(wbMessages);
  const m = useT(messages);
  const locale = useLocale();
  const wb = useWb();
  const pending = approvalsPending(wb);
  const live = wb.runs.filter((r) => r.state === 'waiting' || r.state === 'running');
  const views: { id: PanelView; icon: typeof History; label: string }[] = [
    { id: 'chat', icon: MessagesSquare, label: t.chat },
    { id: 'history', icon: History, label: t.history },
    { id: 'runs', icon: ListChecks, label: t.runs },
  ];
  return (
    <nav aria-label={m.strip} data-wb-strip style={{ width: STRIP }} className="sticky top-0 flex h-dvh shrink-0 flex-col items-center gap-1 border-s border-border bg-(--sidebar) py-2">
      <Tooltip
        side="left"
        content={
          <span className="inline-flex items-center gap-2">
            {t.toggle} <Kbd>Ctrl /</Kbd>
          </span>
        }
      >
        <button
          id="wb-toggle"
          type="button"
          aria-label={pending ? `${t.toggle}. ${counted(pending, locale, m.needs)}` : t.toggle}
          aria-expanded={open}
          aria-keyshortcuts="Control+/ Meta+/"
          onClick={onToggle}
          className={cn('relative flex size-9 items-center justify-center rounded-md transition-colors duration-120 hover:bg-accent', open && 'bg-accent', focusRing)}
        >
          <SquareTerminal aria-hidden className="size-5 text-foreground" strokeWidth={1.75} />
        </button>
      </Tooltip>
      <div className="my-1 h-px w-6 bg-border" />
      {views.map(({ id, icon: Icon, label }) => (
        <Tooltip key={id} side="left" content={label}>
          <button
            type="button"
            aria-label={label}
            aria-pressed={open && view === id}
            data-wb-view={id}
            onClick={() => onView(id)}
            className={cn('flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-120 hover:bg-accent hover:text-foreground', open && view === id && 'bg-accent text-foreground', focusRing)}
          >
            <Icon aria-hidden className="size-4.5" strokeWidth={1.75} />
          </button>
        </Tooltip>
      ))}
      <div className="my-1 h-px w-6 bg-border" />
      {/* Live runs, always visible. Words are in the name and the tooltip, so state is never colour or shape alone. */}
      <ul className="flex flex-col items-center gap-1">
        {live.map((r) => (
          <li key={r.id}>
            <Tooltip side="left" content={`${r.title[locale]}: ${t.runsPanel.states[r.state]}`}>
              <button
                type="button"
                data-wb-strip-run={r.state}
                aria-label={`${fmt(m.runOpen, { title: r.title[locale] })}. ${t.runsPanel.states[r.state]}`}
                onClick={() => r.chatId && onOpenChat(r.chatId)}
                className={cn('flex size-9 items-center justify-center rounded-md transition-colors duration-120 hover:bg-accent', focusRing)}
              >
                <RunIcon state={r.state} />
              </button>
            </Tooltip>
          </li>
        ))}
      </ul>
      {pending > 0 && (
        <span data-wb-pending className="mt-1 flex min-w-5 items-center justify-center gap-0.5 rounded-full bg-warning-soft px-1 text-caption font-bold text-warning-soft-foreground tabular-nums">
          <Hand aria-hidden className="size-3" strokeWidth={2} />
          {pending}
        </span>
      )}
    </nav>
  );
}

/** What fills the panel: the chat, the history or the runs. */
function ChatView({ focusOnMount }: { focusOnMount: boolean }) {
  const wb = useWb();
  const t = useT(wbMessages);
  const chat = wb.chats.find((c) => c.id === wb.activeId);
  return (
    <>
      {chat ? <Thread chat={chat} /> : <EmptyChat />}
      <div className="flex shrink-0 flex-col gap-2 border-t border-border p-3">
        <EngineNotice />
        <div className="flex flex-col gap-1.5">
          <ContextChips />
          {chat && wb.engine === 'ok' && <AskButtons />}
        </div>
        <Composer footer={<RunPickers />} autoFocus={focusOnMount} />
        <span className="sr-only">{t.composer.hint}</span>
      </div>
    </>
  );
}

function PanelHeader({ view, phone, onClose, onVsCode, onView }: { view: PanelView; phone: boolean; onClose: () => void; onVsCode: () => void; onView: (v: PanelView) => void }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const chat = wb.chats.find((c) => c.id === wb.activeId);
  const state = useChatStateSafe(chat);
  const title = view === 'history' ? t.historyPanel.title : view === 'runs' ? t.runsPanel.title : chat ? chat.title[locale] : t.newChat;
  return (
    <header className="flex shrink-0 flex-col gap-1 border-b border-border p-2">
      <div className="flex min-w-0 items-center gap-1">
        <div className="min-w-0 flex-1 px-1">
          <h2 data-wb-title className="truncate text-body-lg font-semibold text-foreground">
            {title}
          </h2>
          {view === 'chat' && state && <p className="truncate text-body-sm text-muted-foreground">{state}</p>}
        </div>
        <IconButton label={t.newChat} data-wb-new onClick={() => { newChat(); onView('chat'); }}>
          <Plus aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
        {view === 'chat' && <VsCodeButton short onClick={onVsCode} />}
        <DemoMenu side="bottom" onAct={() => onView('chat')} />
        <Tooltip side="bottom" content={<span className="inline-flex items-center gap-2">{t.close} <Kbd>Ctrl /</Kbd></span>}>
          <IconButton label={t.close} data-wb-close aria-keyshortcuts="Control+/ Meta+/" onClick={onClose}>
            <X aria-hidden className="size-4" strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      </div>
      {phone && (
        <Segmented
          label={t.panelLabel}
          value={view}
          onChange={(v) => onView(v as PanelView)}
          options={[
            { value: 'chat', label: t.chat },
            { value: 'history', label: t.history },
            { value: 'runs', label: t.runs },
          ]}
        />
      )}
    </header>
  );
}

function useChatStateSafe(chat: ReturnType<typeof useWb>['chats'][number] | undefined) {
  const fake = { id: '', items: [], status: 'idle' } as unknown as NonNullable<typeof chat>;
  const s = useChatState(chat ?? fake);
  return s.label;
}

export function EdgeStripLayout({ controls, ready }: { controls: ShellControls; ready: boolean }) {
  const t = useT(wbMessages);
  const m = useT(messages);
  const wb = useWb();
  const locale = useLocale();
  const { cardKey } = useRoute();
  const phone = !useMedia('(min-width: 768px)');
  const desktop = useMedia('(min-width: 1024px)');
  const vw = useWindowWidth();
  const [open, setOpenRaw] = useRemembered('open', true);
  const [width, setWidth] = useRemembered('width', DEFAULT_PANEL);
  const [view, setView] = useState<PanelView>('chat');
  const [dragging, setDragging] = useState(false);
  const [vscode, setVscode] = useState(false);
  const [focusComposer, setFocusComposer] = useState(false);
  const [phoneFront, setPhoneFront] = useState<'chat' | 'card'>('chat');
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (cardKey) setPhoneFront('card');
    else setPhoneFront('chat');
  }, [cardKey]);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenRaw(next);
      if (next) {
        lastFocus.current = document.activeElement as HTMLElement | null;
        setFocusComposer(true);
      } else {
        const back = lastFocus.current;
        window.setTimeout(() => {
          if (back?.isConnected && back !== document.body) back.focus();
          else (document.getElementById('wb-toggle') ?? document.getElementById('main'))?.focus();
        }, 0);
      }
    },
    [setOpenRaw],
  );
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);
  useToggleKey(toggle);

  // Both panes open: the sidebar folds to icons so the page keeps a readable column, and comes back when one closes.
  const both = open && !!cardKey && desktop;
  const pref = useFoldSidebar(both);

  const sidebarW = desktop ? (pref ?? !(vw >= 1280) ? 56 : 248) : 0;
  const available = vw - sidebarW - STRIP;
  const beside = cardKey ? Math.min(SHEET_BESIDE, available - MIN_PANEL) : 0;
  const maxPanel = Math.max(MIN_PANEL, available - (cardKey ? Math.max(beside, 300) : MIN_PAGE));
  const panel = Math.max(MIN_PANEL, Math.min(width, maxPanel));
  const pageRoom = available - (open ? panel + 8 : 0) - (cardKey ? (open ? beside : 560) : 0);
  const pageHidden = !phone && !!cardKey && pageRoom < 300;
  const narrow = pageRoom < 960;

  // An Undo toast stays clear of the composer.
  useEffect(() => {
    const root = document.getElementById('hub-root');
    if (!root) return;
    root.style.setProperty('--wb-toast-end', phone ? '0px' : `${STRIP + (open ? panel + 8 : 0)}px`);
    root.style.setProperty('--wb-toast-bottom-phone', phone && open ? '10rem' : '0px');
  }, [phone, open, panel]);

  const openChatHere = (id: string) => {
    openChat(id);
    setView('chat');
    if (!open) setOpen(true);
    if (phone) setPhoneFront('chat');
  };
  const pickView = (v: PanelView) => {
    if (open && view === v) return setOpen(false);
    setView(v);
    if (!open) setOpen(true);
  };

  const pending = approvalsPending(wb);
  const phoneButton = phone && (
    <button
      type="button"
      id="wb-toggle"
      data-wb-phone-toggle
      aria-label={pending ? `${t.toggle}. ${counted(pending, locale, m.needs)}` : t.toggle}
      aria-expanded={open}
      onClick={() => {
        const waiting = firstWaitingChat(wb);
        if (!open && waiting) openChat(waiting.id);
        toggle();
      }}
      className={cn('relative flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-accent', focusRing)}
    >
      <SquareTerminal aria-hidden className="size-5 text-foreground" strokeWidth={1.75} />
      {pending > 0 && <span className="absolute end-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-warning-soft px-1 text-caption font-bold text-warning-soft-foreground tabular-nums">{pending}</span>}
    </button>
  );

  return (
    <div className="flex min-h-dvh" data-wb-dragging={dragging}>
      <DesktopSidebar onShortcuts={controls.openHelp} />
      <div className={cn('flex min-w-0 flex-1 flex-col', pageHidden && 'hidden')} data-wb-page-narrow={narrow}>
        <Header onOpenNav={controls.openNav} onOpenPalette={controls.openPalette} onNewCard={controls.openNew} onShortcuts={controls.openHelp} extra={phoneButton} compact={!phone && pageRoom < 720} />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <ViewOutlet />
        </main>
      </div>

      {ready && cardKey && (
        <div
          data-wb-sheet-pane
          style={!phone ? { width: pageHidden ? undefined : open ? beside : 560 } : undefined}
          className={cn(
            !phone && 'sticky top-0 h-dvh shrink-0 overflow-hidden border-s border-border',
            !phone && pageHidden && 'min-w-0 flex-1',
            phone && 'fixed inset-0 z-50',
            phone && open && phoneFront === 'chat' && 'hidden',
          )}
        >
          <DockedSheet
            className="h-full w-full"
            onAsk={() => {
              if (!open) setOpen(true);
              setView('chat');
              if (phone) setPhoneFront('chat');
            }}
            topBar={
              phone && open ? (
                <div className="flex shrink-0 items-center border-b border-border p-1">
                  <Button variant="ghost" data-wb-phone-tochat onClick={() => setPhoneFront('chat')}>
                    <ArrowRight aria-hidden className="size-4 ltr:-scale-x-100" strokeWidth={1.75} />
                    {t.backToChat}
                  </Button>
                </div>
              ) : undefined
            }
          />
        </div>
      )}

      {open && !phone && (
        <Resizer axis="x" value={panel} min={MIN_PANEL} max={maxPanel} fallback={DEFAULT_PANEL} onChange={setWidth} onDragging={setDragging} label={t.resize} hint={t.resizeHint} className="sticky top-0 h-dvh border-s border-border bg-background" />
      )}

      {open && (
        <section
          aria-label={t.panelLabel}
          data-wb-panel
          style={phone ? undefined : { width: panel }}
          className={cn('flex flex-col bg-background', phone ? 'fixed inset-0 z-45 w-full' : 'sticky top-0 h-dvh shrink-0')}
        >
          <PanelHeader view={view} phone={phone} onClose={() => setOpen(false)} onVsCode={() => setVscode(true)} onView={setView} />
          {phone && cardKey && (
            <div className="flex shrink-0 items-center justify-end border-b border-border px-2 py-1">
              <Button size="sm" variant="ghost" data-wb-phone-tocard onClick={() => setPhoneFront('card')}>
                {t.toCard}
              </Button>
              <IconButton label={t.close} onClick={closeCard}>
                <X aria-hidden className="size-4" strokeWidth={1.75} />
              </IconButton>
            </div>
          )}
          {view === 'chat' && <ChatView focusOnMount={focusComposer} />}
          {view === 'history' && (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <HistoryList onOpen={() => setView('chat')} />
            </div>
          )}
          {view === 'runs' && (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
              <RunsList onOpenChat={openChatHere} />
              <DoNext />
              <RunsFootnote />
            </div>
          )}
          <VsCodeDialog open={vscode} onOpenChange={setVscode} />
        </section>
      )}

      {!phone && <Strip open={open} view={view} onToggle={toggle} onView={pickView} onOpenChat={openChatHere} />}
      {pageHidden && <span className="sr-only">{m.pageHidden}</span>}
    </div>
  );
}

