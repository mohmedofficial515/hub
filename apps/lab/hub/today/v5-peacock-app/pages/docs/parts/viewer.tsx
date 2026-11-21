import { useEffect, useMemo, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Hash, TriangleAlert } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { docContent, docTwin, githubUrl, resolveDocLink } from '@lab/mocks/hub-app/docs';
import { AppLink, CardChip, cn, CopyButton, fill, fmt, focusRing, headingsOf, kitMessages, Ltr, MarkdownView, Pill, plural, rel, RelativeTime, setQuery, useMedia, useRoute, type DocCard } from '../../../kit';
import { messages } from '../i18n';

const metaLink = `inline-flex items-center gap-1 rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline hit-44 ${focusRing}`;

/** A doc's language pair: both are the same doc to a reader, so this is a toggle, not two tree rows (09 §11). */
function LangToggle({ card }: { card: DocCard }) {
  const t = useT(messages);
  const twin = docTwin(card.key);
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
          className={cn('inline-flex h-11 items-center rounded-sm px-2.5 text-body-sm font-medium md:h-7', lang === me ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground', focusRing)}
        >
          {t.twinNames[lang]}
        </AppLink>
      ))}
    </div>
  );
}

/**
 * The reading column. The doc keeps its own direction, so an English doc stays LTR in the Arabic UI while everything
 * around it mirrors. The outline sits at the doc's reading end from 1280 px (08 §5.4).
 */
export function DocViewer({ card }: { card: DocCard }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { query } = useRoute();
  const showOutline = useMedia('(min-width: 1280px)');
  const d = card.doc;
  const source = docContent(card.key);
  const dir = d.lang === 'ar' ? 'rtl' : 'ltr';
  const outline = useMemo(() => headingsOf(source), [source]);
  const anchor = query.get('anchor');

  useEffect(() => {
    const target = anchor ? document.getElementById(anchor) : null;
    if (target) {
      target.scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
    } else {
      document.getElementById('main')?.scrollTo?.({ top: 0 });
      window.scrollTo({ top: 0 });
    }
  }, [anchor, card.key]);

  const Back = locale === 'ar' ? ArrowRight : ArrowLeft;

  const renderLink = (href: string, children: ReactNode) => {
    if (href.startsWith('http')) return undefined;
    const target = resolveDocLink(card.key, href);
    if (target) {
      return (
        <AppLink view="docs" query={{ doc: target.key, anchor: href.split('#')[1] ?? null }} className={cn('hit-44 rounded-sm text-primary underline underline-offset-4', focusRing)}>
          {children}
        </AppLink>
      );
    }
    return undefined;
  };

  return (
    <article className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-3 border-b border-border pb-4">
        <AppLink view="docs" query={{ doc: null, anchor: null }} className={cn('inline-flex h-11 items-center gap-1.5 self-start rounded-sm text-body-sm font-medium text-muted-foreground hover:text-foreground lg:hidden', focusRing)}>
          <Back aria-hidden className="size-4" strokeWidth={1.75} />
          {t.back}
        </AppLink>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={d.path} compact label={fmt(t.copyPath, { path: d.path })} className="min-w-0" />
          <Pill>{kit.sheet.doc.kinds[d.kind]}</Pill>
          <span className="text-body-sm text-muted-foreground" translate="no">
            {d.sourceName}
          </span>
          <div className="ms-auto flex flex-wrap items-center gap-x-3 gap-y-1">
            <LangToggle card={card} />
            <a href={githubUrl(card.key)} target="_blank" rel="noreferrer" className={metaLink}>
              {t.openGithub}
              <ExternalLink aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
            </a>
          </div>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground">
          <span>{fill(t.updated, { when: <RelativeTime iso={card.lastEventAt} /> })}</span>
          <span>
            {t.commit} <Ltr mono className="text-caption text-foreground">{d.lastCommitSha}</Ltr>
          </span>
          <span>{plural(d.wordCount, locale, t.words)}</span>
          <span title={rel(d.lastIndexedAt, locale)}>
            <AppLink card={card.key} className={cn('rounded-sm underline-offset-4 hover:underline hit-44', focusRing)}>
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

      <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-8', showOutline && outline.length > 1 && 'grid-cols-[minmax(0,1fr)_11.5rem]')}>
        <div className="flex min-w-0 flex-col gap-8">
          <MarkdownView
            source={source}
            dir={dir}
            copyCodeLabel={t.copyCode}
            renderLink={renderLink}
            renderHeadingAction={(id, text) => (
              <AppLink view="docs" query={{ anchor: id }} aria-label={fmt(t.sectionLink, { name: text })} className={cn('shrink-0 rounded-sm text-muted-foreground opacity-0 group-hover/heading:opacity-100 hover:text-foreground focus-visible:opacity-100 max-md:hidden', focusRing)}>
                <Hash aria-hidden className="size-4" strokeWidth={1.75} />
              </AppLink>
            )}
            className="max-w-3xl"
          />
          <p className="text-caption text-muted-foreground">{t.excerptNote}</p>
          <section aria-labelledby="doc-refs" className="flex flex-col gap-2 border-t border-border pt-4">
            <h2 id="doc-refs" className="text-body font-semibold text-foreground">
              {t.referencedBy}
            </h2>
            {d.referencedBy.length === 0 ? (
              <p className="text-body-sm text-muted-foreground">{t.notReferenced}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {d.referencedBy.map((key) => (
                  <li key={key} className="max-w-full">
                    <CardChip k={key} showTitle showStatus />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        {showOutline && outline.length > 1 && (
          <nav aria-labelledby="doc-outline" className="sticky top-18 flex max-h-[calc(100dvh-5.5rem)] flex-col gap-2 self-start overflow-y-auto">
            <h2 id="doc-outline" className="text-body-sm font-semibold text-foreground">
              {t.outline}
            </h2>
            <ol dir={dir} className="flex flex-col gap-0.5 border-s border-border">
              {outline.map((h) => (
                <li key={h.anchor}>
                  <AppLink
                    view="docs"
                    query={{ anchor: h.anchor }}
                    aria-current={anchor === h.anchor ? 'location' : undefined}
                    onClick={() => anchor === h.anchor && setQuery({ anchor: null })}
                    className={cn(
                      '-ms-px block border-s py-0.5 text-body-sm underline-offset-4 hover:text-foreground',
                      h.level === 3 ? 'ps-5' : 'ps-3',
                      anchor === h.anchor ? 'border-foreground font-medium text-foreground' : 'border-transparent text-muted-foreground',
                      focusRing,
                    )}
                  >
                    {h.text}
                  </AppLink>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>
    </article>
  );
}
