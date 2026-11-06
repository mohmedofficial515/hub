'use client';

/**
 * @file composer.tsx
 * @description The composer: three rows inside one box, with nothing outside it, whose height never moves. What goes with the message, the text, then the attachments, the modes and Send. Ported from the approved design, `apps/lab/hub/workbench/v6-edge-strip-port/core/composer.tsx`.
 */
import { type ChatSuggestion, HUB_SKILLS, suggestedPrompts } from '@hub/contracts';
import {
  ArrowUp,
  BookText,
  Check,
  ChevronDown,
  Crosshair,
  File as FileIcon,
  FolderOpen,
  Laptop,
  Monitor,
  Paperclip,
  Plus,
  Smartphone,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  Button,
  CardPicker,
  cn,
  DocPicker,
  fmt,
  focusRing,
  focusRingInset,
  getCard,
  IconButton,
  kitMessages,
  Ltr,
  matchKey,
  Modal,
  openCard,
  portalRoot,
  RoleBadge,
  showToast,
  TextInput,
  Tip,
  type TipFact,
  TypeIcon,
  useKeyLabels,
  useLocale,
  useRoving,
  useSession,
  useT,
} from '@/components/kit';
import { toActionable } from '@/features/cards/rules';

import {
  attach,
  chatIsBusy,
  clearFollowOffer,
  detach,
  EFFORTS,
  engineBlocks,
  fillComposer,
  type Mode,
  type ModelId,
  MODELS,
  MODES,
  removeTemplate,
  saveTemplate,
  send,
  setDevice,
  setEffort,
  setFolder,
  setLeaveOut,
  setMode,
  setModel,
  setPersona,
  setPref,
  stopTurn,
  usePrefs,
  useWb,
  useWorkContext,
} from './store';
import type { ChatMessages } from './words';

/** A folder's last name, on either kind of slash. */
const lastName = (path: string) => path.split(/[\\/]/).pop() ?? path;
/** The reason a control is off, while the engine cannot run anything. */
const offOf = (engine: Parameters<typeof engineBlocks>[0]) =>
  engineBlocks(engine) ? (engine as 'offline') : null;
const deviceIconOf = (platform: string | undefined) =>
  platform === 'android' || platform === 'ios' ? Smartphone : platform === 'darwin' ? Laptop : Monitor;

const itemClass =
  'flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-2.5 py-1.5 text-body-sm text-foreground outline-none select-none data-[highlighted]:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:text-muted-foreground md:min-h-9';
const triggerClass = cn(
  'inline-flex h-11 min-w-0 max-w-full items-center gap-1 rounded-md px-1.5 text-body-sm whitespace-nowrap text-muted-foreground transition-colors duration-120 hover:bg-accent hover:text-foreground md:h-7',
  focusRing,
);
const labelClass = 'px-2.5 py-1.5 text-body-sm font-medium text-muted-foreground';

