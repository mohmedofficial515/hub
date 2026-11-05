import { useMemo, useRef, useState } from 'react';
import { GitBranch, PackageOpen, Plus, RefreshCw, Rocket, SearchX } from 'lucide-react';
import { Tabs } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { eligibleForRelease, notesAuthors, notesSkeleton } from '@lab/mocks/hub-app/releases';
import {
  ActorChip,
  AppLink,
  Bidi,
  Button,
  CardChip,
  CardRow,
  cn,
  CopyButton,
  dayKey,
  dayOfMonth,
  EmptyState,
  ErrorState,
  FilterBar,
  fill,
  fmt,
  focusRing,
  getCard,
  kitMessages,
  LoadingRegion,
  Ltr,
  num,
  PageContainer,
  PageHeader,
  patchCard,
  plural,
  SectionHeader,
  setQuery,
  shortDate,
  showToast,
  Skeleton,
  SkeletonRows,
  StatusBadge,
  Tooltip,
  tabTriggerClass,
  typeClass,
  typeIcon,
  useCards,
  useFilter,
  useKeyboardList,
  usePerformAction,
  useSession,
  type HubCard,
  type ReleaseCard,
} from '../../kit';
import { messages } from './i18n';
import { NewReleaseDialog } from './parts/new-release';

export default function Page() {
  const { scenario } = useSession();
  return <Releases key={scenario} />;
}

const TYPE_ORDER: HubCard['type'][] = ['decision', 'task', 'handoff', 'redesign', 'change', 'need', 'doc'];

const monthName = (iso: string, locale: 'ar' | 'en') => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date(iso));
const monthShort = (iso: string, locale: 'ar' | 'en') => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { month: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(iso));

function included(release: ReleaseCard): HubCard[] {
  return release.release.includedKeys.map((k) => getCard(k)).filter((c): c is HubCard => !!c);
}

/** How much a release carries, by type: a coloured icon and a number, and words for a screen reader. */
function TypeCounts({ cards }: { cards: HubCard[] }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {TYPE_ORDER.filter((type) => cards.some((c) => c.type === type)).map((type) => {
        const Icon = typeIcon[type];
        const n = cards.filter((c) => c.type === type).length;
        return (
          <span key={type} title={t.groups[type]} className="inline-flex items-center gap-1">
            <Icon aria-hidden className={cn('size-3.5', typeClass[type].fg)} strokeWidth={1.75} />
            <span className="sr-only">{t.groups[type]}</span>
            <Ltr className="font-medium text-foreground tabular-nums">{num(n, locale)}</Ltr>
          </span>
        );
      })}
    </span>
  );
}

/**
 * The batch going out next, laid open: this page's focal point. What it carries, what each audience will read, and the
 * one action that ends it. Shipped releases only need a line each; this one still needs work.
 */
