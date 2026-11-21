/**
 * A chapter page: one group read as paragraphs. Header (path, title, lede, byline sentence, History + Advanced view) and a margin
 * column with what a careful editor would write in the margin: the attention note, the cross-group note, "see also" and a legend.
 */
import type { ReactNode } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Clock3, Info, KeyRound, ListTree, Sparkles } from 'lucide-react';
import { SETTINGS_SECTIONS } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { useBook } from './store';
import { cleanLabel, chapterIndex, docOf, fieldOf, fieldsOf, fill, formatValue, plural, relative, same, sectionOfGroup } from './model';
import { SubsectionBlock } from './body';
import { GroupIcon } from './icons';
import { Forbidden } from './states';
import { Badge, btn } from './ui';

export function Crumb() {
  const { locale } = useBook();
  const C = locale === 'ar' ? ChevronLeft : ChevronRight;
  return <C className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />;
}

export function GroupPage({ docKey }: { docKey: string }) {
  const book = useBook();
  const { t, locale } = book;
  const doc = docOf(docKey);
  const group = doc?.group;
  if (!doc || !group) return null;
  if (!book.canSee(docKey)) return <Forbidden body={group.permission?.[locale] ?? ''} />;

  const section = sectionOfGroup(docKey);
  const ci = section ? chapterIndex(section.id) : 0;
  const offDefault = fieldsOf(doc).filter((f) => !same(book.get(docKey, f.key), f.default)).length;
  const last = book.lastChange(docKey) ?? { by: group.updatedBy, at: group.updatedAt };
  const pending = book.pending(docKey);
  const related = t.related[docKey] ?? [];
  const special = group.kind === 'special';

  return (
    <article className="grid gap-x-12 xl:grid-cols-[minmax(0,46rem)_15rem]">
      {/* header */}
      <header className="min-w-0 xl:col-start-1">
        <nav aria-label={t.ui.contents} className="flex flex-wrap items-center gap-1.5 text-13 text-muted-foreground">
          <button type="button" className="rounded-md py-1 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring" onClick={() => book.go({ view: 'overview' })}>
            {t.ui.bookTitle}
          </button>
          <Crumb />
          {section ? (
            <button
              type="button"
              className="rounded-md py-1 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => book.go({ view: 'overview', chapter: section.id })}
            >
              {fill(t.ui.chapterOf, { chapter: t.ui.chapters[ci], title: section.title[locale] })}
            </button>
          ) : null}
        </nav>

        <div className="mt-5 flex items-start gap-4">
          <span className="mt-1 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-primary/15">
            <GroupIcon name={group.icon} className="size-6" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-26 font-black leading-tight sm:text-32">{group.title[locale]}</h1>
              {!group.inDashboard ? (
                <Badge tone="info">
                  <Sparkles className="size-3" aria-hidden />
                  {t.ui.newBadge}
                </Badge>
              ) : null}
              {group.permission ? (
                <Badge>
                  <KeyRound className="size-3" aria-hidden />
                  {t.ui.ownerOnly}
                </Badge>
              ) : null}
              {pending ? <Badge tone="warning">{t.ui.pendingBadge}</Badge> : null}
            </div>
          </div>
        </div>
        <p className="mt-4 max-w-[62ch] text-16 leading-relaxed text-muted-foreground">{group.description[locale]}</p>
        <p className="mt-3 text-13 text-muted-foreground">
          {special
            ? fill(t.ui.bylineSpecial, { by: last.by, when: relative(last.at, locale) })
            : fill(t.ui.byline, { v: book.version(docKey), by: last.by, when: relative(last.at, locale) })}{' '}
          {offDefault ? fill(t.ui.bylineDiff, { n: plural(offDefault, 'valueGen', locale, t) }) : t.ui.bylineSame}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" className={btn('outline')} onClick={() => book.openHistory(docKey)}>
            <Clock3 className="size-4" aria-hidden />
            {t.ui.history}
          </button>
          <button
            type="button"
            aria-pressed={book.advanced}
            className={cn(btn(book.advanced ? 'primary' : 'outline'))}
            onClick={() => book.setAdvanced(!book.advanced)}
          >
            <ListTree className="size-4" aria-hidden />
            {t.ui.advanced}
          </button>
        </div>
        {book.advanced ? <p className="mt-2 text-12 text-muted-foreground">{t.ui.advancedOn}</p> : null}
      </header>

      {/* margin column (after the header on narrow screens) */}
      <aside className="mt-8 grid content-start gap-6 xl:col-start-2 xl:row-span-3 xl:row-start-1 xl:mt-28 xl:self-start xl:sticky xl:top-24" aria-label={t.ui.seeAlso}>
        {group.attention ? (
          <Note icon={<AlertTriangle className="size-4 text-warning-strong" aria-hidden />} title={t.ui.attention}>
            {group.attention[locale]}
          </Note>
        ) : null}
        {group.permission ? (
          <Note icon={<KeyRound className="size-4 text-primary" aria-hidden />} title={t.ui.ownerOnly}>
            <bdi>{group.permission[locale]}</bdi>
          </Note>
        ) : null}
        {group.notes ? (
          <Note icon={<Info className="size-4 text-info" aria-hidden />} title={t.ui.note}>
            {group.notes[locale]}
          </Note>
        ) : null}
        {related.length ? (
          <div>
            <p className="text-12 font-bold text-muted-foreground">{t.ui.seeAlso}</p>
            <ul className="mt-2 grid gap-2.5">
              {related
                .filter((r) => book.canSee(r.to))
                .map((r) => (
                  <li key={r.to} className="text-13 leading-relaxed">
                    <button
                      type="button"
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-md font-bold text-foreground underline decoration-primary/40 underline-offset-4 outline-none hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => book.go({ view: 'group', key: r.to })}
                    >
                      <GroupIcon name={docOf(r.to)?.group?.icon ?? ''} className="size-3.5 text-primary" />
                      {docOf(r.to)?.title[locale]}
                    </button>
                    <span className="block text-muted-foreground">{r.why}</span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
        <Legend />
      </aside>

      <div className="min-w-0 xl:col-start-1">
        {pending ? <PendingBanner docKey={docKey} /> : null}
        <div className="mt-10 grid gap-12">
          {doc.subsections.map((sub) => (
            <SubsectionBlock key={sub.id} doc={doc} sub={sub} />
          ))}
        </div>
      </div>
    </article>
  );
}

function Note({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 xl:border-0 xl:bg-transparent xl:p-0">
      <p className="flex items-center gap-2 text-12 font-bold text-muted-foreground">
        {icon}
        {title}
      </p>
      <p className="mt-1.5 text-13 leading-relaxed text-foreground">{children}</p>
    </div>
  );
}

function Legend() {
  const { t } = useBook();
  return (
    <div className="hidden xl:block">
      <p className="text-12 font-bold text-muted-foreground">{t.ui.legendTitle}</p>
      <ul className="mt-2 grid gap-2 text-12 text-muted-foreground">
        <li className="flex items-center gap-2">
          <span className="rounded-md bg-primary/10 px-1.5 font-bold text-[color-mix(in_oklab,var(--primary),black_25%)] dark:bg-primary/15 dark:text-primary">14</span>
          {t.ui.legendValue}
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-flex w-6 justify-center">
            <span className="size-1.5 rounded-full bg-primary" />
          </span>
          {t.ui.legendDot}
        </li>
        <li className="flex items-center gap-2">
          <span className="rounded-md bg-warning/40 px-1.5 font-bold text-foreground dark:bg-warning/25">14</span>
          {t.ui.legendMarker}
        </li>
        <li className="flex items-center gap-2">
          <span className="rounded-md border border-dashed border-accent-violet/70 px-1.5 font-bold text-primary">14</span>
          {t.ui.legendDashed}
        </li>
      </ul>
    </div>
  );
}

function PendingBanner({ docKey }: { docKey: string }) {
  const book = useBook();
  const { t, locale } = book;
  const p = book.pending(docKey)!;
  return (
    <div role="status" className="mt-8 rounded-2xl border border-border bg-card p-5">
      <p className="flex items-center gap-2 text-15 font-extrabold">
        <Clock3 className="size-4 text-warning-strong" aria-hidden />
        {t.ui.pendingTitle}
      </p>
      <ul className="mt-2 grid gap-1 text-14 leading-relaxed">
        {p.changes.map((c) => {
          const f = fieldOf(docKey, c.field);
          if (!f) return null;
          return (
            <li key={c.field}>
              {fill(t.ui.changeLine, {
                label: cleanLabel(f.label[locale]),
                from: formatValue(f, c.from, locale, t),
                to: formatValue(f, c.to, locale, t),
              })}
            </li>
          );
        })}
      </ul>
      {p.note ? <p className="mt-2 text-13 text-muted-foreground">«{p.note}»</p> : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-13 text-muted-foreground">{fill(t.ui.pendingBody, { when: relative(p.at, locale) })}</p>
        <button type="button" className={btn('outline', 'sm')} onClick={() => book.withdraw(docKey)}>
          {t.ui.withdraw}
        </button>
      </div>
    </div>
  );
}

export const SECTION_COUNT = SETTINGS_SECTIONS.length;
