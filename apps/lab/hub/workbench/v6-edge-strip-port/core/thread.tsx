import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, Ban, Check, ChevronDown, CircleStop, FileDiff, FolderOpen, GitBranch, Loader2, Maximize2, MoreHorizontal, RotateCcw, ShieldQuestion, Terminal, Copy } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { actionsFor, Bidi, Button, CardKey, CardRow, cn, copyText, counted, fill, fmt, focusRing, IconButton, kitMessages, Ltr, MarkdownView, Modal, num, Pill, portalRoot, RowAction, showToast, StatusBadge, useCard, useSession } from './kit';
import { answerApproval, branchFrom, deviceOf, engineOff, getWb, retryTurn, useWb } from './store';
import type { ApprovalRequest, ChangedFile, Chat, DiffLine, Item, L, ToolCall, TurnMeta } from './mock';
import { Blocked, DraftCard, GapsCard, LinksCard, PlanCard, ProtocolCard, QuestionCard, RefusedNote, ReportCard, SavedCard } from './protocol';
import { wbMessages } from './strings';
import { Tip, type TipFact } from './tips';

const said = (locale: 'ar' | 'en', text: string | L) => (typeof text === 'string' ? text : text[locale]);

/** Cut at a word so a streaming reply never shows half a word. */
function streamed(text: string, shown: number) {
  if (shown >= 1) return text;
  const end = Math.floor(text.length * shown);
  const cut = text.lastIndexOf(' ', end);
  return text.slice(0, cut > 0 ? cut : end);
}

