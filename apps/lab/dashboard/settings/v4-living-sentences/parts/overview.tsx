/**
 * The policy book: a table of contents of 8 chapters and, in the reading column, every group summarised in one sentence built
 * from its live values. Attention notes sit in the margin (inline under the sentence below xl).
 */
import { useEffect } from 'react';
import { AlertTriangle, KeyRound, Lock, Settings2, Sparkles } from 'lucide-react';
import { SETTINGS_SECTIONS, groupsOfSection, type SectionId, type SettingsGroup } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { useBook } from './store';
import { ORG_DOCS, fieldsOf, fill, plural, relative, same, type SearchFilter } from './model';
import { summaryTemplate } from './templates';
import { Sentence, sentenceCls } from './sentence';
import { GroupIcon } from './icons';
import { Badge } from './ui';

export function scrollToChapter(id: string) {
  const el = document.getElementById(`ch-${id}`);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
}

/* ───────── table of contents ───────── */

export function Toc({ active, onPick }: { active: SectionId | null; onPick?: () => void }) {
  const book = useBook();
  const { t, locale, route } = book;
  const currentGroup = route.view === 'group' ? route.key : null;
  const pickChapter = (id: SectionId) => {
    onPick?.();
    if (route.view === 'overview' && !book.query) scrollToChapter(id);
    else book.go({ view: 'overview', chapter: id });
  };
  return (
    <nav aria-label={t.ui.contents}>
      <p className="px-3 text-12 font-bold text-muted-foreground">{t.ui.contents}</p>
      <ol className="mt-2 grid gap-0.5">
        {SETTINGS_SECTIONS.map((s, i) => {
          const groups = groupsOfSection(s.id).filter((g) => book.canSee(g.key));
          const attention = groups.some((g) => g.attention);
          const drafts = groups.some((g) => book.draftCount(g.key) > 0);
          const open = !!currentGroup && groups.some((g) => g.key === currentGroup);
          const on = active === s.id || open;
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-current={on && route.view === 'overview' ? 'true' : undefined}
                onClick={() => pickChapter(s.id)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-14 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-h-10',
                  on ? 'bg-muted font-bold text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <span className="w-4 shrink-0 text-12 tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1">{s.title[locale]}</span>
                {drafts ? <span className="size-2 rounded-full bg-warning" title={t.ui.unsaved} /> : null}
                {attention ? <AlertTriangle className="size-3.5 text-warning-strong" aria-label={t.ui.attention} /> : null}
              </button>
              {open ? (
                <ol className="my-1 ms-7 grid gap-0.5 border-s border-border ps-2">
                  {groups.map((g) => (
                    <li key={g.key}>
                      <button
                        type="button"
                        aria-current={g.key === currentGroup ? 'page' : undefined}
                        onClick={() => {
                          onPick?.();
                          book.go({ view: 'group', key: g.key });
                        }}
                        className={cn(
                          'flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-start text-13 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9',
                          g.key === currentGroup ? 'bg-primary/10 font-bold text-foreground dark:bg-primary/15' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span className="min-w-0 flex-1">{g.title[locale]}</span>
                        {book.draftCount(g.key) ? <span className="size-2 rounded-full bg-warning" aria-label={t.ui.unsaved} /> : null}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="mt-5 border-t border-border pt-4">
        <p className="px-3 text-12 font-bold text-muted-foreground">{t.ui.outsideBook}</p>
        <button
          type="button"
          aria-current={route.view === 'prefs' ? 'page' : undefined}
          onClick={() => {
            onPick?.();
            book.go({ view: 'prefs' });
          }}
          className={cn(
            'mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring',
            route.view === 'prefs' ? 'bg-muted font-bold' : 'hover:bg-muted/60',
          )}
        >
          <Settings2 className="size-4 text-primary" aria-hidden />
          <span className="grid">
            <span className="text-14">{t.ui.prefs}</span>
            <span className="text-12 font-normal text-muted-foreground">{t.ui.prefsSub}</span>
          </span>
        </button>
      </div>
    </nav>
  );
}

/* ───────── overview ───────── */

export function Overview({ onActive }: { onActive: (id: SectionId) => void }) {
  const book = useBook();
  const { t, locale, route } = book;
  const visible = ORG_DOCS.filter((d) => book.canSee(d.key));
  const changed = visible.flatMap((d) => fieldsOf(d).filter((f) => !same(book.get(d.key, f.key), f.default))).length;
  const proposed = visible.flatMap((d) => fieldsOf(d).filter((f) => f.proposed)).length;
  const attention = visible.filter((d) => d.group?.attention).length;

  useEffect(() => {
    if (route.view === 'overview' && route.chapter) {
      const id = route.chapter;
      requestAnimationFrame(() => scrollToChapter(id));
    }
  }, [route]);

  useEffect(() => {
    const els = SETTINGS_SECTIONS.map((s) => document.getElementById(`ch-${s.id}`)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) onActive(top.target.id.slice(3) as SectionId);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [onActive]);

  const chip = (f: SearchFilter, label: string, n: number) => (
    <button
      type="button"
      onClick={() => book.setFilter(f)}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-13 font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
    >
      {label}
      <span className="tabular-nums text-muted-foreground">{n}</span>
    </button>
  );

  return (
    <div>
      <header className="max-w-[46rem]">
        <h1 className="text-32 font-black leading-tight">{t.ui.bookTitle}</h1>
        <p className="mt-4 text-17 leading-[1.9] text-muted-foreground">{t.ui.bookLede}</p>
        <p className="mt-3 text-15 leading-relaxed">
          {fill(t.ui.bookState, {
            groups: plural(visible.length, 'groupNom', locale, t),
            chapters: plural(SETTINGS_SECTIONS.length, 'chapterGen', locale, t),
            attention,
            changed: plural(changed, 'valueNom', locale, t),
          })}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {chip('changed', t.ui.filters.changed, changed)}
          {chip('proposed', t.ui.filters.proposed, proposed)}
        </div>
      </header>

      {SETTINGS_SECTIONS.map((s, i) => {
        const all = groupsOfSection(s.id);
        const groups = all.filter((g) => book.canSee(g.key));
        const hidden = all.filter((g) => !book.canSee(g.key));
        return (
          <section key={s.id} id={`ch-${s.id}`} aria-labelledby={`cht-${s.id}`} className="scroll-mt-24 pt-16">
            <p className="text-13 font-bold text-primary">{t.ui.chapters[i]}</p>
            <h2 id={`cht-${s.id}`} className="mt-1 text-26 font-extrabold leading-tight">
              {s.title[locale]}
            </h2>
            <p className="mt-1.5 max-w-[46rem] text-15 leading-relaxed text-muted-foreground">{s.description[locale]}</p>
            <div className="mt-7 grid gap-9">
              {groups.map((g) => (
                <GroupEntry key={g.key} group={g} />
              ))}
            </div>
            {hidden.length ? (
              <p className="mt-6 flex max-w-[46rem] items-start gap-2 text-13 text-muted-foreground">
                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                {fill(t.ui.hiddenPages, { names: hidden.map((g) => g.title[locale]).join(locale === 'ar' ? '، ' : ', ') })}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function GroupEntry({ group }: { group: SettingsGroup }) {
  const book = useBook();
  const { t, locale } = book;
  const get = (k: string) => book.get(group.key, k);
  const tpl = summaryTemplate(t, group.key, get);
  const fields = group.subsections.flatMap((s) => s.fields);
  const offDefault = fields.filter((f) => !same(get(f.key), f.default)).length;
  const last = book.lastChange(group.key) ?? { by: group.updatedBy, at: group.updatedAt };
  const drafts = book.draftCount(group.key);
  return (
    <div className="grid gap-x-12 xl:grid-cols-[minmax(0,46rem)_15rem]">
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <button
            type="button"
            onClick={() => book.go({ view: 'group', key: group.key })}
            className="-ms-1 inline-flex min-h-11 items-center gap-2.5 rounded-lg px-1 text-18 font-bold outline-none hover:underline hover:decoration-primary/50 hover:underline-offset-8 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
          >
            <GroupIcon name={group.icon} className="size-5 text-primary" />
            {group.title[locale]}
          </button>
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
          {drafts ? <Badge tone="warning">{fill(t.ui.draftBadge, { n: drafts })}</Badge> : null}
          {book.pending(group.key) ? <Badge tone="warning">{t.ui.pendingBadge}</Badge> : null}
        </h3>
        {tpl ? (
          <p className={cn('mt-1', sentenceCls(locale, 'md'))}>
            {tpl.lines.map((line, i) => (
              <Sentence key={i} docKey={group.key} line={line} mode="link" />
            ))}
          </p>
        ) : (
          <p className="mt-1 text-15 text-muted-foreground">{group.summary[locale]}</p>
        )}
        <p className="mt-1 text-13 text-muted-foreground">
          {group.kind === 'special'
            ? fill(t.ui.bylineSpecial, { by: last.by, when: relative(last.at, locale) })
            : fill(t.ui.byline, { v: book.version(group.key), by: last.by, when: relative(last.at, locale) })}{' '}
          {offDefault ? fill(t.ui.bylineDiff, { n: plural(offDefault, 'valueGen', locale, t) }) : t.ui.bylineSame}
        </p>
      </div>
      {group.attention ? (
        <aside className="mt-3 flex gap-2.5 rounded-2xl border border-border/80 bg-card p-3.5 text-13 leading-relaxed xl:mt-2 xl:border-0 xl:bg-transparent xl:p-0">
          <AlertTriangle className="mt-1 size-4 shrink-0 text-warning-strong" aria-hidden />
          <span>
            <span className="sr-only">{t.ui.attention}: </span>
            {group.attention[locale]}
          </span>
        </aside>
      ) : null}
    </div>
  );
}