export function Menu({
  trigger,
  label,
  children,
  side = 'top',
  align = 'start',
}: {
  trigger: ReactNode;
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | undefined;
  align?: 'start' | 'end' | undefined;
}) {
  const locale = useLocale();
  return (
    <DropdownMenu.Root dir={locale === 'ar' ? 'rtl' : 'ltr'} modal={false}>
      <DropdownMenu.Trigger asChild aria-label={label}>
        {trigger}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalRoot()}>
        <DropdownMenu.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className="z-[75] max-h-[min(70dvh,30rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// ── Modes ───────────────────────────────────────────────────────────────────────────────────────

/** Ask, Plan, Execute: always in view, and the one thing here that is never folded. `Alt+1` to `Alt+3` from anywhere. One Tab stop, as every segmented control. */
export function ModeSwitch() {
  const t = useT<ChatMessages>('chat').panel;
  const wb = useWb();
  const { root, groupProps, itemProps } = useRoving(MODES.indexOf(wb.mode));
  return (
    <div
      ref={root}
      role="toolbar"
      aria-label={t.pro.modeGroup}
      {...groupProps}
      data-wb-modes
      className="inline-flex shrink-0 rounded-md border border-border bg-card md:p-0.5"
    >
      {MODES.map((mode, i) => {
        const active = wb.mode === mode;
        return (
          <Tip key={mode} k={`mode.${mode}` as 'mode:ask'} keys={[`Alt ${i + 1}`]}>
            <button
              type="button"
              data-wb-mode={mode}
              aria-pressed={active}
              aria-keyshortcuts={`Alt+${i + 1}`}
              {...itemProps(i)}
              onClick={() => setMode(mode)}
              className={cn(
                'inline-flex h-11 shrink-0 items-center justify-center rounded-sm px-2 text-body-sm font-medium whitespace-nowrap max-md:min-w-11 transition-colors duration-120 md:h-7',
                active
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                focusRingInset,
              )}
            >
              {t.pro.modes[mode]}
            </button>
          </Tip>
        );
      })}
    </div>
  );
}

export function useModeKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (i < 0) return;
      e.preventDefault();
      setMode(MODES[i] as Mode);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

// ── Model and effort ────────────────────────────────────────────────────────────────────────────

export function ModelPicker({ side }: { side?: 'top' | 'bottom' | undefined }) {
  const t = useT<ChatMessages>('chat').panel;
  const tipWords = useT<ChatMessages>('chat').tips;
  const wb = useWb();
  const model = MODELS.find((m) => m.id === wb.model) ?? { id: 'default' as ModelId, effort: true };
  const words = t.pro.models;
  const name = words[model.id].name;
  const f = tipWords.facts;
  const supported = wb.engineStatus;
  const canEffort = model.effort && supported?.effortSupported !== false;
  const canModel = supported?.modelSupported !== false;
  const facts: TipFact[] = [
    [f.model, name],
    ...(canEffort ? ([[f.effort, t.pro.efforts[wb.effort]]] as TipFact[]) : []),
  ];
  return (
    <Menu
      side={side}
      label={`${t.pro.modelLabel}: ${name}${canEffort ? `, ${t.pro.efforts[wb.effort]}` : ''}`}
      trigger={
        <Tip k="model" facts={facts}>
          <button type="button" data-wb-model className={cn(triggerClass, 'shrink-0')}>
            <span>{name}</span>
            <ChevronDown aria-hidden className="size-3 shrink-0 max-md:hidden" strokeWidth={2} />
          </button>
        </Tip>
      }
    >
      <DropdownMenu.Label className={labelClass}>{t.pro.modelLabel}</DropdownMenu.Label>
      {MODELS.map((m) => (
        <DropdownMenu.Item
          key={m.id}
          disabled={!canModel && m.id !== 'default'}
          data-wb-model-item={m.id}
          className={itemClass}
          onSelect={(e) => {
            e.preventDefault();
            setModel(m.id);
          }}
        >
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{words[m.id].name}</span>
            <span className="block text-muted-foreground">{words[m.id].note}</span>
          </span>
          {m.id === wb.model && <Check aria-hidden className="mt-0.5 size-4 shrink-0" />}
        </DropdownMenu.Item>
      ))}
      <DropdownMenu.Separator className="my-1 h-px bg-border" />
      <DropdownMenu.Label className={labelClass}>{t.pro.effortLabel}</DropdownMenu.Label>
      {!canEffort && (
        <p data-wb-effort-off className="px-2.5 pb-1 text-body-sm text-muted-foreground">
          {fmt(t.pro.effortOff, { model: name })}
        </p>
      )}
      {EFFORTS.map((e) => (
        <DropdownMenu.Item
          key={e}
          disabled={!canEffort}
          data-wb-effort-item={e}
          className={cn(itemClass, 'items-center')}
          onSelect={(ev) => {
            ev.preventDefault();
            setEffort(e);
          }}
        >
          <span className="flex-1">{t.pro.efforts[e]}</span>
          {canEffort && e === wb.effort && <Check aria-hidden className="size-4 shrink-0" />}
        </DropdownMenu.Item>
      ))}
    </Menu>
  );
}

// ── Where it runs ───────────────────────────────────────────────────────────────────────────────

/** Device, folder and persona folded into one control, because they rarely change. The tooltip still names all three. */
export function WherePicker({ side }: { side?: 'top' | 'bottom' | undefined }) {
  const t = useT<ChatMessages>('chat').panel;
  const tipWords = useT<ChatMessages>('chat').tips;
  const kit = useT(kitMessages);
  const wb = useWb();
  const { roles } = useSession();
  const persona =
    wb.persona && roles.includes(wb.persona as (typeof roles)[number]) ? wb.persona : (roles[0] ?? 'owner');
  const roleWord = (kit.roles as Record<string, string>)[persona] ?? persona;
  const Icon = deviceIconOf(wb.device?.platform);
  const folder = wb.folderNow ?? '';
  const short = lastName(folder);
  const f = tipWords.facts;
  const focusOf = (role: string) => (t.pro.personas as Record<string, string>)[role] ?? t.pro.personas.other;
  return (
    <Menu
      side={side}
      align="end"
      label={`${t.picker.device}: ${wb.deviceName}. ${t.picker.folder}: ${folder}. ${fmt(t.picker.workingAs, { role: roleWord })}`}
      trigger={
        <Tip
          k="where"
          facts={[
            [f.device, wb.deviceName],
            [f.folder, folder, true],
            [f.persona, roleWord],
          ]}
        >
          <button type="button" data-wb-where className={cn(triggerClass, 'max-w-30')}>
            <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
            <Ltr mono className="min-w-0 truncate text-body-sm">
              {short}
            </Ltr>
            <ChevronDown aria-hidden className="size-3 shrink-0 max-md:hidden" strokeWidth={2} />
          </button>
        </Tip>
      }
    >
      <DropdownMenu.Label className={labelClass}>{t.picker.device}</DropdownMenu.Label>
      {wb.devices.map((d) => {
        const DIcon = deviceIconOf(d.platform);
        return (
          <DropdownMenu.Item
            key={d.id}
            disabled={!d.online}
            data-wb-device-item={d.id}
            className={itemClass}
            onSelect={() => {
              if (d.id === wb.device?.id) return;
              setDevice(d.id);
              showToast({ message: fmt(t.picker.deviceChange, { device: d.name }) });
            }}
          >
            <DIcon aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                <bdi>{d.name}</bdi>
              </span>
              {!d.online && <span className="block text-muted-foreground">{t.picker.offline}</span>}
            </span>
            {d.id === wb.device?.id && <Check aria-hidden className="mt-0.5 size-4 shrink-0" />}
          </DropdownMenu.Item>
        );
      })}
      <DropdownMenu.Separator className="my-1 h-px bg-border" />
      <DropdownMenu.Label className={labelClass}>{t.picker.folder}</DropdownMenu.Label>
      {wb.folders.map((path) => (
        <DropdownMenu.Item
          key={path}
          data-wb-folder-item={path}
          className={cn(itemClass, 'items-center')}
          onSelect={() => {
            if (path === folder) return;
            setFolder(path);
            showToast({ message: t.picker.folderChange });
          }}
        >
          <FolderOpen aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
          <Ltr mono className="min-w-0 flex-1 text-start text-body-sm break-all">
            {path}
          </Ltr>
          {path === folder && <Check aria-hidden className="size-4 shrink-0" />}
        </DropdownMenu.Item>
      ))}
      <DropdownMenu.Separator className="my-1 h-px bg-border" />
      <DropdownMenu.Label className={labelClass}>{t.picker.persona}</DropdownMenu.Label>
      {roles.map((role) => (
        <DropdownMenu.Item key={role} className={itemClass} onSelect={() => setPersona(role)}>
          <RoleBadge role={role} iconOnly className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{(kit.roles as Record<string, string>)[role] ?? role}</span>
            <span className="block text-muted-foreground">{focusOf(role)}</span>
          </span>
          {role === persona && <Check aria-hidden className="mt-0.5 size-4 shrink-0" />}
        </DropdownMenu.Item>
      ))}
    </Menu>
  );
}

// ── Context, attachments and suggestions ────────────────────────────────────────────────────────

const chip =
  'inline-flex h-7 min-w-0 max-w-full items-center gap-1 rounded-md bg-muted px-2 text-body-sm text-foreground';

/**
 * The one chip for "this", then what the owner attached, on one line that never wraps. The chip names one thing: the open card, otherwise the open doc, otherwise the page, with the project in front only
 * when the chat's project differs from the page's. Pressing the chip takes it out of the next message, so the chip and its × are one Tab stop. A small mark appears only when Follow the chat opened the card by itself.
 */
export function ContextTray() {
  const t = useT<ChatMessages>('chat').panel;
  const tipWords = useT<ChatMessages>('chat').tips;
  const wb = useWb();
  const ctx = useWorkContext();
  const { follow } = usePrefs();
  const f = tipWords.facts;
  const key = ctx.cardKey ?? ctx.doc?.key ?? `page:${ctx.view}`;
  const left = wb.leaveOut === key;
  const facts: TipFact[] = [
    [f.project, ctx.projectName],
    [f.page, ctx.pageName],
    ...(ctx.cardKey ? ([[f.card, ctx.cardKey, true]] as TipFact[]) : []),
    ...(ctx.doc ? ([[f.doc, ctx.doc.path, true]] as TipFact[]) : []),
  ];
  const name = ctx.cardKey ?? (ctx.doc ? lastName(ctx.doc.path) : ctx.pageName);
  const followedHere = follow && !!ctx.cardKey && wb.followed === ctx.cardKey;
  return (
    <ul
      aria-label={t.context.label}
      data-wb-chips
      className="wb-nowrap-row min-w-0 flex-1 gap-1 overflow-hidden"
    >
      <li className="flex min-w-0 shrink" data-wb-chip-auto data-wb-left={left || undefined}>
        <Tip k={left ? 'ctx:back' : 'ctx:auto'} facts={facts} align="start">
          <button
            type="button"
            data-wb-chip-leave
            aria-pressed={left}
            aria-label={fmt(left ? t.pro.ctx.back : t.pro.ctx.leave, { name })}
            onClick={() => setLeaveOut(left ? null : key)}
            className={cn(
              chip,
              'hover:bg-accent',
              left && 'bg-transparent text-muted-foreground line-through',
              focusRing,
            )}
          >
            {ctx.card && <TypeIcon type={ctx.card.type} size="sm" />}
            {ctx.card || ctx.doc ? (
              <Ltr mono className="truncate text-body-sm font-medium">
                {name}
              </Ltr>
            ) : (
              <span className="truncate font-medium">{name}</span>
            )}
            {left ? (
              <Plus aria-hidden className="size-3 shrink-0 text-muted-foreground" strokeWidth={2} />
            ) : (
              <X aria-hidden className="size-3 shrink-0 text-muted-foreground" strokeWidth={2} />
            )}
          </button>
        </Tip>
      </li>
      {wb.followOffer && wb.followOffer !== ctx.cardKey && (
        <li className="flex shrink-0">
          <Tip k="ctx:followOffer" vars={{ key: wb.followOffer }}>
            <button
              type="button"
              data-wb-follow-offer
              onClick={() => {
                if (wb.followOffer) openCard(wb.followOffer);
                clearFollowOffer();
              }}
              className={cn(chip, 'hover:bg-accent', focusRing)}
            >
              {fmt(t.pro.ctx.followOffer, { key: wb.followOffer })}
            </button>
          </Tip>
        </li>
      )}
      {followedHere && (
        <li className="flex shrink-0">
          <Tip k="ctx:followOn">
            <button
              type="button"
              data-wb-follow-mark
              aria-pressed
              aria-label={t.pro.ctx.followOpened}
              onClick={() => setPref('follow', false)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md text-foreground hover:bg-accent',
                focusRing,
              )}
            >
              <Crosshair aria-hidden className="size-3.5" strokeWidth={2} />
            </button>
          </Tip>
        </li>
      )}
      {wb.attachments.map((a) => {
        const Icon = a.kind === 'card' ? null : a.kind === 'doc' ? BookText : FileIcon;
        const card = a.kind === 'card' ? getCard(a.key) : undefined;
        return (
          <li key={a.key} className="flex min-w-0 shrink" data-wb-attachment={a.kind}>
            <Tip
              k="ctx:detach"
              facts={[
                [a.kind === 'card' ? f.card : a.kind === 'doc' ? f.doc : t.pro.ctx.file, a.label, true],
              ]}
              align="start"
            >
              <button
                type="button"
                aria-label={fmt(t.pro.ctx.remove, { name: a.label })}
                onClick={() => detach(a.key)}
                className={cn(chip, 'hover:bg-accent', focusRing)}
              >
                {card && <TypeIcon type={card.type} size="sm" />}
                {Icon && (
                  <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                )}
                <Ltr mono className="truncate text-body-sm font-medium">
                  {lastName(a.label)}
                </Ltr>
                <X aria-hidden className="size-3 shrink-0 text-muted-foreground" strokeWidth={2} />
              </button>
            </Tip>
          </li>
        );
      })}
    </ul>
  );
}

