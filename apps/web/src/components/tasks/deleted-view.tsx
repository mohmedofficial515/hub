'use client';

/**
 * @file deleted-view.tsx
 * @description The Deleted view («المحذوفات», D28): every deleted card this member may see, whatever its type. The API answers with all of them for owner
 * and pm, and a card's creator's own for everyone else. It lives at `tasks?view=deleted`, reached from the Filters of Tasks, Decisions and Planning.
 */
import { ArrowLeft, ArrowRight, RotateCcw, SearchX, Trash2 } from 'lucide-react';
import { useRef } from 'react';

import {
  ActorChip,
  AppLink,
  Button,
  CardRow,
  cn,
  EmptyState,
  ErrorState,
  fill,
  FilterBar,
  focusRing,
  kitMessages,
  Ltr,
  PageContainer,
  PageHeader,
  plural,
  RelativeTime,
  setArchived,
  setQuery,
  showToast,
  SkeletonRows,
  useCardsQuery,
  useFilter,
  useKeyboardList,
  useLocale,
  useT,
} from '@/components/kit';
import type { CardType } from '@/features/cards/types';
import { isHubError } from '@/lib/api/errors';

import type { TaskMessages } from './messages';

const TYPES: CardType[] = ['task', 'decision', 'idea', 'plan', 'need', 'handoff', 'release'];

/** The way in, for a filter panel. */
export function DeletedLink({ type }: { type?: CardType | undefined }) {
  const t = useT<TaskMessages>('tasks');
  return (
    <AppLink
      view="tasks"
      query={{ view: 'deleted', ...(type ? { type } : {}) }}
      className={cn(
        'hit-44 inline-flex items-center gap-1.5 rounded-sm text-body-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline',
        focusRing,
      )}
    >
      <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
      {t.deleted.title}
    </AppLink>
  );
}

export function DeletedView() {
  const t = useT<TaskMessages>('tasks');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const query = useCardsQuery({ archived: true });
  const type = useFilter('type');
  const heading = useRef<HTMLHeadingElement>(null);
  const all = query.data?.items ?? [];
  const rows = type ? all.filter((c) => c.type === type) : all;
  const list = useKeyboardList({ ids: rows.map((c) => c.key), emptyFocusRef: heading });
  const Back = locale === 'ar' ? ArrowRight : ArrowLeft;

  const report = (error: unknown) =>
    showToast({ tone: 'error', message: isHubError(error) ? error.message : kit.actionFailed });

  const restore = (key: string) => {
    setArchived(key, false)
      .then(() =>
        showToast({
          message: fill(t.deleted.restored, { key: <Ltr mono>{key}</Ltr> }),
          onUndo: () => void setArchived(key, true).catch(report),
        }),
      )
      .catch(report);
  };

  return (
    <PageContainer>
      <PageHeader
        title={t.deleted.title}
        meta={query.isPending ? undefined : plural(all.length, locale, t.deleted.count)}
        actions={
          <AppLink
            view="tasks"
            // The same view keeps its params, so the way back clears the ones that make this the Deleted view.
            query={{ view: null, type: null }}
            className={cn(
              'hit-44 inline-flex items-center gap-1.5 rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline',
              focusRing,
            )}
          >
            <Back aria-hidden className="size-4" strokeWidth={1.75} />
            {t.deleted.back}
          </AppLink>
        }
      />
      <p className="max-w-prose text-body text-muted-foreground">{t.deleted.explain}</p>
      {all.length > 0 && (
        <FilterBar
          selects={[
            {
              param: 'type',
              label: t.deleted.type,
              any: t.deleted.anyType,
              // The chosen type stays an option, so a link from another page still says what it filters.
              options: TYPES.filter((v) => v === type || all.some((c) => c.type === v)).map((v) => ({
                value: v,
                label: kit.types[v],
              })),
            },
          ]}
        />
      )}
      <section aria-label={t.deleted.title} className="flex flex-col gap-2">
        <h2 ref={heading} tabIndex={-1} className="sr-only">
          {t.deleted.title}
        </h2>
        {query.isPending ? (
          <SkeletonRows count={4} />
        ) : query.isError ? (
          <ErrorState
            thing={t.deleted.thing}
            code={isHubError(query.error) ? query.error.code : undefined}
            onRetry={() => void query.refetch()}
          />
        ) : rows.length === 0 && all.length > 0 ? (
          <EmptyState
            icon={SearchX}
            title={t.deleted.noneOfType}
            action={<Button onClick={() => setQuery({ type: null })}>{t.deleted.showAll}</Button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState icon={Trash2} title={t.deleted.emptyTitle}>
            {t.deleted.emptyBody}
          </EmptyState>
        ) : (
          <ul data-hub-list className="flex flex-col gap-2">
            {rows.map((card) => (
              <li key={card.key}>
                <CardRow
                  {...list.rowProps(card.key)}
                  cardKey={card.key}
                  type={card.type}
                  title={card.title}
                  titleId={`deleted-${card.key}`}
                  meta={
                    <>
                      {card.archivedAt && (
                        <span className="inline-flex items-center gap-1">
                          {t.deleted.when}
                          <RelativeTime iso={card.archivedAt} />
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        {t.deleted.createdBy}
                        <ActorChip kind={card.createdByKind} memberId={card.createdById} />
                      </span>
                    </>
                  }
                  action={
                    <Button
                      size="sm"
                      aria-describedby={`deleted-${card.key}`}
                      onClick={() => restore(card.key)}
                    >
                      <RotateCcw aria-hidden className="size-3.5" strokeWidth={1.75} />
                      {kit.sheet.restore}
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
