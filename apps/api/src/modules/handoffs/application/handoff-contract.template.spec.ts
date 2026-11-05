/**
 * @file Contract handoff golden files (docs/07 §6.6). The summary has both languages; the prompt is for agents.
 */
import { expectGolden } from '../../../../test/golden';
import {
  type ContractHandoffData,
  renderContractPrompt,
  renderContractSummary,
} from './handoff-contract.template';

const data: ContractHandoffData = {
  key: 'GTV-255',
  severity: 'breaking',
  specPath: 'openapi/openapi.json',
  branch: 'feat/wallet',
  repoUrl: 'https://github.com/example/backend',
  fromSha: 'aaaaaaa1111111',
  toSha: 'bbbbbbb2222222',
  sourceCardKey: 'GTV-250',
  entries: [
    { level: 'breaking', operation: 'DELETE', path: '/wallet/{id}', text: 'removed' },
    { level: 'notable', operation: 'GET', path: '/wallet', text: 'new field', comment: 'optional' },
    { level: 'info', operation: 'GET', path: '/health', text: 'description changed' },
  ],
};

describe('contract handoff', () => {
  it.each(['en', 'ar'] as const)('summary %s', (locale) => {
    expectGolden(`handoff-summary.${locale}.md`, renderContractSummary(data, locale));
  });

  it('prompt', () => {
    expectGolden('handoff-prompt.md', renderContractPrompt(data));
  });

  it('a summary stays inside its limit', () => {
    const long = Array.from({ length: 100 }, () => data.entries[0]) as ContractHandoffData['entries'];
    expect(renderContractSummary({ ...data, entries: long }, 'en').length).toBeLessThanOrEqual(1000);
  });
});
