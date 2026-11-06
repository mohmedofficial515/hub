'use client';

/**
 * @file lab-gallery.tsx
 * @description The lab's gallery as a view of the Redesign page (docs/16 §6, D39): every page and version, side-by-side compare, device sizes, language,
 * theme, status and notes, in Hub's design system. Its state is the address, as it was in the lab. The verdict stays in the card's sheet, one click away.
 */
import { Columns2, ExternalLink, Globe, LayoutDashboard, NotebookText, Palette, Radar } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';

import {
  AppLink,
  Bidi,
  cn,
  EmptyState,
  ErrorState,
  fill,
  fmt,
  focusRing,
  LoadingRegion,
  Ltr,
  MarkdownView,
  plural,
  type RedesignCard,
  Segmented,
  Select,
  setQuery,
  Skeleton,
  StatusBadge,
  useLocale,
  useRoute,
  useT,
} from '@/components/kit';
import {
  choicesOf,
  compareTarget,
  frameSrc,
  GALLERY_APPS,
  GALLERY_WIDTHS,
  type GalleryApp,
  type GalleryPage,
  galleryQuery,
  type GalleryState,
  LIVE,
  readGallery,
  SCENARIOS,
  TOKENS_PAGE,
  TOKENS_VERSION,
} from '@/features/redesign/gallery';
import { type LabPage, useLabPages, useVersionFiles } from '@/features/redesign/queries';
import { isHubError } from '@/lib/api/errors';
import type { RedesignMessages } from '@/lib/i18n/page-dicts';
import { useTheme } from '@/lib/theme';

import { LabPane } from './lab-stage';

const APP_ICONS: Record<GalleryApp, typeof Globe> = { web: Globe, dashboard: LayoutDashboard, hub: Radar };

const META_KEYS = ['base', 'created', 'tokens', 'touches-components', 'ported'] as const;

const toGalleryPage = (page: LabPage, cards: readonly RedesignCard[]): GalleryPage => ({
  liveUrl: page.liveUrl,
  renderable: page.renderable,
  versions: cards.map((card) => card.redesign.version),
});

