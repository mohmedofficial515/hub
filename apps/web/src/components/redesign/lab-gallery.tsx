'use client';

/**
 * @file lab-gallery.tsx
 * @description The lab as Hub's own full page (docs/16 §6, as the owner changed it on 2026-11-06): it opens in a tab of its own at `/<locale>/<ws>/gallery`, with
 * no sidebar or header, and looks the way the lab always did (`apps/lab/lab/src/shell`). Everything under it is Hub: the data and statuses are the cards', the
 * live stream updates them, and a card's sheet, the palette and the owner's verdict open over it from the shell. Its state is the address.
 */
import {
  ArrowLeft,
  Columns2,
  ExternalLink,
  Globe,
  LayoutDashboard,
  Moon,
  NotebookText,
  Palette,
  Radar,
  Square,
  Sun,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef } from 'react';

import {
  AppLink,
  Bidi,
  cn,
  EmptyState,
  ErrorState,
  focusRing,
  LoadingRegion,
  Ltr,
  MarkdownView,
  openCard,
  type RedesignCard,
  setQuery,
  Skeleton,
  useLocale,
  useRoute,
  useSession,
  useT,
} from '@/components/kit';
import {
  choicesOf,
  compareTarget,
  frameSrc,
  GALLERY_APPS,
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
import { LAB_LANGS, LAB_WIDTHS, LAB_WORDS } from '@/features/redesign/lab-words';
import { type LabPage, useLabPages, useVersionFiles } from '@/features/redesign/queries';
import { isHubError } from '@/lib/api/errors';
import type { RedesignMessages } from '@/lib/i18n/page-dicts';
import { useTheme } from '@/lib/theme';

import { LabPane, LabStatus } from './lab-stage';

const APP_ICONS: Record<GalleryApp, typeof Globe> = { web: Globe, dashboard: LayoutDashboard, hub: Radar };

const META_KEYS = ['base', 'created', 'tokens', 'touches-components', 'ported'] as const;

const toGalleryPage = (page: LabPage, cards: readonly RedesignCard[]): GalleryPage => ({
  liveUrl: page.liveUrl,
  renderable: page.renderable,
  versions: cards.map((card) => card.redesign.version),
});

/**
 * The lab's frame. `dark` brings Hub's dark tokens to everything inside, in either theme of Hub, and `dir` keeps the frame's geometry in Arabic too. A frame's own
 * language and theme are set inside it, from the toolbar.
 */
function LabFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-lab-gallery
      dir="ltr"
      className={cn('dark lab-frame flex h-dvh flex-col bg-lab-canvas text-lab-text', className)}
    >
      {children}
    </div>
  );
}

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
      <LabFrame className="p-6">
        <LoadingRegion label={t.loading}>
          <Skeleton className="h-96 w-full" />
        </LoadingRegion>
      </LabFrame>
    );
  }
  if (query.isError) {
    const error = query.error;
    return (
      <LabFrame className="p-6">
        <ErrorState
          thing={t.errorThing}
          code={isHubError(error) ? error.code : 'hub.redesign.lab_unavailable'}
          requestId={isHubError(error) ? error.requestId : undefined}
          onRetry={() => void query.refetch()}
        />
      </LabFrame>
    );
  }
  if (pages.length === 0) {
    return (
      <LabFrame className="p-6">
        <EmptyState size="page" icon={Palette} title={t.emptyTitle}>
          {t.emptyBody}
        </EmptyState>
      </LabFrame>
    );
  }

  const current = pages.find((p) => p.page.app === state.app && p.page.page === state.page);
  const galleryPage = current ? toGalleryPage(current.page, current.cards) : undefined;
  const isTokens = state.page === TOKENS_PAGE;
  const ready = !!state.app && !!state.page && !!state.a;
  const cardOf = (version: string | null) => current?.cards.find((card) => card.redesign.version === version);
  const noted = [...new Set([state.a, state.b])].filter((id): id is string => !!id && id !== LIVE);

  return (
    <LabFrame className="overflow-y-auto lg:flex-row lg:overflow-hidden">
      <Sidebar state={state} pages={pages} go={go} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar state={state} page={galleryPage} card={state.b ? undefined : cardOf(state.a)} go={go} />
        <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
          {ready && state.app && state.page && state.a ? (
            <div className="flex min-w-0 flex-1 flex-col divide-white/10 md:flex-row md:divide-x">
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
    </LabFrame>
  );
}

function Welcome({ pageCount, versionCount }: { pageCount: number; versionCount: number }) {
  return (
    <div className="grid min-h-64 flex-1 place-items-center p-8 text-center">
      <div className="max-w-md space-y-2">
        <p className="text-lg font-semibold">{LAB_WORDS.title}</p>
        <p className="text-sm text-lab-dim">{LAB_WORDS.welcome(pageCount, versionCount)}</p>
      </div>
    </div>
  );
}

// ── The list of everything ───────────────────────────────────────────────────────────────────────

const BackToHub = ({ className }: { className?: string }) => (
  <AppLink
    view="redesign"
    aria-label={LAB_WORDS.backToHub}
    title={LAB_WORDS.backToHub}
    className={cn(
      'inline-flex size-11 shrink-0 items-center justify-center rounded-md text-lab-dim transition-colors hover:bg-white/10 hover:text-lab-text lg:size-8',
      focusRing,
      className,
    )}
  >
    <ArrowLeft aria-hidden className="size-4" />
  </AppLink>
);

function Sidebar({
  state,
  pages,
  go,
}: {
  state: GalleryState;
  pages: { page: LabPage; cards: RedesignCard[] }[];
  go: (patch: Partial<GalleryState>) => void;
}) {
  const project = useSession().workspace?.name;
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
      <div className="flex items-end gap-2 border-b border-white/10 bg-lab-panel p-3 lg:hidden">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-lab-dim">
          {LAB_WORDS.pick}
          <LabSelect value={value} onChange={pick} label={LAB_WORDS.pick} className="w-full">
            <option value="">{LAB_WORDS.pickPrompt}</option>
            <optgroup label={LAB_WORDS.tokens}>
              {GALLERY_APPS.map((app) => (
                <option key={app} value={`${app}|${TOKENS_PAGE}|${TOKENS_VERSION}`}>
                  {LAB_WORDS.apps[app]}
                </option>
              ))}
            </optgroup>
            {pages.map(({ page, cards }) => (
              <optgroup key={`${page.app}/${page.page}`} label={`${page.app}/${page.page}`}>
                {page.liveUrl && <option value={`${page.app}|${page.page}|${LIVE}`}>{LAB_WORDS.live}</option>}
                {cards.map((card) => (
                  <option key={card.key} value={`${page.app}|${page.page}|${card.redesign.version}`}>
                    {card.redesign.version}
                  </option>
                ))}
              </optgroup>
            ))}
          </LabSelect>
        </label>
        <BackToHub />
      </div>

      <nav
        aria-label={LAB_WORDS.navLabel}
        className="hidden h-full w-64 shrink-0 flex-col overflow-y-auto border-e border-white/10 bg-lab-panel text-sm lg:flex"
      >
        <div className="flex items-start justify-between gap-2 px-4 pt-5 pb-4">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold tracking-lab text-lab-faint uppercase">
              {project ?? 'Goteav'}
            </p>
            <p className="text-base font-semibold text-lab-text">{LAB_WORDS.title}</p>
          </div>
          <BackToHub />
        </div>

        <Section title={LAB_WORDS.tokens}>
          {GALLERY_APPS.map((app) => (
            <Item
              key={app}
              query={link(app, TOKENS_PAGE, TOKENS_VERSION)}
              active={isActive(app, TOKENS_PAGE, TOKENS_VERSION)}
            >
              <Palette aria-hidden className="size-3.5 text-lab-faint" />
              {LAB_WORDS.apps[app]}
            </Item>
          ))}
        </Section>

        {GALLERY_APPS.map((app) => {
          const Icon = APP_ICONS[app];
          const ofApp = pages.filter((p) => p.page.app === app);
          return (
            <Section key={app} title={LAB_WORDS.apps[app]} icon={<Icon aria-hidden className="size-3.5" />}>
              {ofApp.length === 0 && <p className="px-3 py-1 text-xs text-lab-faint">{LAB_WORDS.noPages}</p>}
              {ofApp.map(({ page, cards }) => (
                <div key={page.page} className="mb-2">
                  <p className="truncate px-3 py-1 font-medium text-lab-soft" title={page.title}>
                    {page.page}
                  </p>
                  {page.liveUrl && (
                    <Item indent query={link(app, page.page, LIVE)} active={isActive(app, page.page, LIVE)}>
                      <span aria-hidden className="size-1.5 rounded-full bg-lab-live" /> {LAB_WORDS.live}
                    </Item>
                  )}
                  {cards.map((card) => {
                    const version = card.redesign.version;
                    return (
                      <Item
                        key={card.key}
                        indent
                        query={link(app, page.page, version)}
                        active={isActive(app, page.page, version)}
                      >
                        <span className="min-w-0 flex-1 truncate">{version}</span>
                        <LabStatus status={card.status} />
                      </Item>
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

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-white/5 px-2 py-3">
      <h2 className="mb-1 flex items-center gap-1.5 px-3 text-lab-label font-semibold tracking-wider text-lab-faint uppercase">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Item({
  active,
  indent,
  query,
  children,
}: {
  active: boolean;
  indent?: boolean;
  query: Record<string, string | null>;
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  // The list is long, and a version opened from a link should be in sight.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);
  return (
    <AppLink
      ref={ref}
      view="gallery"
      query={query}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-start text-lab-dim transition-colors hover:bg-white/5 hover:text-lab-text',
        indent && 'ps-5',
        active && 'bg-white/10 text-lab-strong',
        focusRing,
      )}
    >
      {children}
    </AppLink>
  );
}

// ── The controls ─────────────────────────────────────────────────────────────────────────────────

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg bg-white/5 p-0.5">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-11 rounded-md px-2.5 py-1 text-xs transition-colors md:min-h-0',
            option.value === value ? 'bg-white/15 text-lab-strong' : 'text-lab-dim hover:text-lab-text',
            focusRing,
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const iconButton = 'inline-flex size-11 items-center justify-center rounded-md transition-colors md:size-7';

function Toggle({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        iconButton,
        active ? 'bg-white/15 text-lab-strong' : 'text-lab-dim hover:bg-white/10 hover:text-lab-text',
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

function LabSelect({
  label,
  value,
  onChange,
  className,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'min-h-11 max-w-48 rounded-md border border-white/10 bg-lab-canvas px-2 py-1 text-xs text-lab-soft md:min-h-0',
        focusRing,
        className,
      )}
    >
      {children}
    </select>
  );
}

function Toolbar({
  state,
  page,
  card,
  go,
}: {
  state: GalleryState;
  page: GalleryPage | undefined;
  /** The version on show. None in a compare, where each side names its own. */
  card: RedesignCard | undefined;
  go: (patch: Partial<GalleryState>) => void;
}) {
  const { isOwner } = useSession();
  const isTokens = state.page === TOKENS_PAGE;
  const choices = choicesOf(page);
  const comparing = state.b !== null;
  const canCompare = choices.length > 1;
  const popout =
    state.app && state.page && state.a && state.a !== LIVE
      ? frameSrc(state.app, state.page, state.a, state)
      : null;
  const versionSelect = (label: string, value: string | null, onChange: (next: string) => void) => (
    <LabSelect label={label} value={value ?? ''} onChange={onChange}>
      {choices.map((choice) => (
        <option key={choice} value={choice}>
          {choice}
        </option>
      ))}
    </LabSelect>
  );

  return (
    <div
      role="toolbar"
      aria-label={LAB_WORDS.toolbar}
      className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-lab-panel px-4 py-2.5 text-sm text-lab-soft"
    >
      <p className="me-auto flex min-w-0 items-center gap-2 font-medium text-lab-text">
        <span className="truncate">
          {state.app
            ? `${state.app} / ${isTokens ? LAB_WORDS.tokens.toLowerCase() : state.page}`
            : LAB_WORDS.pickPrompt}
        </span>
        {card && (
          <AppLink
            card={card.key}
            aria-label={LAB_WORDS.openCard(card.key)}
            title={LAB_WORDS.openCard(card.key)}
            className={cn(
              'shrink-0 rounded-sm text-xs font-normal text-lab-dim hover:text-lab-text',
              focusRing,
            )}
          >
            <Ltr mono>{card.key}</Ltr>
          </AppLink>
        )}
      </p>

      {/* The verdict stays the sheet's, with its confirmation: this only opens it on the right action. */}
      {isOwner && card?.status === 'review' && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => openCard(card.key, { action: 'approve', opener: e.currentTarget })}
            data-status="approved"
            className={cn(
              'lab-status min-h-11 rounded-md px-2.5 py-1 text-xs transition-opacity hover:opacity-80 md:min-h-0',
              focusRing,
            )}
          >
            {LAB_WORDS.approve}
          </button>
          <button
            type="button"
            onClick={(e) => openCard(card.key, { action: 'request_changes', opener: e.currentTarget })}
            className={cn(
              'min-h-11 rounded-md px-2.5 py-1 text-xs text-lab-dim transition-colors hover:bg-white/10 hover:text-lab-text md:min-h-0',
              focusRing,
            )}
          >
            {LAB_WORDS.requestChanges}
          </button>
        </div>
      )}

      {canCompare && (
        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            active={comparing}
            onClick={() => go({ b: comparing ? null : compareTarget(choices, state.a) })}
            title={LAB_WORDS.compare}
          >
            {comparing ? (
              <Columns2 aria-hidden className="size-4" />
            ) : (
              <Square aria-hidden className="size-4" />
            )}
          </Toggle>
          {comparing && (
            <>
              {versionSelect(LAB_WORDS.versionA, state.a, (a) => go({ a }))}
              <span aria-hidden className="text-lab-faint">
                {LAB_WORDS.vs}
              </span>
              {versionSelect(LAB_WORDS.versionB, state.b, (b) => go({ b }))}
            </>
          )}
        </div>
      )}

      {state.page && !isTokens && (
        <LabSelect
          label={LAB_WORDS.scenario}
          value={state.scenario}
          onChange={(scenario) => go({ scenario })}
        >
          {SCENARIOS.map((scenario) => (
            <option key={scenario} value={scenario}>
              {scenario}
            </option>
          ))}
        </LabSelect>
      )}

      <Segmented
        label={LAB_WORDS.device}
        value={state.width}
        options={LAB_WIDTHS}
        onChange={(width) => go({ width })}
      />
      <Segmented
        label={LAB_WORDS.language}
        value={state.lang}
        options={LAB_LANGS}
        onChange={(lang) => go({ lang })}
      />
      <Toggle
        active={state.theme === 'dark'}
        onClick={() => go({ theme: state.theme === 'dark' ? 'light' : 'dark' })}
        title={LAB_WORDS.theme}
      >
        {state.theme === 'dark' ? (
          <Moon aria-hidden className="size-4" />
        ) : (
          <Sun aria-hidden className="size-4" />
        )}
      </Toggle>
      {!isTokens && (
        <Toggle active={state.notes} onClick={() => go({ notes: !state.notes })} title={LAB_WORDS.notes}>
          <NotebookText aria-hidden className="size-4" />
        </Toggle>
      )}
      {popout && (
        <a
          href={popout}
          target="_blank"
          rel="noreferrer"
          aria-label={LAB_WORDS.popout}
          title={LAB_WORDS.popout}
          className={cn(iconButton, 'text-lab-dim hover:bg-white/10 hover:text-lab-text', focusRing)}
        >
          <ExternalLink aria-hidden className="size-4" />
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
  const files = useVersionFiles(card.key, true);
  const front = card.redesign.frontMatter ?? {};
  const meta = META_KEYS.map((key) => [key, metaText(front[key])] as const).filter(([, value]) => value);
  return (
    <article className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-lab-strong">
          <Bidi>{card.redesign.concept}</Bidi>
        </h3>
        <LabStatus status={card.status} />
      </div>
      <p>
        <AppLink
          card={card.key}
          className={cn(
            'rounded-sm text-xs font-medium text-lab-link underline-offset-4 hover:underline',
            focusRing,
          )}
        >
          {LAB_WORDS.openCard(card.key)}
        </AppLink>
      </p>
      {meta.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {meta.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-lab-faint">{key}</dt>
              <dd className="min-w-0 break-words text-lab-soft">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {files.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : files.data?.markdown ? (
        <MarkdownView source={files.data.markdown} dir="auto" />
      ) : (
        <p className="text-xs text-lab-faint">{LAB_WORDS.noNotes}</p>
      )}
    </article>
  );
}

function Notes({ cards, brief }: { cards: RedesignCard[]; brief: string | undefined }) {
  return (
    <aside
      aria-label={LAB_WORDS.notes}
      className="flex shrink-0 flex-col gap-8 border-t border-white/10 bg-lab-panel p-5 text-sm text-lab-soft xl:w-96 xl:overflow-y-auto xl:border-s xl:border-t-0"
    >
      {cards.map((card) => (
        <VersionNotes key={card.key} card={card} />
      ))}
      {brief && (
        <article className="flex flex-col gap-2 border-t border-white/10 pt-5">
          <h3 className="text-xs font-semibold tracking-wider text-lab-faint uppercase">{LAB_WORDS.brief}</h3>
          <MarkdownView source={brief} dir="auto" />
        </article>
      )}
    </aside>
  );
}
