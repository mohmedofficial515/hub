'use client';

/**
 * @file parts.tsx
 * @description The Planning page's pieces: the numbers at a glance, the live draft's banner, the focal card, a lane, an idea row, a plan row and the step meter.
 * Every card opens its own page, not the sheet. Why they look this way: NOTES.md beside this file.
 */
import { useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Check, Circle, type LucideIcon, Sparkles, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import {
  actionName,
  AppLink,
  Bidi,
  Button,
  CardChip,
  cn,
  fill,
  fmt,
  focusRing,
  IconButton,
  type IdeaCard,
  kitMessages,
  Ltr,
  MineMark,
  num,
  openCard,
  type PlanCard,
  plural,
  PriorityBadge,
  RelativeTime,
  RoleBadge,
  RowAction,
  stretchedFocus,
  TypeBadge,
  typeClass,
  useCardQuery,
  type useKeyboardList,
  useLocale,
  usePageWide,
  usePerformAction,
  useSession,
  useT,
} from '@/components/kit';
import {
  excerptOf,
  type Focal,
  isMineHere,
  nextActionOf,
  nextStepOf,
  progressOf,
} from '@/features/planning/model';
import { useSavedProposal } from '@/features/planning/proposal';

import { LivePill, ProgressMeter, StagePill } from './detail-parts';
import { useLiveDraft } from './live';
import type { PlanningMessages } from './messages';

type RowProps = ReturnType<typeof useKeyboardList>['rowProps'];

const STEPS_ON_FOCAL = 5;

/** Steps as a number first, and a thin neutral meter beside it. Status is never colour alone, and this has no colour. */
export function StepMeter({ done, total, className }: { done: number; total: number; className?: string }) {
  const t = useT<PlanningMessages>('planning');
  const locale = useLocale();
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="sr-only">{t.row.steps}</span>
      <ProgressMeter done={done} total={total} className="w-16" />
      <span className="tabular-nums">
        {fmt(t.row.progress, { done: num(done, locale), total: num(total, locale) })}
      </span>
    </span>
  );
}

/** A link styled as the kit's Button, for a control that goes somewhere (README: AppLink for any place), so it opens in a new tab too. */
export const linkButton = (variant: 'primary' | 'outline') =>
  cn(
    'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 text-body font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-150 ease-out md:h-9',
    variant === 'primary'
      ? 'btn-sheen bg-primary text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary-hover'
      : 'border border-border bg-card text-foreground shadow-xs hover:border-primary/30 hover:bg-accent',
    focusRing,
  );

/**
 * Four numbers the page already has, so the owner reads its state before its rows. Nothing here is estimated. A number with rows behind it is a link to
 * them; a zero stays a plain number.
 */
