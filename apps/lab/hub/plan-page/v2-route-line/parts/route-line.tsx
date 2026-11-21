import { Check } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { focusRing, fmt, Ltr, num, useRoving } from '../../../today/v5-peacock-app/kit';
import { messages } from '../i18n';
import type { PhaseGroup } from './model';

/**
 * The plan's overview: one route, a station per phase. A station's length follows its step count, its track fills in `foreground`
 * as steps finish, and the phase holding the next step is ringed and says "You are here" in words. Each station is a link to its
 * phase below (one Tab stop, arrows along the route). Under 1024 px the words fold into one line under the track.
 */
export function RouteLine({ groups, onGo }: { groups: PhaseGroup[]; onGo: (index: number) => void }) {
  const t = useT(messages);
  const locale = useLocale();
  const hereIndex = Math.max(
    0,
    groups.findIndex((g) => g.hasNext),
  );
  const here = groups[hereIndex];
  const { root, groupProps, itemProps } = useRoving(hereIndex);
  const last = groups.length - 1;

  return (
    <nav aria-label={t.route} className="flex min-w-0 flex-col gap-2">
      <div ref={root} {...groupProps} className="flex min-w-0 items-stretch gap-1 md:gap-1.5">
        {groups.map((g, i) => {
          const isHere = i === hereIndex && groups.some((x) => x.hasNext);
          const complete = g.total > 0 && g.done === g.total;
          const percent = g.total ? Math.round((g.done / g.total) * 100) : 0;
          const title = g.phase?.title ?? t.unphased;
          return (
            <a
              key={g.phase?.id ?? 'loose'}
              href={`#phase-${g.index}`}
              {...itemProps(i)}
              onClick={(e) => {
                e.preventDefault();
                onGo(g.index);
              }}
              aria-current={isHere ? 'step' : undefined}
              aria-label={`${fmt(t.phase, { n: num(g.index, locale) })}: ${title}. ${fmt(t.progressLabel, { done: num(g.done, locale), total: num(g.total, locale) })}${isHere ? `. ${t.here}` : ''}`}
              title={title}
              style={{ flexGrow: Math.max(g.total, 1), flexBasis: 0 }}
              className={cn(
                'group flex min-w-0 flex-col gap-2 rounded-lg px-1 py-2 transition-colors duration-150 hover:bg-accent max-md:min-h-11 md:px-1.5',
                focusRing,
              )}
            >
              {/* The track: station dot at the start, fill for done steps. */}
              <span aria-hidden className="relative flex h-4 items-center">
                <span className="absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-foreground transition-[width] duration-500 ease-out motion-reduce:transition-none"
                    style={{ width: `${percent}%` }}
                  />
                </span>
                <span
                  className={cn(
                    'relative flex shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
                    isHere ? 'size-4 border-foreground bg-card ring-4 ring-foreground/15' : 'size-3',
                    complete ? 'border-foreground bg-foreground text-background' : !isHere && 'border-muted-foreground/60 bg-card',
                  )}
                >
                  {complete && <Check className="size-2.5" strokeWidth={3} />}
                </span>
              </span>
              <span className="hidden min-w-0 flex-col gap-0.5 md:flex">
                <span className="flex min-w-0 items-start gap-1.5">
                  <Ltr className={cn('text-body-sm font-bold tabular-nums', isHere ? 'text-foreground' : 'text-muted-foreground')}>{num(g.index, locale)}</Ltr>
                  <span dir="auto" className={cn('line-clamp-2 hidden min-w-0 text-body-sm lg:block', isHere ? 'font-semibold text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>{title}</span>
                </span>
                <span className="hidden truncate text-caption text-muted-foreground tabular-nums lg:block">
                  {fmt(t.progress, { done: num(g.done, locale), total: num(g.total, locale) })}
                </span>
              </span>
            </a>
          );
        })}
      </div>
      {here && (
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1 text-body-sm lg:hidden">
          <span className="font-semibold text-foreground">{fmt(t.phaseOf, { n: num(here.index, locale), last: num(last, locale) })}</span>
          <span dir="auto" className="min-w-0 text-foreground">{here.phase?.title ?? t.unphased}</span>
          <span className="text-muted-foreground tabular-nums">{fmt(t.progress, { done: num(here.done, locale), total: num(here.total, locale) })}</span>
        </p>
      )}
      <p className="sr-only">{t.routeHint}</p>
    </nav>
  );
}
