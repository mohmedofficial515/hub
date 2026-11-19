'use client';

/**
 * @file live-page.tsx
 * @description Live: a large page outside the panel for what a chat is doing now. The files its reply touches, each edit as it arrives and the file against
 * HEAD on the device, what Claude is writing, every step, and a preview of the running project. Several chats can run at once; the strip at the top shows
 * each with its state, and `?chat=` picks one. It reads the same live queries as the panel, so nothing here polls.
 */
import type { ChatFullDto } from '@hub/contracts';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CheckCircle2,
  type Circle,
  ExternalLink,
  FileCode2,
  FileDiff,
  FilePlus2,
  Globe,
  Loader2,
  MessageSquare,
  PenLine,
  Play,
  Radio,
  RotateCw,
  Square,
  SquareTerminal,
  XCircle,
} from 'lucide-react';
import { Tabs } from 'radix-ui';
import { useEffect, useMemo, useState } from 'react';

import {
  Bidi,
  Button,
  cn,
  EmptyState,
  ErrorState,
  fmt,
  focusRing,
  IconButton,
  LoadingRegion,
  Ltr,
  MarkdownView,
  num,
  PageContainer,
  PageHeader,
  plural,
  type PluralForms,
  RelativeTime,
  setQuery,
  Skeleton,
  tabTriggerClass,
  TextInput,
  Tip,
  useLocale,
  useRoute,
  useT,
} from '@/components/kit';
import { fillComposer, newChat, openChat, revealChat, useMaybeWb } from '@/components/workbench/store';
import { DiffView } from '@/components/workbench/thread';
import { runningMessage } from '@/features/chat/live';
import { type LiveFile, liveFilesOf, shortPath } from '@/features/chat/live-files';
import { useChat, useChatDiff, useChats, useStopTurn } from '@/features/chat/queries';
import { parseUnifiedDiff, type ToolCall, toolCallOf } from '@/features/chat/thread-items';
import { isHubError } from '@/lib/api/errors';

interface LiveWords {
  waiting: string;
  title: string;
  meta: string;
  chats: string;
  running: string;
  idle: string;
  noChats: string;
  noChatsTitle: string;
  startChat: string;
  errorThing: string;
  gone: { title: string; body: string; action: string };
  newWindow: string;
  follow: string;
  files: string;
  filesCount: PluralForms;
  noFiles: string;
  fromGit: string;
  fromTool: string;
  tabs: { changes: string; writing: string; preview: string; activity: string };
  edits: PluralForms;
  editN: string;
  write: string;
  againstHead: string;
  liveEdits: string;
  loadingDiff: string;
  noDiff: string;
  pickFile: string;
  writingEmpty: string;
  writingNow: string;
  activityEmpty: string;
  preview: {
    url: string;
    placeholder: string;
    go: string;
    reload: string;
    external: string;
    hint: string;
    run: string;
    runPrompt: string;
  };
  stop: string;
  openChat: string;
  steps: Record<ToolCall['state'], string>;
}

const EASE = [0.2, 0.8, 0.2, 1] as const;
const PREVIEW_KEY = 'hub-live-preview';

function readPreview(ws: string) {
  try {
    return localStorage.getItem(`${PREVIEW_KEY}:${ws}`) ?? '';
  } catch {
    return '';
  }
}
function writePreview(ws: string, url: string) {
  try {
    localStorage.setItem(`${PREVIEW_KEY}:${ws}`, url);
  } catch {
    /* Kept for this visit only. */
  }
}

/** A dot that breathes while something runs, and holds still otherwise. */
function StateDot({ running }: { running: boolean }) {
  return (
    <span aria-hidden className="relative flex size-2 shrink-0">
      {running && (
        <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
      )}
      <span
        className={cn(
          'relative inline-flex size-2 rounded-full',
          running ? 'bg-success' : 'bg-muted-foreground/40',
        )}
      />
    </span>
  );
}

