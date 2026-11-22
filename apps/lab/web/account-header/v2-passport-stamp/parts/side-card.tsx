import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Award,
  Bell,
  Briefcase,
  ChevronDown,
  CreditCard,
  FileSignature,
  FileText,
  Heart,
  HelpCircle,
  History,
  Inbox,
  LifeBuoy,
  MessageSquare,
  Pencil,
  RotateCw,
  Shield,
  Sliders,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@lab/utils';

import { AccountAvatar, LevelMark } from './account-avatar';
import { nameIn, progressOf, type TierCode } from './mock';
import { useAccount } from './model';

const ICONS: Record<string, LucideIcon> = {
  profile: User,
  security: Shield,
  notifications: Bell,
  rewards: Award,
  wallet: Wallet,
  payment_methods: CreditCard,
  preferences: Sliders,
  bookings: FileText,
  searches: History,
  saved: Heart,
  reviews: MessageSquare,
  support: Inbox,
  contact: HelpCircle,
  safety: LifeBuoy,
  guidelines: FileSignature,
};

const RANK: Record<TierCode, number> = { BLUE: 0, SILVER: 1, GOLD: 2 };

function Skeleton({ className }: { className: string }) {
  return <span aria-hidden className={cn('block rounded bg-(--surface-3) motion-safe:animate-pulse', className)} />;
}

