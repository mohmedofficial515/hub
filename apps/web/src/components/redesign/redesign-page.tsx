'use client';

/**
 * @file redesign-page.tsx
 * @description The owner's verdict on lab versions. A version in review is laid open, every other is a tile, and each lab page opens
 * with a rail of all its versions. Ported from the design's `pages/redesign/page.tsx`, reading the lab through the API.
 */
import { ChevronRight, ExternalLink, GitCompareArrows, Maximize2, Palette, SearchX, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import {
  AppLink,
  Bidi,
  Button,
  cn,
  EmptyState,
  ErrorState,
  fill,
  FilterBar,
  fmt,
  focusRing,
  IconButton,
  kitMessages,
  Lightbox,
  LoadingRegion,
  Ltr,
  num,
  openCard,
  PageContainer,
  PageHeader,
  plural,
  type RedesignCard,
  setQuery,
  Skeleton,
  StatusBadge,
  statusIcon,
  statusTone,
  stretchedFocus,
  Tooltip,
  useFilter,
  useKeyboardList,
  useLocale,
  useRoute,
  useSession,
  useT,
} from '@/components/kit';
import { compareDefaults, labHome, togglePicked } from '@/features/redesign/lab';
import { type LabPage, useLabPages } from '@/features/redesign/queries';
import { isHubError } from '@/lib/api/errors';
import type { RedesignMessages } from '@/lib/i18n/page-dicts';

import { ShotThumb, useDefaultShot } from './shot';

const RedesignCompare = dynamic(() => import('./compare'), { ssr: false });

const iconTone = {
  success: 'text-success-soft-foreground',
  info: 'text-info-soft-foreground',
  warning: 'text-warning-soft-foreground',
  danger: 'text-destructive-soft-foreground',
  muted: 'text-muted-foreground',
} as const;

const toneOf = (status: string) => iconTone[statusTone(status)] ?? iconTone.muted;

type RowProps = { 'data-row': string; 'data-row-list': string; tabIndex: number };

export function RedesignPage() {
  const t = useT<RedesignMessages>('redesign');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { isOwner, loading: sessionLoading } = useSession();
  const route = useRoute();
  const query = useLabPages();
  const app = useFilter('app');
  const status = useFilter('status');
  const only = useFilter('page');

  // 09 §10: the owner opens on what waits for him. It is a real filter he can clear, and the URL says so.
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || sessionLoading) return;
    preselected.current = true;
    if (isOwner && !route.query.get('status') && !route.query.get('app')) setQuery({ status: 'review' });
  }, [isOwner, sessionLoading, route.query]);

  const versions = useMemo(() => query.data?.items ?? [], [query.data]);
  const labPages = useMemo(() => query.data?.pages ?? [], [query.data]);
  const byKey = useMemo(() => new Map(versions.map((v) => [v.key, v])), [versions]);
  const inReview = versions.filter((v) => v.status === 'review').length;
  const pageOf = (key: string) => labPages.find((p) => p.versionKeys.includes(key));

  const [picked, setPicked] = useState<string[]>([]);
  const [compare, setCompare] = useState<{ open: boolean; a: string | null; b: string | null }>({
    open: false,
    a: null,
    b: null,
  });

  const togglePick = (key: string) =>
    setPicked((current) => togglePicked(current, key, pageOf(key)?.versionKeys ?? []));

  const pages = useMemo(() => {
    const allowed = labPages.filter((p) => (!app || p.app === app) && (!only || p.page === only));
    const withRows = allowed.map((page) => {
      const list = page.versionKeys.map((k) => byKey.get(k)).filter((v): v is RedesignCard => !!v);
      return { page, list, shown: list.filter((v) => !status || v.status === status) };
    });
    return withRows.sort(
      (a, b) =>
        Number(b.list.some((v) => v.status === 'review')) - Number(a.list.some((v) => v.status === 'review')),
    );
  }, [labPages, app, only, status, byKey]);
  const visible = pages.filter((p) => p.shown.length > 0);
  const hiddenCount = pages.length - visible.length;

  // Newest first inside a page: the version to judge is the one the eye should meet.
  const ordered = visible.map((p) => ({ ...p, shown: [...p.shown].reverse() }));
  const ids = ordered.flatMap((p) => p.shown.map((v) => v.key));
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useKeyboardList({ ids, emptyFocusRef: heading, actions: { x: togglePick } });

  const firstReviewKey = isOwner
    ? ordered.flatMap((p) => p.shown).find((v) => v.status === 'review')?.key
    : undefined;

  const empty = query.isSuccess && labPages.length === 0;
  const header = (
    <PageHeader
      title={t.title}
      // Computed from what the page holds, and left out when it is empty: the empty state says it once (review M4, M8).
      meta={
        query.isPending || query.isError || empty
          ? undefined
          : isOwner
            ? plural(inReview, locale, t.metaOwner)
            : t.metaOther
      }
      actions={
        <a
          href={labHome()}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'inline-flex h-11 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-body font-medium text-foreground transition-colors duration-150 hover:bg-accent md:h-9',
            focusRing,
          )}
        >
          {t.openLab}
          <ExternalLink aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
        </a>
      }
    />
  );

  if (query.isError) {
    const error = query.error;
    return (
      <PageContainer>
        {header}
        <ErrorState
          thing={t.errorThing}
          code={isHubError(error) ? error.code : 'hub.redesign.lab_unavailable'}
          requestId={isHubError(error) ? error.requestId : undefined}
          onRetry={() => void query.refetch()}
        />
      </PageContainer>
    );
  }
  if (query.isPending) {
    return (
      <PageContainer>
        {header}
        <LoadingRegion label={t.loading}>
          {[0, 1].map((n) => (
            <div key={n} className="flex flex-col gap-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-9 w-full max-w-2xl" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="overflow-hidden rounded-lg border border-border bg-card">
                    <Skeleton className="aspect-16/10 rounded-none" />
                    <div className="flex flex-col gap-2 p-3">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </LoadingRegion>
      </PageContainer>
    );
  }
  if (empty) {
    return (
      <PageContainer>
        {header}
        <EmptyState size="page" icon={Palette} title={t.emptyTitle}>
          {t.emptyBody}
        </EmptyState>
      </PageContainer>
    );
  }

  const count = (s: string) =>
    versions.filter((v) => v.status === s && (!app || pageOf(v.key)?.app === app)).length;
  const statusOption = (value: string) => ({ value, label: kit.status[value] ?? value, count: count(value) });

  const pickedCards = picked.map((k) => byKey.get(k)).filter((v): v is RedesignCard => !!v);
  const pickedPage = pageOf(picked[0] ?? '');
  const comparedPage = pageOf(compare.b ?? compare.a ?? '');
  const comparedVersions = (comparedPage?.versionKeys ?? [])
    .map((k) => byKey.get(k))
    .filter((v): v is RedesignCard => !!v);
  const apps = [...new Set(labPages.map((p) => p.app))];

  const [firstPicked, secondPicked] = pickedCards;
  return (
    <PageContainer>
      {header}
      <FilterBar
        status={{
          label: t.filters.status,
          value: status ?? 'all',
          onChange: (next) => setQuery({ status: next === 'all' ? null : next }),
          options: [
            { value: 'all', label: kit.all },
            ...['review', 'draft', 'approved', 'ported', 'rejected'].map(statusOption),
          ],
        }}
        groups={[
          {
            param: 'app',
            label: t.filters.app,
            options: apps.map((a) => ({ value: a, label: t.apps[a as keyof typeof t.apps] ?? a })),
          },
        ]}
      />
      {only && (
        <p>
          <AppLink
            view="redesign"
            query={{ page: null }}
            className={cn(
              'hit-44 rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline',
              focusRing,
            )}
          >
            {t.showAllPages}
          </AppLink>
        </p>
      )}

      {ordered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t.noMatchTitle}
          action={
            <Button onClick={() => setQuery({ app: null, status: null, page: null })}>
              {t.clearFilters}
            </Button>
          }
        >
          {t.noMatchBody}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-10">
          {ordered.map(({ page, list: all, shown }) => (
            <PageStrip key={`${page.app}/${page.page}`} page={page} all={all} shown={shown}>
              <ul data-hub-list className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((v) => {
                  const lead = v.status === 'review';
                  return (
                    <li key={v.key} className={cn(lead && 'sm:col-span-2 lg:col-span-3')}>
                      {lead ? (
                        <LeadVersion
                          card={v}
                          rowProps={list.rowProps(v.key)}
                          primary={v.key === firstReviewKey}
                          onCompare={() => {
                            const [a, b] = compareDefaults(v, all);
                            setCompare({ open: true, a, b });
                          }}
                        />
                      ) : (
                        <VersionTile
                          card={v}
                          rowProps={list.rowProps(v.key)}
                          picked={picked.includes(v.key)}
                          onPick={() => togglePick(v.key)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </PageStrip>
          ))}
          {hiddenCount > 0 && status && (
            <p className="text-body-sm text-muted-foreground">{plural(hiddenCount, locale, t.hidden)}</p>
          )}
        </div>
      )}

      {picked.length > 0 && (
        <div
          role="region"
          aria-label={t.bar.label}
          className="sticky bottom-4 z-20 mx-auto flex w-full max-w-xl flex-wrap items-center gap-2 rounded-lg border border-border bg-popover p-2 ps-3 text-popover-foreground shadow-md"
        >
          <GitCompareArrows
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
          <p role="status" className="min-w-0 flex-1 text-body-sm text-foreground">
            {firstPicked && secondPicked
              ? fill(t.bar.ready, {
                  a: <Ltr mono>{firstPicked.redesign.version}</Ltr>,
                  b: <Ltr mono>{secondPicked.redesign.version}</Ltr>,
                })
              : fmt(t.bar.pickAnother, { page: pickedPage?.title ?? '' })}
          </p>
          <Button
            disabled={pickedCards.length !== 2}
            onClick={() => setCompare({ open: true, a: picked[0] ?? null, b: picked[1] ?? null })}
          >
            {t.bar.open}
          </Button>
          <IconButton label={t.bar.clear} onClick={() => setPicked([])}>
            <X aria-hidden className="size-4" strokeWidth={1.75} />
          </IconButton>
        </div>
      )}

      {compare.open && (
        <RedesignCompare
          open={compare.open}
          a={compare.a}
          b={compare.b}
          versions={comparedVersions}
          pageLabel={comparedPage ? `${comparedPage.app}/${comparedPage.page}` : undefined}
          onOpenChange={(open) => setCompare((c) => ({ ...c, open }))}
        />
      )}
    </PageContainer>
  );
}

/** One lab page: where it stands, every version on a line from oldest to newest, then the ones the filter asks for. */
function PageStrip({
  page,
  all,
  shown,
  children,
}: {
  page: LabPage;
  all: RedesignCard[];
  shown: RedesignCard[];
  children: ReactNode;
}) {
  const t = useT<RedesignMessages>('redesign');
  const locale = useLocale();
  const id = `page-${page.app}-${page.page}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="text-title-sm font-semibold text-foreground">
          <AppLink
            view="redesign"
            query={{ page: page.page }}
            title={t.onlyThisPage}
            className={cn('hit-44 rounded-sm underline-offset-4 hover:underline', focusRing)}
          >
            <Bidi>{page.title}</Bidi>
          </AppLink>
        </h2>
        <Ltr mono className="text-body-sm text-muted-foreground">
          {`${page.app}/${page.page}`}
        </Ltr>
        <span className="text-body-sm text-muted-foreground">{plural(all.length, locale, t.versions)}</span>
        <span className="text-body-sm text-muted-foreground md:ms-auto">
          {t.briefLabel}: <span className="font-medium text-foreground">{t.brief[page.status]}</span>
        </span>
        {page.liveUrl && (
          <span className="text-body-sm text-muted-foreground">
            {t.live}: <Ltr mono>{page.liveUrl}</Ltr>
          </span>
        )}
      </div>
      <VersionRail page={page} all={all} shown={shown} />
      {children}
    </section>
  );
}

/** Time reads with the language: the oldest version at the start, the newest at the end (kit README, time axes). */
function VersionRail({ page, all, shown }: { page: LabPage; all: RedesignCard[]; shown: RedesignCard[] }) {
  const t = useT<RedesignMessages>('redesign');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const shownKeys = new Set(shown.map((v) => v.key));
  return (
    <ol
      aria-label={fmt(t.railLabel, { page: page.title })}
      className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
    >
      {all.map((v, i) => {
        const Icon = statusIcon(v.status);
        const word = kit.status[v.status] ?? v.status;
        return (
          <li key={v.key} className="flex shrink-0 items-center gap-1">
            {i > 0 && (
              <ChevronRight
                aria-hidden
                className="size-3 text-muted-foreground rtl:-scale-x-100"
                strokeWidth={1.75}
              />
            )}
            <AppLink
              card={v.key}
              aria-label={`${v.redesign.version}, ${word}${
                v.redesign.reviewScore !== undefined
                  ? `, ${fmt(t.scoreOf, { score: v.redesign.reviewScore })}`
                  : ''
              }`}
              title={word}
              className={cn(
                'inline-flex h-11 items-center gap-1.5 rounded-full border px-2.5 text-caption transition-colors duration-120 hover:bg-accent md:h-7',
                shownKeys.has(v.key)
                  ? 'border-foreground bg-card text-foreground'
                  : 'border-border text-muted-foreground',
                focusRing,
              )}
            >
              <Icon aria-hidden className={cn('size-3', toneOf(v.status))} strokeWidth={2} />
              <Ltr mono>{v.redesign.version}</Ltr>
              {v.redesign.reviewScore !== undefined && (
                <Ltr className="font-semibold tabular-nums">{num(v.redesign.reviewScore, locale)}</Ltr>
              )}
            </AppLink>
          </li>
        );
      })}
    </ol>
  );
}

function EnlargeButton({ card }: { card: RedesignCard }) {
  const t = useT<RedesignMessages>('redesign');
  const version = card.redesign.version;
  const { shot, shots } = useDefaultShot(card);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  if (!shot) return null;
  return (
    <>
      <IconButton
        label={fmt(t.enlarge, { version })}
        variant="outline"
        onClick={() => {
          setIndex(
            Math.max(
              0,
              shots.findIndex((s) => s.name === shot.name),
            ),
          );
          setOpen(true);
        }}
        className="absolute end-2 top-2 z-10"
      >
        <Maximize2 aria-hidden className="size-4" strokeWidth={1.75} />
      </IconButton>
      {open && (
        <Lightbox
          open={open}
          onOpenChange={setOpen}
          index={index}
          onIndexChange={setIndex}
          images={shots.map((s) => ({ src: s.url, name: s.name, alt: `${version}: ${s.name}` }))}
        />
      )}
    </>
  );
}

/** A version in review is the page's reason to exist: picture wide, the review beside it, the verdict one click away. */
function LeadVersion({
  card,
  rowProps,
  primary,
  onCompare,
}: {
  card: RedesignCard;
  rowProps: RowProps;
  primary: boolean;
  onCompare: () => void;
}) {
  const t = useT<RedesignMessages>('redesign');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { isOwner } = useSession();
  const r = card.redesign;
  const approve = (
    <Button
      variant={primary ? 'primary' : 'outline'}
      disabled={!isOwner}
      onClick={() => openCard(card.key, { action: 'approve' })}
    >
      {kit.actions.approve}
    </Button>
  );
  return (
    <article
      {...rowProps}
      aria-labelledby={`lead-${card.key}`}
      className="group relative grid overflow-hidden rounded-lg border border-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
    >
      <div className="relative">
        <ShotThumb
          card={card}
          alt={fmt(t.shotAlt, { version: r.version })}
          emptyLabel={t.noShot}
          className="aspect-16/10 border-b border-border lg:aspect-auto lg:h-full lg:min-h-80 lg:border-e lg:border-b-0"
        />
        <EnlargeButton card={card} />
      </div>
      <div className="flex min-w-0 flex-col gap-3 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={card.status} />
          <Ltr mono className="text-caption text-muted-foreground">
            {card.key}
          </Ltr>
        </div>
        <h3 id={`lead-${card.key}`} className="text-title-sm font-semibold text-foreground">
          <AppLink
            card={card.key}
            className={cn('hit-44 rounded-sm underline-offset-4 hover:underline', focusRing)}
          >
            <Ltr mono>{r.version}</Ltr>
          </AppLink>
        </h3>
        <p className="text-body-lg text-foreground">
          <Bidi>{r.concept}</Bidi>
        </p>
        {r.reviewScore !== undefined && (
          <div className="flex items-baseline gap-3 border-t border-border pt-3">
            <p
              className="shrink-0 text-title font-bold text-foreground tabular-nums"
              aria-label={fmt(t.scoreOf, { score: r.reviewScore })}
            >
              <Ltr>{num(r.reviewScore, locale)}</Ltr>
            </p>
            <p className="min-w-0 text-body-sm text-muted-foreground">
              {r.reviewSummary && <Bidi>{r.reviewSummary}</Bidi>}
            </p>
          </div>
        )}
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-body-sm text-muted-foreground">
          {r.base && <span>{fill(t.basedOn, { base: <Ltr mono>{r.base}</Ltr> })}</span>}
          <span>{plural(r.touchesComponents.length, locale, t.components)}</span>
        </p>
        <div className="relative z-10 mt-auto flex flex-wrap items-center gap-2 pt-1">
          {isOwner ? (
            approve
          ) : (
            <Tooltip content={t.ownerDecides}>
              <span
                tabIndex={0}
                aria-label={`${kit.actions.approve}: ${t.ownerDecides}`}
                className={cn('rounded-md', focusRing)}
              >
                {approve}
              </span>
            </Tooltip>
          )}
          <Button onClick={onCompare}>
            <GitCompareArrows aria-hidden className="size-4" strokeWidth={1.75} />
            {t.compareWithBase}
          </Button>
        </div>
      </div>
    </article>
  );
}

function VersionTile({
  card,
  rowProps,
  picked,
  onPick,
}: {
  card: RedesignCard;
  rowProps: RowProps;
  picked: boolean;
  onPick: () => void;
}) {
  const t = useT<RedesignMessages>('redesign');
  const locale = useLocale();
  const r = card.redesign;
  const reference = card.status === 'reference';
  return (
    <article
      {...rowProps}
      aria-labelledby={`tile-${card.key}`}
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        picked && 'border-foreground',
      )}
    >
      <div className="relative">
        <ShotThumb
          card={card}
          alt={fmt(t.shotAlt, { version: r.version })}
          emptyLabel={t.noShot}
          className="aspect-16/10 border-b border-border"
        />
        <EnlargeButton card={card} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p id={`tile-${card.key}`} className="text-body font-semibold text-foreground">
          <AppLink
            card={card.key}
            className={cn(
              'outline-none after:absolute after:inset-0 after:rounded-lg hover:underline',
              stretchedFocus,
            )}
          >
            <Ltr mono>{r.version}</Ltr>
          </AppLink>
        </p>
        <p className="line-clamp-2 text-body-sm text-muted-foreground">
          <Bidi>{r.concept}</Bidi>
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1.5">
          <StatusBadge status={card.status} />
          {r.reviewScore !== undefined && (
            <span
              aria-label={fmt(t.scoreOf, { score: r.reviewScore })}
              className="text-body-sm font-semibold text-foreground tabular-nums"
            >
              <Ltr>{`${num(r.reviewScore, locale)}/100`}</Ltr>
            </span>
          )}
          {!reference && (
            <IconButton
              label={fmt(picked ? t.removeFromCompare : t.addToCompare, { version: r.version })}
              aria-pressed={picked}
              aria-keyshortcuts="x"
              variant="outline"
              onClick={onPick}
              className={cn(
                'relative z-10 ms-auto',
                picked && 'border-foreground bg-foreground text-background hover:bg-foreground',
              )}
            >
              <GitCompareArrows aria-hidden className="size-4" strokeWidth={1.75} />
            </IconButton>
          )}
        </div>
      </div>
    </article>
  );
}
