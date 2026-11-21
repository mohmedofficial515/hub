import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftRight, ChevronsLeftRight, ExternalLink, ImageOff, Info, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { labPages, pickShot, shotsOf, type ShotDir, type ShotTheme } from '@lab/mocks/hub-app/redesign';
import { Bidi, cn, focusRing, fmt, getCard, IconButton, kitMessages, Ltr, num, Pill, portalRoot, Select, Skeleton, StatusBadge, useCards, useFocusReturn, useMedia, type RedesignCard } from '../../../kit';
import { matchKey } from '../../../kit/keys';
import { messages } from '../i18n';
import { useShotUrl } from './shot';

const DEVICES = [390, 768, 1440, 'fill'] as const;
type Device = (typeof DEVICES)[number];

/** A segmented control: one value of a few. The chosen one is `foreground`, as everywhere else in the app. */
function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: ReactNode }[]; onChange: (value: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 items-center gap-1.5">
      <span aria-hidden className="text-body-sm text-muted-foreground">
        {label}
      </span>
      <div className="flex rounded-md border border-border bg-card p-0.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-11 items-center rounded-sm px-2.5 text-body-sm font-medium whitespace-nowrap transition-colors duration-120 md:h-7',
              o.value === value ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              focusRing,
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ pressed, onChange, children }: { pressed: boolean; onChange: (next: boolean) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={cn(
        'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-body-sm font-medium whitespace-nowrap transition-colors duration-120 md:h-8',
        pressed ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

const labHref = (r: RedesignCard['redesign']) => r.labUrl.replace(/^\/lab\//, '/');

interface View {
  device: Device;
  dir: ShotDir;
  theme: ShotTheme;
}

function useVersionShot(card: RedesignCard | undefined, view: View) {
  const want = { width: view.device === 'fill' ? 1440 : view.device, dir: view.dir, theme: view.theme };
  const shots = useMemo(() => (card ? shotsOf(card.redesign.labPath) : []), [card]);
  const meta = pickShot(shots, want);
  const src = useShotUrl(meta);
  const exact = !!meta && meta.width === want.width && meta.dir === want.dir && meta.theme === want.theme;
  return { meta, src, exact };
}

/** `min(100%, w)`: a 1440 layout scales into its pane as the real iframe does, and a phone stays true to size. */
const imageWidth = (device: Device) => (device === 'fill' ? '100%' : `min(100%, ${device}px)`);

/** One side: its version picker, its status, and the picture in its own scroller. */
function Pane({
  letter,
  label,
  card,
  options,
  onPick,
  view,
  notes,
  scrollRef,
  onScroll,
}: {
  letter: string;
  label: string;
  card: RedesignCard | undefined;
  options: RedesignCard[];
  onPick: (key: string) => void;
  view: View;
  notes: boolean;
  scrollRef: (el: HTMLDivElement | null) => void;
  onScroll: () => void;
}) {
  const t = useT(messages).compare;
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { meta, src, exact } = useVersionShot(card, view);
  const r = card?.redesign;
  return (
    <section aria-label={label} className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex flex-col gap-1.5 border-b border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-semibold text-foreground">
            {letter}
          </span>
          <label className="min-w-0 flex-1">
            <span className="sr-only">{label}</span>
            <Select dir="ltr" value={card?.key ?? ''} onChange={(e) => onPick(e.target.value)} className="key text-start text-body-sm">
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.redesign.version}
                </option>
              ))}
            </Select>
          </label>
          {r && (
            <a href={labHref(r)} target="_blank" rel="noreferrer" aria-label={`${t.openInLab}: ${r.version}`} title={t.openInLab} className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:size-9', focusRing)}>
              <ExternalLink aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
            </a>
          )}
        </div>
        {card && r && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body-sm text-muted-foreground">
            <StatusBadge status={card.status} />
            {r.reviewScore !== undefined ? (
              <span>
                {kit.sheet.redesign.score} <Ltr className="font-semibold text-foreground tabular-nums">{num(r.reviewScore, locale)}/100</Ltr>
              </span>
            ) : (
              <span>{t.noScore}</span>
            )}
            {meta && !exact && (
              <Pill icon={Info} className="max-w-full">
                <span className="truncate">{fmt(t.closest, { name: meta.name })}</span>
              </Pill>
            )}
          </div>
        )}
        {notes && r && (
          <p className="text-body-sm text-foreground">
            <Bidi>{r.concept[locale]}</Bidi>
            {r.reviewSummary && (
              <span className="text-muted-foreground">
                {' '}
                <Bidi>{r.reviewSummary[locale]}</Bidi>
              </span>
            )}
          </p>
        )}
      </header>
      <div ref={scrollRef} onScroll={onScroll} tabIndex={0} role="group" aria-label={r ? `${label}: ${r.version}` : label} className={cn('min-h-0 flex-1 overflow-auto bg-muted p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset')}>
        {!meta ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-1.5 text-center">
            <ImageOff aria-hidden className="size-6 text-muted-foreground" strokeWidth={1.75} />
            <p className="text-body font-medium text-foreground">{t.noShot}</p>
            <p className="text-body-sm text-muted-foreground">{t.noShotBody}</p>
          </div>
        ) : src ? (
          <img src={src} alt={meta.name} style={{ width: imageWidth(view.device) }} className="mx-auto block h-auto rounded-sm border border-border" />
        ) : (
          <Skeleton className="mx-auto aspect-video w-full max-w-180" />
        )}
      </div>
    </section>
  );
}

