'use client';

/**
 * @file team.tsx
 * @description The team's week: totals against last week, activity per member and day, card flow per type. All of it from `GET /today`. A total no
 * source feeds yet says so rather than read 0, and there is no presence signal, so no online dot (docs/15 §3).
 */
import type { Role, TeamStats } from '@hub/contracts';
import { ArrowDown, ArrowUp, Equal, Users } from 'lucide-react';
import { type KeyboardEvent, useRef, useState } from 'react';

import {
  Avatar,
  CardChip,
  cn,
  dayOfMonth,
  firstName,
  fmt,
  kitMessages,
  type Locale,
  Ltr,
  matchAny,
  type Member,
  num,
  plural,
  rel,
  roleIcon,
  SectionHeader,
  shortDate,
  typeClass,
  TypeDot,
  useLocale,
  useMember,
  usePageWide,
  useT,
  weekday,
} from '@/components/kit';

import { NS, type TodayMessages } from './messages';

/** Heatmap ramp, 5 steps of one hue. Literal classes so Tailwind generates them. */
const heatClass = ['bg-(--heat-0)', 'bg-(--heat-1)', 'bg-(--heat-2)', 'bg-(--heat-3)', 'bg-(--heat-4)'];
const HEAT_BUCKETS = [
  { min: 0, max: 0 },
  { min: 1, max: 2 },
  { min: 3, max: 5 },
  { min: 6, max: 8 },
  { min: 9, max: Infinity },
];
const heatLevel = (v: number) => HEAT_BUCKETS.findIndex((b) => v >= b.min && v <= b.max);

/** A local date as an instant inside that day. */
const noon = (date: string) => `${date}T12:00:00+03:00`;

// ── Weekly totals ──────────────────────────────────────────────────────────────────────────────