function Manifest({ card, primary }: { card: ReleaseCard; primary: boolean }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { isManager } = useSession();
  const perform = usePerformAction();
  const r = card.release;
  const rows = included(card);
  const author = notesAuthors.get(card.key) ?? { kind: 'system' as const };
  const audiences = ['team', 'owner', 'accountant'] as const;

  const regenerate = () => {
    const before = card.release.notes;
    const beforeAuthor = notesAuthors.get(card.key);
    notesAuthors.set(card.key, { kind: 'system' });
    patchCard(card.key, (c) => (c.type === 'release' ? { ...c, release: { ...c.release, notes: notesSkeleton(rows.map((x) => ({ key: x.key, type: x.type, title: x.title }))) } } : c));
    showToast({
      message: fill(t.regenerated, { key: <Ltr mono>{card.key}</Ltr> }),
      onUndo: () => {
        if (beforeAuthor) notesAuthors.set(card.key, beforeAuthor);
        patchCard(card.key, (c) => (c.type === 'release' ? { ...c, release: { ...c.release, notes: before } } : c));
      },
    });
  };

  const release = (
    <Button variant={primary ? 'primary' : 'outline'} disabled={!isManager} aria-keyshortcuts="" onClick={() => perform(card.key, 'release')}>
      <Rocket aria-hidden className="size-4" strokeWidth={1.75} />
      {kit.actions.release}
    </Button>
  );

  return (
    <article aria-labelledby={`manifest-${card.key}`} className="flex flex-col rounded-lg border border-border bg-card">
      {/* Stacked under `md`: beside the buttons this title block collapsed to a 3 px column on a phone (review B1). */}
      <header className="flex flex-col items-start gap-x-4 gap-y-3 border-b border-border p-4 md:flex-row md:p-5">
        <div className="w-full min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body-sm text-muted-foreground">
            <StatusBadge status={card.status} />
            <Ltr mono className="text-caption">
              {card.key}
            </Ltr>
            {r.repo && (
              <span className="inline-flex items-center gap-1">
                <GitBranch aria-hidden className="size-3.5" strokeWidth={1.75} />
                <Ltr mono>{r.repo}</Ltr>
              </span>
            )}
            <span>{r.tag ? fill(t.tagged, { tag: <Ltr mono>{r.tag}</Ltr> }) : t.untagged}</span>
          </p>
          <h3 id={`manifest-${card.key}`} className="mt-1.5 text-title font-semibold text-foreground">
            <AppLink card={card.key} className={cn('rounded-sm underline-offset-4 hover:underline', focusRing)}>
              <Bidi>{card.title[locale]}</Bidi>
            </AppLink>
          </h3>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:shrink-0">
          {isManager && (
            <Button onClick={regenerate}>
              <RefreshCw aria-hidden className="size-4" strokeWidth={1.75} />
              {t.regenerate}
            </Button>
          )}
          {isManager ? (
            release
          ) : (
            <Tooltip content={t.pmOnly}>
              <span tabIndex={0} aria-label={`${kit.actions.release}: ${t.pmOnly}`} className={cn('rounded-md', focusRing)}>
                {release}
              </span>
            </Tooltip>
          )}
        </div>
      </header>
      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-label={t.includedTitle} className="flex flex-col gap-3 border-b border-border p-4 md:border-e md:border-b-0 md:p-5">
          <h4 className="flex items-center gap-2 text-body font-semibold text-foreground">
            {t.includedTitle}
            <span className="text-body-sm font-normal text-muted-foreground">{plural(rows.length, locale, t.included)}</span>
          </h4>
          {TYPE_ORDER.filter((type) => rows.some((c) => c.type === type)).map((type) => (
            <div key={type} className="flex flex-col gap-1">
              <p className={cn('text-caption font-medium', typeClass[type].fg)}>{t.groups[type]}</p>
              <ul className="flex flex-col items-start gap-1.5">
                {rows
                  .filter((c) => c.type === type)
                  .map((c) => (
                    <li key={c.key} className="max-w-full">
                      <CardChip k={c.key} showTitle className="h-auto min-h-8 py-1" />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>
        <section aria-label={t.notes} className="flex min-w-0 flex-col gap-2 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-body font-semibold text-foreground">{t.notes}</h4>
            <p className="flex flex-wrap items-center gap-1.5 text-body-sm text-muted-foreground">
              <span>{t.wroteBy}</span>
              <ActorChip kind={author.kind} memberId={author.memberId} adapter={author.kind === 'system' ? 'digests' : undefined} />
            </p>
          </div>
          <Tabs.Root defaultValue="team" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <Tabs.List aria-label={t.notes} className="flex gap-1 border-b border-border">
              {audiences.map((a) => (
                <Tabs.Trigger key={a} value={a} className={tabTriggerClass}>
                  {kit.sheet.release.noteTabs[a]}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            {audiences.map((a) => (
              <Tabs.Content key={a} value={a} className="relative pt-3 pe-12 outline-none">
                <p className="text-body whitespace-pre-line text-foreground">
                  <Bidi>{r.notes[a][locale]}</Bidi>
                </p>
                <CopyButton text={r.notes[a][locale]} showText={false} label={fmt(t.copyNote, { name: kit.sheet.release.noteTabs[a] })} className="absolute end-0 top-3" />
              </Tabs.Content>
            ))}
          </Tabs.Root>
          {author.kind === 'system' && <p className="mt-1 text-body-sm text-muted-foreground">{t.polish}</p>}
        </section>
      </div>
    </article>
  );
}

function Releases() {
  const t = useT(messages);
  const locale = useLocale();
  const { loading, error, scenario, isManager } = useSession();
  const cards = useCards();
  const repo = useFilter('repo');
  const status = useFilter('status');
  const [creating, setCreating] = useState(false);
  const shippedHeading = useRef<HTMLHeadingElement>(null);

  const empty = scenario === 'empty';
  const all = useMemo(() => (empty ? [] : cards.filter((c): c is ReleaseCard => c.type === 'release')), [cards, empty]);
  const matches = all.filter((c) => (!repo || c.release.repo === repo) && (!status || c.status === status));
  const planned = matches.filter((c) => c.status === 'planned');
  const shipped = matches.filter((c) => c.status === 'released').sort((a, b) => Date.parse(b.release.releasedAt ?? b.createdAt) - Date.parse(a.release.releasedAt ?? a.createdAt));
  const waiting = useMemo(() => (empty ? [] : eligibleForRelease(cards)), [cards, empty]);
  const months = useMemo(() => {
    const groups: { key: string; label: string; rows: ReleaseCard[] }[] = [];
    for (const row of shipped) {
      const iso = row.release.releasedAt ?? row.createdAt;
      const key = dayKey(iso).slice(0, 7);
      const group = groups.find((g) => g.key === key);
      if (group) group.rows.push(row);
      else groups.push({ key, label: monthName(iso, locale), rows: [row] });
    }
    return groups;
  }, [shipped, locale]);

  const list = useKeyboardList({ ids: shipped.map((c) => c.key), emptyFocusRef: shippedHeading });

  const newButton = (
    <Button disabled={!isManager} onClick={() => setCreating(true)}>
      <Plus aria-hidden className="size-4" strokeWidth={1.75} />
      {t.newRelease}
    </Button>
  );
  const header = (
    <PageHeader
      title={t.title}
      meta={loading || error || empty ? undefined : plural(all.filter((c) => c.status === 'planned').length, locale, isManager ? t.meta.manager : t.meta.other)}
      actions={
        loading || error || empty ? undefined : isManager ? (
          newButton
        ) : (
          <Tooltip content={t.pmOnly}>
            <span tabIndex={0} aria-label={`${t.newRelease}: ${t.pmOnly}`} className={cn('rounded-md', focusRing)}>
              {newButton}
            </span>
          </Tooltip>
        )
      }
    />
  );

  if (error) {
    return (
      <PageContainer>
        {header}
        <ErrorState thing={t.errorThing} code="hub.releases.unavailable" requestId="req_7f3ac21" onRetry={() => setQuery({ scenario: null })} />
      </PageContainer>
    );
  }
  if (loading) {
    return (
      <PageContainer>
        {header}
        <LoadingRegion label={t.loading}>
          <Skeleton className="h-72 w-full rounded-lg" />
          <SkeletonRows count={4} withAction={false} />
        </LoadingRegion>
      </PageContainer>
    );
  }
  if (empty) {
    return (
      <PageContainer>
        {header}
        <EmptyState
          size="page"
          icon={PackageOpen}
          title={t.empty.title}
          action={
            isManager ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus aria-hidden className="size-4" strokeWidth={1.75} />
                {t.newRelease}
              </Button>
            ) : undefined
          }
        >
          {t.empty.body}
        </EmptyState>
        <NewReleaseDialog open={creating} onOpenChange={setCreating} onCreated={() => undefined} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {header}
      <FilterBar
        status={{
          label: t.filters.status,
          value: (status ?? 'all') as 'all' | 'planned' | 'released',
          onChange: (next) => setQuery({ status: next === 'all' ? null : next }),
          options: [
            { value: 'all', label: kitMessages[locale].all },
            { value: 'planned', label: kitStatus('planned', locale) },
            { value: 'released', label: kitStatus('released', locale) },
          ],
        }}
        groups={[{ param: 'repo', label: t.filters.repo, options: ['backend', 'web', 'dashboard'].map((r) => ({ value: r, label: r })) }]}
      />

      {matches.length === 0 ? (
        <EmptyState icon={SearchX} title={t.noMatch.title} action={<Button onClick={() => setQuery({ repo: null, status: null })}>{t.noMatch.clear}</Button>}>
          {t.noMatch.body}
        </EmptyState>
      ) : (
        <>
          {status !== 'released' && (
            <section aria-labelledby="next-title" className="flex flex-col gap-3">
              <SectionHeader id="next-title" icon={Rocket} title={t.next.title} />
              {planned.length === 0 ? (
                <EmptyState icon={PackageOpen} title={t.next.none}>
                  {t.next.noneBody}
                </EmptyState>
              ) : (
                planned.map((card, i) => <Manifest key={card.key} card={card} primary={i === 0} />)
              )}
              {waiting.length > 0 && (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{plural(waiting.length, locale, t.waiting.title)}.</span>
                  <span>{t.waiting.body}</span>
                  <TypeCounts cards={waiting} />
                </p>
              )}
            </section>
          )}

          {status !== 'planned' && (
            <section aria-labelledby="shipped-title" className="flex flex-col gap-4">
              <SectionHeader ref={shippedHeading} id="shipped-title" title={t.shipped} count={shipped.length} />
              <div className="flex flex-col gap-6">
                {months.map((month) => (
                  <div key={month.key} className="flex flex-col gap-2">
                    <h3 className="text-body font-semibold text-muted-foreground">{month.label}</h3>
                    <ol data-hub-list className="flex flex-col gap-2">
                      {month.rows.map((card) => {
                        const iso = card.release.releasedAt ?? card.createdAt;
                        const rows = included(card);
                        return (
                          // The date column is this list's spine: a release is first of all a moment.
                          <li key={card.key} className="grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-2 md:grid-cols-[3.5rem_minmax(0,1fr)] md:gap-3">
                            <time dateTime={iso} title={shortDate(iso, locale)} className="flex flex-col items-center pt-2.5 text-center">
                              <span className="text-title font-bold text-foreground tabular-nums">
                                <Ltr>{dayOfMonth(iso)}</Ltr>
                              </span>
                              <span className="text-caption text-muted-foreground">{monthShort(iso, locale)}</span>
                            </time>
                            <CardRow
                              {...list.rowProps(card.key)}
                              cardKey={card.key}
                              type="release"
                              title={card.title[locale]}
                              meta={
                                <>
                                  {card.release.repo && <Ltr mono>{card.release.repo}</Ltr>}
                                  {card.release.tag && <Ltr mono className="text-caption">{card.release.tag}</Ltr>}
                                  <span>{plural(rows.length, locale, t.included)}</span>
                                  <TypeCounts cards={rows} />
                                </>
                              }
                            />
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}
                {shipped.length === 0 && (
                  <EmptyState icon={PackageOpen} title={t.empty.title}>
                    {t.empty.body}
                  </EmptyState>
                )}
              </div>
            </section>
          )}
        </>
      )}

      <NewReleaseDialog open={creating} onOpenChange={setCreating} onCreated={() => setQuery({ status: null, repo: null })} />
    </PageContainer>
  );
}

function kitStatus(status: string, locale: 'ar' | 'en') {
  return kitMessages[locale].status[status] ?? status;
}