/**
 * The curtain: one picture over the other, split at a handle you drag. It answers what side by side cannot, which is
 * what moved between two versions of the same screen. The start side is the first version, in either language.
 */
function Curtain({ a, b, view, labelA, labelB }: { a: RedesignCard | undefined; b: RedesignCard | undefined; view: View; labelA: string; labelB: string }) {
  const t = useT(messages).compare;
  const locale = useLocale();
  const rtl = locale === 'ar';
  const shotA = useVersionShot(a, view);
  const shotB = useVersionShot(b, view);
  const [pos, setPos] = useState(50);
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const place = (clientX: number) => {
    const rect = frame.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const fromLeft = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, rtl ? 100 - fromLeft : fromLeft)));
  };

  // The second picture shows from the handle to the end edge. `clip-path` has no logical form, so it picks a side.
  const clip = rtl ? `inset(0 ${pos}% 0 0)` : `inset(0 0 0 ${pos}%)`;
  const ready = shotA.src && shotB.src;
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-muted p-3">
      {!shotA.meta || !shotB.meta ? (
        <div className="flex h-full min-h-48 flex-col items-center justify-center gap-1.5 text-center">
          <ImageOff aria-hidden className="size-6 text-muted-foreground" strokeWidth={1.75} />
          <p className="text-body font-medium text-foreground">{t.noShot}</p>
          <p className="text-body-sm text-muted-foreground">{t.noShotBody}</p>
        </div>
      ) : !ready ? (
        <Skeleton className="mx-auto aspect-video w-full max-w-180" />
      ) : (
        <div
          ref={frame}
          style={{ width: imageWidth(view.device) }}
          className="relative mx-auto touch-pan-y overflow-hidden rounded-sm border border-border select-none"
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            place(e.clientX);
          }}
          onPointerMove={(e) => dragging.current && place(e.clientX)}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
        >
          <img src={shotA.src!} alt={labelA} draggable={false} className="block h-auto w-full" />
          <img src={shotB.src!} alt={labelB} draggable={false} style={{ clipPath: clip }} className="absolute inset-x-0 top-0 block h-auto w-full" />
          <div aria-hidden style={{ insetInlineStart: `${pos}%` }} className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground rtl:translate-x-1/2" />
          <button
            type="button"
            role="slider"
            aria-label={t.curtainLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            aria-valuetext={`${labelA} ${Math.round(pos)}%`}
            style={{ insetInlineStart: `${pos}%` }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 10 : 2;
              const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
              const back = rtl ? 'ArrowRight' : 'ArrowLeft';
              if (matchKey(e, forward)) setPos((p) => Math.min(100, p + step));
              else if (matchKey(e, back)) setPos((p) => Math.max(0, p - step));
              else if (matchKey(e, 'Home')) setPos(0);
              else if (matchKey(e, 'End')) setPos(100);
              else return;
              e.preventDefault();
            }}
            className={cn('absolute top-24 flex size-11 -translate-x-1/2 cursor-ew-resize items-center justify-center rounded-full border border-border bg-popover text-foreground shadow-md rtl:translate-x-1/2', focusRing)}
          >
            <ChevronsLeftRight aria-hidden className="size-5" strokeWidth={1.75} />
          </button>
          <span className="absolute start-2 top-2 rounded-sm bg-popover px-1.5 py-0.5 text-caption text-popover-foreground">
            <Ltr mono>{labelA}</Ltr>
          </span>
          <span className="absolute end-2 top-2 rounded-sm bg-popover px-1.5 py-0.5 text-caption text-popover-foreground">
            <Ltr mono>{labelB}</Ltr>
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 08 §5.4 `RedesignCompare`: full-screen, two versions, one set of size, language and theme controls. The real dialog
 * loads two lab iframes; here each side is that version's real screenshot for the chosen combination.
 */
