import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRight, ChevronDown, Code2, Copy, Crosshair, FileDown, Gauge, Hand, History, Info, ListChecks, MessagesSquare, MoreHorizontal, Pin, PinOff, Plug, Plus, Settings2, SquareTerminal, Trash2, X } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { DesktopSidebar } from '../../../today/v5-peacock-app/shell/sidebar';
import { Button, cn, copyText, counted, fmt, focusRing, focusRingInset, getCard, IconButton, kitMessages, Ltr, Modal, Segmented, showToast, useMedia, useRoute, useRoving } from '../core/kit';
import { Composer, Menu, useModeKeys } from '../core/composer';
import { Header } from '../core/header';
import { DemoMenu, DoNext, EmptyChat, EngineNotice, HistoryList, RunIcon, RunsFootnote, RunsList, VsCodeDialog } from '../core/panels';
import { Resizer } from '../core/resizer';
import { useFoldSidebar, ViewOutlet, useToggleKey, type ShellControls } from '../core/shell';
import { DockedSheet, focusSheetTitle } from '../core/sheet';
import { approvalsPending, attach, deleteChat, deviceOf, exportMarkdown, firstWaitingChat, newChat, openChat, revealApproval, setPref, stopTurn, togglePin, usePrefs, useRemembered, useWb, wasFollowOpened } from '../core/store';
import { MODES, PROJECTS, type Chat } from '../core/mock';
import { wbMessages } from '../core/strings';
import { Thread, useChatState } from '../core/thread';
import { setHelpMode, Tip, useHelpMode, useKeyLabels, type TipFact } from '../core/tips';
import { tipCopy } from '../core/tips-copy';
import { messages } from '../i18n';
import { messages as shellMessages } from '../../../today/v5-peacock-app/i18n';

type PanelView = 'chat' | 'history' | 'runs';

const STRIP = 52;
const GRIP = 8;
const MIN_PANEL = 340;
const DEFAULT_PANEL = 440;
/** The page's minimum beside the panel, with no card open. */
const MIN_PAGE = 340;
/** With a card open, under this the page is residue: a board shows 1.5 clipped columns. So it steps aside, and the sheet takes the room (review, Calm under richness). */
const PAGE_WITH_SHEET = 520;
const SHEET_BESIDE = 460;
const MIN_SHEET = 380;

const subscribeWidth = (fn: () => void) => {
  window.addEventListener('resize', fn);
  return () => window.removeEventListener('resize', fn);
};
const useWindowWidth = () => useSyncExternalStore(subscribeWidth, () => document.getElementById('hub-root')?.clientWidth ?? window.innerWidth);

/** Facts from the bridge. S1 names each source: `init.claude_code_version`, `init.mcp_servers`, `init.skills`, `rate_limit_info`. */
const ENGINE_FACTS = { version: '2.1.318', servers: 5, skills: 117 };

function useBridgeFacts(): TipFact[] {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const f = tipCopy[locale].facts;
  const device = deviceOf(wb.device);
  if (wb.engine === 'offline') return [[f.device, device.name[locale]], [f.state, t.demo.offline], [f.lastSeen, t.pro.strip.sinceTime]];
  return [
    [f.device, device.name[locale]],
    [f.state, wb.engine === 'ok' || wb.engine === 'limit' ? t.pro.strip.bridgeOn : t.demo[wb.engine]],
    [f.since, t.pro.strip.sinceTime],
    [f.version, wb.engine === 'version_new' ? '2.1.320' : wb.engine === 'version_old' ? '2.1.202' : ENGINE_FACTS.version, true],
    [f.folder, wb.folder, true],
  ];
}
function useUsageFacts(): TipFact[] {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const f = tipCopy[locale].facts;
  return [
    [f.used, fmt(t.pro.strip.usageShort, { n: wb.usage })],
    [f.window, t.pro.strip.sevenDay],
    [f.resets, wb.engine === 'limit' ? '15:45' : t.pro.strip.monday],
  ];
}

