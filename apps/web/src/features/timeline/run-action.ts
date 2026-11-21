'use client';

/**
 * @file run-action.ts
 * @description Run a card's action from a row that does not live in the card caches: a timeline row, an inbox item or a deadline. An action with
 * no form runs here; any other opens the sheet on its form, as every page of the design does.
 */
import { useQueryClient } from '@tanstack/react-query';

import { openCard, useRoute } from '@/components/shell/router';
import { actionsFor, usePerformAction } from '@/features/cards/actions';
import { qk } from '@/features/cards/keys';
import { type CardFullDto, toHubCard } from '@/features/cards/map';
import { getCard } from '@/features/cards/store';
import type { HubCard } from '@/features/cards/types';
import { useSession } from '@/features/session/session';
import type { CardAction } from '@/lib/i18n';

/** An API row with its detail, as the card the kit reads. */
export const asCard = (dto: unknown): HubCard => toHubCard(dto as CardFullDto);

export function useRunAction() {
  const perform = usePerformAction();
  const client = useQueryClient();
  const { ws } = useRoute();
  const { roles, me } = useSession();

  return (card: HubCard, action: CardAction) => {
    // `perform` reads the card from the caches. Seeded as stale, so a sheet opening on it reads the whole card at once.
    if (!getCard(card.key, ws)) client.setQueryData(qk.card(ws, card.key), card, { updatedAt: 0 });
    const mode = actionsFor(card, roles, me.id).find((a) => a.action === action)?.mode;
    if (mode === 'now') perform(card.key, action);
    else openCard(card.key, { action });
  };
}
