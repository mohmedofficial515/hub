/**
 * @file The deep link `/[ws]/cards/[key]` of docs/09 §14, which the API writes into an ADR when a decision is decided
 * (`hubUrl` in apps/api decisions/application/decision-actions.ts). It opens the card's sheet over Today; a key that is
 * not one shows the project's own not-found page.
 */
import { notFound, redirect } from 'next/navigation';

import { cardLinkTarget } from '@/lib/card-link';

export default async function CardLinkPage({
  params,
}: {
  params: Promise<{ locale: string; ws: string; key: string }>;
}) {
  const { locale, ws, key } = await params;
  const target = cardLinkTarget(locale, ws, key);
  if (!target) notFound();
  redirect(target);
}
