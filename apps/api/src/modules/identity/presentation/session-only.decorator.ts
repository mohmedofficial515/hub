/**
 * @file `@SessionOnly()`: refuses API tokens on a route (docs/04 §3.2, docs/15 §2).
 * @description For the things a token must never reach: creating tokens, passwords, TOTP and the profile.
 * The session's other limit, CSRF, is checked where the cookie is read.
 */
import { SetMetadata } from '@nestjs/common';

export const SESSION_ONLY_KEY = 'hub:session-only';

export const SessionOnly = (): MethodDecorator & ClassDecorator => SetMetadata(SESSION_ONLY_KEY, true);