/** The always-there strip at the page edge. The panel opens from it and closes back into it, so a waiting approval never goes out of sight. */
function Strip({ open, view, onToggle, onView }: { open: boolean; view: PanelView; onToggle: () => void; onView: (v: PanelView) => void }) {
  const t = useT(wbMessages);
  const m = useT(messages);
  const locale = useLocale();
  const wb = useWb();
  const side = locale === 'ar' ? 'right' : 'left';
  const pending = approvalsPending(wb);
  const waiting = firstWaitingChat(wb);
  const live = wb.runs.filter((r) => r.state === 'waiting' || r.state === 'running');
  const bridge = useBridgeFacts();
  const usage = useUsageFacts();
  const f = tipCopy[locale].facts;
  const views: { id: PanelView; icon: typeof History; label: string; tip: 'strip.chat' | 'strip.history' | 'strip.runs' }[] = [
    { id: 'chat', icon: MessagesSquare, label: t.chat, tip: 'strip.chat' },
    { id: 'history', icon: History, label: t.history, tip: 'strip.history' },
    { id: 'runs', icon: ListChecks, label: t.runs, tip: 'strip.runs' },
  ];
  const bridgeOk = wb.engine !== 'offline' && wb.engine !== 'signed_out' && wb.engine !== 'claude_missing';
  const statusRoving = useRoving(0);
  return (
    <nav aria-label={m.strip} data-wb-strip style={{ width: STRIP }} className="sticky top-0 flex h-dvh shrink-0 flex-col items-center gap-1 border-s border-border bg-(--sidebar) py-2">
      <Tip k="strip.toggle" side={side} keys={['Ctrl /']}>
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
      </Tip>
      <div className="my-1 h-px w-6 bg-border" />
      {views.map(({ id, icon: Icon, label, tip }) => (
        <Tip key={id} k={tip} side={side}>
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
        </Tip>
      ))}
      <div className="my-1 h-px w-6 bg-border" />
      {/* Live runs, always visible. Words are in the name and the tooltip, so state is never colour or shape alone. */}
      <ul className="flex flex-col items-center gap-1">
        {live.map((r) => (
          <li key={r.id}>
            <Tip k="strip.run" side={side} facts={[[f.state, t.runsPanel.states[r.state]], [f.folder, r.folder, true], ...(r.command ? ([[f.command, r.command, true]] as TipFact[]) : [])]}>
              <button
                type="button"
                data-wb-strip-run={r.state}
                aria-label={`${fmt(m.runOpen, { title: r.title[locale] })}. ${t.runsPanel.states[r.state]}`}
                onClick={() => r.chatId && revealApproval(r.chatId)}
                className={cn('flex size-9 items-center justify-center rounded-md transition-colors duration-120 hover:bg-accent', focusRing)}
              >
                <RunIcon state={r.state} />
              </button>
            </Tip>
          </li>
        ))}
      </ul>
      {pending > 0 && (
        <Tip k="strip.pending" side={side} facts={waiting ? [[f.chat, waiting.title[locale]]] : undefined}>
          <button
            type="button"
            data-wb-pending
            aria-label={counted(pending, locale, m.needs)}
            onClick={() => waiting && revealApproval(waiting.id)}
            className={cn('mt-1 flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full bg-warning-soft px-1 text-caption font-bold text-warning-soft-foreground tabular-nums', focusRing)}
          >
            <Hand aria-hidden className="size-3" strokeWidth={2} />
            {pending}
          </button>
        </Tip>
      )}
      {/* Two statuses, one Tab stop with arrows between them: they carry values, and are not controls (review N10). */}
      <div ref={statusRoving.root} role="group" aria-label={t.pro.statusGroup} {...statusRoving.groupProps} className="mt-auto flex flex-col items-center gap-1">
        <Tip k="strip.usage" side={side} facts={usage}>
          <span {...statusRoving.itemProps(0)} role="img" data-wb-status="usage" aria-label={`${t.pro.strip.usage}: ${fmt(t.pro.strip.usageShort, { n: wb.usage })}`} className={cn('flex flex-col items-center rounded-md px-1 py-0.5 text-muted-foreground', wb.usage >= 80 && 'text-warning-strong', focusRing)}>
            <Gauge aria-hidden className="size-4" strokeWidth={1.75} />
            <span className="text-caption tabular-nums">{fmt(t.pro.strip.usageShort, { n: wb.usage })}</span>
          </span>
        </Tip>
        <Tip k="strip.bridge" side={side} facts={bridge}>
          <span {...statusRoving.itemProps(1)} role="img" data-wb-status="bridge" aria-label={`${t.pro.strip.bridge}: ${bridgeOk ? t.pro.strip.bridgeOn : wb.engine === 'offline' ? t.demo.offline : t.demo.signed_out}`} className={cn('flex size-9 items-center justify-center rounded-md', focusRing)}>
            <Plug aria-hidden className={cn('size-4', bridgeOk ? 'text-success-soft-foreground' : 'text-warning-strong')} strokeWidth={1.75} />
          </span>
        </Tip>
      </div>
    </nav>
  );
}

