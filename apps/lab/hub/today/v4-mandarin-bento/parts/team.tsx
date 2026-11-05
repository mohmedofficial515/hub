import { useRef, useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Equal } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { NOW, members, type Member, type Today } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { CardKey, fmt, HubLink, Ltr, Monogram, Tile, TileHead } from './atoms';
import { dayOfMonth, firstName, num, plural, rel, shortDate, weekday } from './format';
import { useMedia } from './hooks';
import { HEAT_BUCKETS, heatClass, heatLevel, roleIcon } from './type-meta';

type Team = Today['team'];
const DAY = 24 * 3_600_000;

// ── Weekly totals: the number is the hero, the delta is a word and never judged by colour ─────

function Totals({ totals }: { totals: Team['totals'] }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-b-(--t-line) pb-4 sm:grid-cols-3 lg:grid-cols-6 md:pb-5">
      {totals.map((m) => {
        const delta = m.value - m.prev;
        const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Equal;
        const words = delta > 0 ? fmt(t.team.up, { n: num(delta, locale) }) : delta < 0 ? fmt(t.team.down, { n: num(-delta, locale) }) : t.team.same;
        return (
          <li key={m.key} className="flex min-w-0 flex-col">
            <span className="text-body-sm text-(--t-muted)">{m.label[locale]}</span>
            <span className="text-display font-extrabold tabular-nums">
              <Ltr>{num(m.value, locale)}</Ltr>
            </span>
            <span className="flex items-start gap-1 text-body-sm">
              <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.25} />
              <span className="font-medium">
                {words}
                {delta !== 0 && <span className="font-normal text-(--t-muted)"> {fmt(t.team.lastWeek, { n: num(m.prev, locale) })}</span>}
              </span>
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
    <div className="flex items-center gap-2 text-caption text-(--t-muted)">
      <span>{t.team.fewer}</span>
      <ol className="flex items-start gap-1">
        {HEAT_BUCKETS.map((b, i) => (
          <li key={i} className="flex flex-col items-center gap-0.5">
            <span aria-hidden className={cn('size-4 rounded-xs ring-1 ring-(--t-line) ring-inset', heatClass[i])} />
            <Ltr className="tabular-nums">{b.max === Infinity ? `${b.min}+` : b.min === b.max ? b.min : `${b.min}–${b.max}`}</Ltr>
          </li>
        ))}
      </ol>
      <span>{t.team.more}</span>
    </div>
  );
}

function Identity({ member, focus }: { member: Member; focus: { key: string; title: string } | null }) {
  const t = useT(messages);
  const locale = useLocale();
  const wide = useMedia('(min-width: 640px)');
  const name = member.name[locale];
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Monogram member={member} size="md" />
      <div className="min-w-0">
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-body-sm font-bold">
          {/* A phone shows the first name, so nobody is cut to "Yousef Alq…". */}
          <span>{wide ? name : firstName(name)}</span>
          <span className="hidden shrink-0 items-center gap-0.5 text-(--t-muted) sm:flex">
            {member.roles.map((r) => {
              const Icon = roleIcon[r];
              return <Icon key={r} aria-hidden className="size-3" strokeWidth={1.75} />;
            })}
          </span>
          {member.online ? (
            <span className="inline-flex items-center gap-1 text-caption font-normal text-(--t-muted)">
              <span aria-hidden className="size-1.5 rounded-full bg-(--t-fg)" />
              <span className="hidden sm:inline">{t.team.online}</span>
              <span className="sr-only sm:hidden">{t.team.online}</span>
            </span>
          ) : (
            <span className="sr-only">{fmt(t.team.lastSeen, { rel: rel(member.lastActiveAt, locale) })}</span>
          )}
          <span className="sr-only">{member.roles.map((r) => t.roles[r]).join(', ')}</span>
        </p>
        <div className="flex min-w-0 items-center gap-1.5 text-caption text-(--t-muted)">
          {focus ? (
            <HubLink
              to={`/cards/${focus.key}`}
              title={focus.title}
              className="relative flex min-w-0 items-center gap-1.5 underline-offset-2 after:absolute after:-inset-y-3 after:inset-x-0 hover:underline md:after:hidden"
            >
              <CardKey k={focus.key} className="shrink-0 text-caption" />
              <span className="hidden truncate lg:inline">{focus.title}</span>
            </HubLink>
          ) : (
            <span>{t.team.noFocus}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Heatmap({ team, me, myFocus }: { team: Team; me: string; myFocus: { key: string; title: string } | null }) {
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
        <div className="min-w-0">
          <h3 id="heat-title" className="text-title-sm font-bold">
            {wide ? t.team.activity : t.team.activityShort}
          </h3>
          <p id="heat-hint" className="mt-0.5 text-body-sm text-(--t-muted)">
            {t.team.activityHint}
          </p>
        </div>
        <Legend />
      </div>
      <table
        role="grid"
        aria-labelledby="heat-title"
        aria-describedby="heat-hint"
        className="w-full border-separate border-spacing-x-0.5 border-spacing-y-1 md:border-spacing-x-1"
        onMouseLeave={() => setShown(null)}
      >
        <thead>
          <tr>
            <th scope="col" className="w-full pe-2 text-start text-caption font-normal">
              <span className="sr-only">{t.team.member}</span>
            </th>
            {days.map((d, i) => (
              <th key={d} scope="col" className={cn('p-0 text-center text-caption font-normal text-(--t-muted) tabular-nums', i === span - 1 && 'font-bold text-(--t-fg)')}>
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
                <th scope="row" className="max-w-0 py-1 pe-2 text-start font-normal">
                  <Identity member={row.member} focus={f} />
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
                      className="rounded-xs p-0 outline-none focus-visible:ring-2 focus-visible:ring-(--t-ring)"
                    >
                      <span aria-hidden className={cn('mx-auto block size-6 rounded-xs xl:size-7', heatClass[heatLevel(v)], v === 0 && 'ring-1 ring-(--t-line) ring-inset')} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* The focused cell's label is what a screen reader hears; this line is for the eye only (v2: it spoke twice). */}
      <p className="min-h-5 text-body-sm text-(--t-muted)">{shown ? <span className="font-semibold text-(--t-fg)">{describe(shown[0], shown[1])}</span> : t.team.readoutIdle}</p>
    </div>
  );
}

export function TeamWeek({
  team,
  me,
  myFocus,
  className,
}: {
  team: Team;
  me: string;
  myFocus: { key: string; title: string } | null;
  className?: string;
}) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <Tile tone="green" labelledBy="team-title" className={cn('flex flex-col gap-4 md:gap-5', className)}>
      <TileHead
        id="team-title"
        title={t.team.title}
        aside={
          <span className="text-body-sm text-(--t-muted)">
            {fmt(t.team.week, { from: shortDate(team.week.from + 'T12:00:00+03:00', locale), to: shortDate(team.week.to + 'T12:00:00+03:00', locale) })}
          </span>
        }
      />
      <Totals totals={team.totals} />
      <Heatmap team={team} me={me} myFocus={myFocus} />
    </Tile>
  );
}
