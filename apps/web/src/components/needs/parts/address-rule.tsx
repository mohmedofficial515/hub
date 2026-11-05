'use client';

/**
 * @file address-rule.tsx
 * @description Ported from the approved design, pages/needs. Contract: apps/web/README.md.
 */
import { Signpost } from 'lucide-react';

import { useT } from '@/components/kit';
import type { NeedsMessages } from '@/features/needs/messages';

/**
 * The page's one rule, as one line that always stays on the page. `LocationPointer` and the Deliver form carry the idea where it
 * matters, so this no longer spends the first screen on a diagram (review M10, decided 2026-11-04). It cannot be dismissed.
 */
export function AddressRule() {
  const t = useT<NeedsMessages>('needs');
  return (
    <p className="flex items-start gap-2 text-body-sm text-muted-foreground">
      <Signpost aria-hidden className="mt-0.5 size-4 shrink-0 text-type-need-fg" strokeWidth={1.75} />
      <span>{t.rule.lead}</span>
    </p>
  );
}
