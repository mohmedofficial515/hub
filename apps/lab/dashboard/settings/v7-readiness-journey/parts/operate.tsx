// Operate mode: the day-to-day index. Eight sections, every group once with its state now (switch, attention,
// changed from default, draft), plus recent changes and the personal preferences entry.
import { useMemo, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Clock3, Palette, PencilLine, TriangleAlert } from 'lucide-react';
import { SETTINGS_SECTIONS, type SettingsGroup } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { canOpenGroup, findField, formatRelative, groupOf, L, sameValue, visibleGroupsOfSection } from './data';
import { useFmt, useNav } from './nav';
import { bySection, tally } from './readiness';
import { TODO_FILL } from './dial';
import { displayAuthor, draftCount, useSettings, YOU } from './store';
import { Card, Icon, IconTile, Pill } from './ui';

export function OperateIndex() {
  const { state, t, lang, checks, dispatch } = useSettings();
  const nav = useNav();
  const all = tally(checks);
  const sections = bySection(checks);
  const hidden = SETTINGS_SECTIONS.flatMap((s) => s.groupKeys).filter((k) => !canOpenGroup(k, state.role)).length;
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <section aria-labelledby="operate-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="operate-title" className="text-20 font-bold">
            {t.operate.title}
          </h2>
          <p className="mt-1 text-14 text-muted-foreground">{t.operate.hint}</p>
          {hidden ? <p className="mt-1 text-13 font-medium text-muted-foreground">{t.operate.hidden(hidden)}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'mode', mode: 'setup' })}
          className="inline-flex min-h-11 items-center gap-3 self-start rounded-xl border border-border bg-card px-3 text-13 font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:self-auto"
        >
          <span className="relative size-7" aria-hidden>
            <svg viewBox="0 0 28 28" className="size-7 -rotate-90">
              <circle cx="14" cy="14" r="11" className="fill-none stroke-muted" strokeWidth="4" />
              <circle cx="14" cy="14" r="11" className="fill-none stroke-success" strokeWidth="4" strokeDasharray={`${(all.pct / 100) * 69.1} 69.1`} />
            </svg>
          </span>
          {t.operate.readinessPill(all.pct, all.todo)}
          <Chevron className="size-4 text-muted-foreground" aria-hidden />
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] [&>*]:min-w-0">
        <RecentChanges />
        <button
          type="button"
          onClick={nav.preferences}
          className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-start transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-background text-primary dark:text-[color:var(--primary)]">
            <Palette className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-15 font-bold">{t.operate.personalise}</span>
            <span className="mt-0.5 block text-13 leading-relaxed text-muted-foreground">{t.operate.personaliseHint}</span>
          </span>
          <Chevron className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </div>

      <div className="mt-6 gap-4 md:columns-2 [&>*]:mb-4">
        {sections.map(({ id, tally: s }) => {
          const section = SETTINGS_SECTIONS.find((x) => x.id === id)!;
          const groups = visibleGroupsOfSection(id, state.role);
          return (
            <Card key={id} className="break-inside-avoid overflow-hidden">
              <header className="flex items-center gap-3 px-4 pt-4 pb-3">
                <IconTile name={section.icon} size="sm" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-16 font-bold leading-snug">{L(section.title, lang)}</h3>
                  <p className="text-12 text-muted-foreground">{t.operate.groups(groups.length)}</p>
                </div>
                <div className="flex w-24 shrink-0 flex-col items-end gap-1" aria-label={t.readiness.sectionAria(L(section.title, lang), s.done, s.todo, s.blocked)}>
                  <span className="text-12 font-semibold text-muted-foreground tabular-nums" dir="ltr">
                    {s.done}/{s.own}
                  </span>
                  <span className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    {s.done ? <span className="h-full rounded-full bg-success" style={{ width: `${(s.done / s.own) * 100}%` }} /> : null}
                    {s.todo ? <span className="h-full rounded-full" style={{ ...TODO_FILL, width: `${(s.todo / s.own) * 100}%` }} /> : null}
                  </span>
                </div>
              </header>
              <ul className="border-t border-border">
                {groups.map((g) => (
                  <GroupRow key={g.key} group={g} />
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function GroupRow({ group }: { group: SettingsGroup }) {
  const { state, t, lang, checks } = useSettings();
  const nav = useNav();
  const saved = state.saved[group.key] ?? {};
  const meta = state.meta[group.key];
  const drafts = draftCount(state, group.key);
  const open = checks.filter((c) => c.group === group.key && c.status === 'todo').length;
  const changed = useMemo(
    () => group.subsections.flatMap((s) => s.fields).filter((f) => !f.readOnly && !sameValue(saved[f.key], f.default)).length,
    [group, saved],
  );
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight;

  let status: ReactNode;
  if (group.key === 'payment_gateways') {
    const withKeys = group.subsections.filter((s) => saved[`${s.fields[0].key.split('.')[0]}.source`] !== 'none').length;
    status = `${withKeys}/${group.subsections.length} ${t.gateways.source}`;
  } else if (group.key === 'whatsapp_provider') {
    const f = findField(group.key, 'status')?.field;
    status = f?.options?.find((o) => o.value === saved.status)?.label[lang];
  } else if (group.masterSwitch) {
    const on = saved[group.masterSwitch] === true;
    status = (
      <>
        <span className={cn('font-semibold', on ? 'text-success-soft-foreground' : 'text-muted-foreground')}>{on ? t.operate.on : t.operate.off}</span>
        <span className="mx-1.5 text-border" aria-hidden>
          |
        </span>
        {t.operate.changed(changed)}
      </>
    );
  } else {
    status = t.operate.changed(changed);
  }

  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => nav.group(group.key)}
        className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        <span className="text-muted-foreground [&_svg]:size-[18px]">
          <Icon name={group.icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-14 font-semibold">{L(group.title, lang)}</span>
            {!group.inDashboard ? <Pill tone="violet">{t.badge.new}</Pill> : null}
            {group.key === 'payment_gateways' ? <Pill>{t.badge.ownerOnly}</Pill> : null}
            {open ? (
              <Pill tone="warning" icon={<TriangleAlert />}>
                {t.badge.attention}
              </Pill>
            ) : null}
          </span>
          <span className="mt-0.5 block text-12 text-muted-foreground">
            {drafts ? (
              <span className="inline-flex items-center gap-1 font-semibold text-info-soft-foreground">
                <PencilLine className="size-3" aria-hidden />
                {t.operate.draft(drafts)}
              </span>
            ) : (
              status
            )}
          </span>
        </span>
        <span className="hidden shrink-0 text-end text-12 text-muted-foreground sm:block">
          <span className="block font-semibold text-foreground">{t.group.version(meta.version)}</span>
          <span>{formatRelative(meta.updatedAt, lang)}</span>
        </span>
        <Chevron className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}

function RecentChanges() {
  const { state, t, lang } = useSettings();
  const nav = useNav();
  const fmt = useFmt();
  const items = useMemo(
    () =>
      Object.entries(state.history)
        .flatMap(([group, entries]) => entries.flatMap((e) => e.changes.slice(0, 1).map((c) => ({ group, e, c }))))
        .filter(({ group }) => canOpenGroup(group, state.role))
        .sort((a, b) => b.e.at.localeCompare(a.e.at))
        .slice(0, 4),
    [state.history, state.role],
  );
  return (
    <Card className="p-4">
      <h3 className="flex items-center gap-2 text-15 font-bold">
        <Clock3 className="size-4 text-muted-foreground" aria-hidden />
        {t.operate.recent}
      </h3>
      {items.length ? (
        <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2 [&>*]:min-w-0">
          {items.map(({ group, e, c }) => {
            const hit = findField(group, c.field);
            return (
              <li key={`${group}-${e.version}`}>
                <button
                  type="button"
                  onClick={() => nav.group(group, c.field)}
                  className="block min-h-11 w-full rounded-lg px-2 py-2 text-start hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="block truncate text-13 font-semibold">
                    {hit ? L(hit.field.label, lang) : c.field}
                    {hit ? (
                      <span className="font-normal text-muted-foreground">
                        {': '}
                        <bdi>{fmt(hit.field, c.to)}</bdi>
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-12 text-muted-foreground">
                    {[L(groupOf(group)?.title, lang), e.by === YOU ? t.history.you : displayAuthor(e.by, t), formatRelative(e.at, lang)].join(lang === 'ar' ? '، ' : ', ')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-13 text-muted-foreground">{t.operate.recentEmpty}</p>
      )}
    </Card>
  );
}