/** One chip per chat, the running ones first: several chats can work at once, and this is where to move between them. */
function ChatStrip({ selected }: { selected: string | null }) {
  const w = useT<LiveWords>('live');
  const chats = (useChats().data ?? [])
    .slice()
    .sort((a, b) => Number(b.running) - Number(a.running) || b.updatedAt.localeCompare(a.updatedAt));
  if (chats.length === 0) return null;
  return (
    <nav aria-label={w.chats} className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {chats.slice(0, 12).map((chat) => {
        const on = chat.id === selected;
        return (
          <button
            key={chat.id}
            type="button"
            aria-current={on ? 'true' : undefined}
            onClick={() => setQuery({ chat: chat.id })}
            className={cn(
              // `relative` keeps the chip's sr-only label inside the scrolling strip: unpositioned, it escapes the strip and widens the page.
              'relative flex h-9 max-w-64 shrink-0 items-center gap-2 rounded-full border px-3 text-body-sm transition-[background-color,border-color] duration-150 max-md:h-11',
              on
                ? 'border-primary/40 bg-primary/10 font-semibold text-primary-text'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
              focusRing,
            )}
          >
            <StateDot running={chat.running} />
            <span className="truncate">
              <Bidi>{chat.title || chat.folder}</Bidi>
            </span>
            <span className="sr-only">{chat.running ? w.running : w.idle}</span>
          </button>
        );
      })}
    </nav>
  );
}

