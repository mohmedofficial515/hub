import { Check, History, RotateCcw } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { Button, cn, useCard, useRoute, type DocCard } from '../core/kit';
import { Menu } from '../core/composer';
import { deviceOf, engineOff as offReason, restoreRevision, startDoc, useWb } from '../core/store';
import { wbMessages } from '../core/strings';
import { Tip } from '../core/tips';
import { tipCopy } from '../core/tips-copy';

/**
 * The document protocol's three ways in, on the page they act on. A quiet row of outline buttons: Docs has no filled button, by the kit's rule, because a
 * page with no next step does not lean. Each starts the protocol in the panel, and nothing is written from here.
 */
export function DocBar({ doc }: { doc?: DocCard }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const route = useRoute();
  const open = useCard(route.cardKey ?? '');
  const d = t.pro.docBar;
  const f = tipCopy[locale].facts;
  const device = deviceOf(wb.device).name[locale];
  const engineOff = offReason(wb.engine);
  const isTask = open?.type === 'task';
  const state = doc ? wb.docs[doc.key] : undefined;
  return (
    <div role="group" aria-label={d.label} data-wb-docbar className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-1.5">
      <span className="px-1.5 text-body-sm text-muted-foreground">{d.label}</span>
      {doc && (
        <Tip k="doc.improve" off={engineOff} vars={{ device }} label={d.improve} facts={[[f.doc, doc.doc.path, true]]}>
          <Button size="sm" data-wb-doc-improve disabled={!!engineOff} onClick={() => startDoc('improve', { key: doc.key, path: doc.doc.path })}>
            {d.improve}
          </Button>
        </Tip>
      )}
      <Tip k="doc.document" off={engineOff ?? (isTask ? null : 'notTask')} vars={{ device }} label={d.document} facts={isTask ? [[f.card, open.key, true]] : undefined}>
        <Button size="sm" data-wb-doc-document disabled={!!engineOff || !isTask} onClick={() => open && startDoc('document', { key: open.key })}>
          {d.document}
        </Button>
      </Tip>
      <Tip k="doc.gaps" off={engineOff} vars={{ device }} label={d.gaps}>
        <Button size="sm" data-wb-doc-gaps disabled={!!engineOff} onClick={() => startDoc('gaps')}>
          {d.gaps}
        </Button>
      </Tip>
      {doc &&
        (state ? (
          <Menu
            side="bottom"
            align="end"
            label={d.revisions}
            trigger={
              <Tip k="doc.revisions">
                <Button size="sm" variant="ghost" data-wb-doc-revisions className="ms-auto">
                  <History aria-hidden className="size-3.5" strokeWidth={1.75} />
                  {d.revisions}
                </Button>
              </Tip>
            }
          >
            <DropdownMenu.Label className="px-2.5 py-1.5 text-body-sm font-medium text-muted-foreground">{d.revisions}</DropdownMenu.Label>
            {state.revisions.map((r) => {
              const current = r.id === state.current;
              return (
                <DropdownMenu.Item
                  key={r.id}
                  disabled={current}
                  data-wb-revision={r.id}
                  onSelect={() => restoreRevision(doc.key, r.id, locale)}
                  className={cn('flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-2.5 py-1.5 text-body-sm text-foreground outline-none select-none data-[highlighted]:bg-accent data-[disabled]:cursor-default md:min-h-9')}
                >
                  {current ? <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : <RotateCcw aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      <bdi dir="ltr" className="key">
                        {r.id}
                      </bdi>{' '}
                      {current ? d.current : d.restore}
                    </span>
                    <span className="block text-muted-foreground">
                      {r.note[locale]}. {r.at[locale]}
                    </span>
                  </span>
                </DropdownMenu.Item>
              );
            })}
          </Menu>
        ) : (
          <Tip k="doc.revisions" off="noRevisions" label={d.revisions} wrapClassName="ms-auto">
            <Button size="sm" variant="ghost" disabled>
              <History aria-hidden className="size-3.5" strokeWidth={1.75} />
              {d.revisions}
            </Button>
          </Tip>
        ))}
    </div>
  );
}
