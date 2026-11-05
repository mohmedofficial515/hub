'use client';

/**
 * @file boundaries.tsx
 * @description What a crash and an unknown address show, in the app's own words and tokens (review M9). Inside the shell the sidebar stays; outside it these take the page.
 */
import { useEffect } from 'react';

import { focusRing } from '@/components/cards/meta';
import { PageContainer } from '@/components/common/layout';
import { ErrorState } from '@/components/common/states';
import { useRoute } from '@/components/shell/router';
import { messages, useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface CaughtError {
  error: Error & { digest?: string };
  reset: () => void;
}

/** A page crashed inside the shell. */
export function PageCrash({ error, reset }: CaughtError) {
  const t = useT(messages).boundary;
  return (
    <PageContainer>
      <ErrorState title={t.crashTitle} detail={t.crashBody} code={error.digest} onRetry={reset} />
    </PageContainer>
  );
}

/** Something outside any page crashed, such as the shell itself. */
export function FullPageCrash({ error, reset }: CaughtError) {
  const t = useT(messages).boundary;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-1 bg-background p-4">
      <ErrorState title={t.crashTitle} detail={t.crashBody} code={error.digest} onRetry={reset} />
    </main>
  );
}

function NotFoundBody({ href, action }: { href: string; action: string }) {
  const t = useT(messages).boundary;
  useEffect(() => {
    document.title = `${t.notFoundTitle} · Hub`;
  }, [t.notFoundTitle]);
  return (
    <>
      <ErrorState title={t.notFoundTitle} detail={t.notFoundBody} code="404" className="pb-0" />
      <a
        href={href}
        className={cn(
          'mt-4 inline-flex h-11 items-center rounded-md bg-primary px-4 text-body font-medium text-primary-foreground hover:bg-primary-hover md:h-9',
          focusRing,
        )}
      >
        {action}
      </a>
    </>
  );
}

/** An unknown address with no project around it. */
export function FullPageNotFound() {
  const t = useT(messages).boundary;
  const locale = useLocale();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-1 bg-background p-4">
      <NotFoundBody href={`/${locale}/workspaces`} action={t.toProjects} />
    </main>
  );
}

/** An unknown view of a project: the sidebar stays, so the way out is right there. */
export function PageNotFound() {
  const t = useT(messages).boundary;
  const locale = useLocale();
  const { ws } = useRoute();
  return (
    <PageContainer>
      <div className="flex flex-col items-center gap-1">
        <NotFoundBody href={`/${locale}/${ws}/today`} action={t.toToday} />
      </div>
    </PageContainer>
  );
}
