import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type DragEvent } from 'react';
import { ArrowRight, ChevronUp, Hand, MessageSquarePlus, Plus, SquareTerminal, X } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { DesktopSidebar } from '../../../today/v5-peacock-app/shell/sidebar';
import { Button, CardKey, CardPicker, cn, closeCard, fmt, focusRing, IconButton, Kbd, Ltr, counted, Segmented, showToast, Tooltip, useMedia, useRoute } from '../core/kit';
import { Composer, DevicePicker, FolderPicker, PersonaPicker, RunPickers } from '../core/composer';
import { useWorkContext } from '../core/context';
import { Header } from '../core/header';
import { AskButtons, ContextChips, DemoMenu, DoNext, EmptyChat, EngineNotice, HistoryList, RunIcon, RunsFootnote, RunsList, VsCodeButton, VsCodeDialog } from '../core/panels';
import { Resizer } from '../core/resizer';
import { ViewOutlet, useToggleKey, type ShellControls } from '../core/shell';
import { DockedSheet } from '../core/sheet';
import { approvalsPending, firstWaitingChat, newChat, openChat, pinCard, unpinCard, useRemembered, useWb } from '../core/store';
import { wbMessages } from '../core/strings';
import { Thread, useChatState } from '../core/thread';
import type { Chat } from '../core/mock';
import { messages } from '../i18n';

type SideTab = 'runs' | 'next' | 'history';
type PhoneTab = 'chat' | SideTab;

const BAR = 36;
const BAR_PHONE = 48;
const MIN_H = 240;
const DEFAULT_H = 372;
const MIN_SIDE = 260;
const DEFAULT_SIDE = 340;
const MAX_SIDE = 560;

const subscribeSize = (fn: () => void) => {
  window.addEventListener('resize', fn);
  return () => window.removeEventListener('resize', fn);
};
const useWindowHeight = () => useSyncExternalStore(subscribeSize, () => window.innerHeight);

const keyInDrag = (e: DragEvent) => {
  const data = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  return /GTV-\d+/.exec(data)?.[0] ?? null;
};

/** The console, closed: a status bar. It is the only place the panel takes when shut, and it keeps approvals and runs in view. */
function StatusBar({ onOpen, phone, onDropKey }: { onOpen: () => void; phone: boolean; onDropKey: (key: string) => void }) {
  const t = useT(wbMessages);
  const m = useT(messages);
  const locale = useLocale();
  const wb = useWb();
  const pending = approvalsPending(wb);
  const running = wb.runs.filter((r) => r.state === 'running');
  const scheduled = wb.runs.find((r) => r.state === 'next' || r.state === 'scheduled');
  const waiting = firstWaitingChat(wb);
  const bar = cn('inline-flex h-full min-w-0 items-center gap-1.5 px-2 text-body-sm transition-colors duration-120 hover:bg-accent', focusRing);
  return (
    <div
      role="group"
      aria-label={m.statusBar}
      data-wb-statusbar
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const key = keyInDrag(e);
        if (key) onDropKey(key);
      }}
      style={{ height: phone ? BAR_PHONE : BAR }}
      className="sticky bottom-0 z-30 flex shrink-0 items-stretch border-t border-border bg-(--sidebar) text-muted-foreground"
    >
      <button id="wb-toggle" type="button" data-wb-open aria-expanded={false} aria-keyshortcuts="Control+/ Meta+/" aria-label={m.open} onClick={onOpen} className={cn(bar, 'font-medium text-foreground')}>
        <SquareTerminal aria-hidden className="size-4" strokeWidth={1.75} />
        <span className="max-sm:sr-only">{t.claude}</span>
        <Kbd className="max-md:hidden">Ctrl /</Kbd>
      </button>
      {pending > 0 && (
        <button
          type="button"
          data-wb-bar-approval
          onClick={() => {
            if (waiting) openChat(waiting.id);
            onOpen();
          }}
          className={cn(bar, 'font-medium text-warning-strong')}
        >
          <Hand aria-hidden className="size-4 shrink-0" strokeWidth={2} />
          <span className="truncate">{counted(pending, locale, m.needs)}</span>
        </button>
      )}
      {running[0] && (
        <button
          type="button"
          data-wb-bar-run
          onClick={() => {
            if (running[0].chatId) openChat(running[0].chatId);
            onOpen();
          }}
          className={cn(bar, 'max-sm:hidden')}
        >
          <RunIcon state="running" />
          <span className="truncate">{running[0].title[locale]}</span>
          <span className="truncate max-lg:hidden">{running[0].step?.[locale]}</span>
        </button>
      )}
      {scheduled && <span className="inline-flex min-w-0 items-center px-2 text-body-sm max-xl:hidden"><span className="truncate">{fmt(m.nextAt, { title: scheduled.title[locale] })}</span></span>}
      <span className="flex-1" />
      <span className="inline-flex shrink-0 items-center gap-1.5 px-2 max-md:hidden">
        <Ltr mono className="text-body-sm">{wb.folder.split('/').pop()}</Ltr>
      </span>
      <button type="button" aria-label={m.open} onClick={onOpen} className={cn(bar, 'shrink-0')}>
        <ChevronUp aria-hidden className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function ChatTab({ chat, active }: { chat: Chat; active: boolean }) {
  const locale = useLocale();
  const state = useChatState(chat);
  return (
    <button
      type="button"
      data-wb-tab={chat.id}
      aria-current={active ? 'true' : undefined}
      onClick={() => openChat(chat.id)}
      title={state.label || chat.title[locale]}
      className={cn('inline-flex h-11 max-w-52 min-w-0 shrink-0 md:h-9 items-center gap-1.5 rounded-md px-2.5 text-body-sm transition-colors duration-120 hover:bg-accent', active ? 'bg-accent font-semibold text-foreground' : 'text-muted-foreground', focusRing)}
    >
      {state.tone === 'needs' && <RunIcon state="waiting" className="size-3.5" />}
      {state.tone === 'busy' && <RunIcon state="running" className="size-3.5" />}
      <span className="truncate">{chat.title[locale]}</span>
      {state.label && <span className="sr-only">{state.label}</span>}
    </button>
  );
}

