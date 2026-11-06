// The one path to the approved base. Everything else in this version imports v5 through here.
export * from '../../../today/v5-peacock-app/kit';
export { portalRoot } from '../../../today/v5-peacock-app/kit/hooks';
import { fmt, plural } from '../../../today/v5-peacock-app/kit';

/** A plural with its number filled in. */
export const counted = (n: number, locale: 'ar' | 'en', forms: Parameters<typeof plural>[2]) => fmt(plural(n, locale, forms), { n });
