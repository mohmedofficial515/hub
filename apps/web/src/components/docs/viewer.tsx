'use client';

/**
 * @file viewer.tsx
 * @description The reading column. The doc keeps its own direction, so an English doc stays LTR in the Arabic UI while everything around it
 * mirrors. Where the doc lives comes first, as a trail of source, folders and file (08 §5.4). The outline sits at the doc's reading end from
 * 1280 px and follows the section on screen; below that it folds above the text. At the end, the docs before and after it in the tree's order.
 * A doc on the member's onboarding path says which step it is and what comes next. Ported from the design's `pages/docs/parts/viewer.tsx`.
 */
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  ExternalLink,
  FileWarning,
  Hash,
  TriangleAlert,
} from 'lucide-react';
import { type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import {
  AppLink,
  Bidi,
  Button,
  CardChip,
  cn,
  CopyButton,
  EmptyState,
  fill,
  fmt,
  focusRing,
  headingsOf,
  kitMessages,
  Ltr,
  MarkdownView,
  num,
  Pill,
  plural,
  rel,
  RelativeTime,
  setQuery,
  showToast,
  useLocale,
  usePageWide,
  useRoute,
  useT,
} from '@/components/kit';
import { DocBar } from '@/components/workbench/doc-bar';
import type { DocCard } from '@/features/cards/types';
import { localImagesOf } from '@/features/docs/images';
import type { DocWithContent } from '@/features/docs/queries';
import { docTwin, fileName, folderTrail, neighbours, resolveDocLink } from '@/features/docs/tree';
import { setStepDone, useOnboarding } from '@/features/onboarding/queries';
import {
  docKeyOfStep,
  nextStepOf,
  type OnboardingStep,
  stepForDoc,
  type StepTarget,
  stepTarget,
} from '@/features/onboarding/steps';
import { isHubError } from '@/lib/api/errors';

import { useDocImages } from './doc-image';
import type { DocsMessages } from './messages';

const metaLink = `inline-flex items-center gap-1 rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline hit-44 ${focusRing}`;

/** A doc's language pair: both are the same doc to a reader, so this is a toggle, not two tree rows (09 §11). */
function LangToggle({ card, all }: { card: DocCard; all: readonly DocCard[] }) {
  const t = useT<DocsMessages>('docs');
  const twin = docTwin(card, all);
  if (!twin) return null;
  const me = card.doc.lang;
  return (
    <div role="group" aria-label={t.twin} className="flex rounded-md border border-border bg-card p-0.5">
      {(['en', 'ar'] as const).map((lang) => (
        <AppLink
          key={lang}
          view="docs"
          query={{ doc: lang === me ? card.key : twin.key, anchor: null }}
          aria-current={lang === me ? 'true' : undefined}
          className={cn(
            'inline-flex h-11 items-center rounded-sm px-2.5 text-body-sm font-medium md:h-7',
            lang === me
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            focusRing,
          )}
        >
          {t.twinNames[lang]}
        </AppLink>
      ))}
    </div>
  );
}

/** Source, folders, file: where the doc lives, as words. The address has no folder of its own, so these are not links (knowledge-05). */
function Breadcrumb({ card }: { card: DocCard }) {
  const t = useT<DocsMessages>('docs');
  const d = card.doc;
  const parts = [...folderTrail(d.path), fileName(d.path)];
  const separator = (
    <ChevronRight
      aria-hidden
      className="size-3.5 shrink-0 text-muted-foreground rtl:-scale-x-100"
      strokeWidth={1.75}
    />
  );
  return (
    <nav aria-label={t.breadcrumb} className="min-w-0">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-body-sm text-muted-foreground">
        {d.sourceName && (
          <li className="flex min-w-0 items-center gap-1.5">
            <span translate="no" className="truncate">
              {d.sourceName}
            </span>
          </li>
        )}
        {parts.map((part, i) => (
          <li key={`${i}-${part}`} className="flex min-w-0 items-center gap-1.5">
            {(i > 0 || d.sourceName) && separator}
            <Ltr
              mono
              className={cn('truncate text-caption', i === parts.length - 1 && 'font-medium text-foreground')}
            >
              {part}
            </Ltr>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The two docs on either side in the tree's order, as GitBook and Docusaurus end a page. */
function Pager({ prev, next }: { prev?: DocCard | undefined; next?: DocCard | undefined }) {
  const t = useT<DocsMessages>('docs');
  if (!prev && !next) return null;
  const side = (doc: DocCard, which: 'prev' | 'next') => {
    const Icon = which === 'prev' ? ArrowLeft : ArrowRight;
    return (
      <AppLink
        view="docs"
        query={{ doc: doc.key, anchor: null }}
        rel={which}
        className={cn(
          'flex min-h-11 min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors duration-120 hover:bg-accent',
          which === 'next' && 'items-end text-end sm:col-start-2',
          focusRing,
        )}
      >
        <span className="inline-flex items-center gap-1 text-caption font-medium text-muted-foreground">
          {which === 'prev' && <Icon aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />}
          {which === 'prev' ? t.prev : t.next}
          {which === 'next' && <Icon aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />}
        </span>
        <span className="max-w-full truncate text-body font-medium text-foreground">
          <Bidi>{doc.title || fileName(doc.doc.path)}</Bidi>
        </span>
        <Ltr mono className="max-w-full truncate text-caption text-muted-foreground">
          {fileName(doc.doc.path)}
        </Ltr>
      </AppLink>
    );
  };
  return (
    <nav aria-label={t.pager} className="grid gap-2 sm:grid-cols-2">
      {prev && side(prev, 'prev')}
      {next && side(next, 'next')}
    </nav>
  );
}

function TargetLink({ target, children }: { target: StepTarget; children: ReactNode }) {
  const className = cn(metaLink, 'text-body-sm');
  if (target.kind === 'card') {
    return (
      <AppLink card={target.card} className={className}>
        {children}
      </AppLink>
    );
  }
  if (target.kind === 'external') {
    return (
      <a href={target.href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <AppLink view={target.view} query={target.query} className={className}>
      {children}
    </AppLink>
  );
}

/**
 * A doc on the member's onboarding path says so, with the one thing to do once it is read, and after that the step that follows
 * (knowledge-12). It reads the path the Onboarding page already holds; a doc not on the path shows nothing.
 */
function OnboardingStrip({ card, all }: { card: DocCard; all: readonly DocCard[] }) {
  const t = useT<DocsMessages>('docs');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { ws } = useRoute();
  const path = useOnboarding();
  const steps: OnboardingStep[] = path.data?.steps ?? [];
  const found = stepForDoc(steps, card, all);
  // Shown while the step is open, and after it is marked here so the next one is a click away; a step done long ago stays quiet.
  const [marked, setMarked] = useState(false);
  if (!found || (found.step.done && !marked)) return null;
  const { step, index } = found;
  const next = nextStepOf(steps);
  const nextTarget = next ? stepTarget(next, docKeyOfStep(next, all)) : null;

  const fail = (error: unknown) => {
    setMarked(false);
    showToast({ message: isHubError(error) ? error.message : kit.actionFailed, tone: 'error' });
  };
  const markRead = () => {
    setMarked(true);
    void setStepDone(ws, step.id, true).catch(fail);
    showToast({
      message: fmt(t.markedRead, { title: step.title }),
      onUndo: () => void setStepDone(ws, step.id, false).catch(fail),
    });
  };

  const back = (
    <AppLink view="onboarding" className={metaLink}>
      <Compass aria-hidden className="size-3.5" strokeWidth={1.75} />
      {t.backToPath}
    </AppLink>
  );
  return (
    <section
      aria-label={fmt(t.onboardingStep, { n: num(index + 1, locale) })}
      data-onboarding-strip
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-muted px-3 py-2.5"
    >
      {!step.done ? (
        <>
          <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
            <p className="text-body-sm font-semibold text-foreground">
              {fmt(t.onboardingStep, { n: num(index + 1, locale) })}
            </p>
            <p className="text-body-sm text-muted-foreground">{t.onboardingHint}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button size="sm" variant="outline" onClick={markRead} data-mark-read>
              <Check aria-hidden className="size-4" strokeWidth={1.75} />
              {t.markRead}
            </Button>
            {back}
          </div>
        </>
      ) : (
        <>
          <p role="status" className="min-w-0 flex-1 basis-60 text-body-sm text-foreground">
            {next && nextTarget ? (
              <TargetLink target={nextTarget}>
                <span>{fmt(t.nextStep, { title: next.title })}</span>
                <ArrowRight aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
              </TargetLink>
            ) : next ? (
              fmt(t.nextStep, { title: next.title })
            ) : (
              t.pathDone
            )}
          </p>
          {back}
        </>
      )}
    </section>
  );
}

/** The heading whose section is on screen: the last one to cross under the header. Nothing is left observing once the doc closes. */
function useActiveHeading(anchors: readonly string[]): [string | null, (id: string) => void] {
  const [active, setActive] = useState<string | null>(null);
  const key = anchors.join('\n');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || anchors.length === 0) return;
    const heads = anchors.map((a) => document.getElementById(a)).filter((h): h is HTMLElement => !!h);
    if (heads.length === 0) return;
    const pick = () => {
      let current: string | null = null;
      for (const head of heads) {
        if (head.getBoundingClientRect().top <= 96) current = head.id;
        else break;
      }
      setActive(current ?? heads[0]?.id ?? null);
    };
    const observer = new IntersectionObserver(pick, { rootMargin: '-80px 0px -70% 0px' });
    for (const head of heads) observer.observe(head);
    pick();
    return () => observer.disconnect();
    // `key` stands for the anchors' contents, so a new array with the same anchors observes nothing new.
  }, [key]);
  return [active, setActive];
}

const smoothScroll = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches;

export function DocViewer({
  card,
  all,
  order = [],
}: {
  card: DocWithContent;
  all: readonly DocCard[];
  /** Every doc of the tree in reading order, without twins: what comes before and after this one. */
  order?: readonly DocCard[] | undefined;
}) {
  const t = useT<DocsMessages>('docs');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { query, ws } = useRoute();
  const showOutline = usePageWide(1280);
  // Below 1024 the page has no header of its own here, so the doc's title is the page's one h1 (live tour).
  const pageHasTitle = usePageWide(1024);
  const d = card.doc;
  const source = card.content ?? '';
  const dir = d.lang === 'ar' ? 'rtl' : 'ltr';
  const outline = useMemo(() => headingsOf(source), [source]);
  // Images from the doc's own folder come through the API and open in the Lightbox; a remote one stays a stand-in (decision 13b).
  const localImages = useMemo(() => localImagesOf(source), [source]);
  const images = useDocImages(ws, card.key, localImages);
  const anchors = useMemo(() => outline.map((h) => h.anchor), [outline]);
  const [active, setActive] = useActiveHeading(anchors);
  const ownTitle = useMemo(() => /^# \S/m.test(source.replace(/```[\s\S]*?```/g, '')), [source]);
  const anchor = query.get('anchor');
  const folded = useRef<HTMLDetailsElement>(null);
  // A jump this view made itself has already scrolled, smoothly where motion is welcome; the address only catches up.
  const jumped = useRef<string | null>(null);

  useEffect(() => {
    if (anchor && jumped.current === anchor) {
      jumped.current = null;
      return;
    }
    const target = anchor ? document.getElementById(anchor) : null;
    if (target) {
      target.scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
    } else {
      document.getElementById('main')?.scrollTo?.({ top: 0 });
      window.scrollTo({ top: 0 });
    }
  }, [anchor, card.key]);

  /** Scrolls every time, even to the section already in the address: the reader may have moved away from it (knowledge-03). */
  const jump = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const target = document.getElementById(id);
    target?.scrollIntoView({ block: 'start', behavior: smoothScroll() ? 'smooth' : 'auto' });
    target?.focus({ preventScroll: true });
    setActive(id);
    if (folded.current) folded.current.open = false;
    if (anchor !== id) {
      jumped.current = id;
      setQuery({ anchor: id }, { replace: true });
    }
  };

  const Back = locale === 'ar' ? ArrowRight : ArrowLeft;
  const { prev, next } = useMemo(() => neighbours(card, order, all), [card, order, all]);

  const renderLink = (href: string, children: ReactNode) => {
    const target = resolveDocLink(card, href, all);
    if (!target) return undefined;
    return (
      <AppLink
        view="docs"
        query={{ doc: target.key, anchor: href.split('#')[1] ?? null }}
        className={cn('hit-44 rounded-sm text-primary underline underline-offset-4', focusRing)}
      >
        {children}
      </AppLink>
    );
  };

  const outlineList = (touch: boolean) => (
    <ol dir={dir} className="flex flex-col gap-0.5 border-s border-border">
      {outline.map((h) => (
        <li key={h.anchor}>
          <AppLink
            view="docs"
            query={{ anchor: h.anchor }}
            aria-current={active === h.anchor ? 'location' : undefined}
            onClick={jump(h.anchor)}
            className={cn(
              '-ms-px flex items-center border-s text-body-sm underline-offset-4 hover:text-foreground',
              touch ? 'min-h-11 py-1' : 'py-0.5',
              h.level === 3 ? 'ps-5' : 'ps-3',
              active === h.anchor
                ? 'border-foreground font-medium text-foreground'
                : 'border-transparent text-muted-foreground',
              focusRing,
            )}
          >
            {h.text}
          </AppLink>
        </li>
      ))}
    </ol>
  );

  const Title = pageHasTitle ? 'h2' : 'h1';
  const wide = showOutline && outline.length > 1;
  return (
    <article className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-3 border-b border-border pb-4">
        <AppLink
          view="docs"
          query={{ doc: null, anchor: null }}
          className={cn(
            'inline-flex h-11 items-center gap-1.5 self-start rounded-sm text-body-sm font-medium text-muted-foreground hover:text-foreground lg:@page-lg:hidden',
            focusRing,
          )}
        >
          <Back aria-hidden className="size-4" strokeWidth={1.75} />
          {t.back}
        </AppLink>
        <Breadcrumb card={card} />
        {!ownTitle && (
          <Title dir="auto" className="text-title font-semibold text-pretty text-foreground">
            {card.title || fileName(d.path)}
          </Title>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={d.path} compact label={fmt(t.copyPath, { path: d.path })} className="min-w-0" />
          <Pill>{kit.sheet.doc.kinds[d.kind]}</Pill>
          <div className="ms-auto flex flex-wrap items-center gap-x-3 gap-y-1">
            <LangToggle card={card} all={all} />
            {d.webUrl && (
              <a href={d.webUrl} target="_blank" rel="noreferrer" className={metaLink}>
                {t.openGithub}
                <ExternalLink aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
              </a>
            )}
          </div>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground">
          <span>{fill(t.updated, { when: <RelativeTime iso={card.lastEventAt} /> })}</span>
          {d.lastCommitSha && (
            // 08 §5.4: a short SHA, the full one on hover.
            <span title={d.lastCommitSha}>
              {t.commit}{' '}
              <Ltr mono className="text-caption text-foreground">
                {d.lastCommitSha.slice(0, 7)}
              </Ltr>
            </span>
          )}
          {d.wordCount > 0 && <span>{plural(d.wordCount, locale, t.words)}</span>}
          <span title={d.lastIndexedAt ? rel(d.lastIndexedAt, locale) : undefined}>
            <AppLink
              card={card.key}
              className={cn('hit-44 rounded-sm underline-offset-4 hover:underline', focusRing)}
            >
              {t.card}
            </AppLink>
          </span>
        </p>
        {card.status === 'stale' && (
          <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-body-sm text-warning-soft-foreground">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <span>
              <span className="font-semibold">{t.stale}: </span>
              {t.staleHint}
            </span>
          </p>
        )}
      </header>

      <OnboardingStrip card={card} all={all} />

      <DocBar doc={card} />

      <div
        className={cn('grid grid-cols-[minmax(0,1fr)] gap-8', wide && 'grid-cols-[minmax(0,1fr)_11.5rem]')}
      >
        <div className="flex min-w-0 flex-col gap-8">
          {!wide && outline.length > 1 && card.content !== null && (
            // Below 1280 the outline folds above the text, closed until asked for (knowledge-03).
            <details ref={folded} className="group/outline max-w-3xl rounded-lg border border-border bg-card">
              <summary
                className={cn(
                  'flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-body-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden',
                  focusRing,
                )}
              >
                {t.outline}
                <span className="text-caption font-normal text-muted-foreground tabular-nums">
                  <Ltr>{num(outline.length, locale)}</Ltr>
                </span>
                <ChevronDown
                  aria-hidden
                  className="ms-auto size-4 text-muted-foreground transition-transform duration-120 group-open/outline:rotate-180 motion-reduce:transition-none"
                  strokeWidth={1.75}
                />
              </summary>
              <div className="px-3 pb-3">{outlineList(true)}</div>
            </details>
          )}
          {card.content === null ? (
            <EmptyState icon={FileWarning} title={t.unavailable[card.unavailable ?? 'missing']}>
              {t.unavailableBody}
            </EmptyState>
          ) : (
            <MarkdownView
              source={source}
              dir={dir}
              headingOffset={pageHasTitle ? 1 : 0}
              copyCodeLabel={t.copyCode}
              renderLink={renderLink}
              renderImage={images.render}
              renderHeadingAction={(id, text) => (
                <AppLink
                  view="docs"
                  query={{ anchor: id }}
                  onClick={jump(id)}
                  aria-label={fmt(t.sectionLink, { name: text })}
                  className={cn(
                    'shrink-0 rounded-sm text-muted-foreground opacity-0 group-hover/heading:opacity-100 hover:text-foreground focus-visible:opacity-100 max-md:hidden @max-page-md:hidden',
                    focusRing,
                  )}
                >
                  <Hash aria-hidden className="size-4" strokeWidth={1.75} />
                </AppLink>
              )}
              className="max-w-3xl"
            />
          )}
          <section aria-labelledby="doc-refs" className="flex flex-col gap-2 border-t border-border pt-4">
            <h2 id="doc-refs" className="text-body font-semibold text-foreground">
              {t.referencedBy}
            </h2>
            {card.mentionedBy.length === 0 ? (
              <p className="text-body-sm text-muted-foreground">{t.notReferenced}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {card.mentionedBy.map((c) => (
                  <li key={c.key} className="max-w-full">
                    <CardChip k={c.key} type={c.type} title={c.title} showTitle showStatus />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Pager prev={prev} next={next} />
          {images.lightbox}
        </div>
        {wide && (
          <nav
            aria-labelledby="doc-outline"
            className="sticky top-18 flex max-h-[calc(100dvh-5.5rem)] flex-col gap-2 self-start overflow-y-auto"
          >
            <h2 id="doc-outline" className="text-body-sm font-semibold text-foreground">
              {t.outline}
            </h2>
            {outlineList(false)}
          </nav>
        )}
      </div>
    </article>
  );
}
