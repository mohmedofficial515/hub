/**
 * @file The filter reaches nested strings and never echoes the value.
 */
import { AppException } from '../errors';
import { assertNoSecrets } from './secret-filter';

const secret = `ghp_${'a1B2'.repeat(9)}`;

describe('assertNoSecrets', () => {
  it('passes clean values', () => {
    expect(() => assertNoSecrets({ title: 'x', tags: ['a'], n: 1, nested: { a: null } })).not.toThrow();
  });

  it('names the pattern and the field path, not the value', () => {
    let caught: unknown;
    try {
      assertNoSecrets({ detail: { steps: [{ title: secret }] } });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AppException);
    const exception = caught as AppException;
    expect(exception.code).toBe('hub.security.secret_detected');
    expect(exception.details).toEqual({ pattern: 'github_token', field: 'detail.steps.0.title' });
    expect(JSON.stringify(exception.details)).not.toContain(secret);
  });
});
