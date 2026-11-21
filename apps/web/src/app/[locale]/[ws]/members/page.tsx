/**
 * @file page.tsx
 * @description Members (docs/09 §17). The profile lives in Settings › Account now (owner's decision, 2026-11-19): the old
 * `?profile=me` link goes there.
 */
import { redirect } from 'next/navigation';

import { MembersPage } from '@/components/members/members-page';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; ws: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, ws } = await params;
  if ((await searchParams).profile === 'me')
    redirect(`/${locale}/${encodeURIComponent(ws)}/settings?tab=account`);
  return <MembersPage />;
}
