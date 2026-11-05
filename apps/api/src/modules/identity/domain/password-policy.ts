/**
 * @file Password rule (docs/04 §1.9): at least 12 characters and not a known common password.
 * @description The list is every entry of SecLists `10k-most-common` that is 12 characters or longer,
 * because the length rule already refuses all the others, plus a few obvious keyboard runs.
 */
export const PASSWORD_MIN_LENGTH = 12;

const COMMON = new Set([
  '123456789012',
  '1234567890123',
  'businessbabe',
  'contortionist',
  'films+pic+galeries',
  'masterbaiting',
  'masterbating',
  'masturbation',
  'motherfucker',
  'password1234',
  'passwordpassword',
  'pornographic',
  'qwertyuiop12',
  'qwertyuiop123',
  'scandinavian',
  'unbelievable',
]);

export function isWeakPassword(password: string): boolean {
  return password.length < PASSWORD_MIN_LENGTH || COMMON.has(password.toLowerCase());
}
