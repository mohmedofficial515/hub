import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type PointerEvent, type ReactElement, type ReactNode } from 'react';
import { Tooltip as RadixTooltip } from 'radix-ui';
import { useLocale } from '@lab/i18n';
import { cn, focusRing, fmt, Kbd, portalRoot, useMedia } from './kit';
import { usePrefs } from './store';
import { tipCopy, type OffCopy, type OffKey, type TipCopy, type TipKey } from './tips-copy';

/** One line in a status tooltip: a label and a real value. `ltr` keeps a path, a key or a command the right way round. */
export type TipFact = [label: string, value: string, ltr?: boolean];

export interface TipProps {
  /** The text, from `tips-copy.ts`. */
  k?: TipKey;
  /** Text made on the spot, for a suggestion or an option. */
  content?: TipCopy;
  /** Fills `{name}` in the text and in `off`. */
  vars?: Record<string, string | number>;
  /** The reason this control is off, and how to fix it. The control stays reachable, so the reason can be read. */
  off?: OffKey | OffCopy | null;
  /** Real values for a status. */
  facts?: TipFact[];
  /** Key labels, drawn LTR. */
  keys?: string[];
  /** A name for a disabled control, because a disabled control is announced through its wrapper. */
  label?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  /** Off while it would only get in the way, such as over a field being typed in. */
  enabled?: boolean;
  /** Extra classes for the wrapper around a disabled control. */
  wrapClassName?: string;
  children: ReactNode;
}

// ── Explain mode: the touch route to every tooltip ──────────────────────────────────────────────

let helpOn = false;
const helpListeners = new Set<() => void>();
export const useHelpMode = () =>
  useSyncExternalStore(
    (fn) => {
      helpListeners.add(fn);
      return () => helpListeners.delete(fn);
    },
    () => helpOn,
  );
export function setHelpMode(value: boolean) {
  helpOn = value;
  helpListeners.forEach((l) => l());
}

// A click or Esc that puts focus back on a control must not pop its tooltip open: that focus was not the owner moving there.
let lastPress = 0;
let lastKeyWasTab = false;
if (typeof window !== 'undefined') {
  const mark = () => {
    lastPress = Date.now();
    lastKeyWasTab = false;
  };
  window.addEventListener('pointerdown', mark, true);
  window.addEventListener('pointerup', mark, true);
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      if (e.key === 'Tab' || e.key === 'F6' || e.key.startsWith('Arrow')) lastKeyWasTab = true;
      else mark();
    },
    true,
  );
}
const justPressed = () => Date.now() - lastPress < 350;
/** Did the last input come from the keyboard? A focus ring on a title is for someone who cannot see where focus went by pointing. */
export const usingKeyboard = () => lastKeyWasTab;

/** A long press opens the tip instead of pressing the control. */
const LONG_PRESS_MS = 500;
/** A keyboard stop waits this long, so fast Tabbing does not flash a tip at every stop. */
const KEYBOARD_DELAY_MS = 150;

/** Keys as this device labels them: `Ctrl` and `Alt` become `⌘` and `⌥` on a Mac. */
export function useKeyLabels() {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const mac = /Mac|iPhone|iPad/i.test(nav.userAgentData?.platform ?? nav.userAgent);
  return (combo: string) => (mac ? combo.replace(/Ctrl ?/g, '⌘').replace(/Alt ?/g, '⌥ ').replace(/Shift ?/g, '⇧ ') : combo);
}

