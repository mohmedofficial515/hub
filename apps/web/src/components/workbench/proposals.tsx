'use client';

/**
 * @file proposals.tsx
 * @description What `/hub:suggest` ends in (docs/16 §11, D66): one card with each proposal, its kind, why it is proposed, and Accept and Dismiss. Nothing exists until Accept,
 * which the server carries out through the normal create path and answers what it made. Styled as the plan card is: one neutral surface, the kind in a coloured icon and a word.
 */
import type { ChatSuggestionDto, ChatSuggestionsDto } from '@hub/contracts';
import { isAllowed } from '@hub/contracts';
import { Check, ChevronDown, ClipboardList, Lightbulb, ListTodo, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

import {
  AppLink,
  Bidi,
  Button,
  cn,
  fill,
  fmt,
  focusRing,
  kitMessages,
  Ltr,
  MarkdownView,
  openCard,
  RoleBadge,
  showToast,
  Tip,
  useSession,
  useT,
} from '@/components/kit';
import { useAnswerSuggestion } from '@/features/chat/queries';
import { isHubError } from '@/lib/api/errors';

import type { ChatMessages } from './words';

const KIND_ICON = { task: ListTodo, plan: ClipboardList, skill: Sparkles } as const;

function Proposal({ chatId, item }: { chatId: string; item: ChatSuggestionDto }) {
  const t = useT<ChatMessages>('chat').panel.pro.proposals;
  const kit = useT(kitMessages);
  const { roles } = useSession();
  const answer = useAnswerSuggestion(chatId);
  const [showText, setShowText] = useState(false);
  const { proposal } = item;
  const Icon = KIND_ICON[proposal.kind];
  const title = proposal.kind === 'skill' ? `/hub:${proposal.name}` : proposal.title;
  const skillBlocked = proposal.kind === 'skill' && !isAllowed('skill.manage', roles);
  const press = (decision: 'accept' | 'dismiss') =>
    answer.mutate(
      { suggestion: item.id, decision },
      {
        onSuccess: (done) => {
          if (decision === 'accept' && done.ref) {
            showToast({ message: fmt(t.done[done.proposal.kind], { ref: done.ref }) });
          }
        },
        onError: (error) =>
          showToast({ tone: 'error', message: isHubError(error) ? error.message : t.ownerOnly }),
      },
    );
  return (
    <li
      data-wb-proposal={proposal.kind}
      data-wb-proposal-state={item.state}
      className="flex min-w-0 flex-col gap-1.5 border-t border-border pt-2.5 first:border-t-0 first:pt-0"
    >
      <div className="flex min-w-0 items-start gap-2">
        <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-body-sm text-muted-foreground">{t.kinds[proposal.kind]}</p>
          <p className="text-body font-medium text-foreground">
            {proposal.kind === 'skill' ? <Ltr mono>{title}</Ltr> : <Bidi>{title}</Bidi>}
          </p>
          {proposal.kind === 'skill' && (
            <p className="text-body-sm text-foreground">
              <Bidi>{proposal.description}</Bidi>
            </p>
          )}
          <p className="mt-0.5 text-body-sm text-muted-foreground">
            <span className="font-medium">{t.why}: </span>
            <Bidi>{proposal.why}</Bidi>
          </p>
        </div>
        {proposal.kind === 'task' && proposal.ownerRole && proposal.ownerRole in kit.roles && (
          <RoleBadge role={proposal.ownerRole} iconOnly className="mt-0.5 shrink-0" />
        )}
      </div>
      {proposal.kind === 'plan' && (
        <ol aria-label={t.steps} className="flex flex-col gap-1 ps-6">
          {proposal.steps.map((step, index) => (
            <li
              key={`${index}-${step.title}`}
              className="flex min-w-0 items-start gap-2 text-body-sm text-foreground"
            >
              <span aria-hidden className="w-4 shrink-0 text-center text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <Bidi>{step.title}</Bidi>
              </span>
              {step.role && step.role in kit.roles && (
                <RoleBadge role={step.role} iconOnly className="shrink-0" />
              )}
            </li>
          ))}
        </ol>
      )}
      {proposal.kind !== 'skill' && proposal.related && proposal.related.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 ps-6 text-body-sm text-muted-foreground">
          <span>{t.related}:</span>
          {proposal.related.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => openCard(key)}
              className={cn(
                'rounded-sm underline underline-offset-2 hover:text-foreground max-md:min-h-11',
                focusRing,
              )}
            >
              <Ltr mono>{key}</Ltr>
            </button>
          ))}
        </p>
      )}
      {proposal.kind === 'skill' && (
        <div className="flex min-w-0 flex-col gap-1 ps-6">
          <button
            type="button"
            aria-expanded={showText}
            data-wb-proposal-text
            onClick={() => setShowText((v) => !v)}
            className={cn(
              'inline-flex w-fit items-center gap-1 rounded-sm text-body-sm text-muted-foreground underline underline-offset-2 hover:text-foreground max-md:min-h-11',
              focusRing,
            )}
          >
            {showText ? t.hideText : t.showText}
            <ChevronDown
              aria-hidden
              className={cn('size-3.5', showText && 'rotate-180')}
              strokeWidth={1.75}
            />
          </button>
          {showText && (
            <div className="wb-prose max-h-72 min-w-0 overflow-auto rounded-md bg-muted p-2 text-body-sm text-foreground">
              <MarkdownView source={proposal.body} dir="auto" headingOffset={3} />
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 ps-6">
        {item.state === 'open' ? (
          <>
            <Tip
              k="proposal:accept"
              off={skillBlocked ? { why: t.ownerOnly, fix: '' } : null}
              label={t.accept}
            >
              <Button
                size="sm"
                data-wb-proposal-accept
                busy={answer.isPending && answer.variables?.decision === 'accept'}
                disabled={answer.isPending || skillBlocked}
                onClick={() => press('accept')}
              >
                <Check aria-hidden className="size-3.5" strokeWidth={2} />
                {t.accept}
              </Button>
            </Tip>
            <Tip k="proposal:dismiss" label={t.dismiss}>
              <Button
                size="sm"
                variant="ghost"
                data-wb-proposal-dismiss
                disabled={answer.isPending}
                onClick={() => press('dismiss')}
              >
                <X aria-hidden className="size-3.5" strokeWidth={1.75} />
                {t.dismiss}
              </Button>
            </Tip>
          </>
        ) : item.state === 'accepted' && item.ref ? (
          <p
            role="status"
            data-wb-proposal-done
            className="inline-flex flex-wrap items-center gap-1.5 text-body-sm font-medium text-foreground"
          >
            <Check aria-hidden className="size-4 text-success-soft-foreground" strokeWidth={2} />
            {fill(proposal.kind === 'skill' ? t.acceptedSkill : t.accepted, {
              ref:
                proposal.kind === 'skill' ? (
                  <AppLink
                    view="skills"
                    query={{ skill: item.ref }}
                    className={cn('rounded-sm underline underline-offset-2', focusRing)}
                  >
                    <Ltr mono>{item.ref}</Ltr>
                  </AppLink>
                ) : (
                  <button
                    type="button"
                    onClick={() => openCard(item.ref ?? '')}
                    className={cn('rounded-sm underline underline-offset-2 max-md:min-h-11', focusRing)}
                  >
                    <Ltr mono>{item.ref}</Ltr>
                  </button>
                ),
            })}
          </p>
        ) : (
          <p role="status" className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground">
            <X aria-hidden className="size-4" strokeWidth={1.75} />
            {t.dismissed}
          </p>
        )}
      </div>
    </li>
  );
}

/** The proposals of one turn, with how many the owner has answered. */
export function ProposalsCard({ chatId, suggestions }: { chatId: string; suggestions: ChatSuggestionsDto }) {
  const t = useT<ChatMessages>('chat').panel.pro.proposals;
  const answered = suggestions.items.filter((item) => item.state !== 'open').length;
  return (
    <section
      aria-label={t.title}
      data-wb-proposals
      className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card p-3"
    >
      <header className="flex items-start gap-2">
        <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <h3 className="text-body-lg font-semibold text-foreground">{t.title}</h3>
          {suggestions.summary && (
            <p className="text-body-sm text-foreground">
              <Bidi>{suggestions.summary}</Bidi>
            </p>
          )}
          <p className="text-body-sm text-muted-foreground">{t.note}</p>
        </div>
        <span className="shrink-0 text-body-sm text-muted-foreground tabular-nums">
          {fmt(t.answered, { done: answered, n: suggestions.items.length })}
        </span>
      </header>
      <ul className="flex min-w-0 flex-col gap-2.5">
        {suggestions.items.map((item) => (
          <Proposal key={item.id} chatId={chatId} item={item} />
        ))}
      </ul>
    </section>
  );
}
