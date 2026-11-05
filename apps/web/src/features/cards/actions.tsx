'use client';

/**
 * @file actions.tsx
 * @description `usePerformAction`: run an action the way the whole app does. The status moves at once, the sheet closes, a toast says so,
 * and a refused request puts everything back and shows the API's words. Undo appears only where the API has a real inverse.
 */
import { fill, Ltr } from '@/components/common/text';
import { showToast } from '@/components/common/toast';
import { closeCard, currentRoute } from '@/components/shell/router';
import { post } from '@/lib/api/client';
import { isHubError } from '@/lib/api/errors';
import { type CardAction, kitMessages, useT } from '@/lib/i18n';
import { focusRowWhenReady } from '@/lib/keyboard-list';

import { useSession } from '../session/session';
import { type ActionPayload, actionRequest, actionsFor, inverseOf, predictedStatus } from './rules';
import { getCard, writeCard } from './store';
import type { CardType, Role } from './types';

export { type ActionPayload, actionsFor, type AvailableAction, awaitedAction, inverseOf } from './rules';

/** Run the action on the card that carries it: a redesign's Claim belongs to its port task (09 §10), which the API names. */
function actionTarget(key: string, action: CardAction, roles: readonly Role[], memberId: string | null) {
  const card = getCard(key);
  if (action !== 'claim' || card?.type !== 'redesign') return key;
  return actionsFor(card, roles, memberId).find((a) => a.action === 'claim')?.targetKey;
}

export async function sendAction(
  type: CardType,
  key: string,
  status: string,
  action: CardAction,
  payload: ActionPayload,
) {
  const { ws } = currentRoute();
  const request = actionRequest(ws, type, key, action, payload);
  const to = predictedStatus(type, status, action);
  await writeCard(
    { key, ...(to ? { fields: { status: to } } : {}) },
    () => post(request.path, request.body),
    ws,
  );
}

export function usePerformAction() {
  const t = useT(kitMessages);
  const { roles, me } = useSession();
  return (key: string, action: CardAction, payload: ActionPayload = {}, opts: { cmd?: string } = {}) => {
    const target = actionTarget(key, action, roles, me.id);
    // No target, no write, and so no success message.
    if (!target) return;
    const card = getCard(target);
    if (!card) return;
    const { type, status } = card;
    if (currentRoute().cardKey === key) closeCard();

    const inverse = inverseOf(type, action);
    const message = fill(t.done[action], { key: <Ltr mono>{target}</Ltr> });
    const cmd = action === 'claim' ? `/hub:next ${target}` : opts.cmd;
    showToast({
      message,
      ...(cmd ? { cmd } : {}),
      ...(inverse
        ? {
            onUndo: () => {
              const now = predictedStatus(type, status, action) ?? status;
              void sendAction(type, target, now, inverse, {}).catch((error: unknown) =>
                reportFailure(error, t.actionFailed),
              );
              focusRowWhenReady(key);
            },
          }
        : {}),
    });

    void sendAction(type, target, status, action, payload).catch((error: unknown) => {
      reportFailure(error, t.actionFailed);
      focusRowWhenReady(key);
    });
  };
}

function reportFailure(error: unknown, fallback: string) {
  showToast({ message: isHubError(error) ? error.message : fallback, tone: 'error' });
}
