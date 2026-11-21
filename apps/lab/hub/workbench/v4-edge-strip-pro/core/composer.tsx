import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, BookText, Check, ChevronDown, Crosshair, File as FileIcon, FolderOpen, Laptop, ListPlus, Monitor, MonitorOff, Paperclip, Plus, Smartphone, Square, Trash2, X } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { Button, CardPicker, cn, DocPicker, fmt, focusRing, focusRingInset, getCard, IconButton, kitMessages, Ltr, matchKey, Modal, portalRoot, RoleBadge, showToast, TextInput, TypeIcon, useMedia, useRoving } from './kit';
import { useWorkContext } from './context';
import { DEVICES, EFFORTS, FOLDER_FILES, MODELS, MODES, PERSONAS, PROJECTS, SKILLS, type DeviceId, type Mode, type Skill } from './mock';
import { attach, detach, removeTemplate, saveTemplate, send, setDevice, setEffort, setFolder, setLeaveOut, setMode, setModel, setPersona, setPref, stopTurn, usePrefs, useWb, deviceOf } from './store';
import { suggestionsFor } from './smart';
import { wbMessages } from './strings';
import { Tip, useKeyLabels, type TipFact } from './tips';
import { tipCopy } from './tips-copy';

const itemClass = 'flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-2.5 py-1.5 text-body-sm text-foreground outline-none select-none data-[highlighted]:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:text-muted-foreground md:min-h-9';
const triggerClass = cn('inline-flex h-11 min-w-0 max-w-full items-center gap-1.5 rounded-md px-2 text-body-sm text-muted-foreground transition-colors duration-120 hover:bg-accent hover:text-foreground md:h-8', focusRing);
const labelClass = 'px-2.5 py-1.5 text-body-sm font-medium text-muted-foreground';

