import { useRef, useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Equal } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { NOW, members, type Member, type Today } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Avatar, fmt, HubLink, Ltr, RailHead, TypeIcon } from './atoms';
import { firstName, num, plural, rel, shortDate, weekday } from './format';
import { useMedia } from './hooks';
import { HEAT_BUCKETS, heatClass, heatLevel } from './type-meta';

type Team = Today['team'];
const DAY = 24 * 3_600_000;
const NBSP = String.fromCharCode(160);

// ── Weekly totals: deltas in words, never coloured as good or bad ──────────────────────────────

function Totals({ totals }: { totals: Team['totals'] }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <ul className="grid grid-cols-3 gap-x-3 gap-y-4 xl:grid-cols-2">
      {totals.map((m) => {
        const delta = m.value - m.prev;
        const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Equal;
        const words = delta > 0 ? fmt(t.team.up, { n: num(delta, locale) }) : delta < 0 ? fmt(t.team.down, { n: num(-delta, locale) }) : t.team.same;
        return (
          <li key={m.key} className="min-w-0" title={fmt(t.team.lastWeek, { n: num(m.prev, locale) })}>
            <p className="reef-stat text-foreground">
              <Ltr>{num(m.value, locale)}</Ltr>
            </p>
            <p className="text-body-sm text-foreground">{m.label[locale]}</p>
            <p className="flex items-center gap-1 text-body-sm text-muted-foreground">
              <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
              <span>{words}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}

// ── Activity heatmap: members × days, one hue ramp, a single tab stop with arrow keys ──────────

function Legend() {
  const t = useT(messages);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
      <span>{t.team.legendLabel}</span>
      <ol className="flex items-start gap-1.5">
        {HEAT_BUCKETS.map((b, i) => (
          <li key={i} className="flex items-center gap-1">
            <span aria-hidden className={cn('size-3 rounded-xs ring-1 ring-border ring-inset', heatClass[i])} />
            <Ltr className="tabular-nums">{b.max === Infinity ? `${b.min}+` : b.min === b.max ? b.min : `${b.min}–${b.max}`}</Ltr>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Heatmap({ team, me, myFocus }: { team: Team; me: string; myFocus: { key: string; title: string } | null }) {
  const t = useT(messages);
  const locale = useLocale();
  const tablet = useMedia('(min-width: 768px)');
  const rail = useMedia('(min-width: 1280px)');
  const span = tablet ? 14 : 7;
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

  const cellSize = rail ? 'size-3.5' : tablet ? 'size-6' : 'size-7';
  return (
    <div className="flex flex-col gap-2">
      <div>
        <h3 id="heat-title" className="text-body font-semibold text-foreground">
          {tablet ? t.team.activity : t.team.activityShort}
        </h3>
        <p id="heat-hint" className="mt-0.5 text-body-sm text-muted-foreground">
          {t.team.activityHint}
        </p>
      </div>
      <table
        role="grid"
        aria-labelledby="heat-title"
        aria-describedby="heat-hint"
        className={cn('w-full border-separate', rail ? 'border-spacing-x-px border-spacing-y-1' : 'border-spacing-x-0.5 border-spacing-y-1.5')}
        onMouseLeave={() => setShown(null)}
      >
        <thead>
          <tr>
            <th scope="col" className="w-full pe-2 text-start font-normal">
              <span className="sr-only">{t.team.member}</span>
            </th>
            {/* Dates by the ends of the axis only: every cell states its own date to assistive tech and in its title. */}
            <th colSpan={span} scope="colgroup" className="p-0 font-normal">
              <span className="flex items-baseline justify-between gap-2 text-caption whitespace-nowrap text-muted-foreground">
                <span>{shortDate(days[0], locale)}</span>
                <span className="font-semibold text-foreground">{t.team.today}</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => {
            const isMe = row.member.id === me;
            const f = isMe && myFocus ? myFocus : row.stats.focus ? { key: row.stats.focus.key, title: row.stats.focus.title[locale] } : null;
            return (
              <tr key={row.member.id}>
                <th scope="row" className="max-w-0 pe-2 text-start font-normal">
                  <Identity member={row.member} focus={f} full={tablet && !rail} />
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
                      <span aria-hidden className={cn('mx-auto block rounded-xs ring-1 ring-border/70 ring-inset', cellSize, heatClass[heatLevel(v)])} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="min-h-5 text-body-sm text-muted-foreground">
        {shown ? <span className="font-medium text-foreground">{describe(shown[0], shown[1])}</span> : t.team.readoutIdle}
      </p>
      <Legend />
    </div>
  );
}

/** First name in tight spots so no name ever truncates; the full name stays for assistive tech. */
function Identity({ member, focus, full }: { member: Member; focus: { key: string; title: string } | null; full: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const name = member.name[locale];
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar member={member} online={member.online} />
      <div className="min-w-0">
        <p className="truncate text-body-sm font-medium text-foreground" title={name}>
          <span aria-hidden>{full ? name : firstName(name)}</span>
          <span className="sr-only">
            {name}, {member.roles.map((r) => t.roles[r]).join(', ')}, {member.online ? t.team.online : fmt(t.team.lastSeen, { rel: rel(member.lastActiveAt, locale) })}
          </span>
        </p>
        {focus ? (
          <p className="flex min-w-0 items-baseline gap-1.5 text-caption text-muted-foreground" title={`${t.team.focus}: ${focus.title}`}>
            <span className="sr-only">{t.team.focus}</span>
            <HubLink to={`/cards/${focus.key}`} className="relative underline-offset-2 after:absolute after:-inset-y-2 after:inset-x-0 hover:underline md:after:inset-0">
              <Ltr mono>{focus.key}</Ltr>
            </HubLink>
            {full && <span className="truncate">{focus.title}</span>}
          </p>
        ) : (
          <p className="truncate text-caption text-muted-foreground" title={t.team.noFocus}>
            <span className="sr-only">{t.team.noFocus}</span>
            {/* A no-break space keeps every row the same height when the words do not fit. */}
            <span aria-hidden>{full ? t.team.noFocus : NBSP}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ── Card flow by type: the coloured icon names the type, the bars stay ink ─────────────────────

function Flow({ flow }: { flow: Team['flow'] }) {
  const t = useT(messages);
  const locale = useLocale();
  const max = Math.max(...flow.flatMap((f) => [f.created, f.closed]));
  return (
    <section aria-labelledby="flow-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <RailHead id="flow-title" title={t.team.flow} />
        <div aria-hidden className="flex items-center gap-3 text-body-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-xs bg-foreground/70" />
            {t.team.created}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-xs border border-foreground/70" />
            {t.team.closed}
          </span>
        </div>
      </div>
      <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2 xl:grid-cols-1">
        {flow.map((f) => {
          const net = f.created - f.closed;
          const words = net > 0 ? fmt(t.team.netMore, { n: num(net, locale) }) : net < 0 ? fmt(t.team.netFewer, { n: num(-net, locale) }) : t.team.netEven;
          return (
            <li key={f.type} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5">
              <TypeIcon type={f.type} size="sm" className="mt-0.5" />
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-body-sm">
                  <span className="font-medium text-foreground">{t.types[f.type]}</span>
                  <span className="text-muted-foreground">{words}</span>
                </p>
                <div className="mt-1 flex flex-col gap-1">
                  {(
                    [
                      ['created', f.created],
                      ['closed', f.closed],
                    ] as const
                  ).map(([kind, v]) => (
                    <span key={kind} className="flex items-center gap-2">
                      <span
                        className={cn('h-1.5 min-w-1 rounded-e-xs', kind === 'created' ? 'bg-foreground/70' : 'border border-foreground/70')}
                        style={{ width: `${Math.max((v / max) * 86, 1)}%` }}
                      />
                      <span className="text-caption text-muted-foreground tabular-nums">
                        <Ltr>{num(v, locale)}</Ltr>
                        <span className="sr-only"> {kind === 'created' ? t.team.created : t.team.closed}</span>
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function TeamWeek({ team, me, myFocus }: { team: Team; me: string; myFocus: { key: string; title: string } | null }) {
  const t = useT(messages);
  return (
    <>
      <section aria-labelledby="team-title" className="flex flex-col gap-4">
        <RailHead id="team-title" title={t.team.title} sub={t.team.vs} />
        <Totals totals={team.totals} />
        <Heatmap team={team} me={me} myFocus={myFocus} />
      </section>
      <Flow flow={team.flow} />
    </>
  );
}