export function duration(ms: number, locale: 'ar' | 'en') {
  const sec = locale === 'ar' ? 'ث' : 's';
  const min = locale === 'ar' ? 'د' : 'min';
  if (ms < 10000) return `${(ms / 1000).toFixed(ms < 1000 ? 2 : 1)} ${sec}`;
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} ${sec}`;
  return `${Math.floor(total / 60)} ${min} ${total % 60} ${sec}`;
}

const lineClass: Record<DiffLine['t'], string> = {
  ctx: 'text-muted-foreground',
  add: 'bg-success-soft text-success-soft-foreground',
  del: 'bg-destructive-soft text-destructive-soft-foreground',
  hunk: 'bg-muted text-muted-foreground',
};
const signOf: Record<DiffLine['t'], string> = { ctx: ' ', add: '+', del: '−', hunk: ' ' };

const PROSE_FILE = /\.(md|mdx|markdown|txt)$/i;
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
const STRONG_LATIN = /[A-Za-z]/;
/** The first strong letter decides, the way `dir="auto"` does. Passed per line, so an Arabic sentence and an English one in the same hunk each read from their own start. */
const lineDir = (text: string): 'rtl' | 'ltr' => {
  for (const ch of text) {
    if (ARABIC.test(ch)) return 'rtl';
    if (STRONG_LATIN.test(ch)) return 'ltr';
  }
  return 'ltr';
};

/**
 * A unified diff. Each line carries its own direction, with its sign at the line's start. A prose doc (by extension) uses the body font and Cairo for Arabic, a code file stays mono, and a hunk header
 * is always LTR and mono. A sign says what a line is, so colour is never the only signal.
 */
export function DiffView({ lines, wide, label, path, flags }: { lines: DiffLine[]; wide?: boolean; label: string; path?: string; flags?: Record<string, 'open' | 'confirm' | 'remove' | 'keep_flagged'> }) {
  const t = useT(wbMessages);
  const prose = PROSE_FILE.test(path ?? label);
  return (
    <div tabIndex={0} role="group" aria-label={label} data-wb-diff data-wb-diff-kind={prose ? 'prose' : 'code'} className={cn('overflow-auto rounded-md border border-border bg-card text-body-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', !wide && 'max-h-72')}>
      <div className="py-1">
        {lines.map((line, i) => {
          const state = line.flag ? flags?.[line.flag] : undefined;
          const gone = state === 'remove';
          // The preview is what gets saved: a claim kept with its mark shows the mark.
          const shownText = state === 'keep_flagged' ? `> Unverified: ${line.text}` : line.text;
          const hunk = line.t === 'hunk';
          const dir = hunk ? 'ltr' : lineDir(line.text);
          const body = prose && !hunk;
          return (
            <div key={i} dir={dir} data-wb-diff-line={line.t} className={cn('flex gap-2 px-2 text-start', lineClass[line.t], gone && 'line-through')}>
              <span aria-hidden className="key w-3 shrink-0 select-none">
                {signOf[line.t]}
              </span>
              <span className="sr-only">{line.t === 'add' ? t.pro.diff.added : line.t === 'del' ? t.pro.diff.removed : ''}</span>
              <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                <span dir={dir} className={cn('wb-diff-text max-w-full wrap-anywhere whitespace-pre-wrap', body ? 'wb-diff-prose' : 'key')}>
                  {shownText || ' '}
                </span>
                {line.flag && (state === 'open' || state === 'keep_flagged') && (
                  <span data-wb-diff-flag className="inline-flex items-center gap-1 rounded-sm bg-warning-soft px-1 font-sans text-caption font-medium whitespace-nowrap text-warning-soft-foreground">
                    <AlertTriangle aria-hidden className="size-3" strokeWidth={2} />
                    {t.pro.draft.unverified}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CodeBlock({ title, text, tone }: { title: string; text: string; tone?: 'error' }) {
  const t = useT(wbMessages);
  const kit = useT(kitMessages);
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-body-sm font-medium', tone === 'error' ? 'text-destructive-soft-foreground' : 'text-muted-foreground')}>{title}</span>
        <Tip k="tools.copy">
          <IconButton
            label={fmt(t.pro.step.copy, { what: title })}
            title={undefined}
            className="size-11 md:size-7"
            onClick={() => {
              void copyText(text);
              showToast({ message: kit.copy.copied });
            }}
          >
            <Copy aria-hidden className="size-3.5" strokeWidth={1.75} />
          </IconButton>
        </Tip>
      </div>
      <pre dir="ltr" translate="no" tabIndex={0} aria-label={title} className="key max-h-56 overflow-auto rounded-md bg-card p-2 text-start text-body-sm [overflow-wrap:anywhere] whitespace-pre-wrap text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {text}
      </pre>
    </div>
  );
}

const StepIcon = ({ state }: { state: ToolCall['state'] }) =>
  state === 'running' ? <Loader2 className="size-3.5 text-muted-foreground motion-safe:animate-spin" /> : state === 'denied' ? <Ban className="size-3.5 text-destructive-soft-foreground" /> : state === 'failed' ? <AlertTriangle className="size-3.5 text-destructive-soft-foreground" /> : state === 'stopped' ? <CircleStop className="size-3.5 text-muted-foreground" /> : <Check className="size-3.5 text-success-soft-foreground" />;

/** One step. Closed it is a line. Open it shows the exact input, result or error, and who allowed it. Only values the engine reported appear. */
function StepRow({ call, chatId }: { call: ToolCall; chatId: string }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const [open, setOpen] = useState(call.state === 'failed');
  const s = t.pro.step;
  const row = useRef<HTMLLIElement>(null);
  const { reveal } = useWb();
  useEffect(() => {
    if (reveal?.kind !== 'step' || reveal.stepId !== call.id || reveal.chatId !== chatId) return;
    setOpen(true);
    const button = row.current?.querySelector<HTMLElement>('[data-wb-step]');
    window.setTimeout(() => {
      button?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      button?.focus({ preventScroll: true });
    }, 60);
  }, [reveal, call.id, chatId]);
  return (
    <li ref={row} data-wb-step-id={call.id} className="flex min-w-0 flex-col">
      <Tip k="tools.step" side="top" align="start">
        <button type="button" data-wb-step aria-expanded={open} onClick={() => setOpen((v) => !v)} className={cn('flex min-h-11 w-full min-w-0 items-center gap-2 rounded-sm px-1 text-start text-body-sm transition-colors duration-120 hover:bg-accent md:min-h-7', focusRing)}>
          <span className="shrink-0">
            <StepIcon state={call.state} />
          </span>
          <span className="sr-only">{s.states[call.state]}: </span>
          <code dir="ltr" translate="no" className="key shrink-0 font-medium text-foreground">
            {call.name.replace('mcp__hub__', '')}
          </code>
          <code dir="ltr" translate="no" className="key min-w-0 flex-1 truncate text-start text-muted-foreground">
            {call.detail}
          </code>
          {call.result && (
            <span className="shrink-0 text-muted-foreground max-md:hidden">
              <Bidi>{call.result[locale]}</Bidi>
            </span>
          )}
          {call.ms !== undefined && <span className="shrink-0 text-muted-foreground tabular-nums">{duration(call.ms, locale)}</span>}
          <ChevronDown aria-hidden className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform duration-120', open && 'rotate-180')} strokeWidth={1.75} />
        </button>
      </Tip>
      {open && (
        <div data-wb-step-detail className="ms-5 flex min-w-0 flex-col gap-2 py-1.5">
          {call.input && <CodeBlock title={s.input} text={call.input} />}
          {call.output && <CodeBlock title={s.result} text={call.output} />}
          {call.error && <CodeBlock title={s.error} text={call.error} tone="error" />}
          {!call.output && !call.error && call.state !== 'running' && <p className="text-body-sm text-muted-foreground">{s.noOutput}</p>}
          {call.decision && (
            <p className="text-body-sm text-muted-foreground">
              {s.allowedBy}: <span className="text-foreground">{s.decisions[call.decision]}</span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** The folded line. Folded by default, says what is happening now, and opens to the steps. */
function ToolFold({ calls, chatId }: { calls: ToolCall[]; chatId: string }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const failed = calls.some((c) => c.state === 'failed');
  const [open, setOpen] = useState(false);
  const { reveal } = useWb();
  useEffect(() => {
    if (reveal?.kind === 'step' && reveal.chatId === chatId && calls.some((c) => c.id === reveal.stepId)) setOpen(true);
  }, [reveal, calls, chatId]);
  const running = calls.find((c) => c.state === 'running');
  const stopped = calls.some((c) => c.state === 'stopped');
  const [foldedByHand, setFoldedByHand] = useState(false);
  const shown = open || (failed && !foldedByHand);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Tip k="tools.fold" align="start">
        <button
          type="button"
          aria-expanded={shown}
          data-wb-tools
          onClick={() => {
            if (shown) setFoldedByHand(true);
            else setFoldedByHand(false);
            setOpen(!shown);
          }}
          className={cn('-ms-1.5 inline-flex min-h-9 w-fit max-w-full items-center gap-1.5 rounded-md px-1.5 text-body-sm text-muted-foreground transition-colors duration-120 hover:bg-accent hover:text-foreground max-md:min-h-11', focusRing)}
        >
          {running ? <Loader2 aria-hidden className="size-3.5 shrink-0 motion-safe:animate-spin" strokeWidth={2} /> : failed ? <AlertTriangle aria-hidden className="size-3.5 shrink-0 text-destructive-soft-foreground" strokeWidth={2} /> : <Terminal aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />}
          <span className="truncate">{running ? fill(t.tools.running, { name: <Ltr mono>{running.name.replace('mcp__hub__', '')}</Ltr> }) : counted(calls.length, locale, t.tools.summary)}</span>
          {stopped && <span>{t.tools.stopped}</span>}
          <ChevronDown aria-hidden className={cn('size-3.5 shrink-0 transition-transform duration-120', shown && 'rotate-180')} strokeWidth={1.75} />
        </button>
      </Tip>
      {shown && (
        <ul data-wb-steps className="flex min-w-0 flex-col gap-0.5 rounded-md bg-muted p-1.5">
          {calls.map((c) => (
            <StepRow key={c.id} call={c} chatId={chatId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FileRow({ file }: { file: ChangedFile }) {
  const t = useT(wbMessages);
  const [open, setOpen] = useState(false);
  const [large, setLarge] = useState(false);
  return (
    <li className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1">
        <Tip k="turn.file" align="start">
          <button type="button" data-wb-file aria-expanded={open} onClick={() => setOpen((v) => !v)} className={cn('flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-sm px-1 text-start text-body-sm hover:bg-accent md:min-h-7', focusRing)}>
            <FileDiff aria-hidden className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <code dir="ltr" translate="no" className="key min-w-0 flex-1 text-start wrap-anywhere text-foreground">
              {file.path}
            </code>
            {file.additions !== undefined && (
              <span dir="ltr" className="shrink-0 text-success-soft-foreground tabular-nums">
                +{file.additions}
              </span>
            )}
            {file.deletions !== undefined && (
              <span dir="ltr" className="shrink-0 text-destructive-soft-foreground tabular-nums">
                −{file.deletions}
              </span>
            )}
          </button>
        </Tip>
        {open && (
          <Tip k="turn.fileLarge">
            <IconButton label={fmt(t.pro.diff.large, { path: file.path })} title={undefined} className="size-11 md:size-7" onClick={() => setLarge(true)}>
              <Maximize2 aria-hidden className="size-3.5" strokeWidth={1.75} />
            </IconButton>
          </Tip>
        )}
      </div>
      {open && <DiffView lines={file.diff} label={file.path} />}
      <Modal open={large} onOpenChange={setLarge} title={<Ltr mono>{file.path}</Ltr>} className="md:max-w-4xl">
        <DiffView lines={file.diff} wide label={file.path} />
      </Modal>
    </li>
  );
}

const MenuItem = ({ icon: Icon, label, onSelect, disabled, note }: { icon: typeof RotateCcw; label: string; onSelect: () => void; disabled?: boolean; note?: string }) => (
  <DropdownMenu.Item disabled={disabled} onSelect={onSelect} className="flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-2.5 py-1.5 text-body-sm text-foreground outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:text-muted-foreground data-[highlighted]:bg-accent md:min-h-9">
    <Icon aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
    <span className="min-w-0 flex-1">
      <span className="block font-medium">{label}</span>
      {note && <span className="block text-muted-foreground">{note}</span>}
    </span>
  </DropdownMenu.Item>
);

function TurnMenu({ chat, anchorId, copyText: copied, kind }: { chat: Chat; anchorId: string; copyText?: string; kind: 'turn' | 'user' }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const kit = useT(kitMessages);
  const p = t.pro.turn;
  const busy = chat.status !== 'idle' && chat.status !== 'stopped';
  return (
    <DropdownMenu.Root dir={locale === 'ar' ? 'rtl' : 'ltr'} modal={false}>
      <Tip k={kind === 'turn' ? 'turn.menu' : 'user.menu'}>
        <DropdownMenu.Trigger asChild>
          <IconButton label={p.menu} title={undefined} data-wb-turn-menu className="wb-hover-reveal size-11 md:size-7">
            <MoreHorizontal aria-hidden className="size-4" strokeWidth={1.75} />
          </IconButton>
        </DropdownMenu.Trigger>
      </Tip>
      <DropdownMenu.Portal container={portalRoot()}>
        <DropdownMenu.Content align="end" sideOffset={4} collisionPadding={12} className="z-[75] w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {kind === 'turn' && <MenuItem icon={RotateCcw} label={p.retry} note={busy ? t.pro.offTexts.turnBusy : p.retryNote} disabled={busy} onSelect={() => retryTurn(chat.id)} />}
          <MenuItem icon={GitBranch} label={p.branch} note={p.branchNote} onSelect={() => branchFrom(chat.id, anchorId)} />
          {copied && (
            <MenuItem
              icon={Copy}
              label={kind === 'turn' ? p.copyReply : p.copyMessage}
              onSelect={() => {
                void copyText(copied);
                showToast({ message: kit.copy.copied });
              }}
            />
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const turnIcon = { done: Check, failed: AlertTriangle, stopped: CircleStop, interrupted: AlertTriangle } as const;
const turnTone = { done: 'text-success-soft-foreground', failed: 'text-destructive-soft-foreground', stopped: 'text-muted-foreground', interrupted: 'text-warning-strong' } as const;

/**
 * What a turn reports, in one quiet line that opens. A value the engine did not report is simply left out of the line. Opened, the one reader who might
 * wonder gets a plain sentence that it was not reported.
 */
function TurnLine({ chat, item, reply }: { chat: Chat; item: Extract<Item, { kind: 'turn' }>; reply?: string }) {
  const t = useT(wbMessages);
  const wb = useWb();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const { meta } = item;
  const p = t.pro.turn;
  const Icon = turnIcon[meta.state];
  const model = meta.model[0].toUpperCase() + meta.model.slice(1);
  const count = (n: number) => num(n, locale);
  // Only the last turn can be retried, and never beside an open question: Retry next to Redraft is two answers to one failure (review M5).
  const last = [...chat.items].reverse().find((i) => i.kind === 'turn');
  const openChoice = chat.items.some((i) => (i.kind === 'question' && i.question.status === 'pending') || (i.kind === 'draft' && i.draft.status === 'open'));
  const canRetry = meta.state !== 'done' && last?.id === item.id && !openChoice && !engineOff(wb.engine);
  const busy = chat.status !== 'idle' && chat.status !== 'stopped';
  const failure = meta.failure ? t.engine.turnFailures[meta.failure] : null;
  return (
    <div data-wb-turn={meta.state} data-wb-failure={meta.failure} data-wb-usage={meta.usage ? 'yes' : 'no'} className="group flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-1">
        <Tip k="turn.line" align="start">
          <button type="button" data-wb-turn-line aria-expanded={open} onClick={() => setOpen((v) => !v)} className={cn('-ms-1.5 flex min-h-9 min-w-0 items-center gap-x-2.5 overflow-hidden rounded-md px-1.5 text-start text-body-sm whitespace-nowrap text-muted-foreground transition-colors duration-120 hover:bg-accent max-md:min-h-11', focusRing)}>
            <span className="inline-flex items-center gap-1">
              <Icon aria-hidden className={cn('size-3.5', turnTone[meta.state])} strokeWidth={2} />
              <span className={cn(meta.state === 'done' && 'sr-only')}>{failure ?? p.short[meta.state]}</span>
            </span>
            {meta.ms !== undefined && <span className="tabular-nums">{duration(meta.ms, locale)}</span>}
            <span>{model}</span>
            {meta.files && <span>{counted(meta.files.length, locale, p.files)}</span>}
            <ChevronDown aria-hidden className={cn('size-3.5 transition-transform duration-120', open && 'rotate-180')} strokeWidth={1.75} />
          </button>
        </Tip>
        {canRetry && (
          <Tip k="turn.retry" off={busy ? 'turnBusy' : null} label={p.retry}>
            <Button size="sm" variant="ghost" data-wb-retry disabled={busy} onClick={() => retryTurn(chat.id)}>
              <RotateCcw aria-hidden className="size-3.5" strokeWidth={1.75} />
              {p.retry}
            </Button>
          </Tip>
        )}
        <TurnMenu chat={chat} anchorId={item.id} copyText={reply} kind="turn" />
      </div>
      {open && (
        <div data-wb-turn-detail className="flex min-w-0 flex-col gap-2 rounded-md bg-muted p-2.5">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5 text-body-sm">
            <dt className="text-muted-foreground">{p.status}</dt>
            <dd className="text-foreground">
              {p.states[meta.state]}
              {failure ? `: ${failure}` : ''}
            </dd>
            <dt className="text-muted-foreground">{p.mode}</dt>
            <dd className="text-foreground">{t.pro.modes[meta.mode]}</dd>
            <dt className="text-muted-foreground">{p.model}</dt>
            <dd className="text-foreground">
              {model}
              {meta.effort ? `, ${t.pro.efforts[meta.effort]}` : ''}
            </dd>
            {meta.ms !== undefined && (
              <>
                <dt className="text-muted-foreground">{p.duration}</dt>
                <dd className="text-foreground tabular-nums">{duration(meta.ms, locale)}</dd>
              </>
            )}
            {meta.steps !== undefined && (
              <>
                <dt className="text-muted-foreground">{p.stepsLabel}</dt>
                <dd className="text-foreground tabular-nums">{count(meta.steps)}</dd>
              </>
            )}
            {meta.usage && (
              <>
                <dt className="text-muted-foreground">{p.input}</dt>
                <dd className="text-foreground tabular-nums">{count(meta.usage.input)}</dd>
                <dt className="text-muted-foreground">{p.output}</dt>
                <dd className="text-foreground tabular-nums">{count(meta.usage.output)}</dd>
                {meta.usage.cacheRead !== undefined && (
                  <>
                    <dt className="text-muted-foreground">{p.cache}</dt>
                    <dd className="text-foreground tabular-nums">{count(meta.usage.cacheRead)}</dd>
                  </>
                )}
              </>
            )}
          </dl>
          {!meta.usage && <p data-wb-usage-missing className="text-body-sm text-muted-foreground">{p.usageMissing}</p>}
          {meta.files && (
            <div className="flex min-w-0 flex-col gap-1 border-t border-border pt-2">
              <h4 className="text-body-sm font-medium text-muted-foreground">{p.filesTitle}</h4>
              <ul className="flex min-w-0 flex-col gap-0.5">
                {meta.files.map((f) => (
                  <FileRow key={f.path} file={f} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DANGER = /(--force(?:-with-lease)?|\brm\s+-rf\b|&&|\bsudo\b|\bdocker\s+compose\b)/g;
/** The parts of a command worth a second look stand out by weight and underline, and the text itself is untouched. */
function CommandText({ text }: { text: string }) {
  return (
    <>
      {text.split(DANGER).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} data-wb-danger className="wb-danger">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** Presses this soon after the prompt appears are ignored: a click meant for something underneath must not allow a push (review N6). */
const ARM_MS = 400;

/**
 * Inline approval: neutral surface, coloured icon only, the exact command, and neither answer pre-chosen. It never takes focus by itself. The effect line is looked up from the D41 category (§7.2), so it
 * cannot be model text. Allow and Deny have no tooltip, because a tooltip there covers the command at the moment it matters: what they would say is a sentence in the card.
 */
export function ApprovalPrompt({ chatId, request }: { chatId: string; request: ApprovalRequest }) {
  const t = useT(wbMessages);
  const kit = useT(kitMessages);
  const a = t.approval;
  const wb = useWb();
  const answered = request.status !== 'pending';
  const added = request.diff ? request.diff.after.filter((p) => !request.diff!.before.includes(p)) : [];
  const shownAt = useRef(Date.now());
  const commandRef = useRef<HTMLDivElement>(null);
  const [all, setAll] = useState(false);
  const [long, setLong] = useState(false);
  useEffect(() => {
    const el = commandRef.current;
    if (!el) return;
    el.scrollTop = 0;
    setLong(el.scrollHeight > el.clientHeight + 2);
  }, [request.command, all]);
  const armed = () => Date.now() - shownAt.current >= ARM_MS;
  return (
    <section aria-label={a.title} tabIndex={-1} data-wb-approval={request.status} data-wb-waiting={answered ? undefined : true} className="@container flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3 outline-none md:p-4">
      <header className="flex items-start gap-2.5">
        <ShieldQuestion aria-hidden className={cn('mt-0.5 size-5 shrink-0', answered ? 'text-muted-foreground' : 'text-warning-strong')} strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <h3 className="text-body-lg font-semibold text-foreground">{answered ? a.titleClosed : a.title}</h3>
          <p className="text-body-sm text-foreground" data-wb-effect>
            <span className="text-muted-foreground">{a.effectLabel}: </span>
            {a.effects[request.category]}
          </p>
        </div>
      </header>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-body-sm text-muted-foreground">
          <span>{a.command}</span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <FolderOpen aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
            <Ltr mono className="min-w-0 truncate text-body-sm">
              {request.folder}
            </Ltr>
          </span>
        </div>
        <div className="flex items-start gap-1 rounded-md bg-muted p-2">
          <div ref={commandRef} data-wb-command tabIndex={long ? 0 : undefined} data-all={all} className="wb-command min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <code dir="ltr" translate="no" className="key block text-start text-body font-medium [overflow-wrap:anywhere] text-foreground">
              <CommandText text={request.command} />
            </code>
          </div>
          {!answered && (
            <Tip k="approval.copy" side="top" align="end">
              <IconButton
                label={a.copy}
                title={undefined}
                data-wb-approval-copy
                className="shrink-0 md:size-7"
                onClick={() => {
                  void copyText(request.command);
                  showToast({ message: kit.copy.copied });
                }}
              >
                <Copy aria-hidden className="size-3.5" strokeWidth={1.75} />
              </IconButton>
            </Tip>
          )}
        </div>
        {(long || all) && (
          <button type="button" data-wb-command-all aria-expanded={all} onClick={() => setAll((v) => !v)} className={cn('w-fit rounded-sm text-body-sm text-muted-foreground underline underline-offset-2 hover:text-foreground max-md:min-h-11', focusRing)}>
            {all ? a.showLess : a.showAll}
          </button>
        )}
      </div>
      {request.diff && (
        <dl className="grid gap-2 text-body-sm @lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-muted-foreground">{a.before}</dt>
            {request.diff.before.map((p) => (
              <dd key={p} className="min-w-0 break-all">
                <Ltr mono className="text-body-sm text-foreground">
                  {p}
                </Ltr>
              </dd>
            ))}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-muted-foreground">{a.after}</dt>
            {request.diff.after.map((p) => (
              <dd key={p} className="flex min-w-0 flex-wrap items-center gap-1.5 break-all">
                <Ltr mono className={cn('text-body-sm', added.includes(p) ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                  {p}
                </Ltr>
                {added.includes(p) && <Pill tone="warning">{a.added}</Pill>}
              </dd>
            ))}
          </div>
        </dl>
      )}
      {answered ? (
        <p role="status" data-wb-approval-result={request.status} className="inline-flex items-start gap-1.5 text-body-sm font-medium text-foreground">
          {request.status === 'allowed' ? <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-soft-foreground" /> : <Ban aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
          {request.status === 'allowed' ? a.allowed : request.status === 'denied' ? a.denied : request.status === 'timed_out' ? a.timedOut : a.stopped[request.stoppedBy ?? 'turn']}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" data-wb-answers>
            {/* Equal weight on purpose: the page does not lean towards either answer on a sensitive action. */}
            <Button data-wb-allow onClick={() => armed() && answerApproval(chatId, request, true)}>
              {a.allow[request.category]}
            </Button>
            <Button data-wb-deny onClick={() => armed() && answerApproval(chatId, request, false)}>
              {a.deny}
            </Button>
          </div>
          <p className="text-body-sm text-muted-foreground">
            {a.once} {a.denyNote} {fmt(a.expires, { time: request.expiresAt })}. {a.devices}.
          </p>
        </>
      )}
      <span className="sr-only">{wb.engine}</span>
    </section>
  );
}

/** A card Claude made is a real Hub card: it reads the store, so its status follows what happens to it on any page. */
function LiveCard({ cardKey }: { cardKey: string }) {
  const t = useT(wbMessages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const card = useCard(cardKey);
  const { roles, me } = useSession();
  if (!card) return null;
  const action = actionsFor(card, roles, me.id)[0];
  return (
    <Tip k="next.open" align="start">
    <div data-wb-created className="overflow-hidden rounded-lg border border-border">
      <CardRow
        cardKey={card.key}
        type={card.type}
        title={card.title[locale]}
        priority={card.priority}
        variant="flush"
        meta={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <StatusBadge status={card.status} />
            <span className="text-body-sm text-muted-foreground">{t.card.made}</span>
            {card.archivedAt && <span className="text-body-sm text-muted-foreground">{kit.sheet.archive}</span>}
          </span>
        }
        action={action && !card.archivedAt ? <RowAction card={card} action={action.action} size="sm" /> : undefined}
      />
    </div>
    </Tip>
  );
}

function Notice({ item }: { item: Extract<Item, { kind: 'notice' }> }) {
  const locale = useLocale();
  const Icon = item.tone === 'stopped' ? CircleStop : item.tone === 'denied' ? Ban : AlertTriangle;
  return (
    <p role="status" className="flex items-start gap-2 text-body-sm text-muted-foreground">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <span>{item.text[locale]}</span>
    </p>
  );
}

/** A card key that opens the card. */
export function KeyLink({ k }: { k: string }) {
  return (
    <Tip k="next.open">
      <span className="inline-flex">
        <CardKey k={k} link className="hit-44 text-body-sm" />
      </span>
    </Tip>
  );
}

function UserLine({ item, chat }: { item: Extract<Item, { kind: 'user' }>; chat: Chat }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  return (
    <div className="group flex min-w-0 items-start gap-1 rounded-lg bg-muted py-2 ps-3 pe-1">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-body text-foreground">
          <Bidi>{said(locale, item.text)}</Bidi>
        </p>
        {item.context && (item.context.cardKey || item.context.view || item.context.more?.length) && (
          <p className="flex flex-wrap items-center gap-1.5 text-body-sm text-muted-foreground">
            <span>{t.context.sent}</span>
            {item.context.more?.map((k) => (/^GTV-\d+$/.test(k) ? <KeyLink key={k} k={k} /> : <Ltr key={k} mono className="text-body-sm">{k}</Ltr>))}
            {item.context.cardKey ? <KeyLink k={item.context.cardKey} /> : <span>{item.context.view}</span>}
          </p>
        )}
      </div>
      <TurnMenu chat={chat} anchorId={item.id} copyText={said(locale, item.text)} kind="user" />
    </div>
  );
}

/** Starting says why it takes a while: S1 measured 8 to 10 s before anything arrives on a process, and a mode or model change restarts it (§7.2). */
function StatusLine({ chat }: { chat: Chat }) {
  const t = useT(wbMessages);
  const starting = chat.status === 'starting';
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!starting) return;
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [starting]);
  if (chat.status === 'idle' || chat.status === 'stopped' || chat.status === 'streaming' || chat.status === 'tool' || chat.status === 'waiting') return null;
  const label = starting ? (
    fill(t.status.starting, {
      folder: (
        <Ltr mono className="text-body-sm">
          {chat.folder}
        </Ltr>
      ),
    })
  ) : chat.status === 'retrying' ? (
    fmt(t.status.retryLine, { attempt: 2, sec: 2 })
  ) : (
    t.status.thinking
  );
  return (
    <div role="status" data-wb-statusline={chat.status} data-wb-starting-why={chat.starting} className="flex flex-col gap-0.5">
      <p className="inline-flex flex-wrap items-center gap-1.5 text-body-sm font-medium text-muted-foreground">
        <Loader2 aria-hidden className="size-3.5 shrink-0 motion-safe:animate-spin" strokeWidth={2} />
        <span>{label}</span>
        {starting && elapsed > 0 && <span className="tabular-nums">{fmt(t.status.elapsed, { n: elapsed })}</span>}
      </p>
      {starting && (
        <p className="text-body-sm text-muted-foreground">
          {chat.starting ? `${t.status.startingWhy[chat.starting]}. ` : ''}
          {t.status.startingNote}
        </p>
      )}
      {chat.status === 'retrying' && <p className="text-body-sm text-muted-foreground">{t.status.retryNote}</p>}
    </div>
  );
}

/** Announces a block when it is finished, so a screen reader is not read each streamed word. */
function Announcer({ chat }: { chat: Chat }) {
  const locale = useLocale();
  const t = useT(wbMessages);
  const last = chat.items[chat.items.length - 1];
  const done = !last ? '' : last.kind === 'text' && last.shown >= 1 ? last.text[locale] : last.kind === 'approval' && last.request.status === 'pending' ? `${t.approval.title}: ${last.request.command}` : last.kind === 'turn' ? t.pro.turn.states[last.meta.state] : '';
  return (
    <p role="status" aria-live="polite" data-wb-announce className="sr-only">
      {done}
    </p>
  );
}

/** The transcript. It follows the bottom while the owner is at the bottom, and stops following when they scroll up. */
export function Thread({ chat, className, measure }: { chat: Chat; className?: string; measure?: string }) {
  const locale = useLocale();
  const t = useT(wbMessages);
  const wb = useWb();
  const [approvalAway, setApprovalAway] = useState(false);
  const pendingApproval = chat.items.some((i) => (i.kind === 'approval' && i.request.status === 'pending') || (i.kind === 'question' && i.question.status === 'pending'));
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const shownTotal = useMemo(() => chat.items.reduce((n, it) => n + (it.kind === 'text' ? it.shown : it.kind === 'tools' ? it.calls.length : 1), 0), [chat.items]);

  useEffect(() => {
    pinned.current = true;
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.id]);

  /** Is the pending approval outside the scroller? A pill above the composer then leads back to it. */
  const measureAway = () => {
    const el = scroller.current;
    // The answers are what must be in view: a card whose top shows while its Allow and Deny are cut off is still away.
    const answers = el?.querySelector<HTMLElement>('[data-wb-waiting] [data-wb-answers]');
    if (!el || !answers) return setApprovalAway(false);
    const box = el.getBoundingClientRect();
    const c = answers.getBoundingClientRect();
    setApprovalAway(c.bottom > box.bottom + 1 || c.top < box.top - 1);
  };
  const showApproval = () => {
    const card = scroller.current?.querySelector<HTMLElement>('[data-wb-waiting]');
    if (!card) return;
    card.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    card.focus({ preventScroll: true });
    card.setAttribute('data-wb-revealed', 'true');
    window.setTimeout(() => card.removeAttribute('data-wb-revealed'), 1600);
    window.setTimeout(measureAway, 400);
  };
  useEffect(measureAway, [shownTotal, chat.status, pendingApproval]);
  const reveal = wb.reveal;
  useEffect(() => {
    if (!reveal || reveal.kind !== 'approval' || reveal.chatId !== chat.id || getWb().activeId !== chat.id) return;
    // After the pane has laid out: this may be the press that opened it.
    const timer = window.setTimeout(showApproval, 60);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal?.tick, chat.id]);
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [shownTotal, chat.status]);
  // Late fonts and a resized pane change the height with no new message: stay at the bottom through those too.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);

  const lastTextBefore = (index: number) => {
    for (let i = index - 1; i >= 0; i--) {
      const it = chat.items[i];
      if (it.kind === 'text') return it.text[locale];
      if (it.kind === 'user') return undefined;
    }
    return undefined;
  };

  return (
    <div
      ref={scroller}
      data-wb-scroller
      tabIndex={0}
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        measureAway();
      }}
      className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', className)}
    >
      <div role="log" aria-live="off" aria-label={chat.title[locale]} className={cn('mx-auto flex w-full flex-col gap-3 p-3 md:p-4', measure)}>
        {chat.from && (
          <p data-wb-branched className="flex items-start gap-2 text-body-sm text-muted-foreground">
            <GitBranch aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <span>{fmt(t.pro.turn.branchedFrom, { title: chat.from.title[locale] })}</span>
          </p>
        )}
        {chat.items.map((item, index) => {
          switch (item.kind) {
            case 'user':
              return <UserLine key={item.id} item={item} chat={chat} />;
            case 'text':
              return (
                <div key={item.id} data-wb-reply className="wb-prose min-w-0 text-body text-foreground">
                  <MarkdownView source={streamed(item.text[locale], item.shown)} dir={dir} headingOffset={2} />
                </div>
              );
            case 'tools':
              return <ToolFold key={item.id} calls={item.calls} chatId={chat.id} />;
            case 'approval':
              return <ApprovalPrompt key={item.id} chatId={chat.id} request={item.request} />;
            case 'card':
              return <LiveCard key={item.id} cardKey={item.cardKey} />;
            case 'notice':
              return <Notice key={item.id} item={item} />;
            case 'turn':
              return <TurnLine key={item.id} chat={chat} item={item} reply={lastTextBefore(index)} />;
            case 'protocol':
              return <ProtocolCard key={item.id} item={item} />;
            case 'plan':
              return <PlanCard key={item.id} chatId={chat.id} item={item} />;
            case 'report':
              return <ReportCard key={item.id} report={item.report} />;
            case 'question':
              return <QuestionCard key={item.id} chatId={chat.id} item={item} />;
            case 'refused':
              return <RefusedNote key={item.id} item={item} />;
            case 'draft':
              return <DraftCard key={item.id} chatId={chat.id} item={item} />;
            case 'saved':
              return <SavedCard key={item.id} chatId={chat.id} item={item} />;
            case 'links':
              return <LinksCard key={item.id} chatId={chat.id} item={item} />;
            case 'gaps':
              return <GapsCard key={item.id} item={item} />;
            case 'blocked':
              return <Blocked key={item.id} chatId={chat.id} item={item} />;
          }
        })}
        <StatusLine chat={chat} />
        <Announcer chat={chat} />
      </div>
      {approvalAway && pendingApproval && (
        <div className="pointer-events-none sticky inset-x-0 bottom-2 z-10 flex justify-center">
          <button type="button" data-wb-jump onClick={showApproval} className={cn('pointer-events-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-popover px-3 text-body-sm font-medium text-popover-foreground shadow-md hover:bg-accent max-md:min-h-11', focusRing)}>
            <ArrowDown aria-hidden className="size-3.5 shrink-0 text-warning-strong" strokeWidth={2} />
            {t.approval.jump}
          </button>
        </div>
      )}
    </div>
  );
}

/** Small words for a chat's state, used by whichever list shows the chat. */
export function useChatState(chat: Chat) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const pending = chat.items.some((it) => it.kind === 'approval' && it.request.status === 'pending');
  if (pending) return { label: t.status.waiting, tone: 'needs' as const };
  if (chat.items.some((it) => it.kind === 'question' && it.question.status === 'pending')) return { label: t.status.waitingAnswer, tone: 'needs' as const };
  const protocol = [...chat.items].reverse().find((i): i is Extract<Item, { kind: 'protocol' }> => i.kind === 'protocol');
  const live = protocol?.stages.find((g) => g.state === 'running');
  if (live && chat.status !== 'idle' && chat.status !== 'stopped') return { label: t.pro.stages[live.id], tone: 'busy' as const };
  const failed = protocol?.stages.find((g) => g.state === 'failed');
  if (failed && chat.status === 'idle') return { label: fmt(t.pro.protocol.stoppedAt, { stage: t.pro.stages[failed.id] }), tone: 'needs' as const };
  if (chat.status === 'stopped') return { label: t.status.stopped, tone: 'quiet' as const };
  if (chat.status === 'idle') return { label: '', tone: 'quiet' as const };
  void locale;
  if (chat.status === 'starting') return { label: fmt(t.status.starting, { folder: chat.folder.split('/').pop() ?? chat.folder }), tone: 'busy' as const };
  return { label: t.status[chat.status as 'thinking'], tone: 'busy' as const };
}

export const useDeviceName = () => {
  const wb = useWb();
  const locale = useLocale();
  return deviceOf(wb.device).name[locale];
};

export type { TipFact };