/** The facts of a chat. Folded behind the title, because they are looked up, not read. A value the engine has not reported is left out. */
function ChatFacts({ chat }: { chat: Chat }) {
  const t = useT(wbMessages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const f = tipCopy[locale].facts;
  const model = chat.model[0].toUpperCase() + chat.model.slice(1);
  const rows: [string, string, boolean?][] = [
    [f.project, PROJECTS.find((p) => p.id === chat.project)!.name],
    [f.folder, chat.folder, true],
    [f.device, deviceOf(chat.device).name[locale]],
    ...(chat.branch ? ([[f.branch, chat.branch, true]] as [string, string, boolean][]) : []),
    [f.mode, t.pro.modes[chat.mode]],
    [f.model, model],
    ...(chat.started ? ([[f.started, chat.started[locale]]] as [string, string][]) : []),
    [f.persona, kit.roles[chat.persona]],
    [f.version, ENGINE_FACTS.version, true],
    [f.servers, String(ENGINE_FACTS.servers)],
    [f.skills, String(ENGINE_FACTS.skills)],
  ];
  return (
    <section aria-label={t.pro.facts.title} data-wb-facts className="flex max-h-[40dvh] shrink-0 flex-col gap-1 overflow-y-auto border-b border-border bg-muted px-3 py-2">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5 text-body-sm">
        {rows.map(([name, value, ltr]) => (
          <div key={name} className="contents">
            <dt className="text-muted-foreground">{name}</dt>
            <dd className="min-w-0 [overflow-wrap:anywhere] text-foreground">
              {ltr ? (
                <Ltr mono className="text-body-sm">
                  {value}
                </Ltr>
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
        <dt className="self-center text-muted-foreground">{f.session}</dt>
        <dd className="flex min-w-0 items-center gap-1">
          {chat.session ? (
            <>
              <Ltr mono className="min-w-0 truncate text-body-sm text-foreground">
                {chat.session}
              </Ltr>
              <Tip k="facts.copy">
                <IconButton
                  label={t.pro.facts.copy}
                  title={undefined}
                  className="size-11 md:size-7"
                  onClick={() => {
                    void copyText(chat.session!);
                    showToast({ message: kit.copy.copied });
                  }}
                >
                  <Copy aria-hidden className="size-3.5" strokeWidth={1.75} />
                </IconButton>
              </Tip>
            </>
          ) : (
            <span className="text-body-sm text-muted-foreground">{t.pro.facts.notStarted}</span>
          )}
        </dd>
      </dl>
    </section>
  );
}

function SettingsDialog({ open, onOpenChange, width, onResetWidth }: { open: boolean; onOpenChange: (o: boolean) => void; width: number; onResetWidth: () => void }) {
  const t = useT(wbMessages);
  const prefs = usePrefs();
  const s = t.pro.settings;
  const section = 'flex flex-col gap-1.5';
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={s.title}
      description={s.note}
      footer={
        <Button variant="primary" data-wb-settings-done onClick={() => onOpenChange(false)}>
          {s.done}
        </Button>
      }
    >
      <div data-wb-settings className="flex flex-col gap-4">
        <div className={section}>
          <p className="text-body font-medium text-foreground">{s.mode}</p>
          <Segmented label={s.mode} value={prefs.defaultMode} onChange={(v) => setPref('defaultMode', v)} options={MODES.map((m) => ({ value: m, label: t.pro.modes[m] }))} />
          <p className="text-body-sm text-muted-foreground">{s.modeHint}</p>
        </div>
        <div className={section}>
          <p className="text-body font-medium text-foreground">{s.tip}</p>
          <Segmented label={s.tip} value={prefs.tipLevel} onChange={(v) => setPref('tipLevel', v)} options={[{ value: 'full', label: s.tipFull }, { value: 'compact', label: s.tipCompact }]} />
          <p className="text-body-sm text-muted-foreground">{s.tipHint}</p>
        </div>
        <div className={section}>
          <p className="text-body font-medium text-foreground">{s.follow}</p>
          <Segmented label={s.follow} value={prefs.follow ? 'on' : 'off'} onChange={(v) => setPref('follow', v === 'on')} options={[{ value: 'on', label: s.on }, { value: 'off', label: s.off }]} />
          <p className="text-body-sm text-muted-foreground">{s.followHint}</p>
        </div>
        <div className={section}>
          <p className="text-body font-medium text-foreground">{s.width}</p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body-sm text-muted-foreground">{fmt(s.widthNow, { n: width })}</p>
            <Button size="sm" data-wb-width-reset onClick={onResetWidth}>
              {s.reset}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ChatMenu({ chat, onVsCode, onSettings }: { chat: Chat | undefined; onVsCode: () => void; onSettings: () => void }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const p = t.pro.menu;
  const { follow } = usePrefs();
  const touch = useMedia('(hover: none)');
  const item = 'flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-2.5 py-1.5 text-body-sm text-foreground outline-none select-none data-[highlighted]:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:text-muted-foreground md:min-h-9';
  const Row = ({ icon: Icon, label, note, onSelect, data }: { icon: typeof Pin; label: string; note: string; onSelect: () => void; data: string }) => (
    <DropdownMenu.Item data-wb-menu-item={data} className={item} onSelect={onSelect}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        <span className="block text-muted-foreground">{note}</span>
      </span>
    </DropdownMenu.Item>
  );
  const download = (c: Chat) => {
    const name = `chat-${c.id}.md`;
    const url = URL.createObjectURL(new Blob([exportMarkdown(c, locale)], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ message: fmt(p.exported, { file: name }) });
  };
  return (
    <Menu
      side="bottom"
      align="end"
      label={p.label}
      trigger={
        <Tip k="head.menu" side="bottom">
          <IconButton label={p.label} title={undefined} data-wb-chat-menu>
            <MoreHorizontal aria-hidden className="size-4" strokeWidth={1.75} />
          </IconButton>
        </Tip>
      }
    >
      {chat && <Row data="pin" icon={chat.pinned ? PinOff : Pin} label={chat.pinned ? p.unpin : p.pin} note={p.pinNote} onSelect={() => togglePin(chat.id)} />}
      {chat && <Row data="export" icon={FileDown} label={p.export} note={p.exportNote} onSelect={() => download(chat)} />}
      <Row data="vscode" icon={Code2} label={p.vscode} note={p.vscodeNote} onSelect={onVsCode} />
      <Row data="follow" icon={Crosshair} label={`${p.follow}: ${follow ? p.on : p.off}`} note={p.followNote} onSelect={() => setPref('follow', !follow)} />
      {touch && <Row data="explain" icon={Info} label={p.explain} note={p.explainNote} onSelect={() => setHelpMode(true)} />}
      <Row data="settings" icon={Settings2} label={p.settings} note={p.settingsNote} onSelect={onSettings} />
      {chat && <DropdownMenu.Separator className="my-1 h-px bg-border" />}
      {chat && <Row data="delete" icon={Trash2} label={p.delete} note={p.deleteNote} onSelect={() => deleteChat(chat.id, { ar: wbMessages.ar.historyPanel.deleted, en: wbMessages.en.historyPanel.deleted }, locale)} />}
    </Menu>
  );
}

/** Chat, history, runs on a phone, where there is no strip. */
function PhoneTabs({ view, onView }: { view: PanelView; onView: (v: PanelView) => void }) {
  const t = useT(wbMessages);
  const options: { id: PanelView; label: string; tip: string }[] = [
    { id: 'chat', label: t.chat, tip: t.pro.phoneTips.chat },
    { id: 'history', label: t.history, tip: t.pro.phoneTips.history },
    { id: 'runs', label: t.runs, tip: t.pro.phoneTips.runs },
  ];
  const { root, groupProps, itemProps } = useRoving(options.findIndex((o) => o.id === view));
  return (
    <div ref={root} role="toolbar" aria-label={t.panelLabel} {...groupProps} className="flex rounded-md border border-border bg-card">
      {options.map((o, i) => (
        <Tip key={o.id} content={{ what: o.tip }} side="bottom">
          <button type="button" data-wb-view={o.id} aria-pressed={view === o.id} {...itemProps(i)} onClick={() => onView(o.id)} className={cn('h-11 min-w-0 flex-1 rounded-sm px-2 text-body-sm font-medium', view === o.id ? 'bg-foreground text-background' : 'text-muted-foreground', focusRingInset)}>
            {o.label}
          </button>
        </Tip>
      ))}
    </div>
  );
}

function PanelHeader({ view, phone, chat, factsOpen, cardBeside, onFacts, onClose, onVsCode, onSettings, onView, onToCard }: { view: PanelView; phone: boolean; chat: Chat | undefined; factsOpen: boolean; cardBeside: boolean; onFacts: () => void; onClose: () => void; onVsCode: () => void; onSettings: () => void; onView: (v: PanelView) => void; onToCard: () => void }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const touch = useMedia('(hover: none)');
  const help = useHelpMode();
  const prefs = usePrefs();
  const f = tipCopy[locale].facts;
  const labels = tipCopy[locale].labels;
  const state = useChatStateSafe(chat);
  const title = view === 'history' ? t.historyPanel.title : view === 'runs' ? t.runsPanel.title : chat ? chat.title[locale] : t.newChat;
  const canFacts = view === 'chat' && !!chat;
  const stateLine = view === 'chat' && state.label && (
    <p data-wb-state className={cn('text-body-sm', state.tone === 'needs' ? 'font-medium text-warning-strong' : 'text-muted-foreground')}>
      {state.label}
    </p>
  );
  const titleEl = (
    <h2 data-wb-title className="truncate text-body-lg font-semibold text-foreground">
      {title}
    </h2>
  );
  const heading = canFacts ? (
    <Tip
      k="head.title"
      side="bottom"
      align="start"
      facts={[
        [f.project, PROJECTS.find((p) => p.id === chat.project)!.name],
        [f.device, deviceOf(chat.device).name[locale]],
        [f.folder, chat.folder, true],
        ...(chat.branch ? ([[f.branch, chat.branch, true]] as TipFact[]) : []),
      ]}
    >
      <button type="button" data-wb-facts-toggle aria-expanded={factsOpen} onClick={onFacts} className={cn('flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-0.5 text-start hover:bg-accent max-md:min-h-11', focusRing)}>
        <span className="min-w-0 flex-1">
          {titleEl}
          {/* On touch the state has its own full-width line below, so "Waiting for your approval" is never cut. */}
          {!touch && stateLine}
        </span>
        <ChevronDown aria-hidden className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform duration-120', factsOpen && 'rotate-180')} strokeWidth={1.75} />
      </button>
    </Tip>
  ) : (
    <div className="min-w-0 flex-1 px-1">
      {titleEl}
      {!touch && stateLine}
    </div>
  );
  const helpButton = touch && (
    <Tip k="head.help" side="bottom">
      <Button size="sm" variant="ghost" data-wb-help aria-pressed={help} className={help ? 'bg-accent text-foreground' : undefined} onClick={() => setHelpMode(!help)}>
        <Info aria-hidden className="size-4" strokeWidth={1.75} />
        {labels.helpLabel}
      </Button>
    </Tip>
  );
  const newButton = (
    <Tip k="head.new" side="bottom">
      <IconButton
        label={t.newChat}
        title={undefined}
        data-wb-new
        onClick={() => {
          newChat();
          onView('chat');
        }}
      >
        <Plus aria-hidden className="size-4" strokeWidth={1.75} />
      </IconButton>
    </Tip>
  );
  const closeButton = (
    <Tip k="head.close" side="bottom" keys={['Ctrl /']}>
      <IconButton label={t.close} title={undefined} data-wb-close aria-keyshortcuts="Control+/ Meta+/" onClick={onClose}>
        <X aria-hidden className="size-4" strokeWidth={1.75} />
      </IconButton>
    </Tip>
  );
  const menu = <ChatMenu chat={view === 'chat' ? chat : undefined} onVsCode={onVsCode} onSettings={onSettings} />;
  const demo = <DemoMenu side="bottom" onAct={() => onView('chat')} />;
  return (
    <header className="flex shrink-0 flex-col gap-1 border-b border-border p-2">
      {touch ? (
        <>
          <div className="flex min-w-0 items-center gap-0.5">
            {heading}
            {menu}
            {closeButton}
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <div className="min-w-0 flex-1 px-1">{stateLine}</div>
            {helpButton}
            {newButton}
            {demo}
          </div>
        </>
      ) : (
        <div className="flex min-w-0 items-center gap-0.5">
          {heading}
          {newButton}
          {menu}
          {demo}
          {closeButton}
        </div>
      )}
      {phone && (
        <div className="flex min-w-0 items-center gap-1">
          <div className="min-w-0 flex-1">
            <PhoneTabs view={view} onView={onView} />
          </div>
          {cardBeside && (
            <Tip content={{ what: t.pro.phoneTips.toCard }} side="bottom">
              <Button size="sm" variant="outline" data-wb-phone-tocard onClick={onToCard}>
                {t.toCard}
              </Button>
            </Tip>
          )}
        </div>
      )}
      {touch && !prefs.hintSeen && !help && (
        <p role="status" data-wb-help-hint className="flex items-center justify-between gap-2 rounded-md bg-muted px-2 text-body-sm text-foreground">
          <span className="min-w-0 py-1">{labels.helpHint}</span>
          <Button size="sm" variant="ghost" data-wb-help-hint-close onClick={() => setPref('hintSeen', true)}>
            {labels.helpHintClose}
          </Button>
        </p>
      )}
      {help && touch && (
        <p role="status" data-wb-help-banner className="flex items-center justify-between gap-2 rounded-md bg-muted px-2 text-body-sm text-foreground">
          <span>{labels.helpOn}</span>
          <Button size="sm" variant="ghost" data-wb-help-done onClickCapture={(e) => { e.stopPropagation(); setHelpMode(false); setPref('hintSeen', true); }}>
            {labels.helpDone}
          </Button>
        </p>
      )}
    </header>
  );
}

function useChatStateSafe(chat: Chat | undefined) {
  const fake = { id: '', items: [], status: 'idle' } as unknown as Chat;
  return useChatState(chat ?? fake);
}

const keyInDrag = (e: { dataTransfer: DataTransfer }) => {
  const data = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  return /GTV-\d+/.exec(data)?.[0] ?? null;
};

export function EdgeStripLayout({ controls, ready }: { controls: ShellControls; ready: boolean }) {
  const t = useT(wbMessages);
  const m = useT(messages);
  const wb = useWb();
  const locale = useLocale();
  const route = useRoute();
  const { cardKey } = route;
  const shellNav = useT(shellMessages).nav;
  const phone = !useMedia('(min-width: 768px)');
  const desktop = useMedia('(min-width: 1024px)');
  const vw = useWindowWidth();
  const label = useKeyLabels();
  // A phone's first visit lands on the page, not a full-screen chat over it (review N3).
  const [open, setOpenRaw] = useRemembered('open', window.innerWidth >= 768);
  const [width, setWidth] = useRemembered('width', DEFAULT_PANEL);
  const [view, setView] = useState<PanelView>('chat');
  const [dragging, setDragging] = useState(false);
  const [vscode, setVscode] = useState(false);
  const [settings, setSettings] = useState(false);
  const [factsOpen, setFactsOpen] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [focusComposer, setFocusComposer] = useState(false);
  const [phoneFront, setPhoneFront] = useState<'chat' | 'card'>('chat');
  const lastFocus = useRef<HTMLElement | null>(null);
  const chat = wb.chats.find((c) => c.id === wb.activeId);

  useEffect(() => {
    const followed = wasFollowOpened();
    if (cardKey && !followed) setPhoneFront('card');
    else if (!cardKey) setPhoneFront('chat');
  }, [cardKey]);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenRaw(next);
      if (next) {
        lastFocus.current = document.activeElement as HTMLElement | null;
        // A touch keyboard must not jump up just because the panel opened.
        setFocusComposer(!matchMedia('(hover: none)').matches);
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
  useModeKeys();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'Period' && chat && chat.status !== 'idle' && chat.status !== 'stopped') {
        e.preventDefault();
        stopTurn(chat.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chat]);

  // Both panes open: the sidebar folds to icons so the page keeps a readable column, and comes back when one closes.
  const both = open && !!cardKey && desktop;
  const pref = useFoldSidebar(both);

  const sidebarW = desktop ? (pref ?? !(vw >= 1280) ? 56 : 248) : 0;
  const available = vw - sidebarW - STRIP;
  const room = available - (open ? GRIP : 0);
  // With no card, the page keeps MIN_PAGE. With one, the sheet keeps MIN_SHEET, and the page stays only if it would be a working page: under PAGE_WITH_SHEET it steps aside.
  const maxPanel = Math.max(MIN_PANEL, room - (cardKey ? MIN_SHEET : MIN_PAGE));
  const panel = Math.max(MIN_PANEL, Math.min(width, maxPanel));
  const beside = cardKey ? SHEET_BESIDE : 0;
  const pageRoom = room - (open ? panel : 0) - (cardKey ? (open ? beside : 560) : 0);
  const pageHidden = !phone && !!cardKey && pageRoom < PAGE_WITH_SHEET;
  const narrow = pageRoom < 960;
  const pageName = shellNav[route.view];

  // An Undo toast stays clear of the composer.
  useEffect(() => {
    const root = document.getElementById('hub-root');
    if (!root) return;
    root.style.setProperty('--wb-toast-end', phone ? '0px' : `${STRIP + (open ? panel + GRIP : 0)}px`);
    root.style.setProperty('--wb-toast-bottom-phone', phone && open ? '10rem' : '0px');
  }, [phone, open, panel]);

  // A reveal from anywhere brings the panel to the thread first: the strip, a run, or a check on the card.
  const revealTick = wb.reveal?.tick;
  useEffect(() => {
    if (!revealTick) return;
    setView('chat');
    if (!open) setOpen(true);
    if (phone) setPhoneFront('chat');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealTick]);

  /** Where focus lands in the panel: what is waiting on the owner if anything is, otherwise the message box. */
  const focusPanel = useCallback(() => {
    const target = document.querySelector<HTMLElement>('[data-wb-approval="pending"]') ?? document.querySelector<HTMLElement>('[data-wb-input]') ?? document.querySelector<HTMLElement>('[data-wb-panel] button');
    target?.focus({ preventScroll: false });
  }, []);
  useEffect(() => {
    const onSkip = () => {
      if (!open) setOpen(true);
      window.setTimeout(focusPanel, 0);
    };
    window.addEventListener('wb:focus-panel', onSkip);
    return () => window.removeEventListener('wb:focus-panel', onSkip);
  }, [open, setOpen, focusPanel]);
  // F6 moves between the page, the sheet, the panel and the strip, in reading order. Tab also runs through all of them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F6') return;
      e.preventDefault();
      const regions: { root: string; go: () => void }[] = [
        ...(!pageHidden ? [{ root: '[data-wb-page]', go: () => document.getElementById('main')?.focus() }] : []),
        ...(cardKey ? [{ root: '[data-card-sheet]', go: focusSheetTitle }] : []),
        ...(open ? [{ root: '[data-wb-panel]', go: focusPanel }] : []),
        { root: '[data-wb-strip]', go: () => document.getElementById('wb-toggle')?.focus() },
      ];
      const at = regions.findIndex((r) => (document.activeElement as HTMLElement | null)?.closest(r.root));
      const step = e.shiftKey ? -1 : 1;
      const next = at < 0 ? 0 : (at + step + regions.length) % regions.length;
      regions[next].go();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pageHidden, cardKey, open, focusPanel]);

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
  const dropKey = (key: string) => {
    const card = getCard(key);
    if (!card) return;
    attach(card.type === 'doc' ? { kind: 'doc', key, label: card.doc.path } : { kind: 'card', key, label: key });
    setView('chat');
    if (!open) setOpen(true);
  };

  const pending = approvalsPending(wb);
  const phoneButton = phone && (
    <Tip k="strip.toggle" side="bottom" keys={['Ctrl /']}>
      <button
        type="button"
        id="wb-toggle"
        data-wb-phone-toggle
        aria-label={pending ? `${t.toggle}. ${counted(pending, locale, m.needs)}` : t.toggle}
        aria-expanded={open}
        onClick={() => {
          const waiting = firstWaitingChat(wb);
          if (!open && waiting) revealApproval(waiting.id);
          else toggle();
        }}
        className={cn('relative flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-accent', focusRing)}
      >
        <SquareTerminal aria-hidden className="size-5 text-foreground" strokeWidth={1.75} />
        {pending > 0 && <span className="absolute end-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-warning-soft px-1 text-caption font-bold text-warning-soft-foreground tabular-nums">{pending}</span>}
      </button>
    </Tip>
  );

  const widthFacts: TipFact[] = [[tipCopy[locale].facts.state, `${panel} px`]];

  return (
    <div className="flex min-h-dvh" data-wb-dragging={dragging} data-wb-page-hidden={pageHidden} data-wb-sheet-open={!!cardKey}>
      <DesktopSidebar onShortcuts={controls.openHelp} />
      <div data-wb-page inert={phone && (open || !!cardKey)} className={cn('flex min-w-0 flex-1 flex-col', pageHidden && 'hidden')} data-wb-page-narrow={narrow}>
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
            stepAside={pageHidden ? pageName : undefined}
            onAsk={() => {
              if (!open) setOpen(true);
              setView('chat');
              if (phone) setPhoneFront('chat');
            }}
            // A phone has no strip, and the sheet covers the page's header, so this is the way to the panel and to anything waiting there.
            topBar={
              phone ? (
                <div className="flex shrink-0 items-center gap-2 border-b border-border p-1">
                  <Tip content={{ what: t.pro.phoneTips.toChat }} side="bottom" align="start">
                    <Button
                      variant="ghost"
                      data-wb-phone-tochat
                      onClick={() => {
                        const waiting = firstWaitingChat(wb);
                        if (waiting) revealApproval(waiting.id);
                        else if (!open) setOpen(true);
                        setPhoneFront('chat');
                      }}
                    >
                      <ArrowRight aria-hidden className="size-4 ltr:-scale-x-100" strokeWidth={1.75} />
                      {t.backToChat}
                    </Button>
                  </Tip>
                  {pending > 0 && (
                    <span data-wb-phone-pending className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-body-sm font-medium text-warning-soft-foreground">
                      <Hand aria-hidden className="size-3.5" strokeWidth={2} />
                      {counted(pending, locale, m.needs)}
                    </span>
                  )}
                </div>
              ) : undefined
            }
          />
        </div>
      )}

      {open && !phone && <Resizer axis="x" value={panel} min={MIN_PANEL} max={maxPanel} fallback={DEFAULT_PANEL} onChange={setWidth} onDragging={setDragging} label={t.resize} facts={widthFacts} className="sticky top-0 h-dvh border-s border-border bg-background" />}

      {open && (
        <section
          aria-label={t.panelLabel}
          id="wb-panel"
          data-wb-panel
          style={phone ? undefined : { width: panel }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('text/uri-list') || e.dataTransfer.types.includes('text/plain')) {
              e.preventDefault();
              setDropping(true);
            }
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
          className={cn('relative flex min-w-0 flex-col bg-background', phone ? 'fixed inset-0 z-45 w-full' : 'sticky top-0 h-dvh shrink-0')}
        >
          <PanelHeader view={view} phone={phone} chat={chat} factsOpen={factsOpen} cardBeside={phone && !!cardKey} onFacts={() => setFactsOpen((v) => !v)} onClose={() => setOpen(false)} onVsCode={() => setVscode(true)} onSettings={() => setSettings(true)} onView={setView} onToCard={() => setPhoneFront('card')} />
          {view === 'chat' && factsOpen && chat && <ChatFacts chat={chat} />}
          {view === 'chat' && (
            <>
              {chat ? <Thread chat={chat} /> : <EmptyChat onRan={() => setView('chat')} />}
              <div className="flex shrink-0 flex-col gap-2 border-t border-border p-2.5">
                <EngineNotice onVsCode={() => setVscode(true)} />
                <Composer autoFocus={focusComposer} />
              </div>
            </>
          )}
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
          {dropping && (
            <div data-wb-dropzone className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-ring bg-background/90 p-4 text-center text-body font-medium text-foreground">
              {t.pro.drop}
            </div>
          )}
          <VsCodeDialog open={vscode} onOpenChange={setVscode} />
          <SettingsDialog open={settings} onOpenChange={setSettings} width={panel} onResetWidth={() => setWidth(DEFAULT_PANEL)} />
        </section>
      )}

      {!phone && <Strip open={open} view={view} onToggle={toggle} onView={pickView} />}
      {pageHidden && <span className="sr-only">{m.pageHidden}</span>}
      <span className="sr-only">{label('Ctrl /')}</span>
    </div>
  );
}

