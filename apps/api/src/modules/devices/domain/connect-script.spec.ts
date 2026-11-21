/**
 * @file The one command stays one line that every shell reads the same, and the script parses.
 */
import { Script } from 'node:vm';

import { bootstrapScript, connectCommand } from './connect-script';

describe('connectCommand', () => {
  it('has nothing a shell would expand', () => {
    const command = connectCommand('http://localhost:7310');
    expect(command).toContain('http://localhost:7310/api/v1/connect/bootstrap');
    expect(command).not.toMatch(/[$!%`\n]/);
    expect(command.match(/"/g)).toHaveLength(2);
  });

  it('names the uninstall when asked', () => {
    expect(connectCommand('http://x:1', 'uninstall')).toContain('bootstrap?action=uninstall');
  });
});

describe('bootstrapScript', () => {
  it('parses, for both actions, and a URL cannot break out of its string', () => {
    for (const action of ['connect', 'uninstall'] as const) {
      expect(() => new Script(bootstrapScript('http://a";process.exit(9);"', action))).not.toThrow();
    }
    expect(bootstrapScript('http://a";x', 'connect')).toContain(JSON.stringify('http://a";x'));
  });
});