/** Shown only in an empty chat, as its body, so they can never move the composer or re-run anything after a turn. A press fills the box and sets the mode. Nothing runs until the owner sends (D51). */
export function Suggestions({ className }: { className?: string | undefined }) {
  const t = useT<ChatMessages>('chat');
  const panel = t.panel;
  const ctx = useWorkContext();
  const { roles, me } = useSession();
  const subject = ctx.card ?? ctx.docCard;
  const list = suggestedPrompts({
    page: ctx.view,
    card: subject ? { ...toActionable(subject), key: subject.key } : null,
    roles,
    memberId: me.id,
  }).slice(0, 3);
  const words = (s: ChatSuggestion) => {
    const entry = t.suggestions[s.id] as { label: string; prompt: string; runs?: string };
    return { label: entry.label, prompt: fmt(entry.prompt, { key: s.key ?? '' }), runs: entry.runs };
  };
  const press = (s: ChatSuggestion) => {
    const { prompt } = words(s);
    if (s.onPress === 'fill') {
      fillComposer(prompt, s.mode);
      return;
    }
    void send({
      text: prompt,
      mode: s.mode,
      context: ctx.cardKey ? { card: ctx.cardKey } : { page: ctx.pageName },
    });
  };
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <ul aria-label={panel.pro.suggestions} data-wb-suggestions className="flex min-w-0 flex-col gap-1">
        {list.map((s) => {
          const w = words(s);
          return (
            <li key={s.id} className="min-w-0">
              <Tip
                content={{
                  what: w.prompt,
                  then: w.runs ?? (s.onPress === 'run' ? undefined : t.tips.items.suggestion.then),
                }}
                align="start"
              >
                <button
                  type="button"
                  data-wb-suggestion={s.id}
                  data-wb-suggestion-press={s.onPress}
                  data-wb-suggestion-mode={s.mode}
                  onClick={() => press(s)}
                  className={cn(
                    'flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-start text-body-sm text-foreground transition-colors duration-120 hover:bg-accent md:min-h-8',
                    focusRing,
                  )}
                >
                  <span className="min-w-0">{w.label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {fmt(s.onPress === 'run' ? panel.empty.rowRuns : panel.empty.rowFills, {
                      mode: panel.pro.modes[s.mode],
                    })}
                  </span>
                </button>
              </Tip>
            </li>
          );
        })}
      </ul>
      <p data-wb-suggestions-note className="text-body-sm text-muted-foreground">
        {panel.empty.note}
      </p>
    </div>
  );
}

