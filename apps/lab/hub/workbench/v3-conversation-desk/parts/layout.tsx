import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Hand, LogOut, PanelRightClose, PanelRightOpen, Pin, PinOff, SquareTerminal } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { DesktopSidebar } from '../../../today/v5-peacock-app/shell/sidebar';
import { views } from '../../../today/v5-peacock-app/shell/views';
import { messages as shellMessages } from '../../../today/v5-peacock-app/i18n';
import { cn, counted, focusRing, IconButton, Kbd, Ltr, navigate, openCard, Segmented, Select, Tooltip, useMedia, useRoute } from '../core/kit';
import { Composer, RunPickers } from '../core/composer';
import { Header } from '../core/header';
import { AskButtons, ContextChips, DemoMenu, EmptyChat, EngineNotice, VsCodeButton, VsCodeDialog } from '../core/panels';
import { Resizer } from '../core/resizer';
import { useFoldSidebar, ViewOutlet, useToggleKey, type ShellControls } from '../core/shell';
import { DockedSheet } from '../core/sheet';
import { approvalsPending, firstWaitingChat, openChat, useRemembered, useWb } from '../core/store';
import { wbMessages } from '../core/strings';
import { Thread, useChatState } from '../core/thread';
import { messages } from '../i18n';
import { River } from './river';

type DeskPane = 'chat' | 'river' | 'work';

const DEFAULT_STAGE = 560;
const MIN_STAGE = 340;
const MIN_CONVERSATION = 400;
const RIVER = 280;

const subscribeWidth = (fn: () => void) => {
  window.addEventListener('resize', fn);
  return () => window.removeEventListener('resize', fn);
};
const useWindowWidth = () => useSyncExternalStore(subscribeWidth, () => document.getElementById('hub-root')?.clientWidth ?? window.innerWidth);

/** The centre of the desk: the conversation at reading width, with room to breathe. */
function Conversation({ focus, onExit, stageShown, onToggleStage, showStageToggle }: { focus: boolean; onExit: () => void; stageShown: boolean; onToggleStage: () => void; showStageToggle: boolean }) {
  const t = useT(wbMessages);
  const m = useT(messages);
  const locale = useLocale();
  const wb = useWb();
  const chat = wb.chats.find((c) => c.id === wb.activeId);
  const fake = { id: '', items: [], status: 'idle' } as unknown as NonNullable<typeof chat>;
  const state = useChatState(chat ?? fake);
  const [vscode, setVscode] = useState(false);
  return (
    <section aria-label={m.desk} data-wb-panel data-wb-conversation className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-1 border-b border-border p-2">
        <div className="min-w-0 flex-1 px-2">
          <h1 data-wb-title className="truncate text-title-sm font-semibold text-foreground">
            {chat ? chat.title[locale] : t.newChat}
          </h1>
          {state.label && <p className="truncate text-body-sm text-muted-foreground">{state.label}</p>}
        </div>
        <VsCodeButton short onClick={() => setVscode(true)} />
        <DemoMenu side="bottom" />
        {showStageToggle && (
          <IconButton label={stageShown ? m.hideStage : m.showStage} data-wb-stage-toggle aria-pressed={stageShown} onClick={onToggleStage}>
            {stageShown ? <PanelRightClose aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={1.75} /> : <PanelRightOpen aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />}
          </IconButton>
        )}
        <Tooltip side="bottom" content={<span className="inline-flex items-center gap-2">{m.exit} <Kbd>Ctrl /</Kbd></span>}>
          <IconButton label={m.exit} data-wb-close aria-keyshortcuts="Control+/ Meta+/" onClick={onExit}>
            <LogOut aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      </header>
      {chat ? <Thread chat={chat} measure="max-w-2xl" /> : <EmptyChat measure="max-w-2xl" />}
      <div className="mx-auto flex w-full max-w-2xl shrink-0 flex-col gap-2 p-3">
        <EngineNotice />
        <div className="flex flex-col gap-1.5">
          <ContextChips />
          {chat && wb.engine === 'ok' && <AskButtons />}
        </div>
        <Composer footer={<RunPickers />} autoFocus={focus} rows={2} />
      </div>
      <VsCodeDialog open={vscode} onOpenChange={setVscode} />
    </section>
  );
}

