/**
 * The display-currency switcher (plan 6.1).
 *  - desktop (>= sm): a size-8 rounded-full trigger between the theme and fullscreen buttons -> Popover + Command (pattern of phone-country-select)
 *  - mobile (< sm): no room in the header, so the same choice is a sub-menu of the user menu and an entry of the drawer
 */
import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@lab/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@dash/components/ui/command';
import { DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@dash/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@dash/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@dash/components/ui/tooltip';
import { AmountView } from './amount';
import { aggregate } from './convert';
import { CurrencySign, hasSign } from './currency-sign';
import { CATALOG, OWNER_DEFAULT, type CurrencyInfo } from './data';
import { useLab, type Lab } from './env';

const nameOf = (c: CurrencyInfo, lab: Lab) => (lab.locale === 'ar' ? c.nameAr : c.nameEn);

/** The sign when the currency has one, else its code in the same slot. `fixed` keeps a constant width so rows line up. */
export function SignOrCode({ code, lab, className }: { code: string; lab: Lab; className?: string }) {
  const sign = lab.catalogReady && hasSign(code);
  return (
    <span aria-hidden dir="ltr" className={cn('inline-flex items-center justify-center', className)}>
      {sign ? <CurrencySign code={code} gap={0} scale={lab.signScale} /> : <span className="text-[0.62em] font-bold leading-none tracking-tight">{code}</span>}
    </span>
  );
}

/** Mark in a circle with padding of at least one third of its height (SAMA rule 9). */
function Medallion({ code, lab }: { code: string; lab: Lab }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[15px] text-foreground">
      <SignOrCode code={code} lab={lab} />
    </span>
  );
}

