/**
 * @file Suggestions with AI on a message (docs/16 §11, D66): merging a turn's proposals, and their words for a chat outside the panel. Pure.
 */
import {
  type ChatSuggestionDto,
  type ChatSuggestionsDto,
  chatSuggestionsSchema,
  type ProposedSuggestion,
  SUGGESTIONS_PER_TURN,
} from '@hub/contracts';

export function suggestionsToMarkdown(summary: string | null, items: readonly ProposedSuggestion[]): string {
  const lines = summary ? [summary, ''] : [];
  items.forEach((item, index) => {
    const title =
      item.kind === 'skill'
        ? `Skill /hub:${item.name}: ${item.description}`
        : `${item.kind === 'plan' ? 'Plan' : 'Task'}: ${item.title}`;
    lines.push(`${index + 1}. ${title}`, `   Why: ${item.why}`);
    if (item.kind === 'plan')
      item.steps.forEach((step, n) =>
        lines.push(`   ${n + 1}) ${step.title}${step.role ? ` (${step.role})` : ''}`),
      );
  });
  return lines.join('\n');
}

/** Merges a turn's new proposals into what the message already holds, capped. */
export function withProposals(
  current: unknown,
  summary: string | null,
  items: readonly ChatSuggestionDto[],
): ChatSuggestionsDto {
  const parsed = chatSuggestionsSchema.safeParse(current);
  const before = parsed.success ? parsed.data : { summary: null, items: [] };
  return {
    summary: summary ?? before.summary,
    items: [...before.items, ...items].slice(0, SUGGESTIONS_PER_TURN),
  };
}