function FileList({
  files,
  selected,
  onSelect,
  folder,
}: {
  files: LiveFile[];
  selected: string | null;
  onSelect: (path: string) => void;
  folder: string;
}) {
  const w = useT<LiveWords>('live');
  const locale = useLocale();
  const reduce = useReducedMotion();
  return (
    <section aria-labelledby="live-files" className="glass flex min-h-0 flex-col rounded-2xl">
      <header className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
        <FileCode2 aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
        <h2 id="live-files" className="flex-1 text-body-sm font-semibold text-foreground">
          {w.files}
        </h2>
        <span className="text-caption text-muted-foreground tabular-nums">
          {plural(files.length, locale, w.filesCount)}
        </span>
      </header>
      {files.length === 0 ? (
        <p className="p-4 text-body-sm text-muted-foreground">{w.noFiles}</p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto p-1.5">
          {files.map((file) => {
            const on = file.path === selected;
            const path = shortPath(file.path, folder);
            const name = path.split('/').pop() ?? path;
            const dir = path.slice(0, path.length - name.length);
            const Icon = file.edits.some((e) => e.kind === 'write') ? FilePlus2 : FileDiff;
            return (
              <motion.li
                key={file.path}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } }}
              >
                <button
                  type="button"
                  aria-current={on ? 'true' : undefined}
                  onClick={() => onSelect(file.path)}
                  className={cn(
                    'flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-start transition-colors duration-150 md:min-h-9',
                    on ? 'bg-primary/10 text-foreground ring-1 ring-primary/20' : 'hover:bg-accent',
                    focusRing,
                  )}
                >
                  {file.running ? (
                    <Loader2
                      aria-hidden
                      className="size-4 shrink-0 text-primary motion-safe:animate-spin"
                      strokeWidth={1.75}
                    />
                  ) : (
                    <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  )}
                  <span dir="ltr" className="flex min-w-0 flex-1 flex-col text-start">
                    <span className="key truncate text-body-sm text-foreground">{name}</span>
                    {dir && <span className="key truncate text-caption text-muted-foreground">{dir}</span>}
                  </span>
                  <span dir="ltr" className="flex shrink-0 gap-1 text-caption tabular-nums">
                    {file.additions > 0 && (
                      <span className="text-success-soft-foreground">+{file.additions}</span>
                    )}
                    {file.deletions > 0 && (
                      <span className="text-destructive-soft-foreground">−{file.deletions}</span>
                    )}
                  </span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** One file: the device's diff against HEAD, and below it each edit of this reply as it came. */
function FileChanges({
  chatId,
  file,
  folder,
  version,
}: {
  chatId: string;
  file: LiveFile | null;
  folder: string;
  version: number;
}) {
  const w = useT<LiveWords>('live');
  const locale = useLocale();
  const diff = useChatDiff(chatId, file?.path ?? null);
  const { refetch } = diff;
  // A new edit to the file rereads the device's diff.
  useEffect(() => {
    if (file) void refetch();
  }, [version, file, refetch]);
  if (!file) return <p className="p-6 text-body-sm text-muted-foreground">{w.pickFile}</p>;
  const lines = diff.data?.available ? parseUnifiedDiff(diff.data.diff) : [];
  const path = shortPath(file.path, folder);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <code
          dir="ltr"
          translate="no"
          className="key min-w-0 flex-1 truncate text-body-sm font-semibold text-foreground"
        >
          {path}
        </code>
        <span className="rounded-full bg-muted px-2 py-0.5 text-caption text-muted-foreground">
          {file.changed?.source === 'git' ? w.fromGit : w.fromTool}
        </span>
      </div>
      <section className="flex flex-col gap-2">
        <h3 className="text-caption font-semibold text-muted-foreground">{w.againstHead}</h3>
        {diff.isFetching && !diff.data ? (
          <p className="text-body-sm text-muted-foreground">{w.loadingDiff}</p>
        ) : lines.length ? (
          <DiffView lines={lines} label={path} path={path} wide />
        ) : (
          <p className="text-body-sm text-muted-foreground">{w.noDiff}</p>
        )}
      </section>
      {file.edits.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-caption font-semibold text-muted-foreground">
            {w.liveEdits} · {plural(file.edits.length, locale, w.edits)}
          </h3>
          {file.edits
            .slice()
            .reverse()
            .map((edit, i) => (
              <div key={edit.stepId} className="animate-rise flex flex-col gap-1">
                <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
                  {edit.running && (
                    <Loader2 aria-hidden className="size-3 text-primary motion-safe:animate-spin" />
                  )}
                  {edit.kind === 'write' ? w.write : fmt(w.editN, { n: num(file.edits.length - i, locale) })}
                  {' · '}
                  <RelativeTime iso={edit.at} />
                </p>
                <DiffView lines={edit.lines} label={`${path} ${i + 1}`} path={path} />
              </div>
            ))}
        </section>
      )}
    </div>
  );
}

const stateIcon: Record<ToolCall['state'], { icon: typeof Circle; className: string }> = {
  running: { icon: Loader2, className: 'text-primary motion-safe:animate-spin' },
  ok: { icon: CheckCircle2, className: 'text-success-soft-foreground' },
  failed: { icon: XCircle, className: 'text-destructive-soft-foreground' },
  denied: { icon: XCircle, className: 'text-warning-soft-foreground' },
  stopped: { icon: Square, className: 'text-muted-foreground' },
};

function Activity({ calls }: { calls: ToolCall[] }) {
  const w = useT<LiveWords>('live');
  if (calls.length === 0) return <p className="p-4 text-body-sm text-muted-foreground">{w.activityEmpty}</p>;
  return (
    <ol className="flex flex-col gap-0.5">
      {calls
        .slice()
        .reverse()
        .map((call) => {
          const { icon: Icon, className } = stateIcon[call.state];
          return (
            <li
              key={call.id}
              className="animate-rise flex min-w-0 items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/60"
            >
              <Icon aria-hidden className={cn('mt-0.5 size-3.5 shrink-0', className)} strokeWidth={2} />
              <span className="sr-only">{w.steps[call.state]}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <Ltr mono className="truncate text-caption font-medium text-foreground">
                  {call.name.replace('mcp__hub__', 'hub · ')}
                </Ltr>
                {call.detail && (
                  <code dir="ltr" translate="no" className="key truncate text-caption text-muted-foreground">
                    {call.detail}
                  </code>
                )}
              </span>
            </li>
          );
        })}
    </ol>
  );
}

function Preview() {
  const w = useT<LiveWords>('live').preview;
  const { ws } = useRoute();
  const wb = useMaybeWb();
  const [draft, setDraft] = useState('');
  const [url, setUrl] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const saved = readPreview(ws);
    setDraft(saved);
    setUrl(saved);
  }, [ws]);
  const go = () => {
    const next = draft.trim() && !/^https?:\/\//.test(draft.trim()) ? `http://${draft.trim()}` : draft.trim();
    setUrl(next);
    setDraft(next);
    writePreview(ws, next);
    setTick((n) => n + 1);
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <label htmlFor="live-preview-url" className="sr-only">
          {w.url}
        </label>
        <div className="relative min-w-56 flex-1">
          <Globe
            aria-hidden
            className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
          />
          <TextInput
            id="live-preview-url"
            dir="ltr"
            className="key ps-8 text-start"
            placeholder={w.placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" disabled={!draft.trim()}>
          {w.go}
        </Button>
        <IconButton label={w.reload} variant="outline" disabled={!url} onClick={() => setTick((n) => n + 1)}>
          <RotateCw aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={w.external}
            className={cn(
              'inline-flex size-11 items-center justify-center rounded-md border border-border hover:bg-accent md:size-9',
              focusRing,
            )}
          >
            <ExternalLink aria-hidden className="size-4" strokeWidth={1.75} />
          </a>
        )}
        {wb && (
          <Button variant="ghost" onClick={() => fillComposer(w.runPrompt, 'execute', { show: true })}>
            <Play aria-hidden className="size-4" strokeWidth={2} />
            {w.run}
          </Button>
        )}
      </form>
      {url ? (
        <div className="min-h-[60vh] flex-1 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <iframe
            key={tick}
            title={url}
            src={url}
            className="size-full min-h-[60vh]"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        </div>
      ) : (
        <p className="max-w-prose text-body-sm text-muted-foreground">{w.hint}</p>
      )}
    </div>
  );
}

