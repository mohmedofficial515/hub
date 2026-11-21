/**
 * @file The rendered task prompt (docs/07 §6.8, `GET /tasks/{key}/prompt`). English: agents read it.
 */
export interface TaskPromptData {
  readonly key: string;
  readonly title: string;
  readonly priority: string;
  readonly specialty: string;
  readonly effort: string | null;
  readonly repo: string | null;
  readonly branch: string | null;
  readonly body: string | null;
  readonly prompt: string | null;
  readonly acceptance: string | null;
  readonly decisions: readonly {
    readonly key: string;
    readonly title: string;
    readonly option: string;
    readonly rationale: string;
  }[];
  readonly handoffs: readonly { readonly key: string; readonly summary: string }[];
  readonly docs: readonly { readonly path: string; readonly heading?: string | null }[];
  readonly blockedBy: readonly { readonly key: string; readonly title: string; readonly status: string }[];
}

function section(title: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : [`## ${title}`, ...lines, ''];
}

export function renderTaskPrompt(data: TaskPromptData): string {
  const tags = [data.priority, data.specialty, ...(data.effort ? [data.effort] : [])].join(' · ');
  const where = data.repo
    ? [`Repo: \`${data.repo}\`${data.branch ? ` · branch \`${data.branch}\`` : ''}`]
    : [];
  return [
    `# ${data.key} — ${data.title}  [${tags}]`,
    ...where,
    '',
    ...(data.body ? [data.body, ''] : []),
    ...section('Instructions', data.prompt ? [data.prompt] : []),
    ...section('Acceptance', data.acceptance ? [data.acceptance] : []),
    ...section(
      'Decisions that apply',
      data.decisions.map((d) => `- ${d.key} · ${d.title} → **${d.option}** — ${d.rationale}`),
    ),
    ...section(
      'Related handoffs',
      data.handoffs.map((h) => `- ${h.key} · ${h.summary}`),
    ),
    ...section(
      'Docs to read first',
      data.docs.map((d) => `- \`${d.path}\`${d.heading ? ` › ${d.heading}` : ''}`),
    ),
    ...section(
      'Blocked by (do not start until these close)',
      data.blockedBy.map((b) => `- ${b.key} · ${b.title} (${b.status})`),
    ),
    `When finished: run \`pnpm check\` in the repo, call \`hub.complete_task\` for ${data.key} (or \`hub.submit_task\` for review), and \`hub.log_session\` with what changed, what remains and any handoff for another team.`,
    '',
  ].join('\n');
}
