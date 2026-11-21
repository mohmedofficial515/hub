/**
 * @file Finds every `@CardActionHandler()` provider, so adding an action means adding a provider.
 */
import type { PermissionAction } from '@hub/contracts';
import { Injectable, SetMetadata } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { CARD_ACTION_HANDLER, type CardActionDefinition } from '../domain/card-action';

/** Marks a provider implementing `CardActionDefinition`. Add it to the providers of any module. */
export const CardActionHandler = (): ClassDecorator => SetMetadata(CARD_ACTION_HANDLER, true);

@Injectable()
export class CardActionRegistry {
  private actions: Map<PermissionAction, CardActionDefinition> | undefined;

  constructor(private readonly discovery: DiscoveryService) {}

  private load(): Map<PermissionAction, CardActionDefinition> {
    if (this.actions) return this.actions;
    const actions = new Map<PermissionAction, CardActionDefinition>();
    for (const wrapper of this.discovery.getProviders()) {
      const type: unknown = wrapper.metatype;
      if (typeof type !== 'function' || !Reflect.getMetadata(CARD_ACTION_HANDLER, type)) continue;
      const definition = wrapper.instance as CardActionDefinition;
      if (actions.has(definition.action)) throw new Error(`Duplicate card action ${definition.action}`);
      actions.set(definition.action, definition);
    }
    this.actions = actions;
    return actions;
  }

  get(action: PermissionAction): CardActionDefinition | undefined {
    return this.load().get(action);
  }

  all(): readonly CardActionDefinition[] {
    return [...this.load().values()];
  }
}
