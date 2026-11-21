/**
 * @file Route decorators: `@Actor()`, `@CurrentPrincipal()`, `@Public()`, `@Permissions()`, `@RawResponse()`.
 * @description Every route declares `@Public()` or `@Permissions(...)`; an arch test enforces it.
 * `ActorGuard` (modules/identity) fills `request.principal` and `request.actor` before the handler runs.
 */
import type { Actor as ActorShape, MemberActor, PermissionAction, Principal } from '@hub/contracts';
import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

import { AppException } from '../errors';

export const PUBLIC_KEY = 'hub:public';
export const PERMISSIONS_KEY = 'hub:permissions';
export const RAW_RESPONSE_KEY = 'hub:raw-response';

/** The request as the guard leaves it. */
export interface HubRequest extends Request {
  principal?: Principal;
  actor?: MemberActor;
}

/** No sign-in needed. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_KEY, true);

/**
 * Route-level check: the actor's roles could ever do this. Card-bound grants (routed, specialty,
 * assignee, creator) are decided by `CardService.apply`, which sees the card.
 */
export const Permissions = (...actions: PermissionAction[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, actions);

/** Handler writes its own response body: SSE, MCP, plain text. */
export const RawResponse = (): MethodDecorator & ClassDecorator => SetMetadata(RAW_RESPONSE_KEY, true);

/** The member inside the route's `:ws` project. Use on any route under `/workspaces/:ws`. */
export const Actor = createParamDecorator((_data: unknown, context: ExecutionContext): MemberActor => {
  const actor = context.switchToHttp().getRequest<HubRequest>().actor;
  if (!actor) throw new AppException('hub.common.unauthorized');
  return actor;
});
export type Actor = ActorShape;

/** The authenticated member with no project: `/me`, `/workspaces` list and create. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const principal = context.switchToHttp().getRequest<HubRequest>().principal;
    if (!principal) throw new AppException('hub.common.unauthorized');
    return principal;
  },
);
