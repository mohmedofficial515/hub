/**
 * @file Approving a new device in the browser (docs/16 §5). The middleware sends anyone not signed in to sign-in, and back here.
 */
import { ConnectApproval } from '@/components/auth/connect-approval';

export default function ConnectPage() {
  return <ConnectApproval />;
}
