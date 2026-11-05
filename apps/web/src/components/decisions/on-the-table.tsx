'use client';

/**
 * @file on-the-table.tsx
 * @description Ported from v5 `pages/decisions/parts/on-the-table.tsx`. The page's focal point: the next question I can answer, with its options side by side.
 */
import { ChevronDown, MessageSquare } from 'lucide-react';
import { useState } from 'react';

import { openDecideWith } from '@/components/cards/sheet-sections/decision';
import {
  actionName,
  AppLink,
  Bidi,
  Button,
  CardChip,
  cn,
  type DecisionCard,
  DecisionOptionCard,
  fmt,
  focusRing,
  kitMessages,
  Ltr,
  openCard,
  plural,
  PriorityBadge,
  useCardQuery,
  useLocale,
  useMedia,
  useT,
} from '@/components/kit';
import { bandOf } from '@/features/decisions/model';

import { OpenFacts, type RowProps } from './docket';
import type { DecisionMessages } from './messages';

/** One option on the table. A phone folds its pros and cons, one press away, so "Choose this" is never blind (review M11). */
function OptionTile({
  card,
  option,
  wide,
  filled,
}: {
  card: DecisionCard;
  option: DecisionCard['decision']['options'][number];
  wide: boolean;
  filled: boolean;
}) {
  const t = useT<DecisionMessages>('decisions');
  const [open, setOpen] = useState(false);
  const hasDetail = option.pros.length > 0 || option.cons.length > 0;
  const showDetail = wide || open;
  return (
    <DecisionOptionCard
      option={showDetail ? option : { ...option, pros: [], cons: [] }}
      stacked
      className="w-full bg-background"
      footer={
        <div className="flex flex-col gap-2">
          {!wide && hasDetail && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={cn(
                'hit-44 inline-flex items-center gap-1 self-start rounded-sm text-body-sm font-medium text-foreground underline-offset-4 hover:underline',
                focusRing,
              )}
            >
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-3.5 transition-transform duration-120 motion-reduce:transition-none',
                  open && 'rotate-180',
                )}
                strokeWidth={1.75}
              />
              {open ? t.table.hideDetail : t.table.showDetail}
            </button>
          )}
          <Button
            size="sm"
            variant={filled ? 'primary' : 'outline'}
            className="w-full"
            aria-keyshortcuts={filled ? 'd' : undefined}
            aria-label={fmt(t.table.chooseOption, { option: option.title })}
            onClick={() => openDecideWith(card.key, option.id)}
          >
            {t.table.choose}
          </Button>
        </div>
      }
    />
  );
}

/**
 * Every option has its own "Choose this", which opens the sheet's form with that option picked and the cursor in the rationale. The filled one is
 * the recommended option, or the first when none is. A question with no options keeps a filled Decide, the only way forward.
 */
export function OnTheTable({ card, rowProps }: { card: DecisionCard; rowProps: RowProps }) {
  const t = useT<DecisionMessages>('decisions');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const wide = useMedia('(min-width: 768px)');
  const d = card.decision;
  const blocks = card.links.filter((l) => l.kind === 'blocks');
  const danger = bandOf(card) === 'overdue';
  const titleId = `table-${card.key}`;
  // A row carries no body, so the laid-open question reads its own card.
  const body = useCardQuery(card.key).data?.body;
  const columns = d.options.length >= 3 ? 'lg:grid-cols-3' : '';
  const filledOption = (d.options.find((o) => o.recommended) ?? d.options[0])?.id;

  return (
    <article
      {...rowProps(card.key)}
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-card p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:p-5',
        danger ? 'border-destructive/70' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body-sm text-muted-foreground">
        <Ltr mono className="text-caption">
          {card.key}
        </Ltr>
        {(card.priority === 'P0' || card.priority === 'P1') && <PriorityBadge priority={card.priority} />}
        <OpenFacts card={card} gutter={wide} />
      </div>

      <h3 id={titleId} className="text-title font-semibold text-pretty text-foreground">
        <AppLink
          card={card.key}
          className={cn('hit-44 rounded-sm underline-offset-4 hover:underline', focusRing)}
        >
          <Bidi>{card.title}</Bidi>
        </AppLink>
      </h3>
      {body && (
        <p className="line-clamp-2 max-w-prose text-body text-muted-foreground max-md:hidden">
          <Bidi>{body}</Bidi>
        </p>
      )}

      {d.options.length > 0 && (
        <ul className={cn('grid gap-2', wide && 'md:grid-cols-2', columns)}>
          {d.options.map((option) => (
            <li key={option.id} className="flex min-w-0">
              <OptionTile card={card} option={option} wide={wide} filled={option.id === filledOption} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 empty:hidden">
        {d.options.length === 0 && (
          <Button
            variant="primary"
            aria-keyshortcuts="d"
            className="max-sm:w-full"
            onClick={() => openCard(card.key, { action: 'decide' })}
          >
            {actionName(kit, 'decision', 'decide')}
          </Button>
        )}
        {card.commentCount > 0 && (
          <AppLink
            card={card.key}
            className={cn(
              'hit-44 inline-flex items-center gap-1 rounded-sm text-body-sm text-muted-foreground underline-offset-4 hover:underline',
              focusRing,
            )}
            onClick={(e) => {
              e.preventDefault();
              openCard(card.key, { tab: 'comments', opener: e.currentTarget });
            }}
          >
            <MessageSquare aria-hidden className="size-3.5" strokeWidth={1.75} />
            {plural(card.commentCount, locale, t.row.comments)}
          </AppLink>
        )}
        {blocks.length > 0 && (
          <span className="flex flex-wrap items-center gap-1.5 text-body-sm text-muted-foreground">
            {kit.sheet.links.kinds.blocks}
            {blocks.map((l) => (
              <CardChip key={l.key} k={l.key} type={l.card?.type} title={l.card?.title} />
            ))}
          </span>
        )}
      </div>
    </article>
  );
}
