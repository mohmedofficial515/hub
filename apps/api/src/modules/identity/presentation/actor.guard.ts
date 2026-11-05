/**
 * @file Global guard: authenticates, resolves the Actor for `:ws`, checks `@Permissions` at route level.
 * @description Card-bound grants (routed, specialty, assignee, creator) cannot be judged here; `CardService`
 * decides them with the card in hand. Roles are resolved live on every request (docs/15 §5). A route marked
 * `@SessionOnly()` refuses API tokens, which keeps secrets and token creation away from MCP (D27 limits).
 */
import { isPossible, type PermissionAction } from '@hub/contracts';
import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AppException } from '@/shared/errors';
import { type HubRequest, PERMISSIONS_KEY, PUBLIC_KEY } from '@/shared/http';

import { ActorService } from '../application/actor.service';
import { PRINCIPAL_RESOLVER, type PrincipalResolver } from '../application/ports/principal-resolver';
import { SESSION_ONLY_KEY } from './session-only.decorator';

@Injectable()
export class ActorGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly actors: ActorService,
    @Inject(PRINCIPAL_RESOLVER) private readonly resolver: PrincipalResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<HubRequest>();
    const principal = await this.resolver.resolve(request);
    if (!principal) throw new AppException('hub.common.unauthorized');
    request.principal = principal;

    if (principal.kind !== 'user' && this.reflector.getAllAndOverride<boolean>(SESSION_ONLY_KEY, targets)) {
      throw new AppException('hub.identity.token_scope');
    }

    const slug = request.params['ws'];
    if (typeof slug === 'string') {
      const actor = await this.actors.forSlug(principal, slug);
      request.actor = actor;
      const actions = this.reflector.getAllAndOverride<PermissionAction[] | undefined>(
        PERMISSIONS_KEY,
        targets,
      );
      if (actions?.some((action) => !isPossible(action, actor.roles))) {
        throw new AppException('hub.common.forbidden');
      }
    }
    return true;
  }
}
