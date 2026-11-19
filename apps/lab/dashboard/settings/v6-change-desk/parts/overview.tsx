// Overview: the draft ticket and the latest applied changes on top; the 8 sections as a compact index with state per group.
import { useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, History, Lock, Ticket, TriangleAlert } from 'lucide-react';
import { cn } from '@dash/lib/utils';
import { groupsOfSection, SETTINGS_GROUPS, SETTINGS_SECTIONS, type SettingsGroup } from '@lab/mocks/settings';
import { allEntries, canonicalId, FIELD_INDEX } from './data';
import { formatDateLong, num, relative, sameValue } from './format';
import { HIDDEN_FOR_STAFF } from './search';
import { ticketStats, useDesk, useStaged } from './store';
import { Avatar, Badge, Btn, Card, Dot, focusRing, Icon, IconTile } from './ui';

export function Overview() {
  return (
    <div className="grid gap-6">
      <DeskStrip />
      <SectionIndex />
    </div>
  );
}

/** One slim strip: the ticket state, the last applied change and a date for the as-of view. Settings come right after. */
function DeskStrip() {
  const { t, l, role, ticketCode, go, setTrayOpen, session, scenario } = useDesk();
  const { items } = useStaged();
  const stats = ticketStats(items, role);
  const count = items.length;
  const last = allEntries(session, scenario !== 'empty')[0];
  const lastGroup = last ? SETTINGS_GROUPS.find((x) => x.key === last.groupKey) : undefined;
  const [d, setD] = useState('2026-10-03');
  return (
    <Card className="grid gap-0 overflow-hidden lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)]" aria-label={t.ticket.trayLabel}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-xl', count ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
          <Ticket aria-hidden className="size-5" />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="flex flex-wrap items-baseline gap-x-2 text-14 font-bold">
            <bdi dir="ltr" className="tracking-wide tabular-nums">
              {ticketCode}
            </bdi>
            <span className="font-semibold text-muted-foreground">{count ? t.ticket.summary(count, stats.groups) : t.ticket.emptyTitle}</span>
          </p>
          {count === 0 ? (
            <p className="text-13 leading-relaxed text-muted-foreground">{t.overview.noDraft}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {stats.high > 0 && <Badge tone="danger">{t.ticket.highRisk(stats.high)}</Badge>}
              {stats.security > 0 && <Badge tone="neutral">{t.ticket.security(stats.security)}</Badge>}
              {stats.waitGroups > 0 && <Badge tone="info">{t.ticket.waits(stats.waitGroups)}</Badge>}
            </div>
          )}
        </div>
        {count > 0 && (
          <div className="flex flex-wrap gap-2">
            <Btn variant="outline" onClick={() => setTrayOpen(true)}>
              {t.ticket.open}
            </Btn>
            <Btn variant="primary" onClick={() => go({ v: 'review' })}>
              {t.ticket.review}
            </Btn>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 border-t p-4 lg:border-s lg:border-t-0">
        {last && lastGroup ? (
          <>
            <Avatar name={last.by} />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="text-12 font-semibold text-muted-foreground">{t.overview.lastChange}</span>
              <span className="truncate text-13 font-bold">
                {lastGroup.title[l]} <span className="font-normal text-muted-foreground tabular-nums">· v{last.version}</span>
              </span>
              <span className="truncate text-12 text-muted-foreground">
                <bdi>{last.by}</bdi> · {relative(last.at, l)}
              </span>
            </div>
            <Btn variant="ghost" onClick={() => go({ v: 'timeline' })}>
              <History aria-hidden />
              {t.nav.timeline}
            </Btn>
          </>
        ) : (
          <p className="text-13 text-muted-foreground">{t.overview.latestEmpty}</p>
        )}
      </div>
      <div className="grid gap-1.5 border-t p-4 lg:border-s lg:border-t-0">
        <label htmlFor="asof-quick" className="flex items-center gap-1.5 text-12 font-semibold text-muted-foreground">
          <CalendarClock aria-hidden className="size-4 text-[color:var(--primary)]" />
          {t.overview.asofShort}: <span className="text-foreground">{formatDateLong(new Date(`${d}T12:00:00+03:00`), l)}</span>
        </label>
        <div className="flex gap-2">
          <input
            id="asof-quick"
            type="date"
            lang="en-GB"
            dir="ltr"
            value={d}
            min="2026-09-01"
            max="2026-11-18"
            onChange={(e) => e.target.value && setD(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-13 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-10"
          />
          <Btn variant="outline" onClick={() => go({ v: 'asof', d })}>
            {t.overview.show}
          </Btn>
        </div>
      </div>
    </Card>
  );
}

function SectionIndex() {
  const { t, l, role, draft } = useDesk();
  const visibleGroups = SETTINGS_GROUPS.filter((g) => !(role === 'staff' && HIDDEN_FOR_STAFF.has(g.key)));
  return (
    <section aria-labelledby="index-title" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 id="index-title" className="text-20 font-extrabold">
            {t.overview.indexTitle}
          </h2>
          <p className="text-13 text-muted-foreground">{t.overview.indexMeta(SETTINGS_SECTIONS.length, visibleGroups.length)}</p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-12 text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <Dot className="bg-[color:var(--primary)]" /> {t.overview.legend.changed}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Dot className="bg-warning" /> {t.overview.legend.staged}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <TriangleAlert aria-hidden className="size-3.5 text-warning-strong" /> {t.overview.legend.attention}
          </li>
        </ul>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {SETTINGS_SECTIONS.map((s) => {
          const groups = groupsOfSection(s.id);
          const shown = groups.filter((g) => !(role === 'staff' && HIDDEN_FOR_STAFF.has(g.key)));
          const hidden = groups.length - shown.length;
          const stagedInSection = Object.keys(draft).filter((id) => FIELD_INDEX.get(id)?.sectionId === s.id).length;
          return (
            <Card key={s.id} className="p-2" aria-labelledby={`sec-${s.id}`}>
              <div className="flex items-start gap-3 px-3 pb-2 pt-3">
                <IconTile name={s.icon} size="sm" />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <h3 id={`sec-${s.id}`} className="flex flex-wrap items-center gap-2 text-15 font-extrabold">
                    {s.title[l]}
                    {stagedInSection > 0 && <Badge tone="warning">{t.ticket.stagedCount(stagedInSection)}</Badge>}
                  </h3>
                  <p className="line-clamp-1 text-12 text-muted-foreground">{s.description[l]}</p>
                </div>
              </div>
              <ul className="grid">
                {shown.map((g) => (
                  <li key={g.key}>
                    <GroupRow group={g} />
                  </li>
                ))}
              </ul>
              {hidden > 0 && (
                <p className="flex items-center gap-2 px-3 py-2 text-12 text-muted-foreground">
                  <Lock aria-hidden className="size-3.5" />
                  {t.overview.hiddenByPermission(hidden)}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function GroupRow({ group: g }: { group: SettingsGroup }) {
  const { t, l, go, draft, versions, updated, get, values } = useDesk();
  const Chevron = t.dir === 'rtl' ? ChevronLeft : ChevronRight;
  const staged = Object.keys(draft).filter((id) => FIELD_INDEX.get(id)?.groupKey === g.key).length;
  const offDefault = g.kind === 'server' ? g.subsections.flatMap((x) => x.fields).filter((f) => !sameValue(values[`${g.key}.${f.key}`], f.default)).length : 0;
  const master = g.masterSwitch ? FIELD_INDEX.get(`${g.key}.${g.masterSwitch}`) : undefined;
  const masterOn = master ? get(canonicalId(master)) === true : undefined;
  const u = updated[g.key];
  return (
    <button
      type="button"
      onClick={() => go({ v: 'group', g: g.key })}
      className={cn('group flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-muted/70', focusRing)}
    >
      <Icon name={g.icon} className="size-4.5 shrink-0 text-[color:var(--primary)]" />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate text-14 font-bold">{g.title[l]}</span>
          {!g.inDashboard && <Badge tone="info">{t.group.newGroup}</Badge>}
          {g.kind === 'special' && g.key === 'payment_gateways' && <Badge tone="neutral" icon={<Lock aria-hidden />}>{t.special.ownerOnly}</Badge>}
        </span>
        <span className="truncate text-12 text-muted-foreground">
          {g.kind === 'special' ? (
            g.summary[l]
          ) : (
            <>
              <span className="tabular-nums">v{versions[g.key]}</span> · {u.by} · {relative(u.at, l)}
            </>
          )}
        </span>
        {g.attention && (
          <span className="flex min-w-0 items-center gap-1 text-12 text-warning-soft-foreground">
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
            <span className="sr-only">{t.overview.legend.attention}: </span>
            <span className="line-clamp-1">{g.attention[l]}</span>
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {masterOn !== undefined && <Badge tone={masterOn ? 'success' : 'neutral'}>{masterOn ? t.overview.on : t.overview.off}</Badge>}
        {offDefault > 0 && (
          <span className="hidden items-center gap-1 text-12 font-semibold text-muted-foreground sm:inline-flex" title={t.overview.legend.changed}>
            <Dot className="bg-[color:var(--primary)]" />
            <span className="tabular-nums">{num(offDefault, l)}</span>
            <span className="sr-only">{t.overview.changedFromDefault(offDefault)}</span>
          </span>
        )}
        {staged > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-12 font-bold tabular-nums text-warning-foreground" title={t.overview.legend.staged}>
            {num(staged, l)}
            <span className="sr-only"> {t.ticket.staged}</span>
          </span>
        )}
        <Chevron aria-hidden className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
      </span>
    </button>
  );
}