export default function RedesignCompare({ open, onOpenChange, a, b }: { open: boolean; onOpenChange: (open: boolean) => void; a: string | null; b: string | null }) {
  const t = useT(messages);
  const c = t.compare;
  const locale = useLocale();
  const cards = useCards();
  const wide = useMedia('(min-width: 1024px)');
  const onCloseAutoFocus = useFocusReturn(open);

  const [keyA, setKeyA] = useState(a);
  const [keyB, setKeyB] = useState(b);
  // A phone opens at its own size: a 1440 layout squeezed into 390 px says nothing.
  const [device, setDevice] = useState<Device>(() => (window.matchMedia('(min-width: 768px)').matches ? 1440 : 390));
  const [dir, setDir] = useState<ShotDir>(locale === 'ar' ? 'rtl' : 'ltr');
  const [theme, setTheme] = useState<ShotTheme>(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
  const [mode, setMode] = useState<'split' | 'curtain'>('split');
  const [active, setActive] = useState<'a' | 'b'>('b');
  const [sync, setSync] = useState(true);
  const [notes, setNotes] = useState(false);

  useEffect(() => {
    if (open) {
      setKeyA(a);
      setKeyB(b);
    }
  }, [open, a, b]);

  const page = labPages.find((p) => p.versionKeys.includes(keyB ?? '') || p.versionKeys.includes(keyA ?? ''));
  const options = useMemo(() => (page?.versionKeys ?? []).map((k) => cards.find((x) => x.key === k) ?? getCard(k)).filter((x): x is RedesignCard => x?.type === 'redesign'), [page, cards]);
  const cardA = options.find((o) => o.key === keyA);
  const cardB = options.find((o) => o.key === keyB);
  const view: View = { device, dir, theme };

  const scrollers = useRef<{ a: HTMLDivElement | null; b: HTMLDivElement | null }>({ a: null, b: null });
  const lock = useRef(false);
  const onScroll = (from: 'a' | 'b') => {
    if (!sync || lock.current) return;
    const src = scrollers.current[from];
    const dst = scrollers.current[from === 'a' ? 'b' : 'a'];
    if (!src || !dst) return;
    lock.current = true;
    const max = src.scrollHeight - src.clientHeight;
    dst.scrollTop = max > 0 ? (src.scrollTop / max) * (dst.scrollHeight - dst.clientHeight) : 0;
    requestAnimationFrame(() => {
      lock.current = false;
    });
  };

  const paneA = (
    <Pane letter={c.a} label={c.versionA} card={cardA} options={options} onPick={setKeyA} view={view} notes={notes} scrollRef={(el) => (scrollers.current.a = el)} onScroll={() => onScroll('a')} />
  );
  const paneB = (
    <Pane letter={c.b} label={c.versionB} card={cardB} options={options} onPick={setKeyB} view={view} notes={notes} scrollRef={(el) => (scrollers.current.b = el)} onScroll={() => onScroll('b')} />
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={portalRoot()}>
        <Dialog.Content onCloseAutoFocus={onCloseAutoFocus} data-compare className="fixed inset-0 z-[70] flex flex-col bg-background text-foreground outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
          <header className="flex shrink-0 flex-col gap-2 border-b border-border p-2 md:px-4 md:py-2.5">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="truncate text-title-sm font-semibold text-foreground">
                  {c.title}
                  {page && (
                    <span className="ms-2 text-body font-normal text-muted-foreground">
                      <Ltr mono>{`${page.app}/${page.page}`}</Ltr>
                    </span>
                  )}
                </Dialog.Title>
                <Dialog.Description className="sr-only">{c.description}</Dialog.Description>
              </div>
              <IconButton
                label={c.swap}
                variant="outline"
                onClick={() => {
                  setKeyA(keyB);
                  setKeyB(keyA);
                }}
              >
                <ArrowLeftRight aria-hidden className="size-4" strokeWidth={1.75} />
              </IconButton>
              <Dialog.Close asChild>
                <IconButton label={c.close}>
                  <X aria-hidden className="size-4" strokeWidth={1.75} />
                </IconButton>
              </Dialog.Close>
            </div>
            <div className="-mx-2 flex items-center gap-x-4 gap-y-2 overflow-x-auto px-2 pb-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              <Seg label={c.device} value={device} options={DEVICES.map((d) => ({ value: d, label: d === 'fill' ? c.fill : <Ltr className="tabular-nums">{d}</Ltr> }))} onChange={setDevice} />
              <Seg label={c.lang} value={dir} options={[{ value: 'rtl', label: c.arabic }, { value: 'ltr', label: c.english }]} onChange={setDir} />
              <Seg label={c.theme} value={theme} options={[{ value: 'light', label: c.light }, { value: 'dark', label: c.dark }]} onChange={setTheme} />
              <Seg label={c.mode} value={mode} options={[{ value: 'split', label: c.split }, { value: 'curtain', label: c.curtain }]} onChange={setMode} />
              {mode === 'split' && !wide && <Seg label={c.showing} value={active} options={[{ value: 'a', label: c.a }, { value: 'b', label: c.b }]} onChange={setActive} />}
              {mode === 'split' && wide && (
                <Toggle pressed={sync} onChange={setSync}>
                  {c.sync}
                </Toggle>
              )}
              {mode === 'split' && (
                <Toggle pressed={notes} onChange={setNotes}>
                  {c.notes}
                </Toggle>
              )}
            </div>
          </header>
          {mode === 'curtain' ? (
            <>
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
                <label className="min-w-40 flex-1">
                  <span className="sr-only">{c.versionA}</span>
                  <Select dir="ltr" value={keyA ?? ''} onChange={(e) => setKeyA(e.target.value)} className="key text-start text-body-sm">
                    {options.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.redesign.version}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="min-w-40 flex-1">
                  <span className="sr-only">{c.versionB}</span>
                  <Select dir="ltr" value={keyB ?? ''} onChange={(e) => setKeyB(e.target.value)} className="key text-start text-body-sm">
                    {options.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.redesign.version}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              <Curtain a={cardA} b={cardB} view={view} labelA={cardA?.redesign.version ?? ''} labelB={cardB?.redesign.version ?? ''} />
            </>
          ) : wide ? (
            <div className="flex min-h-0 flex-1 divide-x divide-border">
              {paneA}
              {paneB}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">{active === 'a' ? paneA : paneB}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
