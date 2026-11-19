/**
 * Group page: header (identity, state, version, last change, history, related groups and the "what lives where"
 * note), callouts, a sticky subsection index with scroll-spy beside the field rows, and the sticky save bar.
 * Payment gateways and WhatsApp keep this frame and swap the body (parts/special.tsx).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, ChevronRight, CircleAlert, CircleCheck, History, Info, Link2, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@lab/utils';
import { getGroup, getSection, type SettingsGroup, type Subsection } from '@lab/mocks/settings';
import { validate } from './controls';
import { FieldRow, mostlySecurity, useFocusField } from './field-row';
import { count, fill, num, relative } from './format';
import { HistoryDrawer } from './history-drawer';
import { ATTENTION_RULES, RELATED, changedFromDefault, groupState, repeatedHelp, same, type Values } from './model';
import { ReviewSheet } from './review-sheet';
import { GatewaysBody, WhatsAppBody } from './special';
import { Forbidden } from './states';
import { copyText, fieldLink, useStore, who } from './store';
import { Btn, IconTile, Pill } from './ui';

export function GroupPage({ groupKey }: { groupKey: string }) {
  const store = useStore();
  const { t, route, go, canSee } = store;
  const group = getGroup(groupKey);

  if (!group) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="text-16 font-bold">{t.group.notFound}</p>
        <Btn variant="quiet" className="mt-3" onClick={() => go({ view: 'overview' })}>
          {t.group.back}
        </Btn>
      </div>
    );
  }
  if (!canSee(group.key)) return <Forbidden />;

  return (
    <div className="grid gap-6 pb-4">
      <GroupHeader group={group} />
      <Callouts group={group} />
      {group.key === 'payment_gateways' ? <GatewaysBody group={group} /> : group.key === 'whatsapp_provider' ? <WhatsAppBody group={group} /> : <StandardBody group={group} />}
      <SaveBar group={group} />
      <ReviewSheet group={group} open={route.panel === 'review'} onClose={() => go({ ...route, panel: null, field: undefined }, { replace: true })} />
      <HistoryDrawer group={group} open={route.panel === 'history'} onClose={() => go({ ...route, panel: null, field: undefined }, { replace: true })} />
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

export function StatePill({ state }: { state: ReturnType<typeof groupState> }) {
  const { t } = useStore();
  if (state === 'on') return <Pill tone="success" dot>{t.pill.on}</Pill>;
  if (state === 'off') return <Pill tone="neutral" dot>{t.pill.off}</Pill>;
  if (state === 'attention') return <Pill tone="warning" dot>{t.pill.attention}</Pill>;
  if (state === 'scheduled') return <Pill tone="info" dot>{t.pill.scheduled}</Pill>;
  return null;
}

function GroupHeader({ group }: { group: SettingsGroup }) {
  const { t, locale, saved, meta, history, go, route, toast, canSee } = useStore();
  const section = getSection(group.section);
  const values = saved[group.key];
  const state = groupState(group, values);
  const m = meta[group.key];
  const changed = changedFromDefault(group, values).length;
  const entries = history[group.key] ?? [];
  const last = entries[0];
  const related = (RELATED[group.key]?.keys ?? []).map((k) => getGroup(k)).filter((g): g is SettingsGroup => !!g && canSee(g.key));
  const overlap = RELATED[group.key]?.overlap;
  const { resetFields } = useStore();
  const [about, setAbout] = useState(false);
  const fold = about ? '' : 'hidden md:block';

  return (
    <header className="grid gap-5">
      <nav aria-label={t.meta.crumbRoot} className="flex flex-wrap items-center gap-1 text-13 font-semibold text-muted-foreground">
        <button type="button" onClick={() => go({ view: 'overview' })} className="min-h-11 rounded-lg px-1.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8">
          {t.meta.crumbRoot}
        </button>
        <ChevronRight className="size-4 opacity-60 rtl:rotate-180" aria-hidden />
        <span className="px-1.5">{section?.title[locale]}</span>
        <ChevronRight className="size-4 opacity-60 rtl:rotate-180" aria-hidden />
        <span className="px-1.5 text-foreground" aria-current="page">
          {group.title[locale]}
        </span>
      </nav>

      <div className="flex flex-wrap items-start gap-4">
        <IconTile name={group.icon} section={group.section} size="lg" />
        <div className="min-w-0 flex-1 basis-72">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-26 font-extrabold leading-tight tracking-tight sm:text-32">{group.title[locale]}</h1>
            <StatePill state={state} />
            {!group.inDashboard ? <Pill tone="info">{t.pill.new}</Pill> : null}
            {group.permission ? <Pill tone="outline">{t.pill.ownerOnly}</Pill> : null}
            {mostlySecurity(group) ? (
              <Pill tone="outline" className="gap-1 [&_svg]:size-3.5">
                <ShieldCheck aria-hidden />
                {t.field.security}
              </Pill>
            ) : null}
          </div>
          <p id={`about-${group.key}`} className={cn('mt-2 max-w-[72ch] text-14 leading-relaxed text-muted-foreground', fold)}>{group.description[locale]}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-13">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-12 font-bold tabular-nums">v{num(locale, m.version)}</span>
              <span className="text-muted-foreground">{fill(t.group.lastChange, { who: who(t, m.updatedBy), when: relative(locale, m.updatedAt) })}</span>
            </span>
            {last?.note ? <span className={cn('text-muted-foreground', fold)}>«{last.note[locale]}»</span> : null}
            {group.kind === 'server' ? (
              <span className={cn('inline-flex flex-wrap items-center gap-1 text-muted-foreground', !about && 'hidden md:inline-flex')}>
                {changed ? (changed === 1 ? t.group.changedOne : fill(t.group.changedFromDefault, { n: num(locale, changed) })) : t.group.allDefault}
                {changed ? (
                  <button
                    type="button"
                    onClick={() => resetFields(group.key, changedFromDefault(group, values).filter((f) => !f.readOnly && !f.structured).map((f) => f.key))}
                    className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-semibold text-primary outline-none hover:bg-primary/8 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    {t.group.resetAll}
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            aria-expanded={about}
            onClick={() => setAbout((a) => !a)}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-13 font-semibold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:hidden"
          >
            <ChevronDown className={cn('size-4 transition-transform', about && 'rotate-180')} aria-hidden />
            {about ? t.about.hide : t.about.show}
          </button>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" onClick={() => go({ ...route, panel: 'history', field: undefined })}>
            <History />
            {entries.length ? fill(t.group.historyCount, { n: num(locale, entries.length) }) : t.group.history}
          </Btn>
          <Btn variant="ghost" size="icon" aria-label={t.group.copyLink} onClick={() => copyText(fieldLink(group.key), t, toast, t.toast.linkCopied)}>
            <Link2 />
          </Btn>
        </div>
      </div>

      {related.length || overlap || group.notes ? (
        <div className={cn('gap-3 rounded-2xl bg-muted/60 p-4 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6', about ? 'grid' : 'hidden')}>
          <div className="min-w-0">
            <p className="text-13 font-bold">{t.group.whereTitle}</p>
            {overlap ? <p className="mt-1 max-w-[80ch] text-13 leading-relaxed text-muted-foreground">{t.overlap[overlap]}</p> : null}
            {group.notes ? <p className="mt-1 max-w-[80ch] text-13 leading-relaxed text-muted-foreground">{group.notes[locale]}</p> : null}
          </div>
          {related.length ? (
            <ul aria-label={t.group.related} className="flex flex-wrap gap-2">
              {related.map((r) => (
                <li key={r.key}>
                  <button
                    type="button"
                    onClick={() => go({ view: 'group', group: r.key })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card py-1 pe-3 ps-1.5 text-13 font-semibold outline-none transition-colors hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-h-10"
                  >
                    <IconTile name={r.icon} section={r.section} size="sm" />
                    {r.title[locale]}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

// ─── Callouts ───────────────────────────────────────────────────────────────

function Callout({ tone, title, children, action }: { tone: 'warning' | 'info' | 'neutral'; title: string; children?: ReactNode; action?: ReactNode }) {
  const IconCmp = tone === 'warning' ? CircleAlert : tone === 'info' ? Sparkles : Info;
  return (
    <div role={tone === 'warning' ? 'status' : undefined} className="flex flex-wrap items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', tone === 'warning' ? 'bg-warning/18 text-warning-strong' : tone === 'info' ? 'bg-info/12 text-info-soft-foreground' : 'bg-muted text-foreground/70')}>
        <IconCmp className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-14 font-bold">{title}</p>
        {children ? <div className="mt-0.5 text-13 leading-relaxed text-muted-foreground">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

function Callouts({ group }: { group: SettingsGroup }) {
  const { t, locale, saved, pending, withdraw, go, route, viewer, needsApproval } = useStore();
  const rule = ATTENTION_RULES[group.key];
  const p = pending[group.key];
  const showAttention = group.attention && rule?.active(saved[group.key]) && group.key !== 'maintenance';
  return (
    <>
      {!group.inDashboard ? <Callout tone="info" title={t.group.newTitle}>{group.attention?.[locale] ?? t.group.newLead}</Callout> : null}
      {showAttention ? (
        <Callout
          tone="warning"
          title={t.pill.attention}
          action={
            <Btn variant="outline" size="sm" onClick={() => go({ ...route, view: 'group', group: group.key, field: rule.field, panel: null })}>
              {t.attention.fix}
            </Btn>
          }
        >
          {group.attention![locale]}
        </Callout>
      ) : null}
      {p ? (
        <Callout
          tone="info"
          title={t.group.pendingTitle}
          action={
            <Btn variant="ghost" size="sm" onClick={() => withdraw(group.key)}>
              {t.group.pendingWithdraw}
            </Btn>
          }
        >
          {fill(t.group.pendingLead, { who: who(t, p.by), n: num(locale, p.changes.length), when: relative(locale, p.at) })}
        </Callout>
      ) : null}
      {group.approval === 'second-approver' ? (
        <p className="inline-flex items-center gap-2 text-13 text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          {viewer === 'owner' && !needsApproval(group) ? t.group.viewerOwner : t.group.viewerAdmin}
        </p>
      ) : null}
    </>
  );
}

// ─── Standard body: anchors + subsections ──────────────────────────────────

function StandardBody({ group }: { group: SettingsGroup }) {
  const { t, locale, drafts, valueOf } = useStore();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(group.subsections[0]?.id);
  const container = useRef<HTMLDivElement>(null);
  const draft = drafts[group.key] ?? {};
  const multi = group.subsections.length > 1;

  // Scroll-spy: the subsection whose top crossed the upper fifth of the viewport.
  useEffect(() => {
    const nodes = Array.from(container.current?.querySelectorAll<HTMLElement>('section[data-sub]') ?? []);
    if (!nodes.length) return;
    const visible = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set((e.target as HTMLElement).dataset.sub!, e.isIntersecting);
        const first = nodes.find((n) => visible.get(n.dataset.sub!));
        if (first) setActive(first.dataset.sub!);
      },
      { rootMargin: '-18% 0px -62% 0px' },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [group.key]);

  const highlight = useFocusField(group.key);

  const jump = (id: string) => {
    setActive(id);
    document.getElementById(`sub-${group.key}-${id}`)?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  };

  const subState = (sub: Subsection) => {
    const edits = sub.fields.filter((f) => f.key in draft).length;
    const errors = sub.fields.filter((f) => validate(f, valueOf(group.key, f.key), t, locale)).length;
    return { edits, errors };
  };

  return (
    <div className={cn('grid grid-cols-1 gap-6', multi && 'lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]')}>
      {multi ? (
        <nav aria-label={t.group.contents} className="sticky top-0 z-20 min-w-0 -mx-4 bg-background/95 px-4 py-2 backdrop-blur lg:top-6 lg:mx-0 lg:self-start lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <p className="mb-2 hidden text-12 font-bold text-muted-foreground lg:block">{t.group.contents}</p>
          <LayoutGroup id={`anchors-${group.key}`}>
            <ol className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] lg:grid lg:gap-0.5 lg:overflow-visible lg:pb-0">
              {group.subsections.map((sub) => {
                const on = sub.id === active;
                const { edits, errors } = subState(sub);
                return (
                  <li key={sub.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => jump(sub.id)}
                      aria-current={on ? 'location' : undefined}
                      className={cn(
                        'relative flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-start text-13 font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:min-h-10',
                        on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {on ? (
                        <motion.span
                          layoutId="anchor-pill"
                          className="absolute inset-0 rounded-xl bg-card shadow-sm ring-1 ring-border lg:bg-muted lg:shadow-none lg:ring-0"
                          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }}
                        />
                      ) : null}
                      <span className="relative min-w-0 flex-1 whitespace-nowrap lg:whitespace-normal">{sub.title[locale]}</span>
                      {errors ? <span aria-label={t.field.error} className="relative size-2 shrink-0 rounded-full bg-destructive" /> : edits ? <span className="relative shrink-0 rounded-full bg-primary/5 px-1.5 text-11 font-bold text-primary">{num(locale, edits)}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ol>
          </LayoutGroup>
        </nav>
      ) : null}
      <div ref={container} className="grid min-w-0 gap-5">
        {group.subsections.map((sub) => (
          <SubsectionCard key={sub.id} group={group} sub={sub} highlight={highlight} />
        ))}
      </div>
    </div>
  );
}

function SubsectionCard({ group, sub, highlight }: { group: SettingsGroup; sub: Subsection; highlight: { key: string; nonce: number } | null }) {
  const { t, locale, valueOf, resetFields, drafts } = useStore();
  const normal = sub.fields.filter((f) => !f.advanced);
  const advanced = sub.fields.filter((f) => f.advanced);
  const draft = drafts[group.key] ?? {};
  const wantsOpen = advanced.some((f) => f.key === highlight?.key || f.key in draft);
  const [open, setOpen] = useState(wantsOpen);
  useEffect(() => {
    if (wantsOpen) setOpen(true);
  }, [wantsOpen]);
  const notDefault = sub.fields.filter((f) => !f.readOnly && !f.structured && !same(valueOf(group.key, f.key), f.default));
  const panelId = `adv-${group.key}-${sub.id}`;
  const hidden = repeatedHelp(group, sub, locale);

  return (
    <section id={`sub-${group.key}-${sub.id}`} data-sub={sub.id} aria-labelledby={`h-${group.key}-${sub.id}`} className="scroll-mt-20 rounded-3xl border border-border bg-card lg:scroll-mt-6">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pb-2 pt-5 sm:px-5">
        <div className="min-w-0 flex-1 basis-60">
          <h2 id={`h-${group.key}-${sub.id}`} className="text-17 font-extrabold">
            {sub.title[locale]}
          </h2>
          <p className="mt-0.5 max-w-[68ch] text-13 leading-relaxed text-muted-foreground">{sub.description[locale]}</p>
        </div>
        {notDefault.length ? (
          <div className="flex items-center gap-1">
            <span className="text-12 font-semibold text-muted-foreground">{fill(t.group.sectionChanged, { n: num(locale, notDefault.length) })}</span>
            <Btn variant="quiet" size="sm" onClick={() => resetFields(group.key, notDefault.map((f) => f.key))}>
              <RotateCcw />
              {t.group.resetSection}
            </Btn>
          </div>
        ) : null}
      </header>
      <div className="divide-y divide-border/70">
        {normal.map((field) => (
          <FieldRow key={field.key} group={group} field={field} hideHelp={hidden.has(field.key)} highlight={highlight?.key === field.key ? highlight.nonce : 0} />
        ))}
      </div>
      {advanced.length ? (
        <div className={cn('px-2 pb-2', normal.length && 'border-t border-border/70')}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
            className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-start text-13 font-bold outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
            {fill(t.group.advanced, { n: num(locale, advanced.length) })}
            <span className="font-medium text-muted-foreground">· {t.group.advancedHint}</span>
          </button>
          <div id={panelId} hidden={!open} className="divide-y divide-border/70">
            {open ? advanced.map((field) => <FieldRow key={field.key} group={group} field={field} highlight={highlight?.key === field.key ? highlight.nonce : 0} />) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ─── Save bar ───────────────────────────────────────────────────────────────

function SaveBar({ group }: { group: SettingsGroup }) {
  const { t, locale, drafts, meta, discard, go, route, valueOf, toast, restoreFrom } = useStore();
  const reduce = useReducedMotion();
  const draft: Values = drafts[group.key] ?? {};
  const n = Object.keys(draft).length;
  const m = meta[group.key];
  const fields = useMemo(() => group.subsections.flatMap((s) => s.fields), [group]);
  const errors = fields.filter((f) => f.key in draft && validate(f, valueOf(group.key, f.key), t, locale));
  const restoring = restoreFrom[group.key];

  const review = () => {
    if (errors.length) {
      toast(t.save.errors);
      go({ ...route, field: errors[0].key, panel: null });
      return;
    }
    go({ ...route, panel: 'review', field: undefined });
  };

  return (
    <div className="sticky bottom-3 z-30 mt-2">
      <motion.div
        layout={!reduce}
        className={cn(
          'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur sm:px-5',
          n ? 'border-primary/30 bg-card/95' : 'border-border bg-card/90',
        )}
      >
        <div className="flex min-w-0 flex-1 basis-56 items-center gap-3" aria-live="polite">
          {n ? (
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/5 text-14 font-extrabold tabular-nums text-primary">{num(locale, n)}</span>
          ) : (
            <CircleCheck className="size-5 shrink-0 text-success" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="text-14 font-bold">
              {n ? (n === 1 ? t.save.dirtyOne : fill(t.save.dirty, { n: num(locale, n) })) : t.save.upToDate}
              {restoring ? <span className="ms-2 text-13 font-semibold text-muted-foreground">· {fill(t.review.titleRestore, { v: num(locale, restoring) })}</span> : null}
            </p>
            <p className={cn('truncate text-12', errors.length ? 'font-semibold text-destructive-soft-foreground' : 'text-muted-foreground')}>
              {errors.length ? t.save.errors : n ? count(locale, n, t.units.changes) : fill(t.save.upToDateLead, { v: num(locale, m.version), who: who(t, m.updatedBy), when: relative(locale, m.updatedAt) })}
            </p>
          </div>
        </div>
        {n ? (
          <div className="flex flex-1 basis-56 justify-end gap-2 sm:flex-none sm:basis-auto">
            <Btn
              variant="ghost"
              onClick={() => {
                discard(group.key);
                toast(t.save.discarded);
              }}
            >
              {t.save.discard}
            </Btn>
            <Btn variant="primary" onClick={review} className="flex-1 sm:flex-none">
              {t.save.review}
            </Btn>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}

