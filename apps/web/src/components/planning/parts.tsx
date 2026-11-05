'use client';

/**
 * @file parts.tsx
 * @description The Planning page's pieces: the focal card, a lane, an idea row, a plan row and the step meter. Why they look this way: NOTES.md beside this file.
 */
import { ArrowUpRight, Check, Circle, type LucideIcon } from 'lucide-react';

import {
  actionName,
  AppLink,
  Bidi,
  Button,
  CardChip,
  CardRow,
  cn,
  fmt,
  focusRing,
  type IdeaCard,
  kitMessages,
  Ltr,
  MineMark,
  num,
  openCard,
  type PlanCard,
  plural,
  PriorityBadge,
  RoleBadge,
  RowAction,
  StatusBadge,
  TypeBadge,
  typeClass,
  useCardQuery,
  type useKeyboardList,
  useLocale,
  useMedia,
  usePerformAction,
  useSession,
  useT,
} from '@/components/kit';
import { excerptOf, type Focal, isMineHere, nextActionOf, progressOf } from '@/features/planning/model';

import type { PlanningMessages } from './messages';

type RowProps = ReturnType<typeof useKeyboardList>['rowProps'];

const STEPS_ON_FOCAL = 5;

/** Steps as a number first, and a thin neutral meter beside it. Status is never colour alone, and this has no colour. */
export function StepMeter({ done, total, className }: { done: number; total: number; className?: string }) {
  const t = useT<PlanningMessages>('planning');
  const locale = useLocale();
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="sr-only">{t.row.steps}</span>
      <span className="tabular-nums">
        {fmt(t.row.progress, { done: num(done, locale), total: num(total, locale) })}
      </span>
      <span aria-hidden className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-foreground" style={{ width: `${percent}%` }} />
      </span>
    </span>
  );
}

/** The page's focal point: the next thing it wants from this member, with the one filled button. */
export function FocalCard({ focal, rowProps }: { focal: Focal; rowProps: RowProps }) {
  const t = useT<PlanningMessages>('planning');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { me, roles } = useSession();
  const perform = usePerformAction();
  const { card, action } = focal;
  const titleId = `focal-${card.key}`;
  const available = nextActionOf(card, roles, me.id);

  const run = () => {
    if (!available) return;
    if (available.mode === 'now') perform(card.key, available.action);
    else openCard(card.key, { action: available.action });
  };

  const isPlan = card.type === 'plan';
  // A row carries no body, so the focal plan reads its own card. Until that answers, it claims nothing about its text.
  const full = useCardQuery(isPlan ? card.key : null);
  const text = isPlan ? excerptOf(full.data?.body) : excerptOf(card.idea.problem);
  const noText = isPlan ? (full.data ? kit.sections.plan.noBody : '') : t.focal.noProblem;
  const progress = isPlan ? progressOf(card) : null;
  const steps = isPlan ? card.plan.steps.slice(0, STEPS_ON_FOCAL) : [];
  const more = isPlan ? card.plan.steps.length - steps.length : 0;

  return (
    <article
      {...rowProps(card.key)}
      aria-labelledby={titleId}
      className="grid gap-x-8 gap-y-4 rounded-lg border border-border bg-card p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:p-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{action ? t.focal.label : t.focal.moving}</span>
          <TypeBadge type={card.type} />
          <Ltr mono className="text-caption">
            {card.key}
          </Ltr>
          <StatusBadge status={card.status} />
          {(card.priority === 'P0' || card.priority === 'P1') && <PriorityBadge priority={card.priority} />}
          {isMineHere(card, me.id, roles) && <MineMark />}
        </div>
        <h2 id={titleId} className="text-title font-semibold text-pretty text-foreground">
          <AppLink
            card={card.key}
            className={cn('hit-44 rounded-sm underline-offset-4 hover:underline', focusRing)}
          >
            <Bidi>{card.title}</Bidi>
          </AppLink>
        </h2>
        <p className="line-clamp-3 max-w-prose text-body text-muted-foreground">
          <Bidi>{text || noText}</Bidi>
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
          {action && available && (
            <Button variant="primary" className="max-sm:w-full" onClick={run}>
              {actionName(kit, card.type, available.action)}
            </Button>
          )}
          <AppLink
            card={card.key}
            className={cn(
              'hit-44 inline-flex items-center gap-1 rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline',
              focusRing,
            )}
          >
            {isPlan ? t.focal.open : t.focal.openIdea}
            <ArrowUpRight aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
          </AppLink>
        </div>
      </div>

      {isPlan && (
        <div className="flex min-w-0 flex-col gap-2 border-t border-border pt-3 lg:border-none lg:pt-0">
          {progress && progress.total > 0 ? (
            <>
              <p className="flex flex-wrap items-center gap-2 text-body-sm font-medium text-foreground">
                {fmt(t.focal.progress, {
                  done: num(progress.done, locale),
                  total: num(progress.total, locale),
                })}
                <span aria-hidden className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-foreground"
                    style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                  />
                </span>
              </p>
              <ul className="flex flex-col gap-1.5">
                {steps.map((step) => (
                  <li key={step.id} className="flex items-start gap-2 text-body-sm text-foreground">
                    {step.done ? (
                      <Check
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-success-soft-foreground"
                        strokeWidth={1.75}
                      />
                    ) : (
                      <Circle
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        strokeWidth={1.75}
                      />
                    )}
                    <span className={cn('min-w-0 flex-1', step.done && 'text-muted-foreground')}>
                      <Bidi>{step.title}</Bidi>
                    </span>
                    {step.taskKey && <CardChip k={step.taskKey} type="task" />}
                  </li>
                ))}
              </ul>
              {more > 0 && (
                <p className="text-body-sm text-muted-foreground">
                  {plural(more, locale, t.focal.moreSteps)}
                </p>
              )}
            </>
          ) : (
            <p className="text-body-sm text-muted-foreground">{t.focal.noSteps}</p>
          )}
        </div>
      )}
    </article>
  );
}

