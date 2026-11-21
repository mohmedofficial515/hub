/**
 * @file Mention parsing.
 */
import { excerptOf, parseMentions } from './mentions';

const id = '0192f3a1-7c11-7000-8000-000000000abc';

describe('parseMentions', () => {
  it('finds users and roles, once each', () => {
    expect(parseMentions(`@user:${id} and @user:${id}, cc @role:qa @role:qa`)).toEqual({
      userIds: [id],
      roles: ['qa'],
    });
  });

  it('ignores an unknown role and a malformed id', () => {
    expect(parseMentions('@role:wizard @user:not-an-id hello@example.test')).toEqual({
      userIds: [],
      roles: [],
    });
  });
});

describe('excerptOf', () => {
  it('flattens whitespace and cuts long text', () => {
    expect(excerptOf('a\n\n b')).toBe('a b');
    expect(excerptOf('x'.repeat(200))).toHaveLength(141);
  });
});
