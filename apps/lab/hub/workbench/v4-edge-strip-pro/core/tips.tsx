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
if (typeof window !== 'undefined') {
  const mark = () => {
    lastPress = Date.now();
  };
  window.addEventListener('pointerdown', mark, true);
  window.addEventListener('pointerup', mark, true);
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' && !e.key.startsWith('Arrow')) mark();
  }, true);
}
const justPressed = () => Date.now() - lastPress < 350;

// Moving to a neighbour must not show an empty frame between the two. A close by the pointer waits a moment, and an opening tip takes it in the same update.
let pendingClose: (() => void) | null = null;
let pendingTimer: number | undefined;
function flushClose() {
  window.clearTimeout(pendingTimer);
  const close = pendingClose;
  pendingClose = null;
  close?.();
}

/** Keys as this device labels them: `Ctrl` and `Alt` become `⌘` and `⌥` on a Mac. */
export function useKeyLabels() {
  const mac = /Mac|iPhone|iPad/i.test(navigator.platform);
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
  // A compact tooltip still names every value it has room for, and never drops the reason a control is off.
  const shownFacts = full ? facts : facts?.slice(0, 3);
  return (
    <div className="flex flex-col gap-1.5" data-wb-tiplevel={full ? 'full' : 'compact'}>
      {copy && <p className="text-popover-foreground">{copy.what}</p>}
      {full && copy?.then && <Line name={labels.then} text={copy.then} />}
      {full && copy?.needs && <Line name={labels.needs} text={copy.needs} />}
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
      {off && (
        <div className="flex flex-col gap-1 border-t border-border pt-1.5">
          <Line name={labels.why} text={off.why} />
          <Line name={labels.fix} text={off.fix} />
        </div>
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
 * The panel's one tooltip. Props it does not know go to its child, so a menu trigger can wrap it. Hover and keyboard focus open it; on touch, Explain mode or a tap on a disabled control does. It stays open while the pointer is
 * over it, Esc dismisses it and focus never moves into it. Neighbours do not flicker: the shared provider skips the delay when moving between them.
 */
export function Tip({ k, content, vars, off, facts, keys, label, side = 'top', align = 'center', enabled = true, wrapClassName, children, ...rest }: TipProps & Record<string, unknown>) {
  const locale = useLocale();
  const { tipLevel } = usePrefs();
  const touch = useMedia('(hover: none)');
  const help = useHelpMode();
  const [touchOpen, setTouchOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const focused = useRef<{ at: number; el: EventTarget } | null>(null);
  useEffect(() => {
    if (!help) setTouchOpen(false);
  }, [help]);

  const dict = tipCopy[locale];
  const raw: TipCopy | null = content ?? (k ? dict.items[k] : null);
  const fillIn = (s?: string) => (s && vars ? fmt(s, vars) : s);
  const copy = raw ? { what: fillIn(raw.what)!, then: fillIn(raw.then), needs: fillIn(raw.needs) } : null;
  const offRaw = typeof off === 'string' ? dict.off[off] : (off ?? null);
  const offCopy = offRaw ? { why: fillIn(offRaw.why)!, fix: fillIn(offRaw.fix)! } : null;

  // In Explain mode a tap reads the control instead of pressing it. A menu trigger opens on pointer down, so that is held back too.
  const holdBack = touch && help;
  const explain = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTouchOpen(true);
  };
  const onPointerDownCapture = holdBack ? (e: PointerEvent) => e.stopPropagation() : undefined;

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
    if (touch) return setTouchOpen(next);
    // Only a focus that follows a press is held back. A pointer arriving just after a key press still opens it.
    if (next && justPressed() && focused.current && document.activeElement === focused.current.el) return;
    if (next) {
      flushClose();
      setHoverOpen(true);
      return;
    }
    // Focus that scrolls the control into view fires a scroll, which would close the tooltip the moment it opened. A real close comes from Esc or from leaving.
    const f = focused.current;
    if (f && Date.now() - f.at < 300 && document.activeElement === f.el && !justPressed()) return;
    flushClose();
    if (justPressed()) {
      setHoverOpen(false);
      return;
    }
    pendingClose = () => setHoverOpen(false);
    pendingTimer = window.setTimeout(flushClose, 40);
  };

  return (
    <RadixTooltip.Root open={open} onOpenChange={change}>
      <RadixTooltip.Trigger {...rest} asChild data-wb-tip={k ?? 'custom'} onFocusCapture={(e) => (focused.current = { at: Date.now(), el: e.target })} onClickCapture={holdBack && !offCopy ? explain : undefined} onPointerDownCapture={onPointerDownCapture}>
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

/** The delay, shared by every tip in the panel: patient the first time, immediate when moving to a neighbour. */
export function TipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={450} skipDelayDuration={500}>
      {children}
    </RadixTooltip.Provider>
  );
}
