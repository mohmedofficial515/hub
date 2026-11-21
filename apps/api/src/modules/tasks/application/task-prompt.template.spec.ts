/**
 * @file Task prompt golden files (docs/07 §6.8). English only: agents read it.
 */
import { expectGolden } from '../../../../test/golden';
import { renderTaskPrompt, type TaskPromptData } from './task-prompt.template';

const full: TaskPromptData = {
  key: 'GTV-248',
  title: 'Refund button',
  priority: 'P1',
  specialty: 'frontend',
  effort: 'M',
  repo: 'web',
  branch: 'feat/refund',
  body: 'Customers ask for this.',
  prompt: 'Add the button to the wallet page.',
  acceptance: '- [ ] It refunds',
  decisions: [{ key: 'GTV-231', title: 'Provider', option: 'Provider A', rationale: 'It works' }],
  handoffs: [{ key: 'GTV-250', summary: 'The refund route changed' }],
  docs: [{ path: 'docs/21-confirmation-safety.md', heading: 'Refunds' }, { path: 'docs/00.md' }],
  blockedBy: [{ key: 'GTV-260', title: 'Refund API', status: 'in_progress' }],
};

describe('renderTaskPrompt', () => {
  it('with everything', () => {
    expectGolden('task-prompt.full.md', renderTaskPrompt(full));
  });

  it('with the least', () => {
    expectGolden(
      'task-prompt.minimal.md',
      renderTaskPrompt({
        ...full,
        effort: null,
        repo: null,
        branch: null,
        body: null,
        prompt: null,
        acceptance: null,
        decisions: [],
        handoffs: [],
        docs: [],
        blockedBy: [],
      }),
    );
  });
});
