/**
 * @file The prompt of the port task created on approve (docs/07 §6.7). English: agents read it.
 * @description The lab stays at `LAB_ROOT` in this release (docs/15 §3), so the path has no `apps/lab` prefix.
 */
export interface PortTaskData {
  readonly labPath: string;
  readonly redesignKey: string;
  readonly version: string;
  readonly app: string;
  readonly page: string;
  readonly labUrl: string;
  readonly decisionNote: string | null;
  readonly touchesComponents: readonly string[];
  readonly targetRepo: string;
}

export function renderPortTask(data: PortTaskData): string {
  const components = data.touchesComponents.map((name) => `\`${name}\``).join(', ');
  return [
    `# Port approved redesign ${data.labPath} (${data.redesignKey})`,
    '',
    `The owner approved version \`${data.version}\` of \`${data.app}/${data.page}\` in the lab (${data.labUrl}).${
      data.decisionNote ? ` Decision note: ${data.decisionNote}.` : ''
    }`,
    ...(components ? [`Touches shared components: ${components}`] : []),
    '',
    '## What to do',
    `1. Read the version README and review.md in \`${data.labPath}\` under the lab root.`,
    `2. Use the \`redesign-porter\` agent workflow: produce the impact map of every shared component this version changes and every page that uses them, then implement on a feature branch in \`${data.targetRepo}\` (ask the owner before creating the branch).`,
    '3. Keep i18n (ar/en), RTL, light/dark; wire real data; typecheck; tests; side-by-side screenshots against the lab version.',
    '4. When merged, call `hub.mark_redesign_ported` with the branch@commit reference and log your session.',
    '',
  ].join('\n');
}
