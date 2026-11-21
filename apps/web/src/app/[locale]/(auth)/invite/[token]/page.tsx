/**
 * @file Accept an invitation (docs/09 §1.3).
 * @description Whether this browser may hold a session is read from the cookies' presence only. The form then asks the API who is signed
 * in, so the owner trying the link, or a friend on a shared computer, is told before an account is made in the wrong place.
 */
import { cookies } from 'next/headers';

import { InviteForm } from '@/components/auth/invite-form';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const jar = await cookies();
  const maybeSignedIn = jar.has('hub_access') || jar.has('hub_session');
  return <InviteForm token={token} maybeSignedIn={maybeSignedIn} />;
}