function TipBody({ copy, off, facts, keys, full, locale }: { copy: TipCopy | null; off: OffCopy | null; facts?: TipFact[]; keys?: string[]; full: boolean; locale: 'ar' | 'en' }) {
  const labels = tipCopy[locale].labels;
  const label = useKeyLabels();
  const Line = ({ name, text }: { name: string; text: string }) => (
    <p>
      <span className="font-medium text-foreground">{name}: </span>
      <span className="text-muted-foreground">{text}</span>
    </p>
  );
  // A control that is off says why and how to fix it, and not what would happen on a press that cannot happen.
  if (off) {
    return (
      <div className="flex flex-col gap-1" data-wb-tiplevel={full ? 'full' : 'compact'} data-wb-tip-off>
        <Line name={labels.why} text={off.why} />
        <Line name={labels.fix} text={off.fix} />
      </div>
    );
  }
  // Compact trims prose. The values are what a status tip is for, so they all stay.
  const shownFacts = facts;
  return (
    <div className="flex flex-col gap-1.5" data-wb-tiplevel={full ? 'full' : 'compact'}>
      {copy && <p className="text-popover-foreground">{copy.what}</p>}
      {full && copy?.then && <Line name={labels.then} text={copy.then} />}
      {full && copy?.needs && <Line name={labels.needs} text={copy.needs} />}
      {full && copy?.detail && <Line name={labels.detail} text={copy.detail} />}
      {shownFacts && shownFacts.length > 0 && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-t border-border pt-1.5">
          {shownFacts.map(([name, value, ltr]) => (
            <div key={name} className="contents">
              <dt className="text-muted-foreground">{name}</dt>
              <dd className="min-w-0 font-medium [overflow-wrap:anywhere] text-popover-foreground">
                {ltr ? (
                  <bdi dir="ltr" translate="no" className="key">
                    {value}
                  </bdi>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {keys && keys.length > 0 && (
        <p className="flex flex-wrap items-center gap-1 text-muted-foreground">
          <span>{labels.keys}:</span>
          {keys.map((key) => (
            <Kbd key={key}>{label(key)}</Kbd>
          ))}
        </p>
      )}
    </div>
  );
}

/**
 * The panel's one tooltip. Props it does not know go to its child, so a menu trigger can wrap it.
 * - Pointer: opens after the provider's delay. It holds no links, so it does not stay open under the pointer, and a neighbour always shows its own text (`disableHoverableContent`).
 * - Keyboard: opens 150 ms after focus arrives by Tab or arrows, never after a press or Esc returns focus. Focus never enters it, and Esc closes it.
 * - Touch: never opens by itself. Only Explain mode, a long press, or a tap on a disabled control opens it, so a dialog returning focus cannot pop one up.
 */
export function Tip({ k, content, vars, off, facts, keys, label, side = 'top', align = 'center', enabled = true, wrapClassName, children, ...rest }: TipProps & Record<string, unknown>) {
  const locale = useLocale();
  const { tipLevel } = usePrefs();
  const touch = useMedia('(hover: none)');
  const help = useHelpMode();
  const [touchOpen, setTouchOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const focusTimer = useRef<number | undefined>(undefined);
  const pressTimer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);
  const pointerOver = useRef(false);
  useEffect(() => {
    if (!help) setTouchOpen(false);
  }, [help]);
  useEffect(
    () => () => {
      window.clearTimeout(focusTimer.current);
      window.clearTimeout(pressTimer.current);
    },
    [],
  );

  const dict = tipCopy[locale];
  const raw: TipCopy | null = content ?? (k ? dict.items[k] : null);
  const fillIn = (s?: string) => (s && vars ? fmt(s, vars) : s);
  const copy = raw ? { what: fillIn(raw.what)!, then: fillIn(raw.then), needs: fillIn(raw.needs), detail: fillIn(raw.detail) } : null;
  const offRaw = typeof off === 'string' ? dict.off[off] : (off ?? null);
  const offCopy = offRaw ? { why: fillIn(offRaw.why)!, fix: fillIn(offRaw.fix)! } : null;

  // In Explain mode a tap reads the control instead of pressing it. A menu trigger opens on pointer down, so that is held back too.
  const holdBack = touch && help;
  const explain = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTouchOpen(true);
  };
  const onPointerDownCapture = (e: PointerEvent) => {
    if (holdBack) e.stopPropagation();
    if (!touch || e.pointerType === 'mouse') return;
    longPressed.current = false;
    window.clearTimeout(pressTimer.current);
    // A menu opens on pointer down. It is the menu that answers, so the tip holds back (N12).
    if ((e.currentTarget as HTMLElement).getAttribute('aria-haspopup')) return;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setTouchOpen(true);
    }, LONG_PRESS_MS);
  };
  const cancelLongPress = () => window.clearTimeout(pressTimer.current);
  const onClickCapture = (e: MouseEvent) => {
    if (longPressed.current) {
      longPressed.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (holdBack && !offCopy) explain(e);
  };

  const trigger = offCopy ? (
    <span
      tabIndex={0}
      role="button"
      aria-disabled="true"
      aria-label={label ?? copy?.what}
      onClick={touch ? explain : undefined}
      className={cn('inline-flex max-w-full rounded-md [&>*]:pointer-events-none', focusRing, wrapClassName)}
    >
      {children}
    </span>
  ) : (
    (children as ReactElement)
  );

  const open = !enabled ? false : touch ? touchOpen : hoverOpen;
  const change = (next: boolean) => {
    if (touch) {
      // Radix also fires this for focus. Touch opens only through the routes above.
      if (!next) setTouchOpen(false);
      return;
    }
    window.clearTimeout(focusTimer.current);
    if (!next) {
      setHoverOpen(false);
      return;
    }
    // A press just returned focus here: not the owner moving. A pointer over the trigger is, and Radix sends its open only once per entry (review N1).
    if (justPressed() && !pointerOver.current) return;
    const focusedNow = document.activeElement;
    if (lastKeyWasTab && focusedNow?.closest('[data-wb-tip]')) {
      // Radix sends no close for a tip it thinks is shut, so leaving before the delay ends is checked here.
      focusTimer.current = window.setTimeout(() => {
        if (document.activeElement === focusedNow) setHoverOpen(true);
      }, KEYBOARD_DELAY_MS);
      return;
    }
    setHoverOpen(true);
  };

  return (
    <RadixTooltip.Root open={open} onOpenChange={change}>
      <RadixTooltip.Trigger
        {...rest}
        asChild
        data-wb-tip={k ?? 'custom'}
        onClickCapture={onClickCapture}
        onPointerDownCapture={onPointerDownCapture}
        onPointerEnter={(e: PointerEvent) => { if (e.pointerType === 'mouse') pointerOver.current = true; }}
        onPointerLeave={() => { pointerOver.current = false; }}
        onPointerUpCapture={cancelLongPress}
        onPointerCancelCapture={cancelLongPress}
        onContextMenu={touch ? (e: MouseEvent) => e.preventDefault() : undefined}
      >
        {trigger}
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal container={portalRoot()}>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          data-wb-tipbox
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          className="z-[80] max-h-(--radix-tooltip-content-available-height) w-max max-w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-border bg-popover px-3 py-2.5 text-start text-body-sm text-popover-foreground shadow-md"
        >
          <TipBody copy={copy} off={offCopy} facts={facts} keys={keys} full={tipLevel === 'full'} locale={locale} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

/** The delay, shared by every tip in the panel: patient the first time, immediate when moving to a neighbour. A tip holds no links, so it never stays open under the pointer. */
export function TipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={450} skipDelayDuration={500} disableHoverableContent>
      {children}
    </RadixTooltip.Provider>
  );
}
