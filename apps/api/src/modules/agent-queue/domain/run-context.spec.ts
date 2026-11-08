import { decisionFolder, promptRoles, whyOf } from './run-context';

describe('a queued run’s context (D58 to D60)', () => {
  it('gives each role its brief, specialties and reading path', () => {
    const roles = promptRoles(['backend', 'frontend'], {
      backend: [
        { id: 'a', title: 'API', kind: 'doc', ref: 'docs/04-api.md' },
        { id: 'b', title: 'Pack', kind: 'action', ref: 'install' },
      ],
    });
    expect(roles.map((role) => role.label)).toEqual(['Backend', 'Frontend']);
    expect(roles[0]!.readFirst).toEqual(['docs/04-api.md']);
    expect(roles[0]!.specialties).toContain('backend');
    expect(roles[1]!.readFirst).toEqual([]);
  });

  it('puts a pending item in the folder its command names, else the main one', () => {
    const extra = ['F:/work/web', 'F:/work/web-admin'];
    expect(decisionFolder('git -C F:\\work\\web-admin push', 'F:/work/api', extra)).toBe('F:/work/web-admin');
    expect(decisionFolder('git push origin main', 'F:/work/api', extra)).toBe('F:/work/api');
  });

  it('takes the model’s own description as the reason', () => {
    expect(whyOf({ command: 'git push', description: ' Publish the fix ' })).toBe('Publish the fix');
    expect(whyOf({ command: 'git push' })).toBeNull();
  });
});
