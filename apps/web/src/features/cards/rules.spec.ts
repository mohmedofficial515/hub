/**
 * @file The web's use of the shared rules: which answer wins, what a status is predicted to be, what can be undone, and which URL is called.
 */
import { describe, expect, it } from 'vitest';

import { actionRequest, actionsFor, inverseOf, predictedStatus } from './rules';
import type { CardListItem } from './types';

const task = (status: string, extra: Partial<CardListItem> = {}) =>
  ({
    key: 'GTV-1',
    type: 'task',
    status,
    ownerRole: 'frontend',
    task: { specialty: 'frontend' },
    ...extra,
  }) as unknown as CardListItem;

describe('actionsFor', () => {
  it('uses the API answer while the status is the one it answered for', () => {
    const server = [{ action: 'claim', enabled: false, mode: 'now', permission: 'task.claim' }];
    const card = task('ready', { serverActions: server, serverActionsStatus: 'ready' });
    expect(actionsFor(card, ['owner'], 'u1')).toBe(server);
  });

  it('asks the shared rules once the status is only predicted', () => {
    const card = task('claimed', { serverActions: [], serverActionsStatus: 'ready', assigneeId: 'u1' });
    expect(actionsFor(card, ['frontend'], 'u1').map((a) => a.action)).toContain('start');
  });
});

describe('predictedStatus', () => {
  it('follows the machine', () => {
    expect(predictedStatus('task', 'ready', 'claim')).toBe('claimed');
    expect(predictedStatus('task', 'in_progress', 'submit_review')).toBe('in_review');
    expect(predictedStatus('decision', 'open', 'decide')).toBe('decided');
  });

  it('predicts nothing for a move the status does not allow', () => {
    expect(predictedStatus('task', 'done', 'claim')).toBeUndefined();
  });
});

describe('inverseOf', () => {
  it('offers Undo only where the API can take it back', () => {
    expect(inverseOf('task', 'claim')).toBe('unclaim');
    expect(inverseOf('decision', 'decide')).toBeUndefined();
  });
});

describe('actionRequest', () => {
  it('calls the endpoint of docs/04', () => {
    expect(actionRequest('goteav', 'task', 'GTV-1', 'complete', {}).path).toBe(
      'workspaces/goteav/tasks/GTV-1/done',
    );
    expect(actionRequest('goteav', 'task', 'GTV-1', 'submit_review', {}).path).toBe(
      'workspaces/goteav/tasks/GTV-1/submit-review',
    );
    expect(actionRequest('goteav', 'redesign', 'GTV-1', 'send_to_review', {}).path).toBe(
      'workspaces/goteav/redesign/GTV-1/submit-review',
    );
    expect(actionRequest('goteav', 'need', 'GTV-1', 'reject_delivery', {}).path).toBe(
      'workspaces/goteav/needs/GTV-1/reject-delivery',
    );
  });

  it('sends the fields the schemas take and none it was not given', () => {
    expect(
      actionRequest('g', 'decision', 'GTV-1', 'decide', { optionId: 'a', rationale: 'why' }).body,
    ).toEqual({ optionId: 'a', rationale: 'why' });
    expect(actionRequest('g', 'task', 'GTV-1', 'claim', {}).body).toEqual({});
  });
});
