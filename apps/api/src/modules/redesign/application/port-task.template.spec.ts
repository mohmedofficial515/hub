/**
 * @file Port task prompt golden file (docs/07 §6.7). English only: agents read it.
 */
import { expectGolden } from '../../../../test/golden';
import { renderPortTask } from './port-task.template';

describe('renderPortTask', () => {
  it('with a note and components', () => {
    expectGolden(
      'port-task.md',
      renderPortTask({
        labPath: 'web/wallet/v2-flight-path',
        redesignKey: 'GTV-261',
        version: 'v2-flight-path',
        app: 'web',
        page: 'wallet',
        labUrl: '/lab/#/web/wallet/v2-flight-path',
        decisionNote: 'Keep the header',
        touchesComponents: ['Button', 'Card'],
        targetRepo: 'web',
      }),
    );
  });

  it('with neither, the lines are left out', () => {
    const text = renderPortTask({
      labPath: 'a',
      redesignKey: 'GTV-1',
      version: 'v',
      app: 'a',
      page: 'p',
      labUrl: 'u',
      decisionNote: null,
      touchesComponents: [],
      targetRepo: 'a',
    });
    expect(text).not.toContain('Decision note');
    expect(text).not.toContain('Touches shared components');
  });
});
