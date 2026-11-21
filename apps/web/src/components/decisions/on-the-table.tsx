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
  usePageWide,
  useT,
} from '@/components/kit';
import { tableOptions } from '@/features/decisions/model';
import { markdownExcerpt } from '@/lib/markdown-text';

import { OpenFacts, type RowProps } from './docket';
import type { DecisionMessages } from './messages';

/** One option on the table. Its pros and cons fold at every width, one press away, so "Choose this" is never blind (review M11, M4). */
function OptionTile({
  card,
  option,
  filled,
}: {
  card: DecisionCard;
  option: DecisionCard['decision']['options'][number];
  filled: boolean;
}) {
  const t = useT<DecisionMessages>('decisions');
  const [open, setOpen] = useState(false);
  const hasDetail = option.pros.length > 0 || option.cons.length > 0;
  return (
    <DecisionOptionCard
      option={open ? option : { ...option, pros: [], cons: [] }}
      stacked
      className="w-full bg-background"
      footer={
        <div className="flex flex-col gap-2">
          {hasDetail && (
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
  const wide = usePageWide(768);
  const d = card.decision;
  const blocks = card.links.filter((l) => l.kind === 'blocks');
  const titleId = `table-${card.key}`;
  // A row carries no body, so the laid-open question reads its own card.
  const body = useCardQuery(card.key).data?.body;
  const excerpt = body ? markdownExcerpt(body) : '';
  const [showAll, setShowAll] = useState(false);
  const { visible, folded, filledId } = tableOptions(d.options);
  const shown = showAll ? [...visible, ...folded] : visible;
  // Three tiles sit in a row from 768, so they leave no hole. More wrap, and two have the width to themselves.
  const columns =
    shown.length === 3
      ? 'md:@page-md:grid-cols-3'
      : cn('md:@page-md:grid-cols-2', shown.length > 3 && 'lg:@page-lg:grid-cols-3');
  const recommended = d.options.filter((o) => o.recommended).length;

  return (
    <article
      {...rowProps(card.key)}
      aria-labelledby={titleId}
      // Overdue is told by tone, in the gutter and the band's heading, not by a red frame (owner decision 7).
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:p-5"
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
      {excerpt && (
        <p className="line-clamp-2 max-w-prose text-body text-muted-foreground max-md:hidden @max-page-md:hidden">
          <Bidi>{excerpt}</Bidi>
        </p>
      )}

      {recommended >= 2 && (
        <p className="text-body-sm text-muted-foreground">
          {plural(recommended, locale, t.table.manyRecommended)}
        </p>
      )}
      {shown.length > 0 && (
        <ul className={cn('grid items-start gap-2', wide && columns)}>
          {shown.map((option) => (
            <li key={option.id} className="flex min-w-0">
              <OptionTile card={card} option={option} filled={option.id === filledId} />
            </li>
          ))}
        </ul>
      )}
      {folded.length > 0 && (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
          className={cn(
            'hit-44 inline-flex items-center gap-1 self-start rounded-sm text-body-sm font-medium text-foreground underline-offset-4 hover:underline',
            focusRing,
          )}
        >
          <ChevronDown
            aria-hidden
            className={cn(
              'size-3.5 transition-transform duration-120 motion-reduce:transition-none',
              showAll && 'rotate-180',
            )}
            strokeWidth={1.75}
          />
          {showAll ? t.table.fewerOptions : plural(folded.length, locale, t.table.moreOptions)}
        </button>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 empty:hidden">
        {d.options.length === 0 && (
          <Button
            variant="primary"
            aria-keyshortcuts="d"
            className="max-sm:w-full @max-page-sm:w-full"
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