/** No bridge action lists a folder, so the owner names the file. Claude reads it from the chosen folder. */
function FilePicker({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT<ChatMessages>('chat').panel;
  const wb = useWb();
  const [path, setPath] = useState('');
  const add = () => {
    const value = path.trim();
    if (!value) return;
    attach({ kind: 'file', key: value, label: value });
    setPath('');
    onOpenChange(false);
  };
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t.pro.attach.fileTitle}
      description={fmt(t.pro.attach.fileBody, { folder: wb.folderNow ?? '' })}
      footer={
        <Button variant="primary" data-wb-file-add disabled={!path.trim()} onClick={add}>
          {t.pro.attach.fileAdd}
        </Button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <TextInput
          data-autofocus
          data-wb-file-path
          dir="ltr"
          className="key text-start"
          aria-label={t.pro.attach.fileLabel}
          placeholder="src/index.ts"
          value={path}
          onChange={(e) => setPath(e.target.value)}
        />
      </form>
    </Modal>
  );
}

/** Attach and Templates fold into one `+`, so they stop costing the composer two icons at rest. */
function AddMenu({ text, onPick }: { text: string; onPick: (value: string) => void }) {
  const t = useT<ChatMessages>('chat').panel;
  const tipWords = useT<ChatMessages>('chat').tips;
  const ctx = useWorkContext();
  const wb = useWb();
  const a = t.pro.attach;
  const p = t.pro.templates;
  const [picker, setPicker] = useState<'card' | 'doc' | 'file' | null>(null);
  return (
    <>
      <Menu
        label={t.pro.ctx.add}
        trigger={
          <Tip
            k={wb.pageAside ? 'attach:aside' : 'attach'}
            facts={[[tipWords.facts.project, ctx.projectName]]}
          >
            <IconButton label={t.pro.ctx.add} title={undefined} data-wb-add className="size-11 md:size-7">
              <Paperclip aria-hidden className="size-4" strokeWidth={1.75} />
            </IconButton>
          </Tip>
        }
      >
        <DropdownMenu.Label className={labelClass}>{a.label}</DropdownMenu.Label>
        <DropdownMenu.Item
          data-wb-attach-card
          className={cn(itemClass, 'items-center')}
          onSelect={() => setPicker('card')}
        >
          {a.card}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          data-wb-attach-doc
          className={cn(itemClass, 'items-center')}
          onSelect={() => setPicker('doc')}
        >
          {a.doc}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          data-wb-attach-file
          className={cn(itemClass, 'items-center')}
          onSelect={() => setPicker('file')}
        >
          {a.file}
        </DropdownMenu.Item>
        <DropdownMenu.Separator className="my-1 h-px bg-border" />
        <DropdownMenu.Label className={labelClass}>
          {fmt(p.title, { project: ctx.projectName })}
        </DropdownMenu.Label>
        {wb.templates.length === 0 && (
          <p className="px-2.5 py-1.5 text-body-sm text-muted-foreground">{p.empty}</p>
        )}
        {wb.templates.map((x) => (
          <div key={x.id} className="flex min-w-0 items-start gap-1">
            <DropdownMenu.Item
              data-wb-template={x.id}
              className={cn(itemClass, 'min-w-0 flex-1')}
              onSelect={() => onPick(x.body)}
            >
              <span className="min-w-0">
                <span className="block font-medium">
                  <bdi>{x.title}</bdi>
                </span>
                <span className="block truncate text-muted-foreground">
                  <bdi>{x.body}</bdi>
                </span>
              </span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              aria-label={fmt(p.remove, { name: x.title })}
              className={cn(itemClass, 'shrink-0 items-center')}
              onSelect={(e) => {
                e.preventDefault();
                removeTemplate(x.id);
              }}
            >
              <Trash2 aria-hidden className="size-3.5" strokeWidth={1.75} />
            </DropdownMenu.Item>
          </div>
        ))}
        <DropdownMenu.Item
          disabled={!text.trim()}
          data-wb-template-save
          className={itemClass}
          onSelect={() => saveTemplate(text.trim().slice(0, 28), text.trim(), p.saved)}
        >
          <span className="min-w-0">
            <span className="block font-medium">{p.save}</span>
            {!text.trim() && <span className="block text-muted-foreground">{p.saveOff}</span>}
          </span>
        </DropdownMenu.Item>
      </Menu>
      <CardPicker
        open={picker === 'card'}
        onOpenChange={(o) => !o && setPicker(null)}
        title={a.card}
        onConfirm={(keys) => {
          keys.forEach((k) => attach({ kind: 'card', key: k, label: k }));
          setPicker(null);
        }}
      />
      <DocPicker
        open={picker === 'doc'}
        onOpenChange={(o) => !o && setPicker(null)}
        title={a.doc}
        onConfirm={(keys) => {
          keys.forEach((k) => {
            const card = getCard(k);
            attach({ kind: 'doc', key: k, label: card && 'doc' in card ? card.doc.path : k });
          });
          setPicker(null);
        }}
      />
      <FilePicker open={picker === 'file'} onOpenChange={(o) => !o && setPicker(null)} />
    </>
  );
}