function ChatLive({ chat }: { chat: ChatFullDto }) {
  const w = useT<LiveWords>('live');
  const { query } = useRoute();
  const tab = paneOf(query.get('pane'));
  const locale = useLocale();
  const stop = useStopTurn(chat.id);
  const running = runningMessage(chat);
  // A running turn that waits on the owner says so here too, with the way to the question or the approval.
  const waits =
    !!running && [...running.approvals, ...running.questions].some((item) => item.status === 'pending');
  const message = running ?? [...chat.messages].reverse().find((m) => m.role === 'assistant') ?? null;
  // Every file the chat touched, across its replies: work resumed in the same chat keeps the earlier edits in view, the newest first.
  const files = useMemo(() => {
    if (!message) return [];
    const replies = chat.messages.filter((m) => m.role === 'assistant');
    const changed = new Map(replies.flatMap((m) => m.changedFiles ?? []).map((f) => [f.path, f]));
    return liveFilesOf({
      ...message,
      steps: replies.flatMap((m) => m.steps),
      changedFiles: [...changed.values()],
    });
  }, [chat.messages, message]);
  const calls = useMemo(() => (message?.steps ?? []).map(toolCallOf), [message]);
  const [follow, setFollow] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const latest = files[0]?.path ?? null;
  const selected = follow ? latest : (picked ?? latest);
  const file = files.find((f) => f.path === selected) ?? null;
  const version = file?.edits.length ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
        <StateDot running={!!running} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-semibold text-foreground">
            <Bidi>{chat.title || chat.folder}</Bidi>
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
            <span className={cn(waits && 'font-semibold text-warning-strong')}>
              {waits ? w.waiting : running ? w.running : w.idle}
            </span>
            <span aria-hidden>·</span>
            <code dir="ltr" className="key truncate">
              {chat.folder}
            </code>
            {chat.branch && (
              <>
                <span aria-hidden>·</span>
                <code dir="ltr" className="key">
                  {chat.branch}
                </code>
              </>
            )}
          </p>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-caption text-muted-foreground md:min-h-0">
          <input
            type="checkbox"
            className="size-4 accent-(--primary)"
            checked={follow}
            onChange={(e) => setFollow(e.target.checked)}
          />
          {w.follow}
        </label>
        <Button
          size="sm"
          variant={waits ? 'primary' : 'outline'}
          onClick={() => {
            openChat(chat.id);
            revealChat(chat.id);
          }}
        >
          <MessageSquare aria-hidden className="size-3.5" strokeWidth={1.75} />
          {w.openChat}
        </Button>
        {running && (
          <Button size="sm" variant="destructive" disabled={stop.isPending} onClick={() => stop.mutate()}>
            <Square aria-hidden className="size-3.5" strokeWidth={2} />
            {w.stop}
          </Button>
        )}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 @page-lg:grid-cols-[17rem_minmax(0,1fr)] @page-xl:grid-cols-[17rem_minmax(0,1fr)_17rem]">
        <FileList
          files={files}
          selected={selected}
          folder={chat.folder}
          onSelect={(path) => {
            setPicked(path);
            setFollow(false);
          }}
        />

        <Tabs.Root
          value={tab}
          onValueChange={(next) => setQuery({ pane: next === 'changes' ? null : next })}
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          className="glass flex min-h-[70vh] min-w-0 flex-col rounded-2xl"
        >
          <Tabs.List
            aria-label={w.title}
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 scrollbar-none"
          >
            <Tabs.Trigger value="changes" className={tabTriggerClass}>
              <FileDiff aria-hidden className="size-4" strokeWidth={1.75} />
              {w.tabs.changes}
            </Tabs.Trigger>
            <Tabs.Trigger value="writing" className={tabTriggerClass}>
              <PenLine aria-hidden className="size-4" strokeWidth={1.75} />
              {w.tabs.writing}
              {running && <StateDot running />}
            </Tabs.Trigger>
            <Tabs.Trigger value="preview" className={tabTriggerClass}>
              <Globe aria-hidden className="size-4" strokeWidth={1.75} />
              {w.tabs.preview}
            </Tabs.Trigger>
            <Tabs.Trigger value="activity" className={cn(tabTriggerClass, '@page-xl:hidden')}>
              <SquareTerminal aria-hidden className="size-4" strokeWidth={1.75} />
              {w.tabs.activity}
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="changes" className="min-h-0 flex-1 overflow-y-auto p-4 outline-none">
            <FileChanges chatId={chat.id} file={file} folder={chat.folder} version={version} />
          </Tabs.Content>
          <Tabs.Content value="writing" className="min-h-0 flex-1 overflow-y-auto p-4 outline-none">
            {message?.content ? (
              <div aria-busy={!!running} className="flex flex-col gap-2">
                {running && (
                  <p className="flex items-center gap-2 text-caption font-medium text-primary-text">
                    <Loader2 aria-hidden className="size-3.5 motion-safe:animate-spin" />
                    {w.writingNow}
                  </p>
                )}
                <MarkdownView source={message.content} dir="auto" headingOffset={2} />
                {running && (
                  <span
                    aria-hidden
                    className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary motion-reduce:animate-none"
                  />
                )}
              </div>
            ) : (
              <p className="text-body-sm text-muted-foreground">{w.writingEmpty}</p>
            )}
          </Tabs.Content>
          <Tabs.Content value="preview" className="flex min-h-0 flex-1 flex-col p-4 outline-none">
            <Preview />
          </Tabs.Content>
          <Tabs.Content value="activity" className="min-h-0 flex-1 overflow-y-auto p-2 outline-none">
            <Activity calls={calls} />
          </Tabs.Content>
        </Tabs.Root>

        <section
          aria-labelledby="live-activity"
          className="glass hidden min-h-0 flex-col rounded-2xl @page-xl:flex"
        >
          <header className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
            <SquareTerminal aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
            <h2 id="live-activity" className="flex-1 text-body-sm font-semibold text-foreground">
              {w.tabs.activity}
            </h2>
            <span className="text-caption text-muted-foreground tabular-nums">
              {num(calls.length, locale)}
            </span>
          </header>
          <div className="max-h-[70vh] min-h-0 overflow-y-auto p-1.5">
            <Activity calls={calls} />
          </div>
        </section>
      </div>
    </div>
  );
}