/** Spend first (GTV-544): what has been counted, the derived target, what remains; points stay secondary. */
function LevelProgress() {
  const m = useAccount();
  const reduce = useReducedMotion();
  const titleId = useId();
  const summary = m.summary;

  if (m.state === 'loading') {
    return (
      <div aria-hidden className="space-y-2.5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div role="alert" className="rounded-xl border border-(--border) bg-(--surface-2) p-4 text-start">
        <p className="text-sm text-(--ink)">{m.t.card.loadError}</p>
      </div>
    );
  }

  const p = progressOf(summary);
  const rtl = m.locale === 'ar';
  const current = summary.tier.code as TierCode;
  const next = summary.nextTier?.code as TierCode | undefined;

  const bar = (ratio: number, valueNow: number, valueMax: number, text: string) => (
    <div
      role="progressbar"
      aria-labelledby={titleId}
      aria-valuemin={0}
      aria-valuemax={valueMax}
      aria-valuenow={valueNow}
      aria-valuetext={text}
      className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-(--surface-3)"
    >
      <motion.span
        className="absolute inset-0 block rounded-full bg-(--action)"
        style={{ transformOrigin: rtl ? 'right' : 'left' }}
        initial={false}
        animate={{ scaleX: Math.max(0.02, Math.min(1, ratio)) }}
        transition={reduce ? { duration: 0 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );

  const ends = next && (
    <div className="mt-2 flex items-center justify-between text-xs font-semibold text-(--ink-muted)">
      <span className="inline-flex items-center gap-1.5">
        <LevelMark level={current} className="size-3.5" />
        {nameIn(summary.tier.name, m.locale)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        {summary.nextTier && nameIn(summary.nextTier.name, m.locale)}
        <LevelMark level={next} className="size-3.5" />
      </span>
    </div>
  );

  return (
    <section aria-labelledby={titleId} className="text-start">
      {p.kind === 'spend' && (
        <>
          <h3 id={titleId} className="text-sm font-semibold text-(--ink)">
            {m.t.card.spendTitle(nameIn(p.next, m.locale))}
          </h3>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-2xl leading-tight font-bold text-(--brand-ink) tabular-nums">{m.money(p.spent)}</span>
            <span className="text-sm text-(--ink-muted) tabular-nums">{m.t.card.of(m.money(p.target))}</span>
          </p>
          {bar(p.ratio, p.spent, p.target, m.t.card.spendLeft(m.money(p.remaining), nameIn(p.next, m.locale)))}
          {ends}
          <p className="mt-3 text-sm text-(--ink)">
            {m.t.card.spendLeft(m.money(p.remaining), nameIn(p.next, m.locale))}
          </p>
        </>
      )}
      {p.kind === 'points' && (
        <>
          <h3 id={titleId} className="text-sm font-semibold text-(--ink)">
            {m.t.card.pointsTitle(nameIn(p.next, m.locale))}
          </h3>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-2xl leading-tight font-bold text-(--brand-ink) tabular-nums">{m.count(p.earned)}</span>
            <span className="text-sm text-(--ink-muted) tabular-nums">{m.t.card.of(m.count(p.target))}</span>
          </p>
          {bar(p.ratio, p.earned, p.target, m.t.card.pointsLeft(m.count(p.remaining), nameIn(p.next, m.locale)))}
          {ends}
          <p className="mt-3 text-sm text-(--ink)">
            {m.t.card.pointsLeft(m.count(p.remaining), nameIn(p.next, m.locale))}
          </p>
        </>
      )}
      {p.kind === 'top' && (
        <>
          <h3 id={titleId} className="text-sm font-semibold text-(--ink)">
            {m.t.card.topTitle}
          </h3>
          <p className="mt-1 text-2xl leading-tight font-bold text-(--brand-ink) tabular-nums">
            {m.money(Number(summary.lifetimeSpendUsd))}
          </p>
          {bar(1, 1, 1, m.t.card.topTitle)}
          <p className="mt-3 text-sm text-(--ink)">{m.t.card.topSpent(m.money(Number(summary.lifetimeSpendUsd)))}</p>
        </>
      )}
      {p.kind === 'unknown' && (
        <h3 id={titleId} className="text-sm font-semibold text-(--ink)">
          {m.t.card.unknown(nameIn(p.next, m.locale))}
        </h3>
      )}
      {summary.tier.expiresAt && (
        <p className="mt-1 text-xs text-(--ink-muted)">{m.t.card.validUntil(m.date(summary.tier.expiresAt))}</p>
      )}
    </section>
  );
}

function AccountMenuList() {
  const m = useAccount();
  return (
    <div className="space-y-4">
      {m.t.sections.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-1 text-xs font-semibold text-(--ink-muted)">{section.title}</p>
          <ul>
            {section.items.map((item) => {
              const Icon = ICONS[item.id] ?? User;
              const current = item.id === 'profile';
              return (
                <li key={item.id}>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'flex h-11 items-center gap-3 rounded-lg px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--ring)',
                      current
                        ? 'bg-(--brand-soft) font-bold text-(--brand-ink)'
                        : 'font-medium text-(--ink) hover:bg-(--surface-2)',
                    )}
                  >
                    <Icon
                      aria-hidden
                      className={cn('size-[18px] shrink-0', current ? 'text-(--brand-ink)' : 'text-(--ink-muted)')}
                      strokeWidth={1.75}
                    />
                    <span className="truncate">{item.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * The passport data page: the Postmark avatar at 128 px, name, e-mail and the level in words, the spend progress,
 * points, one primary action, then the account menu (inline from lg, a disclosure below).
 */
export function SideCard({ onRetry }: { onRetry: () => void }) {
  const m = useAccount();
  const reduce = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  // "You reached Gold": once, when the level goes up.
  const previous = useRef<TierCode | null>(null);
  const [reached, setReached] = useState<string | null>(null);
  const code = (m.summary?.tier.code ?? null) as TierCode | null;
  useEffect(() => {
    const before = previous.current;
    if (before && code && RANK[code] > RANK[before]) setReached(m.levelName);
    else if (code !== before) setReached(null);
    if (code) previous.current = code;
  }, [code, m.levelName]);

  const loading = m.state === 'loading';

  return (
    <section
      aria-label={m.state === 'loading' ? m.t.card.loading : m.a11yName}
      aria-busy={loading || undefined}
      className="overflow-hidden rounded-2xl border border-(--border) bg-(--card)"
    >
      <div className="p-5 sm:p-6">
        {/* Who: centred on phones and from lg; side by side on tablets */}
        <div className="flex flex-col items-center text-center md:flex-row md:gap-10 md:text-start lg:flex-col lg:gap-0 lg:text-center">
          <div className="p-1">
            <AccountAvatar size={128} />
          </div>
          <div className="mt-4 flex min-w-0 flex-col items-center md:mt-0 md:items-start lg:mt-4 lg:items-center">
            {loading ? (
              <>
                <span className="sr-only">{m.t.card.loading}</span>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="mt-2 h-4 w-52" />
              </>
            ) : (
              <>
                <h2 dir="auto" className="max-w-full truncate text-xl leading-snug font-bold text-(--brand-ink)">
                  {m.customer.name}
                </h2>
                <bdi dir="ltr" className="block max-w-full truncate text-sm text-(--ink-muted)">
                  {m.customer.email}
                </bdi>
                {m.levelName && (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-(--border) py-1 ps-1.5 pe-3 text-sm font-semibold text-(--foreground)">
                    <LevelMark level={m.frame} />
                    {m.t.card.level(m.levelName)}
                  </p>
                )}
                <div aria-live="polite" className="min-h-0">
                  <AnimatePresence>
                    {reached && (
                      <motion.p
                        initial={reduce ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-2 text-sm font-semibold text-(--brand-ink)"
                      >
                        {m.t.card.upgraded(reached)}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-(--border) pt-5">
          <LevelProgress />
          {m.state === 'error' && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex h-11 items-center gap-2 rounded-md border border-(--border-strong) px-4 text-sm font-semibold text-(--brand-ink) outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              <RotateCw aria-hidden className="size-4" />
              {m.t.card.retry}
            </button>
          )}
        </div>

        {m.summary && (
          <dl className="mt-5 flex items-baseline justify-between gap-3 border-t border-(--border) pt-4 text-start">
            <dt className="text-sm font-semibold text-(--ink)">{m.t.card.points}</dt>
            <dd className="text-end">
              <span className="block text-base font-bold text-(--brand-ink) tabular-nums">
                {m.count(m.summary.pointsBalance)}
              </span>
              <span className="block text-xs text-(--ink-muted)">
                {m.t.card.available(m.count(m.summary.availablePoints))}
              </span>
            </dd>
          </dl>
        )}

        {/* One primary action on the screen */}
        <div className="mt-5 grid grid-cols-2 gap-2 md:max-lg:max-w-md">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-(--action) px-3 text-sm font-bold text-(--action-foreground) outline-none hover:bg-(--action-hover) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--card)"
          >
            <Briefcase aria-hidden className="size-4" />
            {m.t.card.myBookings}
          </a>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-(--border-strong) px-3 text-sm font-semibold text-(--brand-ink) outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            <Pencil aria-hidden className="size-4" />
            {m.t.card.editProfile}
          </a>
        </div>
      </div>

      <div className="border-t border-(--border) p-2 lg:p-3">
        <div className="hidden lg:block">
          <AccountMenuList />
        </div>
        <div className="lg:hidden">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-12 w-full items-center justify-between rounded-lg px-3 text-sm font-semibold text-(--brand-ink) outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            <span className="inline-flex items-center gap-2">
              <User aria-hidden className="size-[18px] text-(--ink-muted)" strokeWidth={1.75} />
              {m.t.card.menu}
            </span>
            <ChevronDown aria-hidden className={cn('size-4 transition-transform', menuOpen && 'rotate-180')} />
          </button>
          <div id={menuId} hidden={!menuOpen} className="pt-2 pb-1">
            <AccountMenuList />
          </div>
        </div>
      </div>
    </section>
  );
}
