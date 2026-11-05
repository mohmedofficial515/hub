/**
 * @file Port from a request to a Principal.
 * @description H0-03 binds the real implementation (cookie session and bearer token) to this token in
 * `identity.module.ts`. Until then `NoPrincipalResolver` answers null, so non-public routes answer 401.
 */
import type { Principal } from '@hub/contracts';
import type { Request } from 'express';

export const PRINCIPAL_RESOLVER = Symbol('PRINCIPAL_RESOLVER');

export interface PrincipalResolver {
  /** The authenticated member, or null when the request carries no valid credentials. */
  resolve(request: Request): Promise<Principal | null>;
}

export class NoPrincipalResolver implements PrincipalResolver {
  async resolve(): Promise<Principal | null> {
    return null;
  }
}
