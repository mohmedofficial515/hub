/**
 * The three small screens of v5: each one is a short, looping-free illustration of the real step, built from the
 * same tokens as the site (no screenshots, no stock photos). Sample values only; the page says so under the screen.
 */
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeftRight, Check, CreditCard, Mail, Plane, Wallet } from 'lucide-react';
import { cn } from '@lab/utils';
import type { Messages } from '../i18n';

type S = Messages['screen'];

const rise = (i: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.15 + i * 0.18, duration: 0.3 },
});

const Price = ({ v }: { v: number }) => (
  <bdi dir="ltr" className="tnum font-bold">
    USD {v}
  </bdi>
);

export function SearchScreen({ s }: { s: S }) {
  const rows = [
    { dep: '08:40', arr: '11:50', stops: s.direct, price: 214, best: true },
    { dep: '13:15', arr: '16:30', stops: s.direct, price: 236, best: false },
    { dep: '06:05', arr: '12:20', stops: s.oneStop, price: 198, best: false },
  ];
  return (
    <div className="space-y-3">
      <motion.div {...rise(0)} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-(--line) bg-(--card) p-3">
        <Airport label={s.from} code="CAI" city={s.cairo} />
        <span className="flex size-8 items-center justify-center rounded-full border border-(--line) text-(--brand-ink)">
          <ArrowLeftRight aria-hidden className="size-4" />
        </span>
        <Airport label={s.to} code="IST" city={s.istanbul} />
      </motion.div>
      {rows.map((r, i) => (
        <motion.div
          key={i}
          {...rise(i + 1)}
          className={cn(
            'flex items-center justify-between gap-3 rounded-2xl border bg-(--card) px-3 py-2.5',
            r.best ? 'border-(--brand)' : 'border-(--line)',
          )}
        >
          <div className="min-w-0">
            <p className="tnum flex items-center gap-2 text-base font-bold text-(--brand-ink)" dir="ltr">
              {r.dep}
              <span className="h-px w-6 bg-(--border-strong)" />
              {r.arr}
            </p>
            <p className="text-xs text-(--ink-muted)">
              {r.stops} · {s.bag}
            </p>
          </div>
          <div className="text-end">
            {r.stops === s.oneStop && (
              <p className="text-xs font-semibold text-(--action-text)">{s.cheapest}</p>
            )}
            <p className="text-base text-(--brand-ink)">
              <Price v={r.price} />
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function Airport({ label, code, city }: { label: string; code: string; city: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-(--ink-muted)">{label}</p>
      <p className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold text-(--brand-ink)" translate="no">
          {code}
        </span>
        <span className="truncate text-sm text-(--ink)">{city}</span>
      </p>
    </div>
  );
}

/** Types the passenger name, then picks the wallet and presses Pay. */
export function PayScreen({ s }: { s: S }) {
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState(reduce ? s.name.length : 0);
  const [method, setMethod] = useState<'card' | 'wallet'>(reduce ? 'wallet' : 'card');
  const [paid, setPaid] = useState(!!reduce);

  useEffect(() => {
    if (reduce) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= s.name.length; i++) timers.push(setTimeout(() => setTyped(i), 350 + i * 80));
    const after = 350 + s.name.length * 80;
    timers.push(setTimeout(() => setMethod('wallet'), after + 500));
    timers.push(setTimeout(() => setPaid(true), after + 1300));
    return () => timers.forEach(clearTimeout);
  }, [reduce, s.name]);

  return (
    <div className="space-y-3">
      <motion.div {...rise(0)} className="rounded-2xl border border-(--line) bg-(--card) p-3">
        <p className="text-xs font-semibold text-(--ink-muted)">{s.traveller}</p>
        <p className="mt-2 text-xs text-(--ink-muted)">{s.nameLabel}</p>
        <p className="mt-1 flex h-11 items-center rounded-lg border border-(--brand) px-3 font-semibold text-(--brand-ink)" dir="ltr">
          {s.name.slice(0, typed)}
          {typed < s.name.length && (
            <motion.span
              aria-hidden
              className="ms-0.5 h-5 w-px bg-(--brand-ink)"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
          )}
        </p>
      </motion.div>

      <motion.div {...rise(1)} className="rounded-2xl border border-(--line) bg-(--card) p-3">
        <p className="text-xs font-semibold text-(--ink-muted)">{s.payWith}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Method icon={CreditCard} label={s.card} on={method === 'card'} />
          <Method icon={Wallet} label={s.wallet} on={method === 'wallet'} sub={<>{s.balance} <Price v={300} /></>} />
        </div>
      </motion.div>

      <motion.div
        {...rise(2)}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-(--action) text-base font-bold text-(--action-foreground)"
      >
        <motion.span
          key={paid ? 'paid' : 'pay'}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2"
        >
          {paid ? <Check aria-hidden className="size-5" strokeWidth={2.5} /> : null}
          {s.pay} <Price v={214} />
        </motion.span>
      </motion.div>
    </div>
  );
}

function Method({
  icon: Icon,
  label,
  on,
  sub,
}: {
  icon: typeof Wallet;
  label: string;
  on: boolean;
  sub?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 transition-colors duration-300',
        on ? 'border-(--brand) bg-(--brand-soft)' : 'border-(--line)',
      )}
    >
      <Icon aria-hidden className="size-5 shrink-0 text-(--brand-ink)" strokeWidth={1.75} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-(--brand-ink)">{label}</span>
        {sub && <span className="block text-xs text-(--ink-muted)">{sub}</span>}
      </span>
    </div>
  );
}

/** The e-ticket arrives and an inbox notice slides in over it. */
export function TicketScreen({ s }: { s: S }) {
  return (
    <div className="relative">
      <motion.div {...rise(0)} className="overflow-hidden rounded-2xl border border-(--line) bg-(--card)">
        <div className="flex items-center justify-between border-b border-dashed border-(--border-strong) px-4 py-3">
          <span className="text-sm font-semibold text-(--ink-muted)">{s.ticket}</span>
          <span className="text-base font-bold text-(--brand-ink)" translate="no" dir="ltr">
            go<span className="text-(--action-text)">t</span>eav
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-4" dir="ltr">
          <TicketEnd code="CAI" time="08:40" />
          <Plane aria-hidden className="size-5 rotate-45 text-(--highlight)" strokeWidth={1.75} />
          <TicketEnd code="IST" time="11:50" end />
        </div>
        <dl className="grid grid-cols-3 gap-2 px-4 py-4">
          <Field k={s.passenger} v={s.name} />
          <Field k={s.ref} v="GTV7Q2" />
          <Field k={s.seat} v="14A" />
        </dl>
        <div className="flex items-center justify-between gap-3 border-t border-(--line) px-4 py-3">
          <span className="text-sm font-semibold text-(--action-text)">{s.manage}</span>
          <Qr />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, type: 'spring', stiffness: 380, damping: 26 }}
        className="absolute inset-x-3 -top-5 flex items-center gap-3 rounded-xl border border-(--border-strong) bg-(--card) px-3 py-2.5"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--success-soft) text-(--success-ink)">
          <Mail aria-hidden className="size-4" />
        </span>
        <span className="text-sm font-semibold text-(--brand-ink)">{s.mail}</span>
      </motion.div>
    </div>
  );
}

function TicketEnd({ code, time, end }: { code: string; time: string; end?: boolean }) {
  return (
    <div className={end ? 'text-right' : 'text-left'}>
      <p className="text-3xl font-bold text-(--brand-ink)" translate="no">
        {code}
      </p>
      <p className="tnum text-sm text-(--ink-muted)">{time}</p>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-(--ink-muted)">{k}</dt>
      <dd className="truncate text-sm font-bold text-(--brand-ink)" dir="ltr" translate="no">
        {v}
      </dd>
    </div>
  );
}

/** A decorative code square (fixed pattern), not a scannable QR. */
function Qr() {
  const cells = '1110111010010111011100101101001110110010111011101'.split('');
  return (
    <span aria-hidden className="grid size-12 grid-cols-7 gap-px">
      {cells.map((c, i) => (
        <span key={i} className={c === '1' ? 'bg-(--brand-ink)' : ''} />
      ))}
    </span>
  );
}
