'use client';

/**
 * @file workspace-gate.tsx
 * @description Mounts the shell for a project the member belongs to, and says so plainly when they do not (docs/09 §3).
 */
import { type ReactNode, Suspense } from 'react';

import { Button, ErrorState } from '@/components/kit';
import { LiveProvider } from '@/features/live/live-provider';
import { useMe } from '@/features/session/session';
import { isHubError } from '@/lib/api/errors';
import { messages, useLocale, useT } from '@/lib/i18n';

import { Shell } from './shell';

export function WorkspaceGate({ ws, children }: { ws: string; children: ReactNode }) {
  const t = useT(messages);
  const locale = useLocale();
  const me = useMe();
  const known = me.data?.workspaces.some((w) => w.slug === ws);

  if (me.isError && !isHubError(me.error, 'hub.identity.unauthorized')) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <ErrorState
          thing={t.gate.session}
          code={isHubError(me.error) ? me.error.code : undefined}
          requestId={isHubError(me.error) ? me.error.requestId : undefined}
          onRetry={() => void me.refetch()}
        />
      </main>
    );
  }
  if (me.data && !known) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="hub-page-title text-headline text-foreground">{t.gate.notMember}</h1>
        <p className="max-w-md text-body text-muted-foreground">{t.gate.notMemberBody}</p>
        <a href={`/${locale}/workspaces`}>
          <Button variant="primary" tabIndex={-1}>
            {t.gate.toProjects}
          </Button>
        </a>
      </main>
    );
  }
  return (
    <Suspense>
      <LiveProvider ws={ws}>
        <Shell>{children}</Shell>
      </LiveProvider>
    </Suspense>
  );
}
