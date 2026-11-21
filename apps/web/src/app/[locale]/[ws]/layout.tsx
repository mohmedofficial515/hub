/**
 * @file The signed-in project shell (docs/09 §3): sidebar, header, palette, sheet, and the one live connection.
 */
import type { ReactNode } from 'react';

import { WorkspaceGate } from '@/components/shell/workspace-gate-loader';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ ws: string }>;
}) {
  const { ws } = await params;
  return <WorkspaceGate ws={ws}>{children}</WorkspaceGate>;
}
