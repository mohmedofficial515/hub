export { CardService } from './application/card.service';
export { CardActionHandler, CardActionRegistry } from './application/card-action.registry';
export { CardRepository } from './application/ports/card.repository';
export { CardsModule } from './cards.module';
export type {
  ApplyResult,
  CardActionContext,
  CardActionDefinition,
  CardActionPlan,
  CardCreateFields,
  CardEventView,
  CardPatch,
  CardTarget,
  CardView,
  FollowUp,
  JsonObject,
  NotificationIntent,
} from './domain/card-action';
