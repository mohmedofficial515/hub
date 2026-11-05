'use client';

/**
 * @file boundaries.tsx
 * @description What a crash and an unknown address show, in the app's own words and tokens (review M9). Inside the shell the sidebar stays; outside it these take the page.
 */
import { useEffect } from 'react';

import { PageContainer } from '@/components/common/layout';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { messages, useLocale, useT } from '@/lib/i18n';

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

function NotFoundBody() {
  const t = useT(messages).boundary;
  const locale = useLocale();
  useEffect(() => {
    document.title = `${t.notFoundTitle} · Hub`;
  }, [t.notFoundTitle]);
  return (
    <>
      <ErrorState title={t.notFoundTitle} detail={t.notFoundBody} code="404" className="pb-0" />
      <a href={`/${locale}/workspaces`} className="mt-4">
        <Button variant="primary" tabIndex={-1}>
          {t.toProjects}
        </Button>
      </a>
    </>
  );
}

/** An unknown address with no project around it. */
export function FullPageNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-1 bg-background p-4">
      <NotFoundBody />
    </main>
  );
}

/** An unknown view of a project: the sidebar stays, so the way out is right there. */
export function PageNotFound() {
  return (
    <PageContainer>
      <div className="flex flex-col items-center gap-1">
        <NotFoundBody />
      </div>
    </PageContainer>
  );
}
