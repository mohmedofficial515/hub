import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, MessageCircleQuestion, Route as RouteIcon, Sparkles } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { PlanPageCard } from '@lab/mocks/hub-plan-page';
import { Bidi, Button, fill, fmt, focusRing, longDate, Ltr, num, plural, PriorityBadge, RoleBadge, showToast, StatusBadge } from '../../../today/v5-peacock-app/kit';
import { messages } from '../i18n';
import { Meter } from './phase-group';
import { nextStepOf, progressOf, type PhaseGroup } from './model';
import { PlanRing } from './charts';
import { toneOf } from './tone';

export function BackBar({ cardKey }: { cardKey: string }) {
  const t = useT(messages);
  const locale = useLocale();
  const Back = locale === 'ar' ? ArrowRight : ArrowLeft;
  return (
    <div className="flex items-center gap-1">
      <a
        href="#planning"
        onClick={(e) => e.preventDefault()}
        className={cn('inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-body-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground md:h-9', focusRing)}
      >
        <Back aria-hidden className="size-4" strokeWidth={1.75} />
        {t.back}
      </a>
      <span aria-hidden className="text-muted-foreground">
        /
      </span>
      <Ltr mono className="px-1 text-caption text-muted-foreground">
        {cardKey}
      </Ltr>
    </div>
  );
}

/**
 * The top of the page, in the order the owner asks: what it is, where it stands (the ring of phases and the numbers), the next step
 * in its phase's tone, then the buttons. The first status action is the page's only filled button.
 */
export function PlanHeader({
  card,
  groups,
  selected,
  hover,
  onGo,
  onHover,
}: {
  card: PlanPageCard;
  groups: PhaseGroup[];
  selected: number;
  hover: number | null;
  onGo: (index: number, scroll?: boolean) => void;
  onHover: (index: number | null) => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { done, total } = progressOf(card);
  const Forward = locale === 'ar' ? ArrowLeft : ArrowRight;
  const next = nextStepOf(card);
  const nextGroup = groups.find((g) => g.hasNext);
  const phased = card.phases.length > 0;
  const ideas = card.links.filter((l) => l.card.type === 'idea').length;
  const lab = (action: string) => () => showToast({ message: fmt(t.labOnly, { action }) });

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [card.key]);

  return (
    <header className="flex min-w-0 flex-col gap-5 rounded-2xl border border-border bg-card p-4 md:gap-6 md:p-6">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-body-sm font-medium text-type-plan-fg">
            <span aria-hidden className="flex size-6 items-center justify-center rounded-md bg-type-plan-soft">
              <RouteIcon className="size-3.5" strokeWidth={2} />
            </span>
            {t.plan}
          </span>
          <Ltr mono className="text-caption text-muted-foreground">
            {card.key}
          </Ltr>
          <StatusBadge status={card.status} />
          <PriorityBadge priority={card.priority} />
        </div>
        <h1 ref={titleRef} tabIndex={-1} dir="auto" className="hub-page-title text-headline text-balance text-foreground outline-none">
          <Bidi>{card.title}</Bidi>
        </h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground">
          <span>
            {fmt(t.createdBy, { name: card.createdBy.name[locale] })}
            {card.createdBy.via === 'mcp' && ` ${t.viaMcp}`}
          </span>
          <span>{longDate(card.createdAt, locale)}</span>
          <span>{fmt(t.revision, { n: num(card.revision, locale) })}</span>
        </p>
      </div>

      {/* Where it stands: the ring of phases beside the numbers in words and the next step, in the tone of its phase. */}
      <div className="flex min-w-0 flex-col items-center gap-5 sm:flex-row sm:items-center md:gap-8">
        {phased && total > 0 && <PlanRing groups={groups} selected={selected} hover={hover} onSelect={onGo} onHover={onHover} />}
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-5 gap-y-1">
            <p className="text-body text-muted-foreground">
              {fill(t.progress, {
                done: <span className="text-headline font-bold text-foreground tabular-nums">{num(done, locale)}</span>,
                total: <span className="font-semibold text-foreground">{plural(total, locale, t.stepsWord)}</span>,
              })}
            </p>
            {!phased && total > 0 && <Meter done={done} total={total} className="w-40" />}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground">
              {phased && <span>{plural(card.phases.length, locale, t.phasesWord)}</span>}
              {ideas > 0 && <span>{plural(ideas, locale, t.ideasWord)}</span>}
            </p>
          </div>

          {next ? (
            <div data-tone={nextGroup ? toneOf(nextGroup.index) : '0'} className="ps-tone-soft flex min-w-0 flex-col gap-2 rounded-xl p-3.5 md:p-4">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm">
                <span className="ps-tone-bg inline-flex h-5.5 items-center rounded-full px-2 text-caption font-semibold">{t.next}</span>
                <span className="ps-tone-fg font-medium">{fmt(t.nextStep, { n: num(next.n, locale) })}</span>
                {nextGroup?.phase && (
                  <span className="text-muted-foreground">
                    {fill(t.nextIn, { phase: `${fmt(t.phase, { n: num(nextGroup.index, locale) })}: ${nextGroup.phase.title}` })}
                  </span>
                )}
              </p>
              <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                <span dir="auto" className="text-body-lg font-semibold text-pretty text-foreground">
                  <Bidi>{next.title}</Bidi>
                </span>
                {next.role && <RoleBadge role={next.role} />}
              </p>
              {nextGroup?.phase && (
                <button type="button" onClick={() => onGo(nextGroup.index, true)} className={cn('ps-tone-fg hit-44 inline-flex items-center gap-1 self-start rounded-sm text-body-sm font-semibold underline-offset-4 hover:underline', focusRing)}>
                  {t.openPhase}
                  <Forward aria-hidden className="size-4" strokeWidth={2} />
                </button>
              )}
            </div>
          ) : (
            <p className="text-body text-foreground">{total ? t.allDone : t.noSteps}</p>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {card.actions
            .filter((a) => a !== 'abandon')
            .map((a, i) => (
              <Button key={a} variant={i === 0 && (a !== 'finish' || done === total) ? 'primary' : 'outline'} onClick={lab(t.actions[a])}>
                {t.actions[a]}
              </Button>
            ))}
          {card.actions.includes('abandon') && (
            <Button variant="ghost" onClick={lab(t.actions.abandon)}>
              {t.actions.abandon}
            </Button>
          )}
        </div>
        <div role="group" aria-label={t.claude} className="flex flex-wrap items-center gap-1.5">
          <span className="me-0.5 inline-flex items-center gap-1 text-caption font-medium text-muted-foreground">
            <Sparkles aria-hidden className="size-3.5 text-primary" strokeWidth={1.75} />
            {t.claude}
          </span>
          <Button size="sm" variant="outline" onClick={lab(t.develop)}>
            <Sparkles aria-hidden className="size-3.5" strokeWidth={1.75} />
            {t.develop}
          </Button>
          <Button size="sm" variant="ghost" onClick={lab(t.explain)}>
            <MessageCircleQuestion aria-hidden className="size-3.5" strokeWidth={1.75} />
            {t.explain}
          </Button>
        </div>
      </div>
    </header>
  );
}
