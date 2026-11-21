import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, AtSign, Bell, Clock, Eye, Route, Siren, type LucideIcon } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { messages } from '../i18n';
import { cn, dueInfo, fillText, statusIcon, statusTone, toneClass, type Tone } from './atoms';
import type { FeedItem } from './model';

export function Chip({ tone = 'muted', icon: Icon, children, className }: { tone?: Tone; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-caption font-medium whitespace-nowrap', toneClass[tone], className)}>
      {Icon && <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />}
      {children}
    </span>
  );
}

/**
 * The card's CURRENT status, never the event's. When the status changes under the reader, the chip cross-fades to the new
 * tone and, for a few seconds, says what it was ("was: Pending"), so the change is never a silent swap. Under reduced
 * motion the swap is instant and the "was" line stays still.
 */
export function StatusChip({ status, from, changedAt }: { status: string; from?: string; changedAt?: number }) {
  const t = useT(messages);
  const reduce = useReducedMotion();
  const [showFrom, setShowFrom] = useState(false);

  useEffect(() => {
    if (!changedAt || !from) return;
    setShowFrom(true);
    const id = window.setTimeout(() => setShowFrom(false), 4500);
    return () => window.clearTimeout(id);
  }, [changedAt, from]);

  const label = t.status[status] ?? status;
  const Icon = statusIcon(status);

  return (
    <span className="inline-flex items-center gap-1.5">
      {showFrom && from && (
        <>
          <span className="text-caption text-muted-foreground line-through decoration-1">{t.status[from] ?? from}</span>
          <ArrowRight aria-hidden className="size-3 text-muted-foreground rtl:-scale-x-100" />
        </>
      )}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status}
          initial={reduce ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 4 }}
          transition={{ duration: reduce ? 0 : 0.16, ease: 'easeOut' }}
          className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-caption font-medium whitespace-nowrap', toneClass[statusTone(status)])}
        >
          <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
          {label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function DueChip({ dueAt, escalated }: { dueAt: string; escalated?: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const due = dueInfo(dueAt, locale);
  const tone: Tone = due.overdue || escalated ? 'danger' : due.soon ? 'warning' : 'muted';
  return (
    <Chip tone={tone} icon={Clock}>
      <span className="sr-only">{t.due.label}: </span>
      {fillText(due.overdue ? t.due.over : t.due.in, { d: due.text })}
    </Chip>
  );
}

const whyIcon: Record<string, LucideIcon> = { routed: Route, mention: AtSign, watch: Eye, reminder: Bell, escalation: Siren };

/** Answers "why is this in front of me": routed to my role, mentioned, watching, reminder, escalated. */
export function WhyChip({ why }: { why: NonNullable<FeedItem['why']> }) {
  const t = useT(messages);
  const Icon = whyIcon[why.kind]!;
  const text = why.kind === 'routed' ? fillText(t.why.routed, { role: why.role ? t.roles[why.role] : '' }) : t.why[why.kind];
  const danger = why.kind === 'escalation';
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-caption whitespace-nowrap',
        danger ? 'border-destructive/50 bg-card font-medium text-destructive-soft-foreground' : 'border-border bg-card text-muted-foreground',
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
      {text}
    </span>
  );
}