/** The stage: Hub's real page and the real card sheet, side by side when there is room and one at a time when there is not. Nothing here is an overlay. */
function Stage({ follow, onFollow, width, phone }: { follow: boolean; onFollow: (v: boolean) => void; width: number; phone: boolean }) {
  const m = useT(messages);
  const shell = useT(shellMessages);
  const { view, cardKey } = useRoute();
  const [tab, setTab] = useState<'page' | 'card'>('page');
  useEffect(() => setTab(cardKey ? 'card' : 'page'), [cardKey]);
  const split = !!cardKey && width >= 920;
  const showPage = !cardKey || split || tab === 'page';
  const showCard = !!cardKey && (split || tab === 'card');
  return (
    <section aria-label={m.stage} data-wb-stage className="flex h-full min-h-0 min-w-0 flex-col bg-background" data-wb-page-narrow="true">
      <div className="flex shrink-0 items-center gap-1 border-b border-border p-2">
        <label className="sr-only" htmlFor="wb-stage-view">{m.goTo}</label>
        <Select id="wb-stage-view" data-wb-stage-view className="h-11 w-auto min-w-0 md:h-9" value={view} onChange={(e) => navigate(e.target.value as typeof view)}>
          {views.map((v) => (
            <option key={v.id} value={v.id}>{shell.nav[v.id]}</option>
          ))}
        </Select>
        {cardKey && !split && (
          <div role="group" aria-label={m.stageTabs} className="flex items-center gap-0.5">
            <button type="button" aria-pressed={tab === 'page'} data-wb-stage-page onClick={() => setTab('page')} className={cn('h-11 rounded-md px-2.5 text-body-sm md:h-9', tab === 'page' ? 'bg-accent font-semibold text-foreground' : 'text-muted-foreground hover:bg-accent', focusRing)}>
              {m.goTo}
            </button>
            <button type="button" aria-pressed={tab === 'card'} data-wb-stage-card onClick={() => setTab('card')} className={cn('h-11 rounded-md px-2.5 text-body-sm md:h-9', tab === 'card' ? 'bg-accent font-semibold text-foreground' : 'text-muted-foreground hover:bg-accent', focusRing)}>
              <Ltr mono className="text-body-sm">{cardKey}</Ltr>
            </button>
          </div>
        )}
        <span className="flex-1" />
        <Tooltip side="bottom" content={m.followHint}>
          <button type="button" data-wb-follow aria-pressed={follow} onClick={() => onFollow(!follow)} className={cn('inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-body-sm text-muted-foreground hover:bg-accent hover:text-foreground md:h-9', follow && 'text-foreground', focusRing)}>
            {follow ? <Pin aria-hidden className="size-4" strokeWidth={1.75} /> : <PinOff aria-hidden className="size-4" strokeWidth={1.75} />}
            <span className="max-lg:sr-only">{m.follow}</span>
          </button>
        </Tooltip>
      </div>
      <div className="flex min-h-0 flex-1">
        <main id="main" tabIndex={-1} className={cn('relative min-w-0 flex-1 overflow-y-auto outline-none', !showPage && 'hidden')}>
          <ViewOutlet />
        </main>
        {showCard && (
          <div data-wb-sheet-pane className={cn('h-full min-w-0 overflow-hidden', split ? 'w-[46%] shrink-0 border-s border-border' : 'flex-1')}>
            <DockedSheet className="h-full w-full" />
          </div>
        )}
      </div>
    </section>
  );
}