/** The conversation is one column of the console, never wider than a line can be read. */
function Conversation({ focus, footerPickers }: { focus: boolean; footerPickers: boolean }) {
  const wb = useWb();
  const chat = wb.chats.find((c) => c.id === wb.activeId);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {chat ? <Thread chat={chat} measure="max-w-3xl" /> : <EmptyChat measure="max-w-3xl" />}
      <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-1.5 px-3 pb-2">
        <EngineNotice />
        <Composer autoFocus={focus} footer={footerPickers ? <RunPickers /> : undefined} />
      </div>
    </div>
  );
}

/** The tray: what travels with the next message. A card can be dragged here from anywhere on the page. */
function ContextTray() {
  const t = useT(wbMessages);
  const m = useT(messages);
  const wb = useWb();
  const ctx = useWorkContext();
  const [picking, setPicking] = useState(false);
  const target = wb.pinned[0] ?? ctx.cardKey;
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-3">
      <section aria-labelledby="wb-tray-context" className="flex flex-col gap-1.5">
        <h3 id="wb-tray-context" className="text-body-sm font-semibold text-muted-foreground">{t.context.label}</h3>
        <ContextChips />
        {wb.pinned.length > 0 && (
          <ul aria-label={t.context.pinned} data-wb-pins className="flex flex-wrap gap-1">
            {wb.pinned.map((key) => (
              <li key={key} className="inline-flex h-7 items-center gap-0.5 rounded-md bg-muted ps-2 pe-0.5">
                <CardKey k={key} link className="text-body-sm" />
                <button type="button" aria-label={fmt(m.removePin, { key })} onClick={() => unpinCard(key)} className={cn('flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground', focusRing)}>
                  <X aria-hidden className="size-3.5" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-1">
          {ctx.cardKey && !wb.pinned.includes(ctx.cardKey) && (
            <Button size="sm" variant="ghost" data-wb-pin-open onClick={() => pinCard(ctx.cardKey!)}>
              <Plus aria-hidden className="size-3.5" strokeWidth={1.75} />
              {fmt(m.addOpen, { key: ctx.cardKey })}
            </Button>
          )}
          <Button size="sm" variant="ghost" data-wb-pin-pick onClick={() => setPicking(true)}>
            <Plus aria-hidden className="size-3.5" strokeWidth={1.75} />
            {m.addCard}
          </Button>
        </div>
      </section>
      <section aria-labelledby="wb-tray-ask" className="flex flex-col gap-1.5">
        <h3 id="wb-tray-ask" className="text-body-sm font-semibold text-muted-foreground">{fmt(m.askAbout, { target: target ?? ctx.pageName })}</h3>
        <AskButtons cardKey={target} labels="short" />
      </section>
      <section aria-label={m.tray} className="-ms-1 flex flex-col items-start gap-0.5">
        <DevicePicker />
        <FolderPicker />
        <PersonaPicker />
      </section>
      <p className="text-body-sm text-muted-foreground">{t.context.dragHint}</p>
      <CardPicker open={picking} onOpenChange={setPicking} title={m.pinTitle} confirmLabel={m.pinConfirm} value={wb.pinned} onConfirm={(keys) => keys.forEach(pinCard)} />
    </div>
  );
}

function SideColumn({ tab, onTab, onOpenChat }: { tab: SideTab; onTab: (t: SideTab) => void; onOpenChat: (id: string) => void }) {
  const t = useT(wbMessages);
  const m = useT(messages);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 p-2">
        <Segmented
          label={m.side}
          value={tab}
          onChange={(v) => onTab(v as SideTab)}
          options={[
            { value: 'runs', label: t.runs },
            { value: 'next', label: t.next.title },
            { value: 'history', label: t.history },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {tab === 'runs' && (
          <div className="flex flex-col gap-3">
            <RunsList compact onOpenChat={onOpenChat} />
            <RunsFootnote />
          </div>
        )}
        {tab === 'next' && <DoNext limit={4} onRan={() => onTab('runs')} />}
        {tab === 'history' && <HistoryList />}
      </div>
    </div>
  );
}

export function FloorConsoleLayout({ controls, ready }: { controls: ShellControls; ready: boolean }) {
  const t = useT(wbMessages);
  const m = useT(messages);
  const wb = useWb();
  const { cardKey } = useRoute();
  const phone = !useMedia('(min-width: 768px)');
  const wide = useMedia('(min-width: 1180px)');
  const vh = useWindowHeight();
  const [open, setOpenRaw] = useRemembered('open', true);
  const [height, setHeight] = useRemembered('height', DEFAULT_H);
  const [sideWidth, setSideWidth] = useRemembered('side-width', DEFAULT_SIDE);
  const [sideTab, setSideTab] = useState<SideTab>('runs');
  const [phoneTab, setPhoneTab] = useState<PhoneTab>('chat');
  const [phoneFront, setPhoneFront] = useState<'chat' | 'card'>('chat');
  const [dragging, setDragging] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [vscode, setVscode] = useState(false);
  const [focusComposer, setFocusComposer] = useState(false);
  const lastFocus = useRef<HTMLElement | null>(null);

  const maxH = Math.max(MIN_H, vh - 160);
  const consoleH = Math.max(MIN_H, Math.min(height, maxH));
  const floor = phone ? (open ? 0 : BAR_PHONE) : open ? consoleH + 8 : BAR;

  useEffect(() => setPhoneFront(cardKey ? 'card' : 'chat'), [cardKey]);

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
          else document.getElementById('wb-toggle')?.focus();
        }, 0);
      }
    },
    [setOpenRaw],
  );
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);
  useToggleKey(toggle);

  useEffect(() => {
    const root = document.getElementById('hub-root');
    if (!root) return;
    root.style.setProperty('--wb-toast-bottom', `${floor}px`);
    root.style.setProperty('--wb-toast-end', '0px');
    root.style.setProperty('--wb-toast-bottom-phone', phone ? (open ? '10rem' : `${BAR_PHONE}px`) : '0px');
  }, [floor, phone, open]);

  const openChatHere = (id: string) => {
    openChat(id);
    setPhoneTab('chat');
    setPhoneFront('chat');
    if (!open) setOpen(true);
  };

  const dropKey = (key: string) => {
    pinCard(key);
    showToast({ message: fmt(m.pinned, { key }) });
    if (!open) setOpen(true);
  };

  const tabs = wb.chats.filter((c) => !c.deleted).slice(0, phone ? 3 : 6);
  const activeChat = wb.chats.find((c) => c.id === wb.activeId);
  if (activeChat && !tabs.includes(activeChat)) tabs[tabs.length - 1] = activeChat;

  return (
    <div className="flex min-h-dvh" data-wb-dragging={dragging}>
      <DesktopSidebar onShortcuts={controls.openHelp} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col" data-wb-page-narrow={!!cardKey}>
            <Header onOpenNav={controls.openNav} onOpenPalette={controls.openPalette} onNewCard={controls.openNew} onShortcuts={controls.openHelp} compact={!!cardKey && !phone} />
            <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
              <ViewOutlet />
            </main>
          </div>
          {ready && cardKey && (
            <div
              data-wb-sheet-pane
              style={!phone ? { height: `calc(100dvh - ${floor}px)` } : undefined}
              className={cn(!phone && 'sticky top-0 w-[min(32rem,55%)] shrink-0 overflow-hidden border-s border-border', phone && 'fixed inset-0 z-50', phone && open && phoneFront === 'chat' && 'hidden')}
            >
              <DockedSheet
                className="h-full w-full"
                onAsk={() => {
                  if (!open) setOpen(true);
                  setPhoneFront('chat');
                  setPhoneTab('chat');
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
        </div>

        {!open && <StatusBar onOpen={() => setOpen(true)} phone={phone} onDropKey={dropKey} />}

        {open && (
          <section
            aria-label={m.console}
            data-wb-console
            data-wb-panel
            onDragOver={(e) => {
              e.preventDefault();
              setDropping(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDropping(false);
              const key = keyInDrag(e);
              if (key) dropKey(key);
            }}
            style={phone ? undefined : { height: consoleH + 8 }}
            className={cn('flex min-w-0 flex-col bg-background', phone ? 'fixed inset-0 z-45' : 'sticky bottom-0 z-30 shrink-0 border-t border-border')}
          >
            {!phone && <Resizer axis="y" value={consoleH} min={MIN_H} max={maxH} fallback={DEFAULT_H} onChange={setHeight} onDragging={setDragging} label={t.resize} hint={t.resizeHint} className="w-full" />}
            <div className={cn('flex shrink-0 items-center gap-1 border-b border-border px-2', phone ? 'py-1' : 'pb-1')}>
              <SquareTerminal aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <nav aria-label={m.tabs} className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
                {tabs.map((c) => (
                  <ChatTab key={c.id} chat={c} active={c.id === wb.activeId} />
                ))}
              </nav>
              <IconButton label={t.newChat} data-wb-new onClick={() => { newChat(); setPhoneTab('chat'); }}>
                <MessageSquarePlus aria-hidden className="size-4" strokeWidth={1.75} />
              </IconButton>
              <VsCodeButton short onClick={() => setVscode(true)} />
              <DemoMenu side="top" onAct={() => setPhoneTab('chat')} />
              <Tooltip side="top" content={<span className="inline-flex items-center gap-2">{t.close} <Kbd>Ctrl /</Kbd></span>}>
                <IconButton label={t.close} data-wb-close aria-keyshortcuts="Control+/ Meta+/" onClick={() => setOpen(false)}>
                  <X aria-hidden className="size-4" strokeWidth={1.75} />
                </IconButton>
              </Tooltip>
            </div>

            {phone ? (
              <>
                <div className="shrink-0 p-1">
                  <Segmented
                    label={m.side}
                    value={phoneTab}
                    onChange={(v) => setPhoneTab(v as PhoneTab)}
                    options={[
                      { value: 'chat', label: t.chat },
                      { value: 'runs', label: t.runs },
                      { value: 'next', label: t.next.title },
                      { value: 'history', label: t.history },
                    ]}
                  />
                </div>
                {cardKey && (
                  <div className="flex shrink-0 items-center justify-end border-b border-border px-2">
                    <Button size="sm" variant="ghost" data-wb-phone-tocard onClick={() => setPhoneFront('card')}>{t.toCard}</Button>
                    <IconButton label={t.close} onClick={closeCard}><X aria-hidden className="size-4" strokeWidth={1.75} /></IconButton>
                  </div>
                )}
                {phoneTab === 'chat' ? (
                  <>
                    <div className="flex shrink-0 flex-col gap-1.5 px-3 py-2">
                      <ContextChips />
                      {wb.engine === 'ok' && <AskButtons labels="short" />}
                    </div>
                    <Conversation focus={focusComposer} footerPickers />
                  </>
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    {phoneTab === 'runs' && (
                      <div className="flex flex-col gap-3">
                        <RunsList compact onOpenChat={openChatHere} />
                        <RunsFootnote />
                      </div>
                    )}
                    {phoneTab === 'next' && <DoNext limit={4} onRan={() => setPhoneTab('runs')} />}
                    {phoneTab === 'history' && <HistoryList onOpen={() => setPhoneTab('chat')} />}
                  </div>
                )}
              </>
            ) : (
              <div className="flex min-h-0 flex-1">
                {wide && (
                  <aside data-wb-tray aria-label={m.tray} className={cn('flex w-60 shrink-0 flex-col border-e border-border', dropping && 'bg-accent')}>
                    <ContextTray />
                  </aside>
                )}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  {!wide && (
                    <div className="flex shrink-0 flex-col gap-1.5 px-3 py-2">
                      <ContextChips />
                      {wb.engine === 'ok' && <AskButtons labels="short" />}
                    </div>
                  )}
                  <Conversation focus={focusComposer} footerPickers={!wide} />
                </div>
                <Resizer axis="x" value={sideWidth} min={MIN_SIDE} max={MAX_SIDE} fallback={DEFAULT_SIDE} onChange={setSideWidth} onDragging={setDragging} label={t.resizeRuns} hint={t.resizeHint} className="border-s border-border" />
                <aside data-wb-side aria-label={m.side} style={{ width: sideWidth }} className="shrink-0">
                  <SideColumn tab={sideTab} onTab={setSideTab} onOpenChat={openChatHere} />
                </aside>
              </div>
            )}
            <VsCodeDialog open={vscode} onOpenChange={setVscode} />
          </section>
        )}
      </div>
    </div>
  );
}
