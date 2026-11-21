// Group page as a focus view: opens scrolled to the deep-linked field, a sub-section jump menu, search scoped to the
// group, related groups explained in the header, advanced fields folded, sticky save bar, review sheet and history.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, History, Link2, MoreHorizontal, RotateCcw, Search, TriangleAlert, Users, X } from 'lucide-react';
import { SETTINGS_SECTIONS, type Field, type SettingsGroup, type Subsection } from '@lab/mocks/settings';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { GroupBadges } from './badges';
import { FieldRow } from './field-row';
import { fmtNumber, fmtRelative, loc } from './format';
import { iconFor } from './icons';
import { canSee, groupByKey, ownerOnly, RELATED, same } from './model';
import { fieldLink, navigate, type Route } from './route';
import { highlightTokens, matchRanges, tokensOf } from './search';
import { SaveBar } from './save-bar';
import { ForbiddenState, GatewayStatus, OwnerNote, WhatsAppStatus, WhatsAppTest, isGatewayStatusField } from './special';
import { useStore } from './store';
import { Btn, IconTile, Menu, focusRing } from './ui';
import { HistorySheet } from './history-sheet';
import { ReviewSheet } from './review-sheet';

const SPECIAL_SUBS: Record<string, string[]> = { whatsapp_provider: ['status', 'test'] };

function matches(field: Field, tokens: string[]) {
  if (!tokens.length) return true;
  const hay = `${field.label.ar} ${field.label.en} ${field.help.ar} ${field.help.en} ${field.key}`;
  return tokens.every((tk) => matchRanges(hay, [tk]).length > 0);
}

export function GroupPage({ route }: { route: Extract<Route, { view: 'group' }> }) {
  const t = useT(messages);
  const locale = useLocale();
  const store = useStore();
  const group = groupByKey(route.group);
  const Back = locale === 'ar' ? ArrowRight : ArrowLeft;

  if (!group) {
    return (
      <ForbiddenState
        title={t.group.notFound}
        body={t.group.notFoundBody(route.group)}
        onBack={() => navigate({ view: 'home' })}
        backLabel={t.group.backToSettings}
      />
    );
  }
  if (!canSee(store.role, group.key)) {
    return (
      <ForbiddenState
        title={t.group.forbidden(loc(group.title, locale))}
        body={t.group.forbiddenBody}
        onBack={() => navigate({ view: 'home' })}
        backLabel={t.group.backToSettings}
      />
    );
  }
  return <GroupView key={group.key} group={group} route={route} Back={Back} />;
}

