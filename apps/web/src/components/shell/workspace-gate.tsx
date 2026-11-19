'use client';

/**
 * @file workspace-gate.tsx
 * @description Mounts the shell for a project the member belongs to, and says so plainly when they do not (docs/09 §3).
 * A failed reread of `auth/me` with data in hand keeps the shell mounted: only a first load that fails shows the error.
 */
import { type ReactNode, useEffect, useRef } from 'react';

import { focusRing } from '@/components/cards/meta';
import { ErrorState } from '@/components/kit';
import { LiveProvider } from '@/features/live/live-provider';
import { useMe } from '@/features/session/session';
import { isHubError } from '@/lib/api/errors';
import { messages, useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

import { Shell } from './shell';

export function WorkspaceGate({ ws, children }: { ws: string; children: ReactNode }) {
  const t = useT(messages);
  const locale = useLocale();
  const me = useMe();
  const known = me.data?.workspaces.some((w) => w.slug === ws);
  // TanStack Query keeps `isError` true after a failed refetch even with data: that is not a lost session.
  const failed = me.isError && !me.data;
  const signedOut = failed && isHubError(me.error) && me.error.status === 401;

  const leaving = useRef(false);
  useEffect(() => {
    if (!signedOut || leaving.current) return;
    leaving.current = true;
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.assign(`/${locale}/sign-in?next=${next}`);
  }, [signedOut, locale]);

  if (signedOut) return <div className="min-h-dvh bg-background" />;
  if (failed) {
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
        <a
          href={`/${locale}/workspaces`}
          className={cn(
            'inline-flex h-11 items-center rounded-md bg-primary px-4 text-body font-medium text-primary-foreground hover:bg-primary-hover md:h-9',
            focusRing,
          )}
        >
          {t.gate.toProjects}
        </a>
      </main>
    );
  }
  return (
    <LiveProvider ws={ws}>
      <Shell>{children}</Shell>
    </LiveProvider>
  );
}
