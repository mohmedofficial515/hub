import { useState } from 'react';
import { Check, ChevronDown, CircleAlert, Lock, RefreshCw } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { Button } from '@dash/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@dash/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@dash/components/ui/popover';
import { Skeleton } from '@dash/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@dash/components/ui/tooltip';
import { fill, messages } from '../i18n';
import { Amount } from './amount';
import { CurrencySign } from './currency-sign';
import { DEFAULT_CURRENCY, type CurrencyMeta } from './data';
import { decToString } from './money-core';
import { aggregate } from './engine';
import { showsSign, useEnv, type Env } from './env';

/** Sign in a circle with SAMA rule 9 padding (>= 1/3 of the mark height) or the code when there is no sign. */
export function CurrencyAvatar({ code, className }: { code: string; className?: string }) {
  const env = useEnv();
  return (
    <span
      aria-hidden
      className={cn('flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-12 font-black text-foreground', className)}
      style={{ ['--sign-box' as string]: '1em' }}
    >
      {showsSign(env, code, false) ? <CurrencySign code={code} /> : <span className="text-[9px] tracking-tight">{code}</span>}
    </span>
  );
}

function ordered(env: Env): CurrencyMeta[] {
  const list = env.catalog.filter((c) => c.enabled);
  return [...list.filter((c) => c.code === DEFAULT_CURRENCY), ...list.filter((c) => c.code !== DEFAULT_CURRENCY)];
}

/** The list, shared by the desktop Popover and the mobile drawer: search, rows with a live KPI preview, footer note. */
export function CurrencyList({ onPick, className }: { onPick: (code: string) => void; className?: string }) {
  const env = useEnv();
  const t = useT(messages);
  if (env.catalogState === 'loading') {
    return (
      <div className={cn('space-y-2 p-3', className)} aria-busy>
        <Skeleton className="h-9 w-full" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
        <p className="pt-1 text-11 text-muted-foreground">{t.catalogLoading}</p>
      </div>
    );
  }
  if (env.catalogState === 'error') {
    return (
      <div className={cn('flex flex-col items-center gap-2 p-6 text-center', className)}>
        <CircleAlert className="size-6 text-destructive" />
        <p className="text-13 font-bold">{t.catalogError}</p>
        <p className="text-12 text-muted-foreground">{t.catalogErrorHint}</p>
        <Button size="sm" variant="outline" className="mt-1 h-9 gap-1.5">
          <RefreshCw className="size-3.5" />
          {t.retry}
        </Button>
      </div>
    );
  }
  return (
    <Command className={cn('bg-transparent', className)} loop>
      <CommandInput placeholder={t.searchCurrency} className="h-11 text-13" />
      <CommandList className="max-h-[min(22rem,60dvh)]">
        <CommandEmpty className="py-6 text-center text-13 text-muted-foreground">{t.noCurrency}</CommandEmpty>
        <CommandGroup>
          {ordered(env).map((c) => {
            const current = env.display === c.code;
            return (
              <CommandItem
                key={c.code}
                value={`${c.code} ${c.names.ar} ${c.names.en}`}
                onSelect={() => onPick(c.code)}
                className="min-h-12 gap-3 rounded-lg px-2 py-1.5"
              >
                <CurrencyAvatar code={c.code} />
                <span className="flex min-w-0 flex-1 flex-col text-start leading-tight">
                  <span className="flex items-center gap-1.5 text-13 font-bold">
                    <span dir="ltr">{c.code}</span>
                    {c.code === DEFAULT_CURRENCY && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-10 font-bold text-primary">{t.defaultTag}</span>
                    )}
                  </span>
                  <span className="truncate text-12 text-muted-foreground">{c.names[env.lang]}</span>
                </span>
                <span className="flex flex-col items-end leading-tight">
                  <span className="text-12 font-bold">
                    <Amount value={decToString(aggregate(c.code).gross)} currency={c.code} context="chart" noTrigger plain />
                  </span>
                  <span className="text-10 text-muted-foreground">{t.previewLabel}</span>
                </span>
                <Check className={cn('size-4 shrink-0 text-primary', current ? 'opacity-100' : 'opacity-0')} aria-hidden />
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
      <p className="border-t px-3 py-2.5 text-11 leading-5 text-muted-foreground">{t.switcherFooter}</p>
    </Command>
  );
}

/** Header control: pill with sign + code from sm:, hidden below sm (the user menu and the drawer carry it there). */
export function CurrencySwitcher({ className, forceShow }: { className?: string; forceShow?: boolean }) {
  const env = useEnv();
  const t = useT(messages);
  const [open, setOpen] = useState(false);
  const loading = env.catalogState === 'loading';
  const sign = !loading && showsSign(env, env.display, false);

  const face = (
    <span dir="ltr" className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center" style={{ ['--sign-box' as string]: '1em' }}>
        {sign ? <CurrencySign code={env.display} /> : null}
      </span>
      <span dir="ltr" className={cn(loading && 'opacity-70')}>
        {env.display}
      </span>
    </span>
  );
  const base =
    'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-12 font-bold text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 [&_svg]:shrink-0';

  if (!env.switcherEnabled) {
    return (
      <div className={cn(forceShow ? 'block' : 'hidden sm:block', className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-disabled="true" className={cn(base, 'cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted-foreground')}>
              {face}
              <Lock className="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-60 text-12">{t.switcherDisabled}</TooltipContent>
        </Tooltip>
      </div>
    );
  }
  return (
    <div className={cn(forceShow ? 'block' : 'hidden sm:block', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={fill(t.switcherAria, { cur: env.display })} className={base}>
            {face}
            <ChevronDown className="size-3 opacity-70" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[22rem] overflow-hidden p-0">
          <CurrencyList
            onPick={(c) => {
              env.setDisplay(c);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
