/**
 * @file The old Live address. Live is the "Running now" tab of the queue now (owner's decision, 2026-11-19); a link to
 * `/[ws]/live?chat=` still opens that chat there.
 */
import { redirect } from 'next/navigation';

import { liveTarget } from './target';

export default async function LiveRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; ws: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, ws } = await params;
  redirect(liveTarget(locale, ws, await searchParams));
}
