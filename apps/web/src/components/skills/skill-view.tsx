'use client';

/**
 * @file skill-view.tsx
 * @description One skill, read (docs/16 §11, D64): when Claude uses it, its Markdown, the folder's other files by name, and for Hub's skills the earlier texts with Bring this back.
 * A restore is a save on the server: what is there now is kept too. A personal skill is read only, with any secret-looking value masked by the server.
 */
import type { SkillSource } from '@hub/contracts';
import { ChevronDown, History, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  cn,
  ErrorState,
  fmt,
  focusRing,
  Ltr,
  MarkdownView,
  Modal,
  RelativeTime,
  showToast,
  SkeletonRows,
  useLocale,
  useT,
  when as whenText,
} from '@/components/kit';
import { useRestoreSkill, useSkill, useSkillRevision, useSkillRevisions } from '@/features/skills/queries';
import { isHubError } from '@/lib/api/errors';

import type { SkillsMessages } from './words';

function Revision({
  name,
  id,
  label,
  createdAt,
  canRestore,
  baseHash,
}: {
  name: string;
  id: string;
  label: string;
  createdAt: string;
  canRestore: boolean;
  baseHash: string;
}) {
  const t = useT<SkillsMessages>('skills').view;
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const detail = useSkillRevision(name, open ? id : null);
  const restore = useRestoreSkill(name);
  return (
    <li
      data-skill-revision={id}
      className="flex min-w-0 flex-col gap-1.5 border-t border-border pt-2 first:border-t-0 first:pt-0"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-sm text-start text-body-sm text-foreground hover:underline md:min-h-8',
            focusRing,
          )}
        >
          <ChevronDown
            aria-hidden
            className={cn('size-3.5 shrink-0', open && 'rotate-180')}
            strokeWidth={1.75}
          />
          <span>{label}</span>
          <span className="text-muted-foreground">
            <RelativeTime iso={createdAt} />
          </span>
        </button>
        {canRestore && (
          <Button
            size="sm"
            variant="ghost"
            data-skill-restore
            busy={restore.isPending}
            onClick={() =>
              restore.mutate(
                { id, baseHash },
                {
                  onSuccess: () =>
                    showToast({ message: fmt(t.restored, { when: whenText(createdAt, locale) }) }),
                  onError: (error) =>
                    showToast({ tone: 'error', message: isHubError(error) ? error.message : t.restore }),
                },
              )
            }
          >
            <RotateCcw aria-hidden className="size-3.5" strokeWidth={1.75} />
            {t.restore}
          </Button>
        )}
      </div>
      {open && (
        <pre
          dir="ltr"
          tabIndex={0}
          className="key max-h-64 overflow-auto rounded-md bg-muted p-2 text-start text-body-sm whitespace-pre-wrap text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {detail.data?.text ?? ''}
        </pre>
      )}
    </li>
  );
}

export function SkillView({
  source,
  name,
  onOpenChange,
  canWrite,
}: {
  source: SkillSource;
  name: string | null;
  onOpenChange: (open: boolean) => void;
  /** The owner, on a Hub skill that is not one of Hub's protocols. */
  canWrite: boolean;
}) {
  const t = useT<SkillsMessages>('skills');
  const v = t.view;
  const query = useSkill(source, name);
  const skill = query.data;
  const revisions = useSkillRevisions(source === 'hub' ? name : null);
  const command = skill ? (source === 'hub' ? `/hub:${skill.name}` : `/${skill.name}`) : '';
  return (
    <Modal
      open={!!name}
      onOpenChange={onOpenChange}
      className="md:max-w-2xl"
      title={<Ltr mono>{skill?.userInvocable ? command : (name ?? '')}</Ltr>}
      description={source === 'personal' ? v.personalNote : undefined}
      footer={<Button onClick={() => onOpenChange(false)}>{v.close}</Button>}
    >
      {query.isPending ? (
        <SkeletonRows count={3} withAction={false} />
      ) : query.isError || !skill ? (
        <ErrorState
          thing={t.errorThing}
          code={isHubError(query.error) ? query.error.code : undefined}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div data-skill-view={skill.name} className="flex min-w-0 flex-col gap-4">
          <section className="flex flex-col gap-1">
            <h3 className="text-body-sm font-medium text-muted-foreground">{v.description}</h3>
            <p dir="auto" className="text-body text-foreground">
              {skill.description}
            </p>
          </section>
          <section className="flex min-w-0 flex-col gap-1">
            <h3 className="text-body-sm font-medium text-muted-foreground">{v.body}</h3>
            <div className="max-h-96 min-w-0 overflow-auto rounded-md border border-border p-3 text-body text-foreground">
              <MarkdownView source={skill.body} dir="auto" headingOffset={3} />
            </div>
          </section>
          {skill.otherFiles.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="text-body-sm font-medium text-muted-foreground">{v.otherFiles}</h3>
              <ul className="flex flex-wrap gap-1">
                {skill.otherFiles.map((file) => (
                  <li key={file}>
                    <code
                      dir="ltr"
                      translate="no"
                      className="key inline-block rounded-sm bg-muted px-1.5 py-0.5 text-body-sm text-foreground"
                    >
                      {file}
                    </code>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {source === 'hub' && (
            <section aria-labelledby="skill-history" className="flex flex-col gap-2">
              <h3
                id="skill-history"
                className="flex items-center gap-1.5 text-body-sm font-medium text-muted-foreground"
              >
                <History aria-hidden className="size-4" strokeWidth={1.75} />
                {v.history}
              </h3>
              {revisions.data && revisions.data.length === 0 ? (
                <p className="text-body-sm text-muted-foreground">{v.historyEmpty}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {(revisions.data ?? []).map((revision) => (
                    <Revision
                      key={revision.id}
                      name={skill.name}
                      id={revision.id}
                      createdAt={revision.createdAt}
                      baseHash={skill.hash}
                      canRestore={canWrite && !skill.core}
                      label={
                        revision.reason === 'restore'
                          ? v.restoreReason
                          : revision.savedBy?.displayName
                            ? fmt(v.savedBy, { name: revision.savedBy.displayName })
                            : v.savedByNone
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