export function LabGallery() {
  const t = useT<RedesignMessages>('redesign');
  const locale = useLocale();
  const hubTheme = useTheme();
  const route = useRoute();
  const query = useLabPages();

  const state = useMemo(
    () =>
      readGallery(route.query, {
        lang: locale === 'en' ? 'en' : 'ar',
        theme: hubTheme === 'light' ? 'light' : 'dark',
      }),
    [route.query, locale, hubTheme],
  );
  const go = (patch: Partial<GalleryState>) =>
    setQuery(galleryQuery({ ...state, ...patch }), { replace: false });

  const byKey = useMemo(
    () => new Map((query.data?.items ?? []).map((card) => [card.key, card])),
    [query.data],
  );
  const pages = useMemo(
    () =>
      (query.data?.pages ?? []).map((page) => ({
        page,
        cards: page.versionKeys.map((key) => byKey.get(key)).filter((card): card is RedesignCard => !!card),
      })),
    [query.data, byKey],
  );

  if (query.isPending) {
    return (
      <div className="px-4 md:px-6">
        <LoadingRegion label={t.loading}>
          <Skeleton className="h-96 w-full" />
        </LoadingRegion>
      </div>
    );
  }
  if (query.isError) {
    const error = query.error;
    return (
      <div className="px-4 md:px-6">
        <ErrorState
          thing={t.errorThing}
          code={isHubError(error) ? error.code : 'hub.redesign.lab_unavailable'}
          requestId={isHubError(error) ? error.requestId : undefined}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }
  if (pages.length === 0) {
    return (
      <div className="px-4 md:px-6">
        <EmptyState size="page" icon={Palette} title={t.emptyTitle}>
          {t.emptyBody}
        </EmptyState>
      </div>
    );
  }

  const current = pages.find((p) => p.page.app === state.app && p.page.page === state.page);
  const galleryPage = current ? toGalleryPage(current.page, current.cards) : undefined;
  const isTokens = state.page === TOKENS_PAGE;
  const ready = !!state.app && !!state.page && !!state.a;
  const cardOf = (version: string | null) => current?.cards.find((card) => card.redesign.version === version);
  const noted = [...new Set([state.a, state.b])].filter((id): id is string => !!id && id !== LIVE);

  return (
    <div
      data-lab-gallery
      className="flex min-h-0 flex-col border-t border-border lg:h-[calc(100dvh-(--spacing(38)))] lg:flex-row"
    >
      <Navigator state={state} pages={pages} go={go} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar state={state} page={galleryPage} go={go} />
        <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
          {ready && state.app && state.page && state.a ? (
            <div className="flex min-w-0 flex-1 flex-col gap-px bg-border md:flex-row">
              <LabPane
                state={state}
                app={state.app}
                page={galleryPage}
                pageSlug={state.page}
                version={state.a}
                card={cardOf(state.a)}
                label={!!state.b}
              />
              {state.b && (
                <LabPane
                  state={state}
                  app={state.app}
                  page={galleryPage}
                  pageSlug={state.page}
                  version={state.b}
                  card={cardOf(state.b)}
                  label
                />
              )}
            </div>
          ) : (
            <Welcome pageCount={pages.length} versionCount={pages.reduce((n, p) => n + p.cards.length, 0)} />
          )}
          {ready && state.notes && !isTokens && (
            <Notes
              cards={noted.map((id) => cardOf(id)).filter((c): c is RedesignCard => !!c)}
              brief={current?.page.brief}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Welcome({ pageCount, versionCount }: { pageCount: number; versionCount: number }) {
  const t = useT<RedesignMessages>('redesign');
  const locale = useLocale();
  return (
    <div className="grid min-h-64 flex-1 place-items-center bg-muted p-8 text-center">
      <div className="flex max-w-md flex-col gap-1">
        <p className="text-title-sm font-semibold text-foreground">{t.gallery.welcomeTitle}</p>
        <p className="text-body-sm text-muted-foreground">
          {fmt(t.gallery.welcomeBody, {
            pages: plural(pageCount, locale, t.gallery.pages),
            versions: plural(versionCount, locale, t.versions),
          })}
        </p>
      </div>
    </div>
  );
}

// ── The list of everything ───────────────────────────────────────────────────────────────────────

function itemClass(active: boolean, indent = false) {
  return cn(
    'flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 text-start text-body-sm transition-colors duration-120 lg:min-h-8',
    indent && 'ps-4',
    active
      ? 'bg-accent font-semibold text-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
    focusRing,
  );
}

function Navigator({
  state,
  pages,
  go,
}: {
  state: GalleryState;
  pages: { page: LabPage; cards: RedesignCard[] }[];
  go: (patch: Partial<GalleryState>) => void;
}) {
  const t = useT<RedesignMessages>('redesign');
  const isActive = (app: string, page: string, version: string) =>
    state.app === app && state.page === page && state.a === version;
  const link = (app: GalleryApp, page: string, version: string) =>
    galleryQuery({ ...state, app, page, a: version, b: null });

  // One control on a phone, where the list would push the version off the screen.
  const value = state.app && state.page && state.a ? `${state.app}|${state.page}|${state.a}` : '';
  const pick = (next: string) => {
    const [app, page, a] = next.split('|');
    if (app && page && a) go({ app: app as GalleryApp, page, a, b: null });
  };

  return (
    <>
      <div className="border-b border-border p-3 lg:hidden">
        <label className="flex flex-col gap-1 text-body-sm font-medium text-foreground">
          {t.gallery.pick}
          <Select value={value} onChange={(e) => pick(e.target.value)} className="w-full">
            <option value="">{t.gallery.pickPrompt}</option>
            <optgroup label={t.gallery.tokens}>
              {GALLERY_APPS.map((app) => (
                <option key={app} value={`${app}|${TOKENS_PAGE}|${TOKENS_VERSION}`}>
                  {t.apps[app]}
                </option>
              ))}
            </optgroup>
            {pages.map(({ page, cards }) => (
              <optgroup key={`${page.app}/${page.page}`} label={`${page.app}/${page.page}`}>
                {page.liveUrl && <option value={`${page.app}|${page.page}|${LIVE}`}>{t.gallery.live}</option>}
                {cards.map((card) => (
                  <option key={card.key} value={`${page.app}|${page.page}|${card.redesign.version}`}>
                    {card.redesign.version}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </label>
      </div>

      <nav
        aria-label={t.gallery.navLabel}
        className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-e border-border p-3 lg:flex"
      >
        <Section
          title={t.gallery.tokens}
          icon={<Palette aria-hidden className="size-3.5" strokeWidth={1.75} />}
        >
          {GALLERY_APPS.map((app) => (
            <AppLink
              key={app}
              view="redesign"
              query={link(app, TOKENS_PAGE, TOKENS_VERSION)}
              aria-current={isActive(app, TOKENS_PAGE, TOKENS_VERSION) ? 'page' : undefined}
              className={itemClass(isActive(app, TOKENS_PAGE, TOKENS_VERSION))}
            >
              {t.apps[app]}
            </AppLink>
          ))}
        </Section>

        {GALLERY_APPS.map((app) => {
          const Icon = APP_ICONS[app];
          const ofApp = pages.filter((p) => p.page.app === app);
          return (
            <Section
              key={app}
              title={t.apps[app]}
              icon={<Icon aria-hidden className="size-3.5" strokeWidth={1.75} />}
            >
              {ofApp.length === 0 && (
                <p className="px-2.5 text-body-sm text-muted-foreground">{t.gallery.noPages}</p>
              )}
              {ofApp.map(({ page, cards }) => (
                <div key={page.page} className="flex flex-col gap-0.5">
                  <p
                    className="truncate px-2.5 py-1 text-body-sm font-medium text-foreground"
                    title={page.title}
                  >
                    <Ltr mono>{page.page}</Ltr>
                  </p>
                  {page.liveUrl && (
                    <AppLink
                      view="redesign"
                      query={link(app, page.page, LIVE)}
                      aria-current={isActive(app, page.page, LIVE) ? 'page' : undefined}
                      className={itemClass(isActive(app, page.page, LIVE), true)}
                    >
                      {t.gallery.live}
                    </AppLink>
                  )}
                  {cards.map((card) => {
                    const version = card.redesign.version;
                    const active = isActive(app, page.page, version);
                    return (
                      <AppLink
                        key={card.key}
                        view="redesign"
                        query={link(app, page.page, version)}
                        aria-current={active ? 'page' : undefined}
                        className={itemClass(active, true)}
                      >
                        <Ltr mono className="min-w-0 flex-1 truncate">
                          {version}
                        </Ltr>
                        <StatusBadge status={card.status} />
                      </AppLink>
                    );
                  })}
                </div>
              ))}
            </Section>
          );
        })}
      </nav>
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="flex items-center gap-1.5 px-2.5 text-caption font-semibold text-muted-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

// ── The controls ─────────────────────────────────────────────────────────────────────────────────

function Toggle({
  pressed,
  onChange,
  icon,
  children,
}: {
  pressed: boolean;
  onChange: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onChange}
      className={cn(
        'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-body-sm font-medium whitespace-nowrap transition-colors duration-120 md:h-8',
        pressed
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
        focusRing,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Toolbar({
  state,
  page,
  go,
}: {
  state: GalleryState;
  page: GalleryPage | undefined;
  go: (patch: Partial<GalleryState>) => void;
}) {
  const t = useT<RedesignMessages>('redesign');
  const isTokens = state.page === TOKENS_PAGE;
  const choices = choicesOf(page);
  const comparing = state.b !== null;
  const canCompare = choices.length > 1;
  const popout =
    state.app && state.page && state.a && state.a !== LIVE
      ? frameSrc(state.app, state.page, state.a, state)
      : null;
  const versionSelect = (label: string, value: string | null, onChange: (next: string) => void) => (
    <Select
      aria-label={label}
      dir="ltr"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-48 font-mono md:h-8"
    >
      {choices.map((choice) => (
        <option key={choice} value={choice}>
          {choice}
        </option>
      ))}
    </Select>
  );

  return (
    <div
      role="toolbar"
      aria-label={t.gallery.toolbar}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card px-3 py-2"
    >
      <p className="me-auto min-w-0 truncate text-body font-medium text-foreground">
        {state.app ? (
          <Ltr mono>{`${state.app} / ${isTokens ? t.gallery.tokens : state.page}`}</Ltr>
        ) : (
          t.gallery.pickPrompt
        )}
      </p>

      {canCompare && (
        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            pressed={comparing}
            onChange={() => go({ b: comparing ? null : compareTarget(choices, state.a) })}
            icon={<Columns2 aria-hidden className="size-4" strokeWidth={1.75} />}
          >
            {t.gallery.compare}
          </Toggle>
          {comparing && (
            <>
              {versionSelect(t.compare.versionA, state.a, (a) => go({ a }))}
              <span aria-hidden className="text-body-sm text-muted-foreground">
                {t.gallery.vs}
              </span>
              {versionSelect(t.compare.versionB, state.b, (b) => go({ b }))}
            </>
          )}
        </div>
      )}

      {state.page && !isTokens && (
        <Select
          aria-label={t.gallery.scenario}
          dir="ltr"
          value={state.scenario}
          onChange={(e) => go({ scenario: e.target.value })}
          className="max-w-40 font-mono md:h-8"
        >
          {SCENARIOS.map((scenario) => (
            <option key={scenario} value={scenario}>
              {scenario}
            </option>
          ))}
        </Select>
      )}

      <Segmented
        label={t.compare.device}
        value={String(state.width)}
        options={GALLERY_WIDTHS.map((width) => ({
          value: String(width),
          label: t.gallery.widths[String(width) as keyof typeof t.gallery.widths],
        }))}
        onChange={(w) => go({ width: w === 'fill' ? 'fill' : (Number(w) as 390 | 768 | 1440) })}
      />
      <Segmented
        label={t.compare.lang}
        value={state.lang}
        options={[
          { value: 'ar', label: t.compare.arabic },
          { value: 'en', label: t.compare.english },
        ]}
        onChange={(lang) => go({ lang })}
      />
      <Segmented
        label={t.compare.theme}
        value={state.theme}
        options={[
          { value: 'light', label: t.compare.light },
          { value: 'dark', label: t.compare.dark },
        ]}
        onChange={(theme) => go({ theme })}
      />
      {!isTokens && (
        <Toggle
          pressed={state.notes}
          onChange={() => go({ notes: !state.notes })}
          icon={<NotebookText aria-hidden className="size-4" strokeWidth={1.75} />}
        >
          {t.compare.notes}
        </Toggle>
      )}
      {popout && (
        <a
          href={popout}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-body-sm font-medium text-muted-foreground transition-colors duration-120 hover:bg-accent hover:text-foreground md:h-8',
            focusRing,
          )}
        >
          {t.gallery.popout}
          <ExternalLink aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
        </a>
      )}
    </div>
  );
}

// ── Status and notes ─────────────────────────────────────────────────────────────────────────────

function metaText(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function VersionNotes({ card }: { card: RedesignCard }) {
  const t = useT<RedesignMessages>('redesign');
  const files = useVersionFiles(card.key, true);
  const front = card.redesign.frontMatter ?? {};
  const meta = META_KEYS.map((key) => [key, metaText(front[key])] as const).filter(([, value]) => value);
  return (
    <article className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-body-lg font-semibold text-foreground">
          <Bidi>{card.redesign.concept}</Bidi>
        </h3>
        <StatusBadge status={card.status} />
      </div>
      <p>
        <AppLink
          card={card.key}
          className={cn(
            'hit-44 rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline',
            focusRing,
          )}
        >
          {fill(t.gallery.openCard, { key: <Ltr mono>{card.key}</Ltr> })}
        </AppLink>
      </p>
      {meta.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body-sm">
          {meta.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">
                <Ltr mono>{key}</Ltr>
              </dt>
              <dd className="min-w-0 break-words text-foreground">
                <Ltr mono>{value}</Ltr>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {files.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : files.data?.markdown ? (
        <MarkdownView source={files.data.markdown} dir="auto" />
      ) : (
        <p className="text-body-sm text-muted-foreground">{t.gallery.noNotes}</p>
      )}
    </article>
  );
}

function Notes({ cards, brief }: { cards: RedesignCard[]; brief: string | undefined }) {
  const t = useT<RedesignMessages>('redesign');
  return (
    <aside
      aria-label={t.compare.notes}
      className="flex shrink-0 flex-col gap-8 border-t border-border bg-card p-4 xl:w-96 xl:overflow-y-auto xl:border-s xl:border-t-0"
    >
      {cards.map((card) => (
        <VersionNotes key={card.key} card={card} />
      ))}
      {brief && (
        <article className="flex flex-col gap-3 border-t border-border pt-4">
          <h3 className="text-caption font-semibold text-muted-foreground">{t.gallery.brief}</h3>
          <MarkdownView source={brief} dir="auto" />
        </article>
      )}
    </aside>
  );
}