/** The searchable list: used in the desktop popover and in the drawer. */
export function CurrencyList({ onPick, className }: { onPick?: (code: string) => void; className?: string }) {
  const lab = useLab();
  const { t, display, setDisplay } = lab;
  // calm live preview: the headline KPI (30-day sales) of each currency, computed once, static while the page currency changes
  const previews = useMemo(() => Object.fromEntries(CATALOG.map((c) => [c.code, aggregate('gross', c.code).total])), []);
  return (
    <Command className={cn('bg-transparent [&_[data-slot=command-input-wrapper]]:h-11 [&_[data-slot=command-input]]:h-11 sm:[&_[data-slot=command-input-wrapper]]:h-10', className)} dir={lab.locale === 'ar' ? 'rtl' : 'ltr'}>
      <CommandInput placeholder={t.switcher.search} aria-label={t.switcher.search} />
      <CommandList>
        <CommandEmpty>{t.switcher.empty}</CommandEmpty>
        <CommandGroup>
          {CATALOG.map((c) => (
            <CommandItem
              key={c.code}
              value={`${c.code} ${c.nameAr} ${c.nameEn}`}
              onSelect={() => {
                setDisplay(c.code);
                onPick?.(c.code);
              }}
              className="min-h-11 gap-3 rounded-lg px-2 py-1.5 sm:min-h-10"
            >
              <Medallion code={c.code} lab={lab} />
              <span dir="ltr" className="w-9 shrink-0 text-13 font-bold">
                {c.code}
              </span>
              <span className="min-w-0 flex-1 truncate text-13 text-muted-foreground">{nameOf(c, lab)}</span>
              <span className="hidden shrink-0 text-12 font-semibold text-muted-foreground sm:inline">
                <AmountView value={previews[c.code]} currency={c.code} context="kpi" mark="none" softCents={false} />
              </span>
              {c.code === OWNER_DEFAULT && <span className="shrink-0 rounded border border-border px-1 text-11 font-semibold text-muted-foreground">{t.switcher.ownerDefault}</span>}
              <Check className={cn('size-4 shrink-0 text-primary', display === c.code ? 'opacity-100' : 'opacity-0')} aria-hidden />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <p className="border-t px-3 py-2.5 text-11 leading-relaxed text-muted-foreground">
        {t.n.switcher.previewCaption}
        <span className="block">{t.switcher.footer}</span>
      </p>
    </Command>
  );
}

const TRIGGER =
  'relative flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-1.5 text-[17px] text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted data-[state=open]:text-primary max-sm:after:absolute max-sm:after:-inset-y-[6px] max-sm:after:inset-x-0 max-sm:after:content-[\'\']';

/** Sign (when there is one) + ISO code + chevron: a control, not a bare glyph. Same 32px height as its neighbours. */
function TriggerFace({ code, lab }: { code: string; lab: Lab }) {
  const sign = lab.catalogReady && hasSign(code);
  return (
    <>
      {sign && <SignOrCode code={code} lab={lab} />}
      <span dir="ltr" className="text-12 font-bold leading-none text-foreground">
        {code}
      </span>
      <ChevronDown className="size-3.5" aria-hidden />
    </>
  );
}

/** Desktop trigger. Hidden below `sm`. */
export function CurrencySwitcher() {
  const lab = useLab();
  const { t, display, switcherEnabled } = lab;
  const [open, setOpen] = useState(false);

  if (!switcherEnabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="hidden rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block" aria-label={t.switcher.disabledTip}>
            <button type="button" disabled aria-label={t.switcher.label} className={cn(TRIGGER, 'pointer-events-none opacity-50')}>
              <TriggerFace code={display} lab={lab} />
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t.switcher.disabledTip}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${t.switcher.label}: ${display}`}
          title={`${t.switcher.label}: ${display}`}
          className={cn(TRIGGER, 'hidden sm:flex')}
        >
          <TriggerFace code={display} lab={lab} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} collisionPadding={12} className="w-[min(25rem,calc(100vw-1.5rem))] rounded-xl p-0 shadow-2xl">
        <p className="px-3 pb-0 pt-3 text-12 font-bold">{t.switcher.title}</p>
        <CurrencyList onPick={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Mobile: an entry of the user menu that expands in place. A fly-out sub-menu does not fit: the menu is as wide as the screen (390px),
 * so there is no room beside it. Touch rows are 44px.
 */
export function CurrencyMenuSub() {
  const lab = useLab();
  const { t, display, setDisplay, switcherEnabled } = lab;
  const [open, setOpen] = useState(false);
  return (
    <>
      <DropdownMenuItem
        disabled={!switcherEnabled}
        onSelect={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="min-h-11 cursor-pointer gap-2.5 rounded-lg px-2 py-2 text-13"
      >
        <span className="flex size-[18px] items-center justify-center text-[15px] text-muted-foreground">
          <SignOrCode code={display} lab={lab} />
        </span>
        <span className="flex-1 text-start">{t.switcher.label}</span>
        <span dir="ltr" className="text-12 font-bold text-muted-foreground">
          {display}
        </span>
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </DropdownMenuItem>
      {open && (
        <div className="max-h-[min(20rem,50dvh)] overflow-y-auto rounded-lg bg-muted/40 p-1">
          <DropdownMenuRadioGroup value={display} onValueChange={setDisplay}>
            {CATALOG.map((c) => (
              <DropdownMenuRadioItem key={c.code} value={c.code} className="min-h-11 gap-2.5 rounded-lg py-2 text-13">
                <span className="flex size-6 items-center justify-center text-[14px]">
                  <SignOrCode code={c.code} lab={lab} />
                </span>
                <span dir="ltr" className="w-9 font-bold">
                  {c.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{nameOf(c, lab)}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <p className="px-2 pb-1 pt-2 text-11 leading-relaxed text-muted-foreground">{t.switcher.footer}</p>
        </div>
      )}
    </>
  );
}

/** Mobile: the drawer entry expands the same searchable list inline. */
export function DrawerCurrencyEntry() {
  const lab = useLab();
  const { t, display, switcherEnabled } = lab;
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        disabled={!switcherEnabled}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-14 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <Medallion code={display} lab={lab} />
        <span className="min-w-0 flex-1">
          {t.switcher.label}
          <span className="block text-11 font-medium text-muted-foreground">{t.switcher.drawerHint}</span>
        </span>
        <span dir="ltr" className="text-13 font-bold text-muted-foreground">
          {display}
        </span>
        <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden />
      </button>
      {open && <CurrencyList className="border-t" onPick={() => setOpen(false)} />}
    </div>
  );
}