/** With the desk closed, Hub is the normal app, and this one button says what is waiting. */
function EnterButton({ onEnter }: { onEnter: () => void }) {
  const m = useT(messages);
  const locale = useLocale();
  const wb = useWb();
  const pending = approvalsPending(wb);
  return (
    <Tooltip side="bottom" content={<span className="inline-flex items-center gap-2">{m.enterLabel} <Kbd>Ctrl /</Kbd></span>}>
      <button type="button" id="wb-toggle" data-wb-enter aria-keyshortcuts="Control+/ Meta+/" onClick={onEnter} className={cn('inline-flex h-11 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-body-sm font-medium text-foreground hover:bg-accent md:h-9', focusRing)}>
        <SquareTerminal aria-hidden className="size-4" strokeWidth={1.75} />
        <span className="max-md:sr-only">{m.enter}</span>
        {pending > 0 && (
          <span title={counted(pending, locale, m.needs)} className="inline-flex items-center gap-0.5 text-warning-strong">
            <Hand aria-hidden className="size-3.5" strokeWidth={2} />
            <span aria-hidden>{pending}</span>
            <span className="sr-only">{counted(pending, locale, m.needs)}</span>
          </span>
        )}
      </button>
    </Tooltip>
  );
}

export function ConversationDeskLayout({ controls, ready }: { controls: ShellControls; ready: boolean }) {
  const t = useT(wbMessages);
  const m = useT(messages);
  const wb = useWb();
  const { cardKey } = useRoute();
  const phone = !useMedia('(min-width: 768px)');
  const hasRiver = useMedia('(min-width: 1180px)');
  const vw = useWindowWidth();
  const [desk, setDeskRaw] = useRemembered('desk', true);
  const [stageWidth, setStageWidth] = useRemembered('stage-width', DEFAULT_STAGE);
  const [stageShown, setStageShown] = useRemembered('stage-shown', true);
  const [follow, setFollow] = useRemembered('follow', true);
  const [pane, setPane] = useState<DeskPane>('chat');
  const [dragging, setDragging] = useState(false);
  const [focusComposer, setFocusComposer] = useState(false);
  const lastFocus = useRef<HTMLElement | null>(null);

  const setDesk = useCallback(
    (next: boolean) => {
      setDeskRaw(next);
      if (next) {
        lastFocus.current = document.activeElement as HTMLElement | null;
        setFocusComposer(true);
      } else {
        window.setTimeout(() => document.getElementById('wb-toggle')?.focus(), 0);
      }
    },
    [setDeskRaw],
  );
  const toggle = useCallback(() => setDesk(!desk), [desk, setDesk]);
  useToggleKey(toggle);
  useFoldSidebar(desk && !phone);

  // The signature: open a chat about a card and the card comes to the stage. The owner can turn it off.
  const openChatHere = (id: string) => {
    openChat(id);
    setPane('chat');
    if (!follow) return;
    const chat = wb.chats.find((c) => c.id === id);
    const key = chat?.items.flatMap((it) => (it.kind === 'user' && it.context?.cardKey ? [it.context.cardKey] : []))[0];
    if (key) openCard(key);
  };

  useEffect(() => {
    const root = document.getElementById('hub-root');
    if (!root) return;
    // On the desk an Undo toast lands over the stage, never over the composer.
    root.style.setProperty('--wb-toast-bottom', desk && !phone && !stageShown ? '11rem' : '0px');
    root.style.setProperty('--wb-toast-bottom-phone', phone && desk ? '12rem' : '0px');
  }, [desk, phone, stageShown]);

  if (!desk) {
    const waiting = firstWaitingChat(wb);
    return (
      <div className="flex min-h-dvh" data-wb-dragging={dragging}>
        <DesktopSidebar onShortcuts={controls.openHelp} />
        <div className="flex min-w-0 flex-1 flex-col" data-wb-page-narrow={!!cardKey}>
          <Header
            onOpenNav={controls.openNav}
            onOpenPalette={controls.openPalette}
            onNewCard={controls.openNew}
            onShortcuts={controls.openHelp}
            compact={!!cardKey && !phone}
            extra={
              <EnterButton
                onEnter={() => {
                  if (waiting) openChat(waiting.id);
                  setDesk(true);
                }}
              />
            }
          />
          <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
            <ViewOutlet />
          </main>
        </div>
        {ready && cardKey && (
          <div data-wb-sheet-pane className={cn(phone ? 'fixed inset-0 z-50' : 'sticky top-0 h-dvh w-140 shrink-0 overflow-hidden border-s border-border')}>
            <DockedSheet className="h-full w-full" onAsk={() => setDesk(true)} />
          </div>
        )}
      </div>
    );
  }

  const sidebar = phone ? 0 : vw >= 1024 ? 56 : 0;
  const riverW = hasRiver ? RIVER : 0;
  const maxStage = Math.max(MIN_STAGE, vw - sidebar - riverW - MIN_CONVERSATION);
  const stage = Math.max(MIN_STAGE, Math.min(stageWidth, maxStage));
  const conversation = (
    <Conversation focus={focusComposer} onExit={() => setDesk(false)} stageShown={stageShown} onToggleStage={() => setStageShown(!stageShown)} showStageToggle={!phone} />
  );

  if (phone) {
    return (
      <div className="relative flex h-dvh flex-col overflow-hidden" data-wb-desk>
        <div className="min-h-0 flex-1">
          {pane === 'chat' && conversation}
          {pane === 'river' && <River onOpenChat={openChatHere} onOpenPalette={controls.openPalette} onOpenNew={controls.openNew} />}
          <div className={cn('h-full', pane !== 'work' && 'hidden')}>{ready && <Stage follow={follow} onFollow={setFollow} width={vw} phone />}</div>
        </div>
        <div className="shrink-0 border-t border-border bg-(--sidebar) p-1">
          <Segmented
            label={m.desk}
            value={pane}
            onChange={(v) => setPane(v as DeskPane)}
            options={[
              { value: 'chat', label: m.tabs.chat },
              { value: 'river', label: m.tabs.river, count: approvalsPending(wb) || undefined },
              { value: 'work', label: cardKey ?? m.tabs.work },
            ]}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh overflow-hidden" data-wb-desk data-wb-dragging={dragging}>
      <DesktopSidebar onShortcuts={controls.openHelp} />
      {hasRiver ? (
        <aside aria-label={m.river} style={{ width: RIVER }} className="h-full shrink-0 border-e border-border bg-(--sidebar)">
          <River onOpenChat={openChatHere} onOpenPalette={controls.openPalette} onOpenNew={controls.openNew} />
        </aside>
      ) : null}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {!hasRiver && (
          <div className="flex shrink-0 items-center gap-1 border-b border-border p-1">
            <Segmented label={m.desk} value={pane === 'work' ? 'chat' : pane} onChange={(v) => setPane(v as DeskPane)} options={[{ value: 'chat', label: m.tabs.chat }, { value: 'river', label: m.tabs.river, count: approvalsPending(wb) || undefined }]} />
          </div>
        )}
        <div className="min-h-0 flex-1">
          {!hasRiver && pane === 'river' ? <River onOpenChat={openChatHere} onOpenPalette={controls.openPalette} onOpenNew={controls.openNew} /> : conversation}
        </div>
      </div>
      {ready && stageShown && (
        <>
          <Resizer axis="x" value={stage} min={MIN_STAGE} max={maxStage} fallback={DEFAULT_STAGE} onChange={setStageWidth} onDragging={setDragging} label={t.resizeStage} hint={t.resizeHint} className="h-full border-s border-border" />
          <div style={{ width: stage }} className="h-full shrink-0">
            <Stage follow={follow} onFollow={setFollow} width={stage} phone={false} />
          </div>
        </>
      )}
    </div>
  );
}
