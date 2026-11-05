/**
 * @file Accept an invitation (docs/09 §1.3).
 */
import { InviteForm } from '@/components/auth/invite-form';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InviteForm token={token} />;
}