const PANES = ['changes', 'writing', 'preview', 'activity'] as const;
type Pane = (typeof PANES)[number];
/** The page's own tab. Not `tab`: that one belongs to the card sheet, which clears it on open and close. */
export const paneOf = (value: string | null): Pane =>
  PANES.includes(value as Pane) ? (value as Pane) : 'changes';

function LiveSkeleton({ label, strip }: { label: string; strip: boolean }) {
  return (
    <LoadingRegion label={label} className="gap-4">
      {strip && (
        <div className="flex gap-1.5">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-40 rounded-full" />
          ))}
        </div>
      )}
      <Skeleton className="h-[60vh] w-full rounded-2xl" />
    </LoadingRegion>
  );
}

export function LivePage() {
  const w = useT<LiveWords>('live');
  const { query, locale, ws } = useRoute();
  const wb = useMaybeWb();
  const chatsQuery = useChats();
  const chats = chatsQuery.data ?? [];
  const fromUrl = query.get('chat');
  const fallback = chats.find((c) => c.running)?.id ?? wb?.activeId ?? chats[0]?.id ?? null;
  const chatId = fromUrl ?? fallback;
  const chat = useChat(chatId);
  const gone = chat.isError && isHubError(chat.error) && chat.error.status === 404;

  const body = () => {
    // The list decides which chat to show, so "no chats yet" waits for it: while it loads or fails, it would not be true.
    if (!fromUrl && chatsQuery.isPending) return <LiveSkeleton label={w.title} strip />;
    if (!fromUrl && chatsQuery.isError && !chatsQuery.data) {
      const error = chatsQuery.error;
      return (
        <ErrorState
          thing={w.errorThing}
          code={isHubError(error) ? error.code : undefined}
          requestId={isHubError(error) ? error.requestId : undefined}
          onRetry={() => void chatsQuery.refetch()}
        />
      );
    }
    if (!chatId) {
      return (
        <EmptyState
          icon={Radio}
          title={w.noChatsTitle}
          action={
            wb ? (
              <Button
                variant="primary"
                onClick={() => {
                  newChat();
                  fillComposer('', undefined, { show: true });
                }}
              >
                <MessageSquare aria-hidden className="size-4" strokeWidth={1.75} />
                {w.startChat}
              </Button>
            ) : undefined
          }
        >
          {w.noChats}
        </EmptyState>
      );
    }
    if (chat.data) return <ChatLive key={chat.data.id} chat={chat.data} />;
    if (gone) {
      return (
        <EmptyState
          icon={Radio}
          title={w.gone.title}
          action={<Button onClick={() => setQuery({ chat: null })}>{w.gone.action}</Button>}
        >
          {w.gone.body}
        </EmptyState>
      );
    }
    if (chat.isError) {
      const error = chat.error;
      return (
        <ErrorState
          thing={w.errorThing}
          code={isHubError(error) ? error.code : undefined}
          requestId={isHubError(error) ? error.requestId : undefined}
          onRetry={() => void chat.refetch()}
        />
      );
    }
    return <LiveSkeleton label={w.title} strip={false} />;
  };

  return (
    <PageContainer className="max-w-440">
      <PageHeader
        title={w.title}
        meta={w.meta}
        actions={
          <Tip content={{ what: w.newWindow }}>
            <Button
              variant="outline"
              onClick={() =>
                window.open(
                  `/${locale}/${ws}/live${chatId ? `?chat=${chatId}` : ''}`,
                  'hub-live',
                  'popup,width=1440,height=900',
                )
              }
            >
              <ExternalLink aria-hidden className="size-4" strokeWidth={1.75} />
              {w.newWindow}
            </Button>
          </Tip>
        }
      />

      <ChatStrip selected={chatId} />

      {body()}
    </PageContainer>
  );
}
