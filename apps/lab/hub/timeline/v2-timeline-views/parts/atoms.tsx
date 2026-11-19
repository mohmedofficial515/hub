import { Fragment, type ReactNode } from 'react';
import {
  ArrowLeftRight,
  Ban,
  CircleCheck,
  CircleDashed,
  CirclePlay,
  Clock,
  Eye,
  FileText,
  GitCommitHorizontal,
  KeyRound,
  Palette,
  Rocket,
  Scale,
  SquareCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { CardType, FeedCard, Locale } from './model';
import { NOW } from './model';
import type { Plural } from '../i18n';

export { cn } from '@lab/ui/hub-cn';

/** Keys, branches, paths and SHAs: always left-to-right, isolated from the Arabic around them. */
export function Ltr({ children, mono = false, className }: { children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <bdi dir="ltr" className={`${mono ? 'font-mono text-[0.92em]' : ''} ${className ?? ''}`.trim()}>
      {children}
    </bdi>
  );
}

/** `fill('{key} decided', { key: <Ltr>GTV-1</Ltr> })` → nodes, so a placeholder can be an element. */
export function fill(template: string, vars: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return <Fragment key={i}>{m ? (vars[m[1]!] ?? part) : part}</Fragment>;
  });
}

export function fillText(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

export function plural(locale: Locale, n: number, forms: Plural): string {
  if (n === 0 && forms.zero) return forms.zero;
  const cat = new Intl.PluralRules(locale).select(n) as keyof Plural;
  return fillText(forms[cat] ?? forms.other, { n });
}

// ── Time. The mock's "now" is fixed, so nothing here reads the clock. ─────────────────────────────

const loc = (locale: Locale) => (locale === 'ar' ? 'ar-u-nu-latn' : 'en');
const nowMs = () => new Date(NOW).getTime();

export function formatTime(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(loc(locale), { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Istanbul' }).format(new Date(iso));
}

function duration(ms: number, locale: Locale) {
  const min = Math.max(1, Math.round(ms / 60_000));
  const [value, unit] = min < 60 ? [min, 'minute'] : min < 36 * 60 ? [Math.round(min / 60), 'hour'] : [Math.round(min / 1440), 'day'];
  return new Intl.NumberFormat(loc(locale), { style: 'unit', unit, unitDisplay: 'long' }).format(value as number);
}

/** `null` means "now" (under a minute, or in the live future of the mock). */
export function ageText(iso: string, locale: Locale): string | null {
  const diff = nowMs() - new Date(iso).getTime();
  return diff < 60_000 ? null : duration(diff, locale);
}

export function dueInfo(iso: string, locale: Locale) {
  const diff = new Date(iso).getTime() - nowMs();
  return { overdue: diff < 0, soon: diff >= 0 && diff < 24 * 3_600_000, text: duration(Math.abs(diff), locale) };
}

export const dayKey = (iso: string) => iso.slice(0, 10);

export function dayLabel(key: string, locale: Locale, t: { today: string; yesterday: string }) {
  const today = dayKey(NOW);
  const y = new Date(new Date(`${today}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  if (key === today) return t.today;
  if (key === y) return t.yesterday;
  return new Intl.DateTimeFormat(loc(locale), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
}

// ── Vocabulary: one table per axis, class strings spelled out so Tailwind sees them ───────────────

export const typeIcon: Record<CardType, LucideIcon> = {
  task: SquareCheck,
  decision: Scale,
  need: KeyRound,
  change: GitCommitHorizontal,
  handoff: ArrowLeftRight,
  redesign: Palette,
  doc: FileText,
  release: Rocket,
};

export const typeTile: Record<CardType, string> = {
  task: 'bg-type-task-soft text-type-task-fg',
  decision: 'bg-type-decision-soft text-type-decision-fg',
  need: 'bg-type-need-soft text-type-need-fg',
  change: 'bg-type-change-soft text-type-change-fg',
  handoff: 'bg-type-handoff-soft text-type-handoff-fg',
  redesign: 'bg-type-redesign-soft text-type-redesign-fg',
  doc: 'bg-type-doc-soft text-type-doc-fg',
  release: 'bg-type-release-soft text-type-release-fg',
};

export type Tone = 'danger' | 'warning' | 'success' | 'info' | 'muted';

export const toneClass: Record<Tone, string> = {
  danger: 'bg-destructive-soft text-destructive-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
  success: 'bg-success-soft text-success-soft-foreground',
  info: 'bg-info-soft text-info-soft-foreground',
  muted: 'bg-muted text-muted-foreground',
};

const STATUS_TONE: Record<string, Tone> = {
  done: 'success', verified: 'success', approved: 'success', merged: 'success', released: 'success', decided: 'success', applied: 'success', summarized: 'success',
  in_progress: 'info', claimed: 'info', in_review: 'info', review: 'info', acknowledged: 'info', delivered: 'info',
  pending: 'warning',
};

export const statusTone = (status: string): Tone => STATUS_TONE[status] ?? 'muted';

export function statusIcon(status: string): LucideIcon {
  const tone = statusTone(status);
  if (tone === 'success') return CircleCheck;
  if (status === 'review' || status === 'in_review') return Eye;
  if (tone === 'info') return CirclePlay;
  if (tone === 'warning') return Clock;
  if (status === 'blocked') return Ban;
  return CircleDashed;
}

export const dangerIcon = TriangleAlert;

/** Focus ring that works on rows flush inside a clipped, bordered list. */
export const focusInset = 'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';
export const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Effective due state of a card: the flags come with the card, the clock is the mock's. */
export function isOverdue(card: FeedCard) {
  return Boolean(card.overdue) || (card.dueAt ? new Date(card.dueAt).getTime() < nowMs() : false);
}
