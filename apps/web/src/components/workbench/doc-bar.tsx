'use client';

/**
 * @file doc-bar.tsx
 * @description The document protocol's ways in, on the page they act on, and the doc's real revisions (docs/16 §7.1, §10). Ported from the approved design.
 */
import { Check, History, RotateCcw } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import {
  Button,
  cn,
  type DocCard,
  RelativeTime,
  showToast,
  Tip,
  useCard,
  useRoute,
  useT,
} from '@/components/kit';
import { useDocRevisions, useRestoreDocRevision } from '@/features/docs/queries';
import { isHubError } from '@/lib/api/errors';

import { Menu } from './composer';
import { engineBlocks, startSkill, useMaybeWb, useWb } from './store';
import type { ChatMessages } from './words';

/**
 * The document protocol's three ways in, on the page they act on. A quiet row of outline buttons: Docs has no filled button, by the kit's rule, because a
 * page with no next step does not lean. Each starts the protocol in the panel, and nothing is written from here.
 */
export function DocBar({ doc }: { doc?: DocCard | undefined }) {
  const wb = useMaybeWb();
  return wb ? <Bar doc={doc} /> : null;
}

function Bar({ doc }: { doc?: DocCard | undefined }) {
  const t = useT<ChatMessages>('chat').panel;
  const tipWords = useT<ChatMessages>('chat').tips;
  const wb = useWb();
  const route = useRoute();
  const open = useCard(route.cardKey ?? '');
  const d = t.pro.docBar;
  const f = tipWords.facts;
  const device = wb.deviceName;
  const engineOff = engineBlocks(wb.engine) ? (wb.engine as 'offline') : null;
  const isTask = open?.type === 'task';
  const revisions = useDocRevisions(doc?.key ?? null).data ?? [];
  const restore = useRestoreDocRevision(doc?.key ?? '');
  return (
    <div
      role="group"
      aria-label={d.label}
      data-wb-docbar
      className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-1.5"
    >
      <span className="px-1.5 text-body-sm text-muted-foreground">{d.label}</span>
      {doc && (
        <Tip
          k="doc:improve"
          off={engineOff}
          vars={{ device }}
          label={d.improve}
          facts={[[f.doc, doc.doc.path, true]]}
        >
          <Button
            size="sm"
            data-wb-doc-improve
            disabled={!!engineOff}
            onClick={() => void startSkill(`/hub:doc improve ${doc.key}`, { card: doc.key })}
          >
            {d.improve}
          </Button>
        </Tip>
      )}
      {/* Only beside an open task: a way in that cannot apply is left out, not shown disabled (knowledge-04). */}
      {isTask && (
        <Tip
          k="doc:document"
          off={engineOff}
          vars={{ device }}
          label={d.document}
          facts={[[f.card, open.key, true]]}
        >
          <Button
            size="sm"
            data-wb-doc-document
            disabled={!!engineOff}
            onClick={() => void startSkill(`/hub:doc document ${open.key}`, { card: open.key })}
          >
            {d.document}
          </Button>
        </Tip>
      )}
      <Tip k="doc:gaps" off={engineOff} vars={{ device }} label={d.gaps}>
        <Button
          size="sm"
          data-wb-doc-gaps
          disabled={!!engineOff}
          onClick={() => void startSkill('/hub:doc gaps', {})}
        >
          {d.gaps}
        </Button>
      </Tip>
      {doc &&
        (revisions.length > 0 ? (
          <Menu
            side="bottom"
            align="end"
            label={d.revisions}
            trigger={
              <Tip k="doc:revisions">
                <Button size="sm" variant="ghost" data-wb-doc-revisions className="ms-auto">
                  <History aria-hidden className="size-3.5" strokeWidth={1.75} />
                  {d.revisions}
                </Button>
              </Tip>
            }
          >
            <DropdownMenu.Label className="px-2.5 py-1.5 text-body-sm font-medium text-muted-foreground">
              {d.revisions}
            </DropdownMenu.Label>
            <p className="flex items-start gap-2 px-2.5 py-1.5 text-body-sm text-muted-foreground">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
              {d.current}
            </p>
            {revisions.map((r) => (
              <DropdownMenu.Item
                key={r.id}
                data-wb-revision={r.id}
                onSelect={() =>
                  restore.mutate(
                    { revision: r.id },
                    {
                      onError: (error) =>
                        showToast({
                          tone: 'error',
                          message: isHubError(error) ? error.message : t.pro.saved.restore,
                        }),
                    },
                  )
                }
                className={cn(
                  'flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-2.5 py-1.5 text-body-sm text-foreground outline-none select-none data-[highlighted]:bg-accent md:min-h-9',
                )}
              >
                <RotateCcw
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{d.restore}</span>
                  <RelativeTime iso={r.createdAt} className="block text-muted-foreground" />
                </span>
              </DropdownMenu.Item>
            ))}
          </Menu>
        ) : (
          <Tip k="doc:revisions" off="noRevisions" label={d.revisions} wrapClassName="ms-auto">
            <Button size="sm" variant="ghost" disabled>
              <History aria-hidden className="size-3.5" strokeWidth={1.75} />
              {d.revisions}
            </Button>
          </Tip>
        ))}
    </div>
  );
}
