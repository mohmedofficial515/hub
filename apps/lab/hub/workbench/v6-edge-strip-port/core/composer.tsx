import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, BookText, Check, ChevronDown, Crosshair, File as FileIcon, FolderOpen, Laptop, Monitor, MonitorOff, Paperclip, Plus, Smartphone, Square, Trash2, X } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { Button, CardPicker, cn, openCard, DocPicker, fmt, focusRing, focusRingInset, getCard, IconButton, kitMessages, Ltr, matchKey, Modal, portalRoot, RoleBadge, showToast, TextInput, TypeIcon, useRoving } from './kit';
import { useWorkContext } from './context';
import { DEVICES, EFFORTS, FOLDER_FILES, MODELS, MODES, PERSONAS, PROJECTS, SKILLS, type DeviceId, type Mode, type Skill } from './mock';
import { attach, clearFollowOffer, detach, engineBlocks, engineOff, fillComposer, removeTemplate, saveTemplate, send, setDevice, setEffort, setFolder, setLeaveOut, setMode, setModel, setPersona, setPref, stopTurn, usePrefs, useWb, deviceOf } from './store';
import { suggestionsFor } from './smart';
import { wbMessages } from './strings';
import { Tip, useKeyLabels, type TipFact } from './tips';
import { tipCopy } from './tips-copy';