export function StatsStrip({
  items,
  label,
}: {
  items: { label: string; value: ReactNode; icon: LucideIcon; href?: string | undefined; empty?: boolean }[];
  label: string;
}) {
  const reduce = useReducedMotion();
  return (
    <dl aria-label={label} className="grid grid-cols-2 gap-2 @page-md:grid-cols-4">
      {items.map(({ label: name, value, icon: Icon, href, empty }) => (
        <div
          key={name}
          className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card px-3 py-2.5 shadow-xs"
        >
          <dt className="flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
            <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{name}</span>
          </dt>
          <dd className="text-title-sm font-semibold text-foreground tabular-nums">
            {href && !empty ? (
              <a
                href={href}
                onClick={(e) => {
                  const target = document.getElementById(href.slice(1));
                  if (!target) return;
                  e.preventDefault();
                  target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
                }}
                className={cn('hit-44 rounded-sm underline-offset-4 hover:underline', focusRing)}
              >
                {value}
              </a>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const DISMISSED = 'hub:planning:draft-dismissed';
const dismissedDraft = () => {
  try {
    return window.sessionStorage.getItem(DISMISSED);
  } catch {
    return null;
  }
};

/** The plan a chat is drafting, or just proposed, with the way to it in the Plan Studio. Gone once that proposal is saved. */
export function DraftBanner() {
  const w = useT<PlanningMessages>('planning');
  const draft = useLiveDraft();
  const saved = useSavedProposal(draft?.proposal?.id);
  const [dismissed, setDismissed] = useState(dismissedDraft);
  if (!draft || saved || (draft.messageId && dismissed === draft.messageId)) return null;
  const dismiss = () => {
    if (!draft.messageId) return;
    setDismissed(draft.messageId);
    try {
      window.sessionStorage.setItem(DISMISSED, draft.messageId);
    } catch {
      // Blocked storage: hidden until the page reloads.
    }
  };
  const title = draft.proposal?.structured?.title;
  return (
    <div
      data-planning-draft
      className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs"
    >
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      >
        <Sparkles className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold text-foreground">
          {draft.writing ? w.liveBanner.drafting : w.liveBanner.proposed}
        </p>
        {title && (
          <p className="truncate text-caption text-muted-foreground">
            <Bidi>{title}</Bidi>
          </p>
        )}
      </div>
      {draft.writing && <LivePill label={w.draft.writing} />}
      <AppLink
        view="planning"
        // Every plan a chat proposes, or is writing, opens in the Plan Studio on that chat (the live draft page is gone).
        query={{ studio: 'plan', chat: draft.chatId }}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-body-sm font-medium text-foreground transition-colors duration-150 hover:bg-accent max-md:h-11',
          focusRing,
        )}
      >
        {w.liveBanner.open}
        <ArrowUpRight aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
      </AppLink>
      {!draft.writing && draft.messageId && (
        <IconButton label={w.liveBanner.dismiss} onClick={dismiss}>
          <X aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
      )}
    </div>
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
      id="planning-focal"
      aria-labelledby={titleId}
      className="grid scroll-mt-20 gap-x-6 gap-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:p-5 @page-lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
    >
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
          <span
            className={cn(
              'inline-flex h-5.5 items-center rounded-full px-2 font-semibold',
              action ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground',
            )}
          >
            {action ? t.focal.label : card.status === 'in_review' ? t.focal.waiting : t.focal.moving}
          </span>
          <TypeBadge type={card.type} />
          <Ltr mono className="text-caption">
            {card.key}
          </Ltr>
          <StagePill card={card} />
          {(card.priority === 'P0' || card.priority === 'P1') && <PriorityBadge priority={card.priority} />}
          {isMineHere(card, me.id, roles) && <MineMark className="text-caption" />}
        </div>
        <h2 id={titleId} className="text-title-sm font-semibold text-pretty text-foreground">
          <AppLink
            card={card.key}
            className={cn('hit-44 rounded-sm underline-offset-4 hover:underline', focusRing)}
          >
            <Bidi>{card.title}</Bidi>
          </AppLink>
        </h2>
        <p className="line-clamp-3 max-w-prose text-body-sm text-muted-foreground">
          <Bidi>{text || noText}</Bidi>
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
          {action && available && (
            <Button variant="primary" className="max-sm:w-full @max-page-sm:w-full" onClick={run}>
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
        <div className="flex min-w-0 flex-col gap-2.5 rounded-xl bg-muted/50 p-3">
          {progress && progress.total > 0 ? (
            <>
              <div className="flex flex-col gap-1.5">
                <p className="text-caption font-medium text-foreground">
                  {fmt(t.focal.progress, {
                    done: num(progress.done, locale),
                    total: num(progress.total, locale),
                  })}
                </p>
                <ProgressMeter done={progress.done} total={progress.total} />
              </div>
              <ul className="flex flex-col gap-1.5">
                {steps.map((step) => (
                  <li key={step.id} className="flex items-start gap-2 text-caption text-foreground">
                    {step.done ? (
                      <Check
                        aria-hidden
                        className="mt-0.5 size-3.5 shrink-0 text-success-soft-foreground"
                        strokeWidth={2}
                      />
                    ) : (
                      <Circle
                        aria-hidden
                        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
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
                <p className="text-caption text-muted-foreground">
                  {plural(more, locale, t.focal.moreSteps)}
                </p>
              )}
            </>
          ) : (
            <p className="text-caption text-muted-foreground">{t.focal.noSteps}</p>
          )}
        </div>
      )}
    </article>
  );
}

/** A status inside a lane. The rule beside it is neutral, like every rule on the page. */
function GroupHeading({ id, title, count }: { id: string; title: string; count: number }) {
  const locale = useLocale();
  return (
    <div className="flex items-center gap-2">
      <h3 id={id} className="text-caption font-semibold text-muted-foreground">
        {title}
      </h3>
      <span className="rounded-full bg-muted px-1.5 text-caption font-medium text-muted-foreground tabular-nums">
        {num(count, locale)}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}

/** One row on Planning: a compact card that opens the card's own page through a stretched link. Its button sits above the link. */
function PlanningRow({
  card,
  rowProps,
  meta,
  below,
  button,
}: {
  card: IdeaCard | PlanCard;
  rowProps: RowProps;
  meta?: ReactNode;
  below?: ReactNode;
  button?: ReactNode;
}) {
  const kit = useT(kitMessages);
  const { me, roles } = useSession();
  const wide = usePageWide(768);
  const id = `row-${card.key}`;
  return (
    <article
      {...rowProps(card.key)}
      aria-labelledby={id}
      className="relative flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-xs outline-none transition-[background-color,box-shadow] duration-150 hover:bg-accent/50 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <p id={id} className="text-body-sm font-semibold text-pretty text-foreground">
            <AppLink
              card={card.key}
              className={cn(
                'underline-offset-4 outline-none after:absolute after:inset-0 after:rounded-xl hover:underline',
                stretchedFocus,
              )}
            >
              <Bidi>{card.title}</Bidi>
            </AppLink>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
            <span className="sr-only">{kit.types[card.type]}</span>
            <Ltr mono className="text-caption">
              {card.key}
            </Ltr>
            {(card.priority === 'P0' || card.priority === 'P1') && <PriorityBadge priority={card.priority} />}
            {isMineHere(card, me.id, roles) && <MineMark className="text-caption" />}
            {meta}
            <RelativeTime iso={card.lastEventAt} className="text-caption" />
          </div>
        </div>
        {wide && button && <div className="relative z-10 shrink-0">{button}</div>}
      </div>
      {below}
      {!wide && button && <div className="relative z-10 flex *:flex-1">{button}</div>}
    </article>
  );
}

export function IdeaRow({
  card,
  rowProps,
  plan,
}: {
  card: IdeaCard;
  rowProps: RowProps;
  plan?: PlanCard | undefined;
}) {
  const t = useT<PlanningMessages>('planning');
  const { me, roles } = useSession();
  const next = nextActionOf(card, roles, me.id);
  const text = excerptOf(card.idea.problem, 140);
  return (
    <PlanningRow
      card={card}
      rowProps={rowProps}
      meta={
        <>
          {card.idea.role && <RoleBadge role={card.idea.role} outline={false} className="text-caption" />}
          {/* The plan it became: above the row's own link, so it opens that plan. */}
          {plan && (
            <span className="relative z-10">
              <CardChip k={plan.key} type="plan" card={plan} showStatus />
            </span>
          )}
        </>
      }
      below={
        <p className="line-clamp-2 text-caption text-muted-foreground">
          <Bidi>{text || t.row.noText}</Bidi>
        </p>
      }
      button={
        next && <RowAction card={card} action={next.action} size="sm" aria-describedby={`row-${card.key}`} />
      }
    />
  );
}

export function PlanRow({
  card,
  rowProps,
  idea,
}: {
  card: PlanCard;
  rowProps: RowProps;
  idea?: IdeaCard | undefined;
}) {
  const t = useT<PlanningMessages>('planning');
  const locale = useLocale();
  const { me, roles } = useSession();
  const next = nextActionOf(card, roles, me.id);
  const { done, total, withoutTask } = progressOf(card);
  const step = nextStepOf(card);
  return (
    <PlanningRow
      card={card}
      rowProps={rowProps}
      meta={
        <>
          {total > 0 ? <StepMeter done={done} total={total} /> : <span>{t.row.noSteps}</span>}
          {total > 0 && withoutTask > 0 && <span>{fmt(t.row.noTask, { n: num(withoutTask, locale) })}</span>}
          {idea && (
            <span className="relative z-10">
              <CardChip k={idea.key} type="idea" card={idea} />
            </span>
          )}
        </>
      }
      below={
        total > 0 && (
          <p className="flex min-w-0 items-center gap-1.5 text-caption text-foreground">
            {step ? (
              <>
                <span className="line-clamp-1 min-w-0">
                  {fill(t.row.next, {
                    n: num(step.index + 1, locale),
                    title: <Bidi>{step.step.title}</Bidi>,
                  })}
                </span>
                {step.step.role && (
                  <RoleBadge role={step.step.role} outline={false} className="shrink-0 text-caption" />
                )}
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Check aria-hidden className="size-3.5" strokeWidth={2} />
                {t.row.allDone}
              </span>
            )}
          </p>
        )
      }
      button={
        next && <RowAction card={card} action={next.action} size="sm" aria-describedby={`row-${card.key}`} />
      }
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
  type,
  title,
  groups,
  empty,
  renderRow,
}: {
  id: string;
  icon: LucideIcon;
  type: 'idea' | 'plan';
  title: string;
  groups: LaneGroup<C>[];
  empty: React.ReactNode;
  renderRow: (card: C) => React.ReactNode;
}) {
  const t = useT<PlanningMessages>('planning');
  const locale = useLocale();
  const words = t.groups as Record<string, string>;
  const count = groups.reduce((sum, g) => sum + g.rows.length, 0);
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg',
            typeClass[type].soft,
            typeClass[type].fg,
          )}
        >
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <h2 id={id} className="text-title-sm font-semibold text-foreground">
          {title}
        </h2>
        {count > 0 && (
          <span className="rounded-full bg-muted px-2 text-caption font-medium text-muted-foreground tabular-nums">
            {num(count, locale)}
          </span>
        )}
      </div>
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