/** A status inside a lane. The rule under it is neutral, like every rule on the page. */
function GroupHeading({ id, title, count }: { id: string; title: string; count: number }) {
  const locale = useLocale();
  return (
    <div className="flex items-center gap-2">
      <h3 id={id} className="text-body-sm font-semibold text-muted-foreground">
        {title}
      </h3>
      <span className="rounded-full bg-muted px-2 text-caption font-medium text-muted-foreground tabular-nums">
        {num(count, locale)}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}

export function IdeaRow({ card, rowProps }: { card: IdeaCard; rowProps: RowProps }) {
  const t = useT<PlanningMessages>('planning');
  const { me, roles } = useSession();
  const wide = useMedia('(min-width: 768px)');
  const next = nextActionOf(card, roles, me.id);
  const text = excerptOf(card.idea.problem, 140);
  const button = next && (
    <RowAction card={card} action={next.action} size="sm" aria-describedby={`row-${card.key}`} />
  );
  return (
    <CardRow
      {...rowProps(card.key)}
      cardKey={card.key}
      type="idea"
      title={card.title}
      titleId={`row-${card.key}`}
      hideType
      priority={card.priority === 'P0' || card.priority === 'P1' ? card.priority : undefined}
      meta={
        <>
          {isMineHere(card, me.id, roles) && <MineMark />}
          {card.idea.role && <RoleBadge role={card.idea.role} outline={false} className="text-body-sm" />}
          <p className="line-clamp-1 basis-full text-body-sm text-muted-foreground">
            <Bidi>{text || t.row.noText}</Bidi>
          </p>
          {!wide && button && <div className="relative z-10 mt-1 flex basis-full *:flex-1">{button}</div>}
        </>
      }
      action={wide ? button : undefined}
    />
  );
}

export function PlanRow({ card, rowProps }: { card: PlanCard; rowProps: RowProps }) {
  const t = useT<PlanningMessages>('planning');
  const { me, roles } = useSession();
  const wide = useMedia('(min-width: 768px)');
  const next = nextActionOf(card, roles, me.id);
  const { done, total } = progressOf(card);
  const button = next && (
    <RowAction card={card} action={next.action} size="sm" aria-describedby={`row-${card.key}`} />
  );
  return (
    <CardRow
      {...rowProps(card.key)}
      cardKey={card.key}
      type="plan"
      title={card.title}
      titleId={`row-${card.key}`}
      hideType
      priority={card.priority === 'P0' || card.priority === 'P1' ? card.priority : undefined}
      meta={
        <>
          {isMineHere(card, me.id, roles) && <MineMark />}
          {total > 0 ? <StepMeter done={done} total={total} /> : <span>{t.row.noSteps}</span>}
          {!wide && button && <div className="relative z-10 mt-1 flex basis-full *:flex-1">{button}</div>}
        </>
      }
      action={wide ? button : undefined}
    />
  );
}

export interface LaneGroup<C> {
  status: string;
  rows: C[];
}

/** One lane: a question as its heading, and its cards under status headings. */
export function Lane<C extends IdeaCard | PlanCard>({
  id,
  icon: Icon,
  iconClass,
  title,
  groups,
  empty,
  renderRow,
}: {
  id: string;
  icon: LucideIcon;
  iconClass: string;
  title: string;
  groups: LaneGroup<C>[];
  empty: React.ReactNode;
  renderRow: (card: C) => React.ReactNode;
}) {
  const t = useT<PlanningMessages>('planning');
  const words = t.groups as Record<string, string>;
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h2 id={id} className="flex items-center gap-2 text-title-sm font-semibold text-foreground">
        <Icon aria-hidden className={cn('size-5', iconClass)} strokeWidth={1.75} />
        {title}
      </h2>
      {groups.length === 0
        ? empty
        : groups.map((group) => (
            <div key={group.status} className="flex flex-col gap-2">
              <GroupHeading
                id={`${id}-${group.status}`}
                title={words[group.status] ?? group.status}
                count={group.rows.length}
              />
              <ul data-hub-list aria-labelledby={`${id}-${group.status}`} className="flex flex-col gap-2">
                {group.rows.map((card) => (
                  <li key={card.key}>{renderRow(card)}</li>
                ))}
              </ul>
            </div>
          ))}
    </section>
  );
}

export const ideaIconClass = typeClass.idea.fg;
export const planIconClass = typeClass.plan.fg;
