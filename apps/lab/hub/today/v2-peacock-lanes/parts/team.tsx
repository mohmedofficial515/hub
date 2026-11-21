import { useRef, useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Equal, Users } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { NOW, members, type CardType, type Member, type Today } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Avatar, CardChip, fmt, Ltr, SectionHead, TypeDot } from './atoms';
import { dayOfMonth, num, plural, rel, shortDate, weekday } from './format';
import { useMedia } from './hooks';
import { HEAT_BUCKETS, heatClass, heatLevel, roleIcon, typeClass } from './type-meta';

type Team = Today['team'];
const DAY = 24 * 3_600_000;

// ── Weekly totals ──────────────────────────────────────────────────────────────────────────────

function Totals({ totals }: { totals: Team['totals'] }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <ul className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border xl:grid-cols-6">
      {totals.map((m) => {
        const delta = m.value - m.prev;
        const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Equal;
        const words = delta > 0 ? fmt(t.team.up, { n: num(delta, locale) }) : delta < 0 ? fmt(t.team.down, { n: num(-delta, locale) }) : t.team.same;
        return (
          <li key={m.key} className="flex min-w-0 flex-col gap-1 bg-card px-3 py-3 sm:px-4 sm:py-3.5">
            <span className="text-caption text-muted-foreground">{m.label[locale]}</span>
            <span className="text-display font-semibold text-foreground tabular-nums">
              <Ltr>{num(m.value, locale)}</Ltr>
            </span>
            <span className="flex flex-wrap items-center gap-x-1 text-caption text-muted-foreground">
              <Icon aria-hidden className="size-3.5 text-foreground" strokeWidth={2} />
              <span className="font-medium text-foreground">{words}</span>
              {delta !== 0 && <span className="hidden sm:inline">{fmt(t.team.lastWeek, { n: num(m.prev, locale) })}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Activity heatmap: members × days, one hue ramp, roving keyboard focus ───────────────────────

function Legend() {
  const t = useT(messages);
  return (
    <div className="flex items-center gap-2 text-caption text-muted-foreground">
      <span>{t.team.fewer}</span>
      <ol className="flex items-start gap-1">
        {HEAT_BUCKETS.map((b, i) => (
          <li key={i} className="flex flex-col items-center gap-0.5">
            <span aria-hidden className={cn('size-4 rounded-xs ring-1 ring-border ring-inset', heatClass[i])} />
            <Ltr className="tabular-nums">{b.max === Infinity ? `${b.min}+` : b.min === b.max ? b.min : `${b.min}–${b.max}`}</Ltr>
          </li>
        ))}
      </ol>
      <span>{t.team.more}</span>
    </div>
  );
}

function Identity({ member, focus }: { member: Member; focus: { key: string; title: string; type: CardType } | null }) {
  const t = useT(messages);
  const locale = useLocale();
  const wide = useMedia('(min-width: 640px)');
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar member={member} size="md" online={member.online} />
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1.5 text-body-sm font-medium text-foreground">
          <span className="truncate">{member.name[locale]}</span>
          <span className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
            {member.roles.map((r) => {
              const Icon = roleIcon[r];
              return <Icon key={r} aria-hidden className="size-3" strokeWidth={1.75} />;
            })}
          </span>
          <span className="sr-only">
            {member.roles.map((r) => t.roles[r]).join(', ')}
            {', '}
            {member.online ? t.team.online : fmt(t.team.lastSeen, { rel: rel(member.lastActiveAt, locale) })}
          </span>
        </p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
          {focus ? (
            <>
              <span className="hidden shrink-0 sm:inline">{t.team.focus}</span>
              <CardChip k={focus.key} type={focus.type} title={wide ? focus.title : undefined} className="min-w-0" />
            </>
          ) : (
            <span>{t.team.noFocus}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Heatmap({
  team,
  me,
  myFocus,
}: {
  team: Team;
  me: string;
  myFocus: { key: string; title: string } | null;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const wide = useMedia('(min-width: 768px)');
  const span = wide ? 14 : 7;
  const days = Array.from({ length: span }, (_, i) => new Date(Date.parse(NOW) - (span - 1 - i) * DAY).toISOString());
  const rows = [...team.members]
    .map((s) => ({ stats: s, member: members.find((m) => m.id === s.memberId)! }))
    .filter((r) => r.member)
    .sort((a, b) => a.member.name[locale].localeCompare(b.member.name[locale], locale));

  const [picked, setActive] = useState<[number, number] | null>(null);
  // Default and clamp the roving cell: the column count changes between phone (7) and wider (14).
  const active: [number, number] = picked ? [Math.min(picked[0], rows.length - 1), Math.min(picked[1], span - 1)] : [0, span - 1];
  const [shown, setShown] = useState<[number, number] | null>(null);
  const cells = useRef(new Map<string, HTMLTableCellElement>());
  const dir = locale === 'ar' ? -1 : 1;

  const valueAt = (r: number, c: number) => rows[r].stats.activity.slice(-span)[c] ?? 0;
  const describe = (r: number, c: number) =>
    plural(valueAt(r, c), locale, t.team.cell)
      .replace('{name}', rows[r].member.name[locale])
      .replace('{date}', `${weekday(days[c], locale)} ${shortDate(days[c], locale)}`);

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
    if (map[e.key]) {
      e.preventDefault();
      map[e.key]();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="heat-title" className="text-body font-semibold text-foreground">
            {wide ? t.team.activity : t.team.activityShort}
          </h3>
          <p id="heat-hint" className="mt-0.5 text-caption text-muted-foreground">
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
          {rows.map((row, r) => {
            const isMe = row.member.id === me;
            const f = isMe && myFocus ? myFocus : row.stats.focus ? { key: row.stats.focus.key, title: row.stats.focus.title[locale] } : null;
            return (
              <tr key={row.member.id}>
                <th scope="row" className="max-w-0 pe-2 text-start font-normal">
                  <Identity member={row.member} focus={f ? { ...f, type: 'task' } : null} />
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
            );
          })}
        </tbody>
      </table>
      <p aria-live="polite" className="min-h-5 text-caption text-muted-foreground">
        {shown ? <span className="font-medium text-foreground">{describe(shown[0], shown[1])}</span> : t.team.readoutIdle}
      </p>
    </div>
  );
}

// ── Card flow by type: created vs closed, paired bars in type colours with numbers ─────────────

function Flow({ flow }: { flow: Team['flow'] }) {
  const t = useT(messages);
  const locale = useLocale();
  const max = Math.max(...flow.flatMap((f) => [f.created, f.closed]));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-body font-semibold text-foreground">{t.team.flow}</h3>
          <p className="mt-0.5 text-caption text-muted-foreground">{t.team.flowHint}</p>
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
      <ul className="grid gap-3 md:grid-cols-2 md:gap-x-10 xl:grid-cols-1">
        {flow.map((f) => {
          const net = f.created - f.closed;
          const words = net > 0 ? fmt(t.team.netMore, { n: num(net, locale) }) : net < 0 ? fmt(t.team.netFewer, { n: num(-net, locale) }) : t.team.netEven;
          return (
            <li key={f.type} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3">
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-body-sm font-medium text-foreground">
                  <TypeDot type={f.type} />
                  {t.types[f.type]}
                </span>
                <span className="block ps-3.5 text-caption text-muted-foreground">{words}</span>
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
                        kind === 'created' ? typeClass[f.type].dot : cn('border', typeClass[f.type].stripe, typeClass[f.type].soft),
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
          );
        })}
      </ul>
    </div>
  );
}

export function TeamWeek({ team, me, myFocus }: { team: Team; me: string; myFocus: { key: string; title: string } | null }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <section aria-labelledby="team-title" className="flex flex-col gap-5">
      <SectionHead
        id="team-title"
        icon={Users}
        title={t.team.title}
        aside={
          <span className="text-caption text-muted-foreground">
            {fmt(t.team.week, { from: shortDate(team.week.from + 'T12:00:00+03:00', locale), to: shortDate(team.week.to + 'T12:00:00+03:00', locale) })}
          </span>
        }
      />
      <Totals totals={team.totals} />
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5 xl:col-span-8">
          <Heatmap team={team} me={me} myFocus={myFocus} />
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5 xl:col-span-4">
          <Flow flow={team.flow} />
        </div>
      </div>
    </section>
  );
}
