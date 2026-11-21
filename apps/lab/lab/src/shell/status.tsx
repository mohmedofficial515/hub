import { cn } from '@lab/utils';
import type { Status } from '../core/registry';

const TONE: Record<Status, string> = {
  draft: 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30',
  review: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  rejected: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  ported: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  reference: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset', TONE[status], className)}>
      {status}
    </span>
  );
}
