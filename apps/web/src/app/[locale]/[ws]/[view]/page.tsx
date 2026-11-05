/**
 * @file Any sidebar view whose page has not been ported yet. A folder named after the view (`[ws]/tasks/page.tsx`) takes over from this.
 */
import { notFound } from 'next/navigation';

import { VIEW_IDS } from '@/components/shell/view-ids';
import { ViewPlaceholder } from '@/components/shell/view-placeholder';

export default async function ViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!(VIEW_IDS as readonly string[]).includes(view)) notFound();
  return <ViewPlaceholder />;
}
