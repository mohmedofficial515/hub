/**
 * @file Reset link (docs/09 §1.4).
 */
import { ResetForm } from '@/components/auth/reset-forms';

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ResetForm token={token} />;
}