export function Menu({ trigger, label, children, side = 'top', align = 'start' }: { trigger: ReactNode; label: string; children: ReactNode; side?: 'top' | 'bottom'; align?: 'start' | 'end' }) {
  const locale = useLocale();
  return (
    <DropdownMenu.Root dir={locale === 'ar' ? 'rtl' : 'ltr'} modal={false}>
      <DropdownMenu.Trigger asChild aria-label={label}>
        {trigger}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalRoot()}>
        <DropdownMenu.Content side={side} align={align} sideOffset={6} collisionPadding={12} className="z-[75] max-h-[min(70dvh,30rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const deviceIcon: Record<DeviceId, typeof Monitor> = { main: Monitor, laptop: Laptop, office: MonitorOff, phone: Smartphone };

// ── Modes ───────────────────────────────────────────────────────────────────────────────────────

/** Ask, Plan, Execute: always in view, and the one thing here that is never folded. `Alt+1` to `Alt+3` from anywhere. One Tab stop, as every segmented control. */
export function ModeSwitch() {
  const t = useT(wbMessages);
  const wb = useWb();
  const { root, groupProps, itemProps } = useRoving(MODES.indexOf(wb.mode));
  return (
    <div ref={root} role="toolbar" aria-label={t.pro.modeGroup} {...groupProps} data-wb-modes className="inline-flex shrink-0 rounded-md border border-border bg-card md:p-0.5">
      {MODES.map((mode, i) => {
        const active = wb.mode === mode;
        return (
          <Tip key={mode} k={`mode.${mode}` as 'mode.ask'} keys={[`Alt ${i + 1}`]}>
            <button
              type="button"
              data-wb-mode={mode}
              aria-pressed={active}
              aria-keyshortcuts={`Alt+${i + 1}`}
              {...itemProps(i)}
              onClick={() => setMode(mode)}
              className={cn('inline-flex h-11 shrink-0 items-center justify-center rounded-sm px-2.5 text-body-sm font-medium whitespace-nowrap max-md:min-w-11 transition-colors duration-120 md:h-7', active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground', focusRingInset)}
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

export function ModelPicker({ side }: { side?: 'top' | 'bottom' }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const model = MODELS.find((m) => m.id === wb.model)!;
  const f = tipCopy[locale].facts;
  const facts: TipFact[] = [[f.model, model.name], ...(model.effort ? ([[f.effort, t.pro.efforts[wb.effort]]] as TipFact[]) : [])];
  return (
    <Menu
      side={side}
      label={`${t.pro.modelLabel}: ${model.name}${model.effort ? `, ${t.pro.efforts[wb.effort]}` : ''}`}
      trigger={
        <Tip k="model" facts={facts}>
          <button type="button" data-wb-model className={triggerClass}>
            <span className="truncate">
              {model.name}
              {model.effort && <span className="text-muted-foreground">, {t.pro.efforts[wb.effort]}</span>}
            </span>
            <ChevronDown aria-hidden className="size-3 shrink-0 max-md:hidden" strokeWidth={2} />
          </button>
        </Tip>
      }
    >
      <DropdownMenu.Label className={labelClass}>{t.pro.modelLabel}</DropdownMenu.Label>
      {MODELS.map((m) => (
        <DropdownMenu.Item key={m.id} data-wb-model-item={m.id} className={itemClass} onSelect={(e) => { e.preventDefault(); setModel(m.id); }}>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{m.name}</span>
            <span className="block text-muted-foreground">{m.note[locale]}</span>
          </span>
          {m.id === wb.model && <Check aria-hidden className="mt-0.5 size-4 shrink-0" />}
        </DropdownMenu.Item>
      ))}
      <DropdownMenu.Separator className="my-1 h-px bg-border" />
      <DropdownMenu.Label className={labelClass}>{t.pro.effortLabel}</DropdownMenu.Label>
      {!model.effort && <p data-wb-effort-off className="px-2.5 pb-1 text-body-sm text-muted-foreground">{fmt(t.pro.effortOff, { model: model.name })}</p>}
      {EFFORTS.map((e) => (
        <DropdownMenu.Item key={e} disabled={!model.effort} data-wb-effort-item={e} className={cn(itemClass, 'items-center')} onSelect={(ev) => { ev.preventDefault(); setEffort(e); }}>
          <span className="flex-1">{t.pro.efforts[e]}</span>
          {model.effort && e === wb.effort && <Check aria-hidden className="size-4 shrink-0" />}
        </DropdownMenu.Item>
      ))}
    </Menu>
  );
}

// ── Where it runs ───────────────────────────────────────────────────────────────────────────────

/** Device, folder and persona folded into one control, because they rarely change. The tooltip still names all three. */
export function WherePicker({ side }: { side?: 'top' | 'bottom' }) {
  const t = useT(wbMessages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const wb = useWb();
  const current = deviceOf(wb.device);
  const Icon = deviceIcon[wb.device];
  const short = wb.folder.split('/').pop();
  const f = tipCopy[locale].facts;
  return (
    <Menu
      side={side}
      align="end"
      label={`${t.picker.device}: ${current.name[locale]}. ${t.picker.folder}: ${wb.folder}. ${fmt(t.picker.workingAs, { role: kit.roles[wb.persona] })}`}
      trigger={
        <Tip
          k="where"
          facts={[
            [f.device, current.name[locale]],
            [f.folder, wb.folder, true],
            [f.persona, kit.roles[wb.persona]],
          ]}
        >
          <button type="button" data-wb-where className={triggerClass}>
            <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
            <Ltr mono className="truncate text-body-sm">
              {short}
            </Ltr>
            <ChevronDown aria-hidden className="size-3 shrink-0 max-md:hidden" strokeWidth={2} />
          </button>
        </Tip>
      }
    >
      <DropdownMenu.Label className={labelClass}>{t.picker.device}</DropdownMenu.Label>
      {DEVICES.map((d) => {
        const DIcon = deviceIcon[d.id];
        return (
          <DropdownMenu.Item
            key={d.id}
            disabled={d.state !== 'ready'}
            data-wb-device-item={d.id}
            className={itemClass}
            onSelect={() => {
              if (d.id === wb.device) return;
              setDevice(d.id);
              showToast({ message: fmt(t.picker.deviceChange, { device: d.name[locale] }) });
            }}
          >
            <DIcon aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{d.name[locale]}</span>
              <span className="block text-muted-foreground">{d.note[locale]}</span>
            </span>
            {d.id === wb.device && <Check aria-hidden className="mt-0.5 size-4 shrink-0" />}
          </DropdownMenu.Item>
        );
      })}
      <DropdownMenu.Separator className="my-1 h-px bg-border" />
      {PROJECTS.map((p) => (
        <DropdownMenu.Group key={p.id}>
          <DropdownMenu.Label className={labelClass}>
            {t.picker.folder}: {p.name}
          </DropdownMenu.Label>
          {p.folders.map((path) => (
            <DropdownMenu.Item
              key={path}
              className={cn(itemClass, 'items-center')}
              onSelect={() => {
                if (path === wb.folder) return;
                setFolder(path, p.id);
                showToast({ message: t.picker.folderChange });
              }}
            >
              <FolderOpen aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
              <Ltr mono className="min-w-0 flex-1 text-start text-body-sm break-all">
                {path}
              </Ltr>
              {path === wb.folder && <Check aria-hidden className="size-4 shrink-0" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Group>
      ))}
      <DropdownMenu.Separator className="my-1 h-px bg-border" />
      <DropdownMenu.Label className={labelClass}>{t.picker.persona}</DropdownMenu.Label>
      {PERSONAS.map((p) => (
        <DropdownMenu.Item key={p.role} className={itemClass} onSelect={() => setPersona(p.role)}>
          <RoleBadge role={p.role} iconOnly className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{kit.roles[p.role]}</span>
            <span className="block text-muted-foreground">{p.focus[locale]}</span>
          </span>
          {p.role === wb.persona && <Check aria-hidden className="mt-0.5 size-4 shrink-0" />}
        </DropdownMenu.Item>
      ))}
    </Menu>
  );
}

// ── Context, attachments and suggestions ────────────────────────────────────────────────────────

const chip = 'inline-flex h-7 min-w-0 max-w-full items-center gap-1 rounded-md bg-muted px-2 text-body-sm text-foreground';

/** The one chip for "this", then what the owner attached. The chip names one thing: the open card, otherwise the open doc, otherwise the page. */
export function ContextTray() {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const ctx = useWorkContext();
  const { follow } = usePrefs();
  const f = tipCopy[locale].facts;
  const key = ctx.cardKey ?? ctx.doc?.key ?? `page:${ctx.view}`;
  const left = wb.leaveOut === key;
  const facts: TipFact[] = [[f.project, ctx.project.name], [f.page, ctx.pageName], ...(ctx.cardKey ? ([[f.card, ctx.cardKey, true]] as TipFact[]) : []), ...(ctx.doc ? ([[f.doc, ctx.doc.path, true]] as TipFact[]) : [])];
  const name = ctx.cardKey ?? ctx.doc?.path.split('/').pop() ?? ctx.pageName;
  const removeBtn = 'flex size-11 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground md:size-5';
  return (
    <div className="flex min-w-0 items-center gap-1">
      <ul aria-label={t.context.label} data-wb-chips className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        <li className={cn(chip, left && 'bg-transparent text-muted-foreground line-through')} data-wb-chip-auto data-wb-left={left || undefined}>
          <Tip k="ctx.auto" facts={facts} align="start">
            <span tabIndex={0} className={cn('inline-flex min-w-0 items-center gap-1 rounded-sm', focusRing)}>
              {ctx.card && <TypeIcon type={ctx.card.type} size="sm" />}
              {ctx.card || ctx.doc ? (
                <Ltr mono className="truncate text-body-sm font-medium">
                  {name}
                </Ltr>
              ) : (
                <span className="truncate font-medium">{name}</span>
              )}
            </span>
          </Tip>
          <Tip k={left ? 'ctx.back' : 'ctx.leave'}>
            <button type="button" data-wb-chip-leave aria-pressed={left} aria-label={fmt(left ? t.pro.ctx.back : t.pro.ctx.leave, { name })} onClick={() => setLeaveOut(left ? null : key)} className={cn(removeBtn, focusRing)}>
              {left ? <Plus aria-hidden className="size-3" strokeWidth={2} /> : <X aria-hidden className="size-3" strokeWidth={2} />}
            </button>
          </Tip>
        </li>
        {wb.attachments.map((a) => {
          const Icon = a.kind === 'card' ? null : a.kind === 'doc' ? BookText : FileIcon;
          const card = a.kind === 'card' ? getCard(a.key) : undefined;
          return (
            <li key={a.key} className={chip} data-wb-attachment={a.kind}>
              <Tip k="ctx.attached" facts={[[a.kind === 'card' ? f.card : a.kind === 'doc' ? f.doc : t.pro.ctx.file, a.label, true]]} align="start">
                <span tabIndex={0} className={cn('inline-flex min-w-0 items-center gap-1 rounded-sm', focusRing)}>
                  {card && <TypeIcon type={card.type} size="sm" />}
                  {Icon && <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
                  <Ltr mono className="truncate text-body-sm font-medium">
                    {a.label.split('/').pop()}
                  </Ltr>
                </span>
              </Tip>
              <Tip k="ctx.detach">
                <button type="button" aria-label={fmt(t.pro.ctx.remove, { name: a.label })} onClick={() => detach(a.key)} className={cn(removeBtn, focusRing)}>
                  <X aria-hidden className="size-3" strokeWidth={2} />
                </button>
              </Tip>
            </li>
          );
        })}
      </ul>
      <Tip k={follow ? 'ctx.followOn' : 'ctx.followOff'}>
        <button type="button" data-wb-follow aria-pressed={follow} aria-label={t.pro.ctx.follow} onClick={() => setPref('follow', !follow)} className={cn('inline-flex h-11 shrink-0 items-center justify-center gap-1 rounded-md px-1.5 text-body-sm transition-colors duration-120 hover:bg-accent max-md:min-w-11 md:h-7', follow ? 'text-foreground' : 'text-muted-foreground', focusRing)}>
          <Crosshair aria-hidden className="size-3.5" strokeWidth={follow ? 2.25 : 1.75} />
          <span className="max-md:sr-only">{t.pro.ctx.followShort}</span>
        </button>
      </Tip>
    </div>
  );
}

/** Three at most, gone while typing, gone while a turn runs or an approval waits. Quiet by design. */
export function Suggestions({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useT(wbMessages);
  const ctx = useWorkContext();
  const roomy = useMedia('(min-width: 768px)');
  const list = useMemo(() => suggestionsFor({ view: ctx.view, card: ctx.card, doc: ctx.card ? null : ctx.doc }).slice(0, roomy ? 3 : 2), [ctx.view, ctx.card, ctx.doc, roomy]);
  return (
    <ul aria-label={t.pro.suggestions} data-wb-suggestions className={cn('flex min-w-0 flex-wrap gap-1', className)}>
      {list.map((s) => (
        <li key={s.id} className="max-w-full">
          <Tip content={{ what: s.what[locale], then: s.then[locale] }} k={undefined} align="start">
            <button type="button" data-wb-suggestion={s.id} onClick={s.run} className={cn('inline-flex min-h-11 max-w-full items-center rounded-md border border-border bg-card px-2.5 py-1 text-start text-body-sm text-foreground transition-colors duration-120 hover:bg-accent md:min-h-7.5', focusRing)}>
              {s.label[locale]}
            </button>
          </Tip>
        </li>
      ))}
    </ul>
  );
}

function FilePicker({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT(wbMessages);
  const wb = useWb();
  const [q, setQ] = useState('');
  const files = (FOLDER_FILES[wb.folder] ?? []).filter((f) => f.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t.pro.attach.fileTitle} description={fmt(t.pro.attach.fileBody, { folder: wb.folder })}>
      <div className="flex flex-col gap-2">
        <TextInput data-autofocus dir="ltr" className="key text-start" aria-label={t.pro.attach.fileSearch} placeholder={t.pro.attach.fileSearch} value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="flex flex-col">
          {files.map((f) => (
            <li key={f}>
              <button
                type="button"
                data-wb-file-pick
                onClick={() => {
                  attach({ kind: 'file', key: f, label: f });
                  onOpenChange(false);
                }}
                className={cn('flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-start text-body-sm hover:bg-accent md:min-h-8', focusRing)}
              >
                <FileIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <Ltr mono className="min-w-0 text-body-sm break-all">
                  {f}
                </Ltr>
              </button>
            </li>
          ))}
          {!files.length && <li className="px-2 py-2 text-body-sm text-muted-foreground">{t.pro.attach.fileEmpty}</li>}
        </ul>
      </div>
    </Modal>
  );
}

function AttachMenu() {
  const t = useT(wbMessages);
  const a = t.pro.attach;
  const [picker, setPicker] = useState<'card' | 'doc' | 'file' | null>(null);
  return (
    <>
      <Menu
        label={a.label}
        trigger={
          <Tip k="attach">
            <IconButton label={a.label} title={undefined} data-wb-attach className="size-11 md:size-7">
              <Paperclip aria-hidden className="size-4" strokeWidth={1.75} />
            </IconButton>
          </Tip>
        }
      >
        <DropdownMenu.Item data-wb-attach-card className={cn(itemClass, 'items-center')} onSelect={() => setPicker('card')}>
          {a.card}
        </DropdownMenu.Item>
        <DropdownMenu.Item data-wb-attach-doc className={cn(itemClass, 'items-center')} onSelect={() => setPicker('doc')}>
          {a.doc}
        </DropdownMenu.Item>
        <DropdownMenu.Item data-wb-attach-file className={cn(itemClass, 'items-center')} onSelect={() => setPicker('file')}>
          {a.file}
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
            attach({ kind: 'doc', key: k, label: card?.type === 'doc' ? card.doc.path : k });
          });
          setPicker(null);
        }}
      />
      <FilePicker open={picker === 'file'} onOpenChange={(o) => !o && setPicker(null)} />
    </>
  );
}

function TemplatesMenu({ text, onPick }: { text: string; onPick: (value: string) => void }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const p = t.pro.templates;
  const mine = wb.templates.filter((x) => x.project === wb.project);
  const project = PROJECTS.find((x) => x.id === wb.project)!;
  return (
    <Menu
      label={p.label}
      trigger={
        <Tip k="templates" facts={[[tipCopy[locale].facts.project, project.name]]}>
          <IconButton label={p.label} title={undefined} data-wb-templates className="size-11 md:size-7">
            <ListPlus aria-hidden className="size-4" strokeWidth={1.75} />
          </IconButton>
        </Tip>
      }
    >
      <DropdownMenu.Label className={labelClass}>{fmt(p.title, { project: project.name })}</DropdownMenu.Label>
      {mine.length === 0 && <p className="px-2.5 py-1.5 text-body-sm text-muted-foreground">{p.empty}</p>}
      {mine.map((x) => (
        <div key={x.id} className="flex min-w-0 items-start gap-1">
          <DropdownMenu.Item data-wb-template={x.id} className={cn(itemClass, 'min-w-0 flex-1')} onSelect={() => onPick(x.text[locale])}>
            <span className="min-w-0">
              <span className="block font-medium">{x.name[locale]}</span>
              <span className="block truncate text-muted-foreground">{x.text[locale]}</span>
            </span>
          </DropdownMenu.Item>
          <DropdownMenu.Item aria-label={fmt(p.remove, { name: x.name[locale] })} className={cn(itemClass, 'shrink-0 items-center')} onSelect={(e) => { e.preventDefault(); removeTemplate(x.id); }}>
            <Trash2 aria-hidden className="size-3.5" strokeWidth={1.75} />
          </DropdownMenu.Item>
        </div>
      ))}
      <DropdownMenu.Separator className="my-1 h-px bg-border" />
      <DropdownMenu.Item disabled={!text.trim()} data-wb-template-save className={itemClass} onSelect={() => { saveTemplate(text.trim().slice(0, 28), text.trim()); showToast({ message: p.saved }); }}>
        <span className="min-w-0">
          <span className="block font-medium">{p.save}</span>
          {!text.trim() && <span className="block text-muted-foreground">{p.saveOff}</span>}
        </span>
      </DropdownMenu.Item>
    </Menu>
  );
}

/**
 * The composer. `/` at the start opens the skills menu, a real combobox: arrows move, Enter or Tab picks, Esc closes. Enter sends and Shift+Enter is a
 * new line. A running turn turns Send into Stop, because a chat runs one turn at a time. Typing stays free while a turn runs.
 */
export function Composer({ autoFocus, menuSide = 'top', rows = 1, className, offWhy }: { autoFocus?: boolean; menuSide?: 'top' | 'bottom'; rows?: number; className?: string; offWhy?: string }) {
  const t = useT(wbMessages);
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
  const chat = wb.chats.find((c) => c.id === wb.activeId);
  const busy = !!chat && chat.status !== 'idle' && chat.status !== 'stopped';
  const blocked = wb.engine !== 'ok';
  const pendingApproval = !!chat?.items.some((i) => i.kind === 'approval' && i.request.state === 'pending');
  const slashOpen = text.startsWith('/') && !text.includes(' ') && !slashClosed && !blocked;
  const matches = useMemo(() => (slashOpen ? SKILLS.filter((s) => s.name.toLowerCase().includes(text.toLowerCase())) : []), [slashOpen, text]);
  const groups = useMemo(() => (['hub', 'personal', 'folder'] as const).map((source) => [source, matches.filter((m) => m.source === source)] as const).filter(([, list]) => list.length), [matches]);
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

  const pick = (s: Skill) => {
    setText(`${s.name} `);
    input.current?.focus();
  };
  const submit = () => {
    const value = text.trim();
    if (!value || blocked || busy) return;
    setText('');
    const auto = ctx.cardKey ?? ctx.doc?.key ?? `page:${ctx.view}`;
    const left = wb.leaveOut === auto;
    send({ text: value, skill: value.startsWith('/') ? value.split(' ')[0] : undefined, context: left ? undefined : ctx.cardKey ? { cardKey: ctx.cardKey } : ctx.doc ? { cardKey: ctx.doc.key, path: ctx.doc.path } : { view: ctx.pageName } });
  };
  const usageWarn = wb.usage >= 80 && wb.usage < 100;
  const device = deviceOf(wb.device).name[locale];
  const engineOff = wb.engine === 'ok' ? null : wb.engine;
  // One thing at a time: suggestions step back while a plan, a draft, a question or a link choice waits on the owner.
  const owed = !!chat?.items.some((i) => (i.kind === 'plan' && i.plan.state === 'proposed') || (i.kind === 'draft' && i.draft.state === 'open') || (i.kind === 'choice' && !i.choice.chosen) || (i.kind === 'links' && !i.done));
  const showSuggestions = !busy && !blocked && !text && !pendingApproval && !owed;

  return (
    <div className={cn('relative flex min-w-0 flex-col gap-1.5', className)}>
      {slashOpen && (
        <div id={`${id}-list`} role="listbox" aria-label={t.slash.title} data-wb-slash className={cn('absolute inset-x-0 z-30 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md', menuSide === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5')}>
          {flat.length === 0 && <p className="px-2.5 py-2 text-body-sm text-muted-foreground">{t.slash.empty}</p>}
          {groups.map(([source, list]) => (
            <div key={source} role="group" aria-label={t.slash.sources[source]}>
              <p className="px-2.5 pt-1.5 pb-0.5 text-body-sm font-medium text-muted-foreground">{t.slash.sources[source]}</p>
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
                    className={cn('flex min-h-11 cursor-pointer flex-wrap items-baseline gap-x-2 rounded-md px-2.5 py-1 md:min-h-9', index === selected && 'bg-accent')}
                  >
                    <Ltr mono className="text-body-sm font-medium text-foreground">
                      {s.name}
                    </Ltr>
                    <span className="min-w-0 text-body-sm text-muted-foreground">{s.about[locale]}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {showSuggestions && <Suggestions />}
      <div className={cn('flex min-w-0 flex-col gap-1 rounded-lg border border-input bg-card p-1.5 focus-within:ring-2 focus-within:ring-ring', blocked && 'bg-muted')}>
        <ContextTray />
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
              placeholder={blocked ? (offWhy ?? t.composer.disabled) : t.composer.placeholder}
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
                    pick(flat[selected]);
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
        <div className="flex min-w-0 items-center gap-0.5">
          <AttachMenu />
          <TemplatesMenu
            text={text}
            onPick={(value) => {
              setText(value);
              input.current?.focus();
            }}
          />
          <div className="ms-auto flex shrink-0 items-center gap-1">
            {busy ? (
              <Tip k="stop" keys={['Ctrl .']}>
                <Button size="sm" data-wb-stop aria-keyshortcuts="Control+. Meta+." onClick={() => chat && stopTurn(chat.id)}>
                  <Square aria-hidden className="size-3.5" strokeWidth={2} />
                  {t.composer.stop}
                </Button>
              </Tip>
            ) : (
              <Tip k="send" keys={['Enter']} off={engineOff ?? (text.trim() ? null : 'empty')} vars={{ device }} label={t.composer.send}>
                <IconButton data-wb-send label={t.composer.send} title={undefined} variant={text.trim() && !blocked ? 'primary' : 'outline'} disabled={!text.trim() || blocked} onClick={submit} className="shrink-0 md:size-8">
                  <ArrowUp aria-hidden className="size-4" strokeWidth={2} />
                </IconButton>
              </Tip>
            )}
          </div>
        </div>
      </div>
      <div data-wb-controls className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
        <ModeSwitch />
        <ModelPicker />
        <WherePicker />
      </div>
      <p id={`${id}-hint`} className="sr-only">
        {chat?.status === 'waiting' ? t.composer.waiting : `${t.composer.hint}. ${key('Ctrl /')}`}
      </p>
      {usageWarn && <p className="px-1 text-body-sm text-warning-strong">{fmt(t.composer.usage, { n: wb.usage })}</p>}
    </div>
  );
}