function GroupView({ group, route, Back }: { group: SettingsGroup; route: Extract<Route, { view: 'group' }>; Back: typeof ArrowLeft }) {
  const t = useT(messages);
  const locale = useLocale();
  const store = useStore();
  const [q, setQ] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [active, setActive] = useState(group.subsections[0]?.id ?? '');
  const tokens = tokensOf(q);
  const hl = highlightTokens(q);
  const section = SETTINGS_SECTIONS.find((s) => s.id === group.section);
  const Icon = iconFor(group.icon);
  const special = SPECIAL_SUBS[group.key] ?? [];
  const isGateways = group.key === 'payment_gateways';
  const relatedKeys = (RELATED[group.key] ?? []).filter((k) => groupByKey(k) && canSee(store.role, k));
  const pending = store.pending[group.key];
  const dirty = store.dirtyCount(group.key);
  const otherDirty = store.dirtyCount() - dirty;
  const relatedNote = group.notes ? loc(group.notes, locale) : t.related[group.key];
  const latest = store.history(group.key)[0];

  const subs = useMemo(
    () =>
      group.subsections
        .filter((s) => !special.includes(s.id))
        .map((s) => ({
          sub: s,
          fields: s.fields.filter((f) => !(isGateways && isGatewayStatusField(f.key)) && canSee(store.role, group.key, f) && matches(f, tokens)),
          hidden: s.fields.filter((f) => !canSee(store.role, group.key, f)).length,
        }))
        .filter((s) => s.fields.length || (!tokens.length && s.hidden)),
    [group, tokens.join(' '), store.role, locale], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const refs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    if (route.field) {
      const sub = group.subsections.find((s) => s.fields.some((f) => f.key === route.field));
      if (sub) setActive(sub.id);
    } else window.scrollTo({ top: 0 });
  }, [route.field, group]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (items) => {
        const top = items.filter((i) => i.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id.replace('sub-', ''));
      },
      { rootMargin: '-20% 0px -65% 0px' },
    );
    Object.values(refs.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [subs]);

  const jump = (id: string) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    refs.current[id]?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setActive(id);
  };

  const resetSub = (s: Subsection) => {
    s.fields.forEach((f) => {
      if (!f.readOnly && !f.structured && !same(store.value(group.key, f.key), f.default)) store.setDraft(group.key, f.key, f.default);
    });
  };
  const resetGroup = () => group.subsections.forEach(resetSub);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* Header */}
      <header className="pt-5 sm:pt-8">
        <nav aria-label={t.group.breadcrumb} className="flex flex-wrap items-center gap-1 text-13 text-muted-foreground">
          <button
            type="button"
            onClick={() => navigate({ view: 'home' })}
            className={cn('-ms-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-semibold text-foreground hover:bg-muted', focusRing)}
          >
            <Back aria-hidden className="size-4" />
            {t.group.settings}
          </button>
          <span aria-hidden>›</span>
          <span>{loc(section?.title, locale)}</span>
        </nav>
        <div className="mt-3 flex flex-wrap items-start gap-4">
          <IconTile icon={Icon} size="lg" />
          <div className="min-w-0 flex-1 basis-64">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-22 font-extrabold leading-tight sm:text-26">{loc(group.title, locale)}</h1>
              <GroupBadges group={group} ownerOnly={ownerOnly(group.key)} />
            </div>
            <p className="mt-1.5 max-w-3xl text-14 leading-relaxed text-muted-foreground">{loc(group.description, locale)}</p>
            <p className="mt-2 text-13 text-muted-foreground">
              {t.group.meta(fmtNumber(store.version(group.key), locale), latest?.by ?? group.updatedBy, fmtRelative(latest?.at ?? group.updatedAt, locale))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Btn onClick={() => setHistoryOpen(true)}>
              <History aria-hidden className="size-4" />
              {t.group.history}
            </Btn>
            <Menu
              trigger={
                <Btn size="icon" aria-label={t.group.moreActions}>
                  <MoreHorizontal aria-hidden className="size-5" />
                </Btn>
              }
              items={[
                {
                  label: t.group.copyLink,
                  icon: <Link2 />,
                  onSelect: () => {
                    void navigator.clipboard?.writeText(fieldLink({ view: 'group', group: group.key })).catch(() => undefined);
                    store.toast(t.toasts.linkCopied, 'info');
                  },
                },
                { label: t.group.resetGroup, icon: <RotateCcw />, onSelect: resetGroup },
              ]}
            />
          </div>
        </div>

        {(relatedNote || relatedKeys.length > 0) && (
          <div className="mt-5 rounded-2xl bg-muted/60 px-4 py-3">
            {relatedNote && <p className="max-w-4xl text-13 leading-relaxed">{relatedNote}</p>}
            {relatedKeys.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-12 font-semibold text-muted-foreground">{t.group.related}</span>
                {relatedKeys.map((k) => {
                  const g = groupByKey(k)!;
                  const RIcon = iconFor(g.icon);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => navigate({ view: 'group', group: k })}
                      className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-13 font-semibold hover:bg-muted xl:min-h-10', focusRing)}
                    >
                      <RIcon aria-hidden className="size-4 text-muted-foreground" />
                      {loc(g.title, locale)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {group.attention && (
          <p className="mt-3 flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-13 leading-relaxed">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-strong" />
            <span>{loc(group.attention, locale)}</span>
          </p>
        )}
        {pending && (
          <p className="mt-3 flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-13 leading-relaxed">
            <Users aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>{t.group.pendingBanner(pending.changes.length, pending.id, pending.by)}</span>
          </p>
        )}
      </header>

      {isGateways && (
        <div className="mt-5">
          <OwnerNote group={group} />
        </div>
      )}
      {group.key === 'whatsapp_provider' && (
        <div className="mt-5 grid gap-4">
          <WhatsAppStatus group={group} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        {/* Jump menu + scoped search */}
        <aside className="min-w-0 lg:sticky lg:top-[calc(var(--settings-sticky-top,0px)+1rem)] lg:self-start" aria-label={t.group.inThisGroup}>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQ('')}
              aria-label={t.group.searchIn(loc(group.title, locale))}
              placeholder={t.group.searchIn(loc(group.title, locale))}
              className={cn('h-11 w-full rounded-xl border border-muted-foreground/85 bg-card ps-9 pe-10 text-14 [&::-webkit-search-cancel-button]:hidden', focusRing)}
            />
            {q && (
              <button type="button" aria-label={t.hero.clear} onClick={() => setQ('')} className={cn('absolute end-0 top-0 grid size-11 place-items-center rounded-xl text-muted-foreground', focusRing)}>
                <X aria-hidden className="size-4" />
              </button>
            )}
          </div>
          <nav aria-label={t.group.jump} className="mt-3">
            <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
              {subs.map(({ sub, fields }) => {
                const d = sub.fields.filter((f) => !same(store.value(group.key, f.key), store.saved(group.key, f.key))).length;
                const on = active === sub.id;
                return (
                  <li key={sub.id} className="shrink-0">
                    <button
                      type="button"
                      aria-current={on ? 'true' : undefined}
                      onClick={() => jump(sub.id)}
                      className={cn(
                        'flex min-h-11 w-full items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-start text-13 font-semibold transition-colors xl:min-h-10 lg:rounded-lg lg:border-0 lg:px-3 lg:whitespace-normal',
                        focusRing,
                        on ? 'border-primary bg-primary/10 text-foreground dark:bg-primary/20' : 'border-border bg-card text-muted-foreground hover:text-foreground lg:bg-transparent lg:hover:bg-muted',
                      )}
                    >
                      <span className="min-w-0 flex-1 lg:truncate">{loc(sub.title, locale)}</span>
                      {d > 0 && (
                        <span className="inline-flex items-center gap-1 text-12 text-warning-soft-foreground">
                          <span aria-hidden className="size-1.5 rounded-full bg-warning-strong" />
                          <span className="sr-only">{t.n.unsaved(d)}</span>
                          <span aria-hidden>{fmtNumber(d, locale)}</span>
                        </span>
                      )}
                      <span className="text-12 font-normal tabular-nums text-muted-foreground">{fmtNumber(fields.length, locale)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* Sub-sections */}
        <div className="flex min-w-0 flex-col gap-8">
          {subs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
              <p className="text-16 font-bold">{t.group.noMatch(q)}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Btn onClick={() => setQ('')}>{t.hero.clear}</Btn>
                <Btn variant="primary" onClick={() => navigate({ view: 'home' })}>
                  {t.group.searchEverywhere}
                </Btn>
              </div>
            </div>
          )}
          {subs.map(({ sub, fields, hidden }) => {
            const basic = fields.filter((f) => !f.advanced);
            const adv = fields.filter((f) => f.advanced);
            const changedHere = sub.fields.some((f) => !f.readOnly && !f.structured && !same(store.value(group.key, f.key), f.default));
            const advOpen = tokens.length > 0 || adv.some((f) => f.key === route.field);
            return (
              <section
                key={sub.id}
                id={`sub-${sub.id}`}
                ref={(el) => {
                  refs.current[sub.id] = el;
                }}
                aria-labelledby={`h-${sub.id}`}
                className="scroll-mt-[calc(var(--settings-sticky-top,0px)+1.5rem)]"
              >
                <div className="mb-3 flex flex-wrap items-end gap-x-4 gap-y-2 px-1">
                  <div className="min-w-0 flex-1 basis-60">
                    <h2 id={`h-${sub.id}`} className="flex flex-wrap items-center gap-2 text-18 font-bold">
                      {loc(sub.title, locale)}
                      {isGateways && <GatewayStatus sub={sub} />}
                    </h2>
                    <p className="mt-0.5 text-13 leading-relaxed text-muted-foreground">{loc(sub.description, locale)}</p>
                  </div>
                  {changedHere && (
                    <Btn variant="quiet" size="sm" onClick={() => resetSub(sub)}>
                      <RotateCcw aria-hidden className="size-3.5" />
                      {t.group.resetSection}
                    </Btn>
                  )}
                </div>
                <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {basic.map((f) => (
                    <Row key={f.key} group={group} field={f} route={route} tokens={hl} />
                  ))}
                  {adv.length > 0 && (
                    <details open={advOpen} className="group/adv">
                      <summary
                        className={cn(
                          'flex min-h-12 cursor-pointer list-none items-center gap-2 px-5 text-14 font-semibold text-muted-foreground hover:bg-muted/50 [&::-webkit-details-marker]:hidden',
                          focusRing,
                          'focus-visible:ring-inset focus-visible:ring-offset-0',
                        )}
                      >
                        <ChevronDown aria-hidden className="size-4 transition-transform group-open/adv:rotate-180 motion-reduce:transition-none" />
                        {t.group.advanced(adv.length)}
                      </summary>
                      <div className="divide-y divide-border border-t border-border">
                        {adv.map((f) => (
                          <Row key={f.key} group={group} field={f} route={route} tokens={hl} />
                        ))}
                      </div>
                    </details>
                  )}
                  {hidden > 0 && (
                    <p className="px-5 py-3 text-13 text-muted-foreground">{t.group.hiddenFields(hidden)}</p>
                  )}
                </div>
              </section>
            );
          })}
          {group.key === 'whatsapp_provider' && !tokens.length && <WhatsAppTest group={group} />}
        </div>
      </div>

      <SaveBar
        group={group}
        dirty={dirty}
        otherDirty={otherDirty}
        onReview={() => setReviewOpen(true)}
        onDiscard={() => store.discard(group.key)}
      />
      <ReviewSheet open={reviewOpen} onOpenChange={setReviewOpen} groupKeys={[group.key]} />
      <HistorySheet open={historyOpen} onOpenChange={setHistoryOpen} group={group} />
    </div>
  );
}

function Row({ group, field, route, tokens }: { group: SettingsGroup; field: Field; route: Extract<Route, { view: 'group' }>; tokens: string[] }) {
  const store = useStore();
  return (
    <FieldRow
      field={field}
      value={store.value(group.key, field.key)}
      saved={store.saved(group.key, field.key)}
      onChange={(v) => store.setDraft(group.key, field.key, v)}
      pinId={`${group.key}.${field.key}`}
      route={{ view: 'group', group: group.key, field: field.key }}
      highlight={route.field === field.key}
      tokens={tokens}
      canSeeSecrets={store.role === 'owner'}
    />
  );
}