/**
 * The composer. `/` at the start opens the skills menu, a real combobox: arrows move, Enter or Tab picks, Esc closes. Enter sends and Shift+Enter is a
 * new line. A running turn turns Send into Stop, because a chat runs one turn at a time. Typing stays free while a turn runs.
 */
export function Composer({
  autoFocus,
  menuSide = 'top',
  rows = 1,
  className,
}: {
  autoFocus?: boolean | undefined;
  menuSide?: 'top' | 'bottom' | undefined;
  rows?: number | undefined;
  className?: string | undefined;
}) {
  const t = useT<ChatMessages>('chat').panel;
  const locale = useLocale();
  const wb = useWb();
  const ctx = useWorkContext();
  const id = useId();
  const key = useKeyLabels();
  const input = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [selected, setSelected] = useState(0);
  const [slashClosed, setSlashClosed] = useState(false);
  const [focused, setFocused] = useState(false);
  const chat = wb.chat;
  const busy = chatIsBusy(chat?.status);
  const off0 = engineBlocks(wb.engine);
  const blocked = off0 || !wb.ready;
  const slashOpen = text.startsWith('/') && !text.includes(' ') && !slashClosed && !blocked;
  // The slash starts the menu and is not part of the search, so `/review` finds `/code-review`.
  // Hub's own, from the plugin, then what the engine reported for this folder on the last turn. Before a first turn there is nothing else to name.
  const skills = useMemo(() => {
    const hub = HUB_SKILLS.map((name) => ({
      name,
      source: 'hub' as const,
      about: (t.pro.skills as Record<string, string>)[name] ?? '',
    }));
    const known = new Set<string>(hub.map((s) => s.name));
    const other = (chat?.skills ?? [])
      .map((name) => (name.startsWith('/') ? name : `/${name}`))
      .filter((name) => !known.has(name))
      .map((name) => ({ name, source: 'folder' as const, about: '' }));
    return [...hub, ...other];
  }, [chat?.skills, t.pro.skills]);
  const matches = useMemo(
    () => (slashOpen ? skills.filter((s) => s.name.toLowerCase().includes(text.slice(1).toLowerCase())) : []),
    [slashOpen, skills, text],
  );
  const groups = useMemo(
    () =>
      (['hub', 'folder'] as const)
        .map((source) => [source, matches.filter((m) => m.source === source)] as const)
        .filter(([, list]) => list.length),
    [matches],
  );
  const flat = useMemo(() => groups.flatMap(([, list]) => list), [groups]);

  useEffect(() => {
    if (autoFocus) input.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  useEffect(() => setSelected(0), [text]);
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  // A suggestion or a plan fills the box, and nothing runs until the owner sends it (D51).
  const lastFill = useRef(0);
  useEffect(() => {
    if (!wb.fill || wb.fill.tick === lastFill.current) return;
    lastFill.current = wb.fill.tick;
    setText(wb.fill.text);
    input.current?.focus();
  }, [wb.fill]);

  const pick = (s: { name: string }) => {
    setText(`${s.name} `);
    input.current?.focus();
  };
  const submit = () => {
    const value = text.trim();
    if (!value || blocked || busy) return;
    setText('');
    const auto = ctx.cardKey ?? ctx.doc?.key ?? `page:${ctx.view}`;
    const left = wb.leaveOut === auto;
    const context = left
      ? undefined
      : ctx.cardKey
        ? { card: ctx.cardKey }
        : ctx.doc
          ? { card: ctx.doc.key }
          : { page: ctx.pageName };
    void send({ text: value, context }).then((sent) => {
      // A refused send gives the words back, unless the owner has started new ones.
      if (!sent) setText((now) => now || value);
    });
  };
  const device = wb.deviceName;
  const off = offOf(wb.engine);
  const time = wb.resetsAt
    ? new Date(wb.resetsAt).toLocaleTimeString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  // A turn cannot be stopped once the bridge has gone: it already ended.
  const stoppable = busy && !blocked;

  return (
    <div className={cn('relative flex min-w-0 flex-col gap-1.5', className)}>
      {slashOpen && (
        <div
          id={`${id}-list`}
          role="listbox"
          aria-label={t.slash.title}
          data-wb-slash
          className={cn(
            'absolute inset-x-0 z-30 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md',
            menuSide === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          {flat.length === 0 && (
            <p className="px-2.5 py-2 text-body-sm text-muted-foreground">{t.slash.empty}</p>
          )}
          {groups.map(([source, list]) => (
            <div
              key={source}
              role="group"
              aria-label={source === 'hub' ? t.slash.sources.hub : t.pro.skillsOther}
            >
              <p className="px-2.5 pt-1.5 pb-0.5 text-body-sm font-medium text-muted-foreground">
                {source === 'hub' ? t.slash.sources.hub : t.pro.skillsOther}
              </p>
              {list.map((s) => {
                const index = flat.indexOf(s);
                return (
                  <div
                    key={s.name}
                    id={`${id}-opt-${index}`}
                    role="option"
                    aria-selected={index === selected}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      pick(s);
                    }}
                    className={cn(
                      'flex min-h-11 cursor-pointer flex-wrap items-baseline gap-x-2 rounded-md px-2.5 py-1 md:min-h-9',
                      index === selected && 'bg-accent',
                    )}
                  >
                    <Ltr mono className="text-body-sm font-medium text-foreground">
                      {s.name}
                    </Ltr>
                    {s.about && <span className="min-w-0 text-body-sm text-muted-foreground">{s.about}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <div
        data-wb-composer-box
        className={cn(
          'flex min-w-0 flex-col gap-1 rounded-lg border border-input bg-card p-1.5 focus-within:ring-2 focus-within:ring-ring',
          blocked && 'bg-muted',
        )}
      >
        <div data-wb-controls className="wb-nowrap-row gap-1">
          <ContextTray />
          <div data-wb-run-where className="wb-nowrap-row ms-auto shrink gap-0.5">
            <WherePicker />
            <ModelPicker />
          </div>
        </div>
        <Tip k="input" side="top" align="start" enabled={!focused && !text && !blocked}>
          <div data-wb-input-wrap className="min-w-0">
            <textarea
              ref={input}
              id={id}
              data-wb-input
              // An empty field with dir=auto is LTR in the browser, which scrambles an Arabic placeholder.
              dir={text ? 'auto' : locale === 'ar' ? 'rtl' : 'ltr'}
              rows={rows}
              value={text}
              disabled={blocked}
              aria-label={t.composer.label}
              aria-describedby={`${id}-hint`}
              role="combobox"
              aria-expanded={slashOpen}
              aria-controls={slashOpen ? `${id}-list` : undefined}
              aria-activedescendant={slashOpen && flat.length ? `${id}-opt-${selected}` : undefined}
              aria-autocomplete="list"
              placeholder={
                off0 ? fmt(t.engine[wb.engine as 'offline'].title, { device }) : t.composer.placeholder
              }
              onFocus={(e) => {
                // Bubbling here would open the tooltip over what is being typed. Its text is the hint this field already describes itself with.
                e.stopPropagation();
                setFocused(true);
              }}
              onBlur={(e) => {
                e.stopPropagation();
                setFocused(false);
              }}
              onChange={(e) => {
                setText(e.target.value);
                setSlashClosed(false);
              }}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (slashOpen && flat.length) {
                  if (matchKey(e, 'ArrowDown')) {
                    e.preventDefault();
                    setSelected((i) => (i + 1) % flat.length);
                    return;
                  }
                  if (matchKey(e, 'ArrowUp')) {
                    e.preventDefault();
                    setSelected((i) => (i - 1 + flat.length) % flat.length);
                    return;
                  }
                  if (matchKey(e, 'Enter') || matchKey(e, 'Tab')) {
                    e.preventDefault();
                    const chosen = flat[selected];
                    if (chosen) pick(chosen);
                    return;
                  }
                }
                if (slashOpen && matchKey(e, 'Escape')) {
                  e.preventDefault();
                  e.stopPropagation();
                  setSlashClosed(true);
                  return;
                }
                if (matchKey(e, 'Enter') && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              className="block min-h-9 w-full min-w-0 resize-none bg-transparent px-1.5 py-1 text-body text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />
          </div>
        </Tip>
        <div data-wb-actions className="wb-nowrap-row gap-1">
          <AddMenu
            text={text}
            onPick={(value) => {
              setText(value);
              input.current?.focus();
            }}
          />
          <ModeSwitch />
          <div className="ms-auto flex shrink-0 items-center gap-1">
            {stoppable ? (
              <Tip k="stop" keys={['Ctrl .']}>
                <Button
                  size="sm"
                  data-wb-stop
                  aria-keyshortcuts="Control+. Meta+."
                  className="md:h-8"
                  onClick={() => chat && stopTurn(chat.id)}
                >
                  <Square aria-hidden className="size-3.5" strokeWidth={2} />
                  {t.composer.stop}
                </Button>
              </Tip>
            ) : (
              <Tip
                k="send"
                keys={['Enter']}
                off={off ?? (text.trim() ? (busy ? 'turnBusy' : null) : 'empty')}
                vars={{ device, time }}
                label={t.composer.send}
              >
                <IconButton
                  data-wb-send
                  label={t.composer.send}
                  title={undefined}
                  variant={text.trim() && !blocked && !busy && !ctx.cardKey ? 'primary' : 'outline'}
                  disabled={!text.trim() || blocked || busy}
                  onClick={submit}
                  className="shrink-0 md:size-8"
                >
                  <ArrowUp aria-hidden className="size-4" strokeWidth={2} />
                </IconButton>
              </Tip>
            )}
          </div>
        </div>
      </div>
      <p id={`${id}-hint`} className="sr-only">
        {chat?.status === 'waiting' ? t.composer.waiting : `${t.composer.hint}. ${key('Ctrl /')}`}
      </p>
    </div>
  );
}
