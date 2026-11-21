/**
 * @file The contract handoff's summary and prompt (docs/07 §6.6). The OpenAPI adapter fills them from an oasdiff
 * changelog. The prompt is English only: agents read it.
 */
export type TemplateLocale = 'en' | 'ar';

export interface ContractEntry {
  readonly level: 'breaking' | 'notable' | 'info';
  readonly operation: string;
  readonly path: string;
  readonly text: string;
  readonly comment?: string;
}

export interface ContractHandoffData {
  readonly key: string;
  readonly severity: string;
  readonly specPath: string;
  readonly branch: string;
  readonly repoUrl: string;
  readonly fromSha: string;
  readonly toSha: string;
  readonly sourceCardKey: string;
  readonly entries: readonly ContractEntry[];
}

const SUMMARY_LIMIT = 1000;

const SUMMARY_TEXT = {
  en: (d: { breaking: number; notable: number; info: number; path: string; branch: string; range: string }) =>
    `Contract change: ${d.breaking} breaking, ${d.notable} notable, ${d.info} informational changes in \`${d.path}\` on \`${d.branch}\` (${d.range}).`,
  ar: (d: { breaking: number; notable: number; info: number; path: string; branch: string; range: string }) =>
    `تغيير في العقد: ${d.breaking} كاسر، ${d.notable} ملحوظ، ${d.info} للعلم في \`${d.path}\` على \`${d.branch}\` (${d.range}).`,
};

function counts(entries: readonly ContractEntry[]) {
  const of = (level: ContractEntry['level']) => entries.filter((entry) => entry.level === level).length;
  return { breaking: of('breaking'), notable: of('notable'), info: of('info') };
}

export function renderContractSummary(data: ContractHandoffData, locale: TemplateLocale): string {
  const range = `${data.fromSha.slice(0, 7)}..${data.toSha.slice(0, 7)}`;
  const lines = [
    SUMMARY_TEXT[locale]({ ...counts(data.entries), path: data.specPath, branch: data.branch, range }),
    ...data.entries
      .filter((entry) => entry.level !== 'info')
      .map(
        (entry) =>
          `- ${entry.level === 'breaking' ? '⛔' : '⚠️'} \`${entry.operation} ${entry.path}\`: ${entry.text}`,
      ),
  ];
  const text = lines.join('\n');
  return text.length > SUMMARY_LIMIT ? `${text.slice(0, SUMMARY_LIMIT - 1)}…` : text;
}

const LEVEL_LABEL = { breaking: 'BREAKING', notable: 'NOTABLE', info: 'INFO' } as const;

export function renderContractPrompt(data: ContractHandoffData): string {
  const { breaking, notable, info } = counts(data.entries);
  return [
    `# Contract change ${data.key} — ${data.severity} (${breaking} breaking, ${notable} notable, ${info} info)`,
    '',
    `The backend OpenAPI contract changed on branch \`${data.branch}\` (${data.repoUrl}/compare/${data.fromSha}...${data.toSha}).`,
    `Source commits: ${data.sourceCardKey}.`,
    '',
    '## Changes',
    ...data.entries.map(
      (entry) =>
        `- [${LEVEL_LABEL[entry.level]}] \`${entry.operation} ${entry.path}\` — ${entry.text}${
          entry.comment ? ` (${entry.comment})` : ''
        }`,
    ),
    '',
    '## What to do',
    "1. In `Goteav-Dashboard`: run `pnpm api:sync` (regenerates the client from the backend's `openapi.json`), then `pnpm typecheck` and fix every type error the regeneration surfaces.",
    '2. In `web`: run `pnpm api:sync` and `pnpm typecheck`; fix the affected features.',
    "3. For each **breaking** entry above, find every call site of the operation (search the generated client's operationId) and update request/response handling; add or adjust tests.",
    '4. Run `pnpm check` in both projects.',
    `5. When done, call \`hub.acknowledge_handoff\`/\`hub.apply_handoff\` for ${data.key} (or mark it applied in Hub) and log your session with \`hub.log_session\`, listing the files changed.`,
    'Do not change the backend. If a change cannot be applied without a backend fix, open a handoff back to `backend` with `hub.create_handoff` describing it.',
    '',
  ].join('\n');
}
