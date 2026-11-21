'use client';

/**
 * @file projects-page.tsx
 * @description `/workspaces`: projects with their awaiting counts, and the New project wizard (docs/15 §5). A member with exactly one project
 * never lingers here (docs/09 §2), unless they came to create another.
 */
import { useQueryClient } from '@tanstack/react-query';
import { FolderKanban, LogOut, Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Direction, Tooltip as RadixTooltip } from 'radix-ui';
import { useEffect, useState } from 'react';

import { LanguageAndTheme } from '@/components/auth/auth-frame';
import {
  Button,
  EmptyState,
  ErrorState,
  focusRing,
  Ltr,
  plural,
  RoleBadge,
  Skeleton,
} from '@/components/kit';
import { Ocellus } from '@/components/shell/ocellus';
import { qk } from '@/features/cards/keys';
import { signOut } from '@/features/session/auth';
import { useMe, useWorkspaces, type WorkspaceRef } from '@/features/session/session';
import { isHubError } from '@/lib/api/errors';
import { useDocumentTitle } from '@/lib/hooks';
import { messages, useLocale, useT } from '@/lib/i18n';
import type { WorkspacesDict } from '@/lib/i18n/page-dicts';
import { cn } from '@/lib/utils';

import { NewProjectWizard } from './new-project-wizard';

function ProjectCard({ project }: { project: WorkspaceRef }) {
  const t = useT<WorkspacesDict>('workspaces');
  const locale = useLocale();
  const count = project.awaitingCount ?? 0;
  return (
    <a
      href={`/${locale}/${project.slug}/today`}
      className={cn(
        'flex min-h-32 flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors duration-120 hover:bg-accent',
        focusRing,
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-body-lg font-semibold text-foreground">{project.name}</span>
        <Ltr mono className="shrink-0 text-body-sm text-muted-foreground">
          {project.keyPrefix}
        </Ltr>
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        {project.roles.map((role) => (
          <RoleBadge key={role} role={role} />
        ))}
      </span>
      <span className="mt-auto flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
        {project.awaitingCount !== undefined && <span>{plural(count, locale, t.awaiting)}</span>}
        {project.status && project.status !== 'active' && <span>· {t.status[project.status]}</span>}
      </span>
    </a>
  );
}

export function ProjectsPage() {
  const t = useT<WorkspacesDict>('workspaces');
  useDocumentTitle(t.title);
  const shell = useT(messages);
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const me = useMe();
  const projects = useWorkspaces();
  const creating = params.get('new') === '1';
  const [wizard, setWizard] = useState(false);

  // After mount: a dialog portals into the page, so the server cannot draw it.
  useEffect(() => {
    if (creating) setWizard(true);
  }, [creating]);

  // docs/09 §2: one project, no list.
  const list = projects.data;
  useEffect(() => {
    if (!creating && !wizard && list?.length === 1 && list[0])
      router.replace(`/${locale}/${list[0].slug}/today`);
  }, [creating, wizard, list, locale, router]);

  const created = (slug: string) => {
    void client.invalidateQueries({ queryKey: qk.workspaces });
    void client.invalidateQueries({ queryKey: qk.me });
    router.push(`/${locale}/${slug}/today`);
  };

  const unauthorised = isHubError(projects.error) && projects.error.status === 401;
  useEffect(() => {
    if (unauthorised) window.location.assign(`/${locale}/sign-in`);
  }, [unauthorised, locale]);

  return (
    <Direction.Provider dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <RadixTooltip.Provider delayDuration={200}>
        <div id="hub-root" className="min-h-dvh bg-background text-foreground">
          <header className="flex h-14 items-center gap-2 border-b border-border px-4">
            <Ocellus />
            <span translate="no" className="text-title-sm font-semibold text-foreground">
              Hub
            </span>
            <div className="ms-auto flex items-center gap-1">
              <LanguageAndTheme signedIn t={shell} />
              <Button variant="ghost" onClick={() => void signOut(locale)} className="hit-44 max-md:px-2">
                <LogOut aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
                <span className="max-md:sr-only">{shell.sidebar.signOut}</span>
              </Button>
            </div>
          </header>
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto flex w-full max-w-275 flex-col gap-6 px-4 pt-4 pb-28 outline-none md:gap-8 md:px-6 md:pt-6"
          >
            <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h1 className="hub-page-title text-headline text-balance text-foreground">{t.title}</h1>
                {me.data && (
                  <p className="mt-0.5 text-body-lg text-muted-foreground">{me.data.displayName}</p>
                )}
              </div>
              {!!list?.length && (
                <Button onClick={() => setWizard(true)}>
                  <Plus aria-hidden className="size-4" strokeWidth={1.75} />
                  {t.new}
                </Button>
              )}
            </header>

            {projects.isPending ? (
              <div role="status" aria-label={t.loading} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : projects.isError ? (
              <ErrorState
                thing={t.title}
                code={isHubError(projects.error) ? projects.error.code : undefined}
                onRetry={() => void projects.refetch()}
              />
            ) : list?.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                size="page"
                title={t.emptyTitle}
                action={
                  <Button variant="primary" onClick={() => setWizard(true)}>
                    <Plus aria-hidden className="size-4" strokeWidth={1.75} />
                    {t.new}
                  </Button>
                }
              >
                {t.emptyBody}
              </EmptyState>
            ) : (
              <ul
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                aria-label={plural(list?.length ?? 0, locale, t.count)}
              >
                {list?.map((project) => (
                  <li key={project.slug}>
                    <ProjectCard project={project} />
                  </li>
                ))}
              </ul>
            )}
          </main>
          <NewProjectWizard open={wizard} onOpenChange={setWizard} onCreated={created} />
        </div>
      </RadixTooltip.Provider>
    </Direction.Provider>
  );
}