function Totals({ totals }: { totals: TeamStats['totals'] }) {
  const t = useT<TodayMessages>(NS);
  const locale = useLocale();
  return (
    <ul className="grid auto-rows-fr grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border lg:@page-lg:grid-cols-6">
      {totals.map((m) => {
        const delta = m.value - m.prev;
        const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Equal;
        const words =
          delta > 0
            ? fmt(t.team.up, { n: num(delta, locale) })
            : delta < 0
              ? fmt(t.team.down, { n: num(-delta, locale) })
              : t.team.same;
        return (
          <li key={m.key} className="flex min-w-0 flex-col gap-0.5 bg-card px-3 py-2.5">
            <span className="truncate text-body-sm text-muted-foreground">{t.team.totals[m.key]}</span>
            <span className="text-title font-bold text-foreground tabular-nums">
              <Ltr>{m.available ? num(m.value, locale) : '–'}</Ltr>
            </span>
            {m.available ? (
              <span className="flex flex-wrap items-center gap-x-1 text-caption text-muted-foreground">
                <Icon aria-hidden className="size-3.5 text-foreground" strokeWidth={2} />
                <span className="font-medium text-foreground">{words}</span>
              </span>
            ) : (
              <span className="text-caption text-muted-foreground">{t.team.noSource}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Activity heatmap: members × days, one hue ramp, roving keyboard focus ───────────────────────

function Legend() {
  const t = useT<TodayMessages>(NS);
  return (
    <div className="flex items-center gap-2 text-caption text-muted-foreground">
      <span>{t.team.fewer}</span>
      <ol className="flex items-start gap-1">
        {HEAT_BUCKETS.map((b, i) => (
          <li key={i} className="flex flex-col items-center gap-0.5">
            <span
              aria-hidden
              className={cn('size-4 rounded-xs ring-1 ring-border ring-inset', heatClass[i])}
            />
            <Ltr className="tabular-nums">
              {b.max === Infinity ? `${b.min}+` : b.min === b.max ? b.min : `${b.min}–${b.max}`}
            </Ltr>
          </li>
        ))}
      </ol>
      <span>{t.team.more}</span>
    </div>
  );
}

type TeamMember = TeamStats['members'][number];

function Identity({ stats }: { stats: TeamMember }) {
  const t = useT<TodayMessages>(NS);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const wide = usePageWide(768);
  const known = useMember(stats.userId);
  const member: Member = known ?? {
    id: stats.userId,
    name: stats.displayName,
    avatarColor: 1,
    roles: stats.roles as Role[],
  };
  const name = stats.displayName;
  const roles = stats.roles as Role[];
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar member={member} size="md" />
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1.5 text-body-sm font-medium text-foreground">
          {/* Phone: first names fit beside 7 day cells, so no name is cut (review, minor). */}
          <span className="truncate" title={name}>
            {wide ? name : firstName(name)}
          </span>
          <span className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
            {roles.map((r) => {
              const Icon = roleIcon[r];
              return <Icon key={r} aria-hidden className="size-3" strokeWidth={1.75} />;
            })}
          </span>
          <span className="sr-only">
            {roles.map((r) => kit.roles[r]).join(', ')}
            {stats.lastActiveAt ? `, ${fmt(t.team.lastSeen, { rel: rel(stats.lastActiveAt, locale) })}` : ''}
          </span>
        </p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-body-sm text-muted-foreground">
          {stats.focus ? (
            <>
              <span className="hidden shrink-0 xl:inline">{t.team.focus}</span>
              <CardChip
                k={stats.focus.key}
                type={stats.focus.type}
                title={stats.focus.title}
                showTitle={wide}
                className="min-w-0"
              />
            </>
          ) : (
            <span className="truncate">{t.team.noFocus}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Heatmap({ team }: { team: TeamStats }) {
  const t = useT<TodayMessages>(NS);
  const locale = useLocale();
  const wide = usePageWide(768);
  const days = team.days.slice(wide ? -14 : -7).map(noon);
  const span = days.length;
  const rows = [...team.members].sort((a, b) => a.displayName.localeCompare(b.displayName, locale));

  const [picked, setActive] = useState<[number, number] | null>(null);
  // Default and clamp the roving cell: the column count changes between phone (7) and wider (14).
  const active: [number, number] = picked
    ? [Math.min(picked[0], rows.length - 1), Math.min(picked[1], span - 1)]
    : [0, span - 1];
  const [shown, setShown] = useState<[number, number] | null>(null);
  const cells = useRef(new Map<string, HTMLTableCellElement>());
  const dir = locale === 'ar' ? -1 : 1;

  const valueAt = (r: number, c: number) => rows[r]?.activity.slice(-span)[c] ?? 0;
  const describe = (r: number, c: number) => {
    const day = days[c] ?? '';
    return plural(valueAt(r, c), locale, t.team.cell)
      .replace('{name}', rows[r]?.displayName ?? '')
      .replace('{date}', `${weekday(day, locale)} ${shortDate(day, locale)}`);
  };

  const move = (r: number, c: number) => {
    const nr = Math.max(0, Math.min(rows.length - 1, r));
    const nc = Math.max(0, Math.min(span - 1, c));
    setActive([nr, nc]);
    setShown([nr, nc]);
    cells.current.get(`${nr}-${nc}`)?.focus();
  };

  const onKey = (e: KeyboardEvent, r: number, c: number) => {
    const map: Record<string, () => void> = {
      ArrowRight: () => move(r, c + dir),
      ArrowLeft: () => move(r, c - dir),
      ArrowDown: () => move(r + 1, c),
      ArrowUp: () => move(r - 1, c),
      Home: () => move(r, 0),
      End: () => move(r, span - 1),
    };
    const key = matchAny(e, Object.keys(map));
    if (key) {
      e.preventDefault();
      map[key]?.();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="heat-title" className="text-body font-semibold text-foreground">
            {wide ? t.team.activity : t.team.activityShort}
          </h3>
          <p id="heat-hint" className="mt-0.5 text-body-sm text-muted-foreground">
            {t.team.activityHint}
          </p>
        </div>
        <Legend />
      </div>
      <table
        role="grid"
        aria-labelledby="heat-title"
        aria-describedby="heat-hint"
        className="w-full border-separate border-spacing-x-0.5 border-spacing-y-1.5 md:border-spacing-x-1"
        onMouseLeave={() => setShown(null)}
      >
        <thead>
          <tr>
            <th scope="col" className="w-full pe-2 text-start text-caption font-normal">
              <span className="sr-only">{t.team.member}</span>
            </th>
            {days.map((d, i) => (
              <th
                key={d}
                scope="col"
                className={cn(
                  'p-0 text-center text-caption font-normal text-muted-foreground tabular-nums',
                  i === span - 1 && 'font-semibold text-foreground',
                )}
              >
                <span className="sr-only">{`${weekday(d, locale, 'long')} ${shortDate(d, locale)}`}</span>
                <span aria-hidden>{i === span - 1 ? t.team.today : <Ltr>{dayOfMonth(d)}</Ltr>}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={row.userId}>
              <th scope="row" className="max-w-0 pe-2 text-start font-normal">
                <Identity stats={row} />
              </th>
              {days.map((d, c) => {
                const v = valueAt(r, c);
                const on = active[0] === r && active[1] === c;
                return (
                  <td
                    key={d}
                    role="gridcell"
                    ref={(el) => {
                      if (el) cells.current.set(`${r}-${c}`, el);
                    }}
                    tabIndex={on ? 0 : -1}
                    aria-label={describe(r, c)}
                    title={describe(r, c)}
                    onKeyDown={(e) => onKey(e, r, c)}
                    onFocus={() => {
                      setActive([r, c]);
                      setShown([r, c]);
                    }}
                    onMouseEnter={() => setShown([r, c])}
                    className="rounded-xs p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mx-auto block size-5 rounded-xs ring-1 ring-border/60 ring-inset md:size-6',
                        heatClass[heatLevel(v)],
                        c === span - 1 && 'ring-(--heat-ring)/40',
                      )}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {/* A plain readout: the focused cell's aria-label already speaks, so this is not a live region (review, minor). */}
      <p className="min-h-5 text-body-sm text-muted-foreground">
        {shown ? (
          <span className="font-medium text-foreground">{describe(shown[0], shown[1])}</span>
        ) : (
          t.team.readoutIdle
        )}
      </p>
    </div>
  );
}

// ── Card flow by type: created vs closed, paired bars in type colours with numbers ─────────────

function netWords(t: TodayMessages, net: number, locale: Locale) {
  return net > 0
    ? fmt(t.team.netMore, { n: num(net, locale) })
    : net < 0
      ? fmt(t.team.netFewer, { n: num(-net, locale) })
      : t.team.netEven;
}

function Flow({ flow }: { flow: TeamStats['flow'] }) {
  const t = useT<TodayMessages>(NS);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const max = Math.max(1, ...flow.flatMap((f) => [f.created, f.closed]));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-body font-semibold text-foreground">{t.team.flow}</h3>
          <p className="mt-0.5 text-body-sm text-muted-foreground">{t.team.flowHint}</p>
        </div>
        <div aria-hidden className="flex items-center gap-3 text-caption text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-muted-foreground" />
            {t.team.created}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full border border-muted-foreground" />
            {t.team.closed}
          </span>
        </div>
      </div>
      {flow.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">{t.team.flowEmpty}</p>
      ) : (
        <ul className="grid gap-3 md:@page-md:grid-cols-2 md:gap-x-8 lg:@page-lg:grid-cols-1">
          {flow.map((f) => (
            <li key={f.type} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3">
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-body-sm font-medium text-foreground">
                  <TypeDot type={f.type} />
                  {kit.types[f.type]}
                </span>
                <span className="block ps-3.5 text-caption text-muted-foreground">
                  {netWords(t, f.created - f.closed, locale)}
                </span>
              </span>
              <span className="flex flex-col gap-1">
                {(
                  [
                    ['created', f.created],
                    ['closed', f.closed],
                  ] as const
                ).map(([kind, v]) => (
                  <span key={kind} className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-2 min-w-1 rounded-full',
                        kind === 'created'
                          ? typeClass[f.type].dot
                          : cn('border', typeClass[f.type].edge, typeClass[f.type].soft),
                      )}
                      style={{ width: `${(v / max) * 84}%` }}
                    />
                    <span className="text-caption text-muted-foreground tabular-nums">
                      <Ltr>{num(v, locale)}</Ltr>
                      <span className="sr-only"> {kind === 'created' ? t.team.created : t.team.closed}</span>
                    </span>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TeamWeek({ team }: { team: TeamStats }) {
  const t = useT<TodayMessages>(NS);
  const locale = useLocale();
  return (
    <section aria-labelledby="team-title" className="flex flex-col gap-4">
      <SectionHeader
        id="team-title"
        icon={Users}
        title={t.team.title}
        aside={
          <span className="text-body-sm text-muted-foreground">
            {fmt(t.team.week, {
              from: shortDate(noon(team.week.from), locale),
              to: shortDate(noon(team.week.to), locale),
            })}
          </span>
        }
      />
      <Totals totals={team.totals} />
      <div className="grid gap-4 lg:@page-lg:grid-cols-12">
        <div className="min-w-0 rounded-lg border border-border bg-card p-4 lg:@page-lg:col-span-8">
          <Heatmap team={team} />
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-card p-4 lg:@page-lg:col-span-4">
          <Flow flow={team.flow} />
        </div>
      </div>
    </section>
  );
}