const itemClass = 'flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-2.5 py-1.5 text-body-sm text-foreground outline-none select-none data-[highlighted]:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:text-muted-foreground md:min-h-9';
const triggerClass = cn('inline-flex h-11 min-w-0 max-w-full items-center gap-1 rounded-md px-1.5 text-body-sm whitespace-nowrap text-muted-foreground transition-colors duration-120 hover:bg-accent hover:text-foreground md:h-7', focusRing);
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
              className={cn('inline-flex h-11 shrink-0 items-center justify-center rounded-sm px-2 text-body-sm font-medium whitespace-nowrap max-md:min-w-11 transition-colors duration-120 md:h-7', active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground', focusRingInset)}
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
          <button type="button" data-wb-model className={cn(triggerClass, 'shrink-0')}>
            <span>{model.name}</span>
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

/**
 * The one chip for "this", then what the owner attached, on one line that never wraps. The chip names one thing: the open card, otherwise the open doc, otherwise the page, with the project in front only
 * when the chat's project differs from the page's. Pressing the chip takes it out of the next message, so the chip and its × are one Tab stop. A small mark appears only when Follow the chat opened the card by itself.
 */
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
  const followedHere = follow && !!ctx.cardKey && wb.followed === ctx.cardKey;
  return (
    <ul aria-label={t.context.label} data-wb-chips className="wb-nowrap-row min-w-0 flex-1 gap-1 overflow-hidden">
      <li className="flex min-w-0 shrink" data-wb-chip-auto data-wb-left={left || undefined}>
        <Tip k={left ? 'ctx.back' : 'ctx.auto'} facts={facts} align="start">
          <button type="button" data-wb-chip-leave aria-pressed={left} aria-label={fmt(left ? t.pro.ctx.back : t.pro.ctx.leave, { name })} onClick={() => setLeaveOut(left ? null : key)} className={cn(chip, 'hover:bg-accent', left && 'bg-transparent text-muted-foreground line-through', focusRing)}>
            {ctx.card && <TypeIcon type={ctx.card.type} size="sm" />}
            {ctx.otherProject && (
              <span data-wb-chip-project className="shrink-0 font-medium">
                {fmt(t.pro.ctx.projectPrefix, { project: ctx.otherProject.name })}
              </span>
            )}
            {ctx.card || ctx.doc ? (
              <Ltr mono className="truncate text-body-sm font-medium">
                {name}
              </Ltr>
            ) : (
              <span className="truncate font-medium">{name}</span>
            )}
            {left ? <Plus aria-hidden className="size-3 shrink-0 text-muted-foreground" strokeWidth={2} /> : <X aria-hidden className="size-3 shrink-0 text-muted-foreground" strokeWidth={2} />}
          </button>
        </Tip>
      </li>
      {wb.followOffer && wb.followOffer !== ctx.cardKey && (
        <li className="flex shrink-0">
          <Tip k="ctx.followOffer" vars={{ key: wb.followOffer }}>
            <button type="button" data-wb-follow-offer onClick={() => { openCard(wb.followOffer!); clearFollowOffer(); }} className={cn(chip, 'hover:bg-accent', focusRing)}>
              {fmt(t.pro.ctx.followOffer, { key: wb.followOffer })}
            </button>
          </Tip>
        </li>
      )}
      {followedHere && (
        <li className="flex shrink-0">
          <Tip k="ctx.followOn">
            <button type="button" data-wb-follow-mark aria-pressed aria-label={t.pro.ctx.followOpened} onClick={() => setPref('follow', false)} className={cn('flex h-7 w-7 items-center justify-center rounded-md text-foreground hover:bg-accent', focusRing)}>
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
            <Tip k="ctx.detach" facts={[[a.kind === 'card' ? f.card : a.kind === 'doc' ? f.doc : t.pro.ctx.file, a.label, true]]} align="start">
              <button type="button" aria-label={fmt(t.pro.ctx.remove, { name: a.label })} onClick={() => detach(a.key)} className={cn(chip, 'hover:bg-accent', focusRing)}>
                {card && <TypeIcon type={card.type} size="sm" />}
                {Icon && <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
                <Ltr mono className="truncate text-body-sm font-medium">
                  {a.label.split('/').pop()}
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
export function Suggestions({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useT(wbMessages);
  const ctx = useWorkContext();
  const list = useMemo(() => suggestionsFor({ view: ctx.view, card: ctx.card, doc: ctx.card ? null : ctx.doc }).slice(0, 3), [ctx.view, ctx.card, ctx.doc]);
  const tips = tipCopy[locale].items.suggestion;
  // `ChatSuggestion.onPress` (D51 as built): a read-only prompt runs, and its row says so. Anything in Execute or Plan only fills the box.
  const press = (s: { mode?: 'ask' | 'plan' | 'execute' }) => (s.mode === 'ask' ? 'run' : 'fill');
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <ul aria-label={t.pro.suggestions} data-wb-suggestions className="flex min-w-0 flex-col gap-1">
        {list.map((s) => (
          <li key={s.id} className="min-w-0">
            <Tip content={{ what: s.what[locale], then: press(s) === 'run' ? s.then[locale] : `${tips.then} ${s.then[locale]}` }} k={undefined} align="start">
              <button type="button" data-wb-suggestion={s.id} data-wb-suggestion-press={press(s)} data-wb-suggestion-mode={s.mode ?? 'execute'} onClick={() => (press(s) === 'run' ? s.run() : fillComposer(s.label[locale], s.mode ?? 'execute', s.run))} className={cn('flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-start text-body-sm text-foreground transition-colors duration-120 hover:bg-accent md:min-h-8', focusRing)}>
                <span className="min-w-0">{s.label[locale]}</span>
                <span className="shrink-0 text-muted-foreground">{fmt(press(s) === 'run' ? t.empty.rowRuns : t.empty.rowFills, { mode: t.pro.modes[s.mode ?? 'execute'] })}</span>
              </button>
            </Tip>
          </li>
        ))}
      </ul>
      <p data-wb-suggestions-note className="text-body-sm text-muted-foreground">
        {t.empty.note}
      </p>
    </div>
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

/** Attach and Templates fold into one `+`, so they stop costing the composer two icons at rest. */
function AddMenu({ text, onPick }: { text: string; onPick: (value: string) => void }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const a = t.pro.attach;
  const p = t.pro.templates;
  const [picker, setPicker] = useState<'card' | 'doc' | 'file' | null>(null);
  const mine = wb.templates.filter((x) => x.project === wb.project);
  const project = PROJECTS.find((x) => x.id === wb.project)!;
  return (
    <>
      <Menu
        label={t.pro.ctx.add}
        trigger={
          <Tip k={wb.pageAside ? 'attach.aside' : 'attach'} facts={[[tipCopy[locale].facts.project, project.name]]}>
            <IconButton label={t.pro.ctx.add} title={undefined} data-wb-add className="size-11 md:size-7">
              <Paperclip aria-hidden className="size-4" strokeWidth={1.75} />
            </IconButton>
          </Tip>
        }
      >
        <DropdownMenu.Label className={labelClass}>{a.label}</DropdownMenu.Label>
        <DropdownMenu.Item data-wb-attach-card className={cn(itemClass, 'items-center')} onSelect={() => setPicker('card')}>
          {a.card}
        </DropdownMenu.Item>
        <DropdownMenu.Item data-wb-attach-doc className={cn(itemClass, 'items-center')} onSelect={() => setPicker('doc')}>
          {a.doc}
        </DropdownMenu.Item>
        <DropdownMenu.Item data-wb-attach-file className={cn(itemClass, 'items-center')} onSelect={() => setPicker('file')}>
          {a.file}
        </DropdownMenu.Item>
        <DropdownMenu.Separator className="my-1 h-px bg-border" />
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
        <DropdownMenu.Item disabled={!text.trim()} data-wb-template-save className={itemClass} onSelect={() => { saveTemplate(text.trim().slice(0, 28), text.trim()); showToast({ message: p.saved }); }}>
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
            attach({ kind: 'doc', key: k, label: card?.type === 'doc' ? card.doc.path : k });
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
  const blocked = engineBlocks(wb.engine);
  const slashOpen = text.startsWith('/') && !text.includes(' ') && !slashClosed && !blocked;
  // The slash starts the menu and is not part of the search, so `/review` finds `/code-review`.
  const matches = useMemo(() => (slashOpen ? SKILLS.filter((s) => s.name.toLowerCase().includes(text.slice(1).toLowerCase())) : []), [slashOpen, text]);
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

  // A suggestion fills the box. Enter on that exact text does what the suggestion means, and any edit makes it an ordinary message.
  const fillRef = useRef<{ text: string; run?: () => void } | null>(null);
  const lastFill = useRef(0);
  useEffect(() => {
    if (!wb.fill || wb.fill.tick === lastFill.current) return;
    lastFill.current = wb.fill.tick;
    fillRef.current = { text: wb.fill.text, run: wb.fill.run };
    setText(wb.fill.text);
    input.current?.focus();
  }, [wb.fill]);

  const pick = (s: Skill) => {
    setText(`${s.name} `);
    input.current?.focus();
  };
  const submit = () => {
    const value = text.trim();
    if (!value || blocked || busy) return;
    setText('');
    const filled = fillRef.current;
    fillRef.current = null;
    if (filled?.run && filled.text.trim() === value) {
      filled.run();
      return;
    }
    const auto = ctx.cardKey ?? ctx.doc?.key ?? `page:${ctx.view}`;
    const left = wb.leaveOut === auto;
    send({ text: value, skill: value.startsWith('/') ? value.split(' ')[0] : undefined, context: left ? undefined : ctx.cardKey ? { cardKey: ctx.cardKey } : ctx.doc ? { cardKey: ctx.doc.key, path: ctx.doc.path } : { view: ctx.pageName } });
  };
  const device = deviceOf(wb.device).name[locale];
  const off = engineOff(wb.engine);
  // A turn cannot be stopped once the bridge has gone: it already ended.
  const stoppable = busy && !blocked;

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
      <div data-wb-composer-box className={cn('flex min-w-0 flex-col gap-1 rounded-lg border border-input bg-card p-1.5 focus-within:ring-2 focus-within:ring-ring', blocked && 'bg-muted')}>
        <div data-wb-controls className="wb-nowrap-row gap-1">
          <ContextTray />
          <div data-wb-run-where className="wb-nowrap-row ms-auto shrink gap-0.5">
            <WherePicker />
            <ModelPicker />
          </div>
        </div>
        <Tip k="input" side="top" align="start" enabled={!focused && !text && !blocked && !wb.fill}>
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
              placeholder={blocked ? (offWhy ?? fmt(t.engine[wb.engine as 'offline'].title, { device })) : t.composer.placeholder}
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
                <Button size="sm" data-wb-stop aria-keyshortcuts="Control+. Meta+." className="md:h-8" onClick={() => chat && stopTurn(chat.id)}>
                  <Square aria-hidden className="size-3.5" strokeWidth={2} />
                  {t.composer.stop}
                </Button>
              </Tip>
            ) : (
              <Tip k="send" keys={['Enter']} off={off ?? (text.trim() ? (busy ? 'turnBusy' : null) : 'empty')} vars={{ device }} label={t.composer.send}>
                <IconButton data-wb-send label={t.composer.send} title={undefined} variant={text.trim() && !blocked && !busy && !ctx.cardKey ? 'primary' : 'outline'} disabled={!text.trim() || blocked || busy} onClick={submit} className="shrink-0 md:size-8">
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
