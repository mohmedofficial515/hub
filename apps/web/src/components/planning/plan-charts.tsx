'use client';

/**
 * @file plan-charts.tsx
 * @description The plan page's two charts (v5-live-plan): the ring of phases in the head, weighted by effort, and who carries the plan, a bar per
 * role split by phase. Both use the phases' tones (`journey.css`) and say their numbers in words beside them, so neither is colour alone.
 */
import { fmt, kitMessages, Ltr, num, type Role, roleIcon, useLocale, useT } from '@/components/kit';
import { effortOf, type PhaseGroup, toneOf } from '@/features/planning/journey';

import type { PlanningMessages } from './messages';

const GAP = 0.008;
const MOVE =
  'stroke-dasharray 700ms cubic-bezier(0.2, 0.7, 0.2, 1), stroke-width 180ms ease, opacity 200ms ease';

/**
 * The plan at a glance: one ring, an arc per phase as long as its effort (S 1, M 3, L 8), each filling in its tone as steps finish. Arcs are pointer
 * shortcuts to the map (hover lights the phase, click picks it); the keyboard path is the map itself, so the ring is hidden from screen readers and
 * its words are said beside it.
 */
export function PlanRing({
  groups,
  selected,
  hover,
  onSelect,
  onHover,
}: {
  groups: PhaseGroup[];
  selected: number;
  hover: number | null;
  onSelect: (index: number) => void;
  onHover: (index: number | null) => void;
}) {
  const j = useT<PlanningMessages>('planning').detail.journey;
  const locale = useLocale();
  const all = groups.flatMap((g) => g.steps);
  const effort = effortOf(all);
  const total = effort.total;
  const steps = {
    done: all.filter((s) => s.done).length,
    review: all.filter((s) => s.review).length,
    total: all.length,
  };
  const percent = total ? Math.round((effort.done / total) * 100) : 0;
  const reviewPercent = total ? Math.round((effort.review / total) * 100) : 0;
  let start = 0;

  return (
    <div className="relative size-34 shrink-0 md:size-42" data-plan-ring>
      <svg
        viewBox="0 0 120 120"
        aria-hidden
        className="size-full"
        style={{ transform: `rotate(-90deg)${locale === 'ar' ? ' scaleY(-1)' : ''}` }}
      >
        <circle cx="60" cy="60" r="50" fill="none" strokeWidth="12" style={{ stroke: 'var(--muted)' }} />
        {groups.map((g, i) => {
          const e = effortOf(g.steps);
          if (!total || !e.total) return null;
          const length = e.total / total;
          const from = start;
          start += length;
          const visible = Math.max(length - GAP, 0.002);
          const filled = Math.min(e.done / total, visible);
          const reviewing = Math.min(e.review / total, Math.max(visible - filled, 0));
          const hot = hover === i || selected === i;
          const dim = hover !== null && hover !== i;
          return (
            <g
              key={g.phase?.id ?? 'loose'}
              data-pj-tone={toneOf(i)}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(i)}
            >
              <circle
                cx="60"
                cy="60"
                r="50"
                pathLength={1}
                strokeDasharray={`${visible} ${1 - visible}`}
                strokeDashoffset={-from}
                data-hot={hot}
                data-dim={dim}
                className="pj-arc pj-arc-rest"
                style={{ transition: MOVE }}
              />
              <circle
                cx="60"
                cy="60"
                r="50"
                pathLength={1}
                strokeDasharray={`${filled} ${1 - filled}`}
                strokeDashoffset={-from}
                data-hot={hot}
                data-dim={dim}
                className="pj-arc pj-arc-done"
                style={{ transition: MOVE }}
              />
              {reviewing > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  pathLength={1}
                  strokeDasharray={`${reviewing} ${1 - reviewing}`}
                  strokeDashoffset={-(from + filled)}
                  data-hot={hot}
                  data-dim={dim}
                  className="pj-arc pj-arc-review"
                  style={{ transition: MOVE }}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span aria-hidden>
          <Ltr className="text-headline font-bold text-foreground tabular-nums">
            {num(percent, locale)}
            <span className="text-title-sm font-semibold text-muted-foreground">%</span>
          </Ltr>
        </span>
        <span aria-hidden className="text-caption text-muted-foreground">
          {j.ringEffort}
        </span>
        {reviewPercent > 0 && (
          <span aria-hidden className="text-caption font-medium text-foreground tabular-nums">
            {fmt(j.ringReview, { p: num(reviewPercent, locale) })}
          </span>
        )}
      </div>
      <p className="sr-only">
        {j.ringLabel}:{' '}
        {fmt(j.progressLabel, { done: num(steps.done, locale), total: num(steps.total, locale) })}.{' '}
        {steps.review > 0 && `${fmt(j.inReview, { n: num(steps.review, locale) })}. `}
        {fmt(j.effortLabel, { done: num(effort.done, locale), total: num(total, locale) })}
      </p>
    </div>
  );
}

interface RoleRow {
  total: number;
  done: number;
  parts: { phase: number; done: number; rest: number }[];
}

/**
 * Who carries the plan: a bar per role, split by phase in the phase's tone (solid is done, pale is still to do), longest role first. The colours are
 * the map's, so it needs no legend of its own. Each row says its numbers in words.
 */
export function RolesChart({
  groups,
  hover,
  onHover,
}: {
  groups: PhaseGroup[];
  hover: number | null;
  onHover: (index: number | null) => void;
}) {
  const j = useT<PlanningMessages>('planning').detail.journey;
  const kit = useT(kitMessages);
  const locale = useLocale();
  const roles = new Map<Role, RoleRow>();
  groups.forEach((g, gi) => {
    for (const s of g.steps) {
      if (!s.role) continue;
      const row = roles.get(s.role) ?? { total: 0, done: 0, parts: [] };
      row.total += 1;
      if (s.done) row.done += 1;
      let part = row.parts.find((p) => p.phase === gi);
      if (!part) {
        part = { phase: gi, done: 0, rest: 0 };
        row.parts.push(part);
      }
      if (s.done) part.done += 1;
      else part.rest += 1;
      roles.set(s.role, row);
    }
  });
  const rows = [...roles.entries()].sort((a, b) => b[1].total - a[1].total);
  const max = Math.max(1, ...rows.map(([, r]) => r.total));
  if (rows.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-body-sm text-muted-foreground">{j.rolesHint}</p>
      <ul className="flex min-w-0 flex-col gap-3">
        {rows.map(([role, r]) => {
          const Icon = roleIcon[role];
          return (
            <li
              key={role}
              className="grid min-w-0 grid-cols-[minmax(7rem,9rem)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-body-sm text-foreground">
                <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span className="truncate">{kit.roles[role]}</span>
              </span>
              <span
                aria-hidden
                className="flex h-3 min-w-0 gap-px overflow-hidden rounded-full"
                style={{ width: `${(r.total / max) * 100}%` }}
              >
                {r.parts.map((p) => (
                  <span
                    key={p.phase}
                    data-pj-tone={toneOf(p.phase)}
                    onMouseEnter={() => onHover(p.phase)}
                    onMouseLeave={() => onHover(null)}
                    title={`${groups[p.phase]?.phase?.title ?? j.noPhase}: ${num(p.done, locale)}/${num(p.done + p.rest, locale)}`}
                    className="flex h-full min-w-0 transition-opacity duration-200 motion-reduce:transition-none"
                    style={{
                      flexGrow: p.done + p.rest,
                      flexBasis: 0,
                      opacity: hover !== null && hover !== p.phase ? 0.3 : 1,
                    }}
                  >
                    {p.done > 0 && (
                      <span className="pj-tone-bg h-full" style={{ flexGrow: p.done, flexBasis: 0 }} />
                    )}
                    {p.rest > 0 && (
                      <span
                        className="h-full"
                        style={{ flexGrow: p.rest, flexBasis: 0, background: 'var(--pj-tone-line)' }}
                      />
                    )}
                  </span>
                ))}
              </span>
              <span className="text-caption text-muted-foreground tabular-nums">
                <span aria-hidden>
                  <Ltr>
                    {num(r.done, locale)}/{num(r.total, locale)}
                  </Ltr>
                </span>
                <span className="sr-only">
                  {fmt(j.rolesRow, {
                    role: kit.roles[role],
                    done: num(r.done, locale),
                    total: num(r.total, locale),
                  })}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
