import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, Check, ChevronDown, FolderOpen, Laptop, Monitor, MonitorOff, Smartphone, Square } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { Button, cn, fmt, focusRing, IconButton, kitMessages, Ltr, matchKey, portalRoot, RoleBadge, showToast } from './kit';
import { useWorkContext } from './context';
import { DEVICES, PERSONAS, PROJECTS, SKILLS, type DeviceId, type Skill } from './mock';
import { send, setDevice, setFolder, setPersona, stopTurn, useWb } from './store';
import { wbMessages } from './strings';

const itemClass = 'flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-2.5 py-1.5 text-body-sm text-foreground outline-none select-none data-[highlighted]:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:text-muted-foreground md:min-h-9';
const triggerClass = cn('inline-flex h-11 min-w-0 max-w-full items-center gap-1.5 rounded-md px-2 text-body-sm text-muted-foreground transition-colors duration-120 hover:bg-accent hover:text-foreground md:h-8', focusRing);

function Menu({ trigger, label, children, side = 'top' }: { trigger: ReactNode; label: string; children: ReactNode; side?: 'top' | 'bottom' }) {
  const locale = useLocale();
  return (
    <DropdownMenu.Root dir={locale === 'ar' ? 'rtl' : 'ltr'} modal={false}>
      <DropdownMenu.Trigger asChild aria-label={label}>
        {trigger}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalRoot()}>
        <DropdownMenu.Content side={side} align="start" sideOffset={6} collisionPadding={12} className="z-[75] max-h-[min(70dvh,28rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const deviceIcon: Record<DeviceId, typeof Monitor> = { main: Monitor, laptop: Laptop, office: MonitorOff, phone: Smartphone };

export function DevicePicker({ side }: { side?: 'top' | 'bottom' }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const current = DEVICES.find((d) => d.id === wb.device)!;
  const Icon = deviceIcon[wb.device];
  return (
    <Menu
      side={side}
      label={`${t.picker.device}: ${current.name[locale]}`}
      trigger={
        <button type="button" data-wb-device className={triggerClass}>
          <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{current.name[locale]}</span>
          <ChevronDown aria-hidden className="size-3 shrink-0 max-md:hidden" strokeWidth={2} />
        </button>
      }
    >
      <DropdownMenu.Label className="px-2.5 py-1.5 text-body-sm font-medium text-muted-foreground">{t.picker.device}</DropdownMenu.Label>
      {DEVICES.map((d) => {
        const DIcon = deviceIcon[d.id];
        return (
          <DropdownMenu.Item
            key={d.id}
            disabled={d.state !== 'ready'}
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
    </Menu>
  );
}

export function FolderPicker({ side }: { side?: 'top' | 'bottom' }) {
  const t = useT(wbMessages);
  const wb = useWb();
  const short = wb.folder.split('/').pop();
  return (
    <Menu
      side={side}
      label={`${t.picker.folder}: ${wb.folder}`}
      trigger={
        <button type="button" data-wb-folder className={triggerClass}>
          <FolderOpen aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
          <Ltr mono className="truncate text-body-sm">
            {short}
          </Ltr>
          <ChevronDown aria-hidden className="size-3 shrink-0 max-md:hidden" strokeWidth={2} />
        </button>
      }
    >
      {PROJECTS.map((p) => (
        <DropdownMenu.Group key={p.id}>
          <DropdownMenu.Label className="px-2.5 py-1.5 text-body-sm font-medium text-muted-foreground">{p.name}</DropdownMenu.Label>
          {p.folders.map((f) => (
            <DropdownMenu.Item
              key={f}
              className={cn(itemClass, 'items-center')}
              onSelect={() => {
                if (f === wb.folder) return;
                setFolder(f, p.id);
                showToast({ message: t.picker.folderChange });
              }}
            >
              <Ltr mono className="min-w-0 flex-1 text-start text-body-sm break-all">
                {f}
              </Ltr>
              {f === wb.folder && <Check aria-hidden className="size-4 shrink-0" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Group>
      ))}
    </Menu>
  );
}

export function PersonaPicker({ side }: { side?: 'top' | 'bottom' }) {
  const t = useT(wbMessages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const wb = useWb();
  return (
    <Menu
      side={side}
      label={fmt(t.picker.workingAs, { role: kit.roles[wb.persona] })}
      trigger={
        <button type="button" data-wb-persona className={triggerClass}>
          <RoleBadge role={wb.persona} iconOnly className="shrink-0" />
          <span className="truncate">{kit.roles[wb.persona]}</span>
          <ChevronDown aria-hidden className="size-3 shrink-0 max-md:hidden" strokeWidth={2} />
        </button>
      }
    >
      <DropdownMenu.Label className="px-2.5 py-1.5 text-body-sm font-medium text-muted-foreground">{t.picker.persona}</DropdownMenu.Label>
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

/** Device, folder and persona in the order Claude needs them. */
export function RunPickers({ side }: { side?: 'top' | 'bottom' }) {
  return (
    <>
      <DevicePicker side={side} />
      <FolderPicker side={side} />
      <PersonaPicker side={side} />
    </>
  );
}

/**
 * The composer. `/` at the start opens the skills menu, a real combobox: arrows move, Enter or Tab picks, Esc closes. Enter sends and Shift+Enter is a
 * new line. A running turn turns Send into Stop, because a chat runs one turn at a time. Typing stays free while a turn runs.
 */
export function Composer({ footer, autoFocus, menuSide = 'top', rows = 1, className }: { footer?: ReactNode; autoFocus?: boolean; menuSide?: 'top' | 'bottom'; rows?: number; className?: string }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const ctx = useWorkContext();
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [selected, setSelected] = useState(0);
  const [slashClosed, setSlashClosed] = useState(false);
  const chat = wb.chats.find((c) => c.id === wb.activeId);
  const busy = !!chat && chat.status !== 'idle' && chat.status !== 'stopped';
  const blocked = wb.engine !== 'ok';
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
    send({ text: value, skill: value.startsWith('/') ? value.split(' ')[0] : undefined, context: ctx.cardKey ? { cardKey: ctx.cardKey } : { view: ctx.pageName } });
  };
  const usageWarn = wb.usage >= 80 && wb.usage < 100;

  return (
    <div className={cn('relative flex flex-col gap-1', className)}>
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
      <div className={cn('flex flex-col rounded-lg border border-input bg-card focus-within:ring-2 focus-within:ring-ring', blocked && 'bg-muted')}>
        <div className="flex items-end gap-1 p-1.5">
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
          placeholder={blocked ? t.composer.disabled : t.composer.placeholder}
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
          className="min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-body text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
          {busy ? (
            <Button size="sm" data-wb-stop onClick={() => chat && stopTurn(chat.id)}>
              <Square aria-hidden className="size-3.5" strokeWidth={2} />
              {t.composer.stop}
            </Button>
          ) : (
            <IconButton data-wb-send label={t.composer.send} variant={text.trim() && !blocked ? 'primary' : 'outline'} disabled={!text.trim() || blocked} onClick={submit} className="shrink-0">
              <ArrowUp aria-hidden className="size-4" strokeWidth={2} />
            </IconButton>
          )}
        </div>
        {footer && <div className="flex min-w-0 flex-wrap items-center gap-0.5 border-t border-border px-1 py-0.5">{footer}</div>}
      </div>
      <p id={`${id}-hint`} className="sr-only">
        {chat?.status === 'waiting' ? t.composer.waiting : t.composer.hint}
      </p>
      {usageWarn && <p className="px-1 text-body-sm text-warning-strong">{fmt(t.composer.usage, { n: wb.usage })}</p>}
    </div>
  );
}
