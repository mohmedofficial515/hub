/**
 * @file Owner decisions 6, 9a, 9b and 9c (2026-11-19): a step's why, size, after and acceptance as data; a plan in review sent back to draft
 * with a reason; the studio chat an idea or plan came from, written by the save and read by every member; and Release asking to confirm.
 */
import type { INestApplication } from '@nestjs/common';

import { aProject, aTask, created, db, eventsOf } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';

const MISSING = '019a6b52-6d1e-7c3a-9d1f-3a2b4c5d6e7f';

/** A studio chat of `userId` in the project, with two replies: what a save names. */
async function aChat(workspaceId: string, userId: string) {
  const device = await db().device.create({
    data: { userId, name: 'Laptop', platform: 'win32', pairedAt: new Date() },
  });
  const chat = await db().chat.create({
    data: { workspaceId, userId, deviceId: device.id, folder: 'F:/repo', mode: 'plan' },
  });
  const reply = (ordinal: number) =>
    db().chatMessage.create({ data: { workspaceId, chatId: chat.id, ordinal, role: 'assistant' } });
  const [first, second] = [await reply(1), await reply(2)];
  return { id: chat.id, message: first.id, refined: second.id };
}

describe('studio saves', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  it('a plan keeps each step’s why, size, after and acceptance, and drops an after that is not an earlier step', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const { id: CHAT, message: MESSAGE, refined: REFINED } = await aChat(project.id, pm.id);
    const { body } = await pm
      .post('/cards', {
        type: 'plan',
        title: 'Refund plan',
        detail: {
          steps: [
            { id: 's1', title: 'Schema', size: 'S', after: ['s2'] },
            {
              id: 's2',
              title: 'API',
              role: 'backend',
              why: 'The page reads it.',
              size: 'M',
              after: ['s1', 'missing'],
              acceptance: 'The e2e suite passes.',
            },
          ],
          sourceChatId: CHAT,
          sourceMessageId: MESSAGE,
        },
      })
      .expect(201);
    expect(body.data.detail).toMatchObject({
      sourceChatId: CHAT,
      sourceMessageId: MESSAGE,
      steps: [
        { id: 's1', title: 'Schema', size: 'S', done: false },
        {
          id: 's2',
          why: 'The page reads it.',
          size: 'M',
          after: ['s1'],
          acceptance: 'The e2e suite passes.',
        },
      ],
    });
    expect(body.data.detail.steps[0].after).toBeUndefined();
    await pm
      .post('/cards', { type: 'plan', title: 'Bad', detail: { steps: [{ title: 'X', size: 'XL' }] } })
      .expect(400);

    // A refinement saved by the studio names its new reply, and is one event.
    const key = body.data.key as string;
    const updated = await pm
      .patch(`/plans/${key}`, { body: 'Refined', sourceMessageId: REFINED })
      .expect(200);
    expect(updated.body.data.detail).toMatchObject({ sourceChatId: CHAT, sourceMessageId: REFINED });
    expect((await eventsOf(body.data.id as string)).map((event) => event.kind)).toEqual([
      'created',
      'plan_revised',
    ]);
  });

  it('a card names only its writer’s own chat, and the history says when the tie changed', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const other = await project.member(['pm']);
    const mine = await aChat(project.id, pm.id);
    const theirs = await aChat(project.id, other.id);
    const elsewhere = await aProject(app);
    const stranger = await aChat(elsewhere.id, pm.id);

    const plan = (detail: object) =>
      pm.post('/cards', { type: 'plan', title: 'P', detail: { steps: [], ...detail } });
    expect((await plan({ sourceChatId: theirs.id }).expect(404)).body.error.code).toBe('hub.chats.not_found');
    expect((await plan({ sourceChatId: MISSING }).expect(404)).body.error.code).toBe('hub.chats.not_found');
    expect((await plan({ sourceChatId: stranger.id }).expect(404)).body.error.code).toBe(
      'hub.chats.not_found',
    );
    expect((await plan({ sourceMessageId: theirs.message }).expect(404)).body.error.code).toBe(
      'hub.chats.message_not_found',
    );
    expect(
      (await plan({ sourceChatId: mine.id, sourceMessageId: theirs.message }).expect(404)).body.error.code,
    ).toBe('hub.chats.message_not_found');

    const card = await created(pm, {
      type: 'plan',
      title: 'Mine',
      detail: { steps: [], sourceChatId: mine.id },
    });
    // Another member may edit the plan, but not tie it to their session in place of the author's.
    await other.patch(`/plans/${card.key}`, { sourceChatId: mine.id }).expect(200);
    await other.patch(`/plans/${card.key}`, { sourceMessageId: mine.refined }).expect(404);
    const second = await aChat(project.id, pm.id);
    await pm.patch(`/plans/${card.key}`, { sourceChatId: second.id }).expect(200);
    expect((await eventsOf(card.id)).at(-1)).toMatchObject({
      kind: 'field_changed',
      data: { changes: [{ field: 'sourceChatId', from: mine.id, to: second.id }] },
    });

    const idea = await created(other, { type: 'idea', title: 'Idea', detail: {} });
    await other.patch(`/ideas/${idea.key}`, { sourceChatId: mine.id }).expect(404);
    await other.post('/cards', { type: 'idea', title: 'I', detail: { sourceChatId: mine.id } }).expect(404);
    await other.post(`/ideas/${idea.key}/to-plan`, { title: 'Plan', sourceChatId: mine.id }).expect(404);
    const { body } = await other.patch(`/ideas/${idea.key}`, { sourceChatId: theirs.id }).expect(200);
    expect(body.data.detail).toMatchObject({ sourceChatId: theirs.id });
    expect((await eventsOf(idea.id)).at(-1)).toMatchObject({
      kind: 'field_changed',
      data: { changes: [{ field: 'sourceChatId' }] },
    });
  });

  it('every member finds the plan and the idea a studio chat became', async () => {
    const project = await aProject(app);
    const owner = await project.member(['owner']);
    const qa = await project.member(['qa']);
    const { id: CHAT, refined: REFINED } = await aChat(project.id, owner.id);
    const { id: OTHER_CHAT, message: MESSAGE } = await aChat(project.id, owner.id);
    const plan = await created(owner, {
      type: 'plan',
      title: 'From the studio',
      detail: { steps: [], sourceChatId: CHAT },
    });
    await created(owner, { type: 'plan', title: 'Another', detail: { steps: [] } });
    const idea = await created(owner, {
      type: 'idea',
      title: 'From the idea studio',
      detail: { sourceChatId: OTHER_CHAT, sourceMessageId: MESSAGE },
    });

    const plans = (await qa.get('/plans', { sourceChat: CHAT }).expect(200)).body.data;
    expect(plans.map((row: { key: string }) => row.key)).toEqual([plan.key]);
    expect(plans[0].detail).toMatchObject({ sourceChatId: CHAT, sourceMessageId: null });
    const byReply = await created(owner, {
      type: 'plan',
      title: 'Saved from the panel',
      detail: { steps: [], sourceMessageId: REFINED },
    });
    const replies = (await qa.get('/plans', { sourceMessage: REFINED }).expect(200)).body.data;
    expect(replies.map((row: { key: string }) => row.key)).toEqual([byReply.key]);
    const ideas = (await qa.get('/ideas', { sourceChat: OTHER_CHAT }).expect(200)).body.data;
    expect(ideas).toMatchObject([
      { key: idea.key, detail: { sourceChatId: OTHER_CHAT, sourceMessageId: MESSAGE } },
    ]);
    expect((await qa.get('/ideas', { sourceChat: CHAT }).expect(200)).body.data).toEqual([]);
    await qa.get('/plans', { sourceChat: 'not-a-chat' }).expect(400);
  });

  it('an idea updated from a refined report names the new reply; Turn into a plan gives the plan its chat', async () => {
    const project = await aProject(app);
    const qa = await project.member(['qa']);
    const { id: OTHER_CHAT, refined: REFINED } = await aChat(project.id, qa.id);
    const { id: CHAT, message: MESSAGE } = await aChat(project.id, qa.id);
    const idea = await created(qa, { type: 'idea', title: 'Idea', detail: { sourceChatId: OTHER_CHAT } });
    const { body } = await qa.patch(`/ideas/${idea.key}`, { sourceMessageId: REFINED }).expect(200);
    expect(body.data.detail).toMatchObject({ sourceChatId: OTHER_CHAT, sourceMessageId: REFINED });

    const turned = await qa
      .post(`/ideas/${idea.key}/to-plan`, { title: 'Plan', sourceChatId: CHAT, sourceMessageId: MESSAGE })
      .expect(200);
    const planRow = await db().planDetail.findUniqueOrThrow({
      where: { cardId: turned.body.data.detail.planCardId as string },
    });
    expect(planRow).toMatchObject({ sourceChatId: CHAT, sourceMessageId: MESSAGE, sourceIdeaId: idea.id });
  });

  it('request changes sends a plan in review back to draft, with a reason, for owner and pm only', async () => {
    const project = await aProject(app);
    const creator = await project.member(['backend']);
    const pm = await project.member(['pm']);
    const plan = await created(creator, { type: 'plan', title: 'Plan', detail: { steps: [] } });

    await pm.post(`/plans/${plan.key}/request-changes`, { reason: 'Too early' }).expect(409);
    await creator.post(`/plans/${plan.key}/submit-review`).expect(200);
    const offered = (await pm.get(`/cards/${plan.key}`).expect(200)).body.data.actions;
    expect(offered).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'request_changes', mode: 'confirm', reason: true, enabled: true }),
      ]),
    );
    await creator.post(`/plans/${plan.key}/request-changes`, { reason: 'Mine' }).expect(403);
    await pm.post(`/plans/${plan.key}/request-changes`, {}).expect(400);
    const { body } = await pm
      .post(`/plans/${plan.key}/request-changes`, { reason: 'Split step two' })
      .expect(200);
    expect(body.data).toMatchObject({ status: 'draft', event: { kind: 'changes_requested' } });
    expect((await eventsOf(plan.id)).at(-1)).toMatchObject({
      kind: 'changes_requested',
      data: { reason: 'Split step two', from: 'in_review', to: 'draft' },
    });
  });

  it('a step’s acceptance becomes its task’s acceptance', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const plan = await created(pm, {
      type: 'plan',
      title: 'Plan',
      detail: { steps: [{ title: 'Wallet page', role: 'frontend', acceptance: 'It shows the balance.' }] },
    });
    const { body } = await pm.post(`/plans/${plan.key}/to-tasks`, {}).expect(200);
    const taskKey = body.data.detail.steps[0].taskKey as string;
    const task = await db().card.findFirstOrThrow({ where: { key: taskKey }, include: { task: true } });
    expect(task.task).toMatchObject({ acceptance: 'It shows the balance.' });
  });

  it('a planned release offers Release as a confirm, not as a destructive action', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const task = await created(pm, aTask());
    const release = await created(pm, {
      type: 'release',
      title: 'Autumn',
      detail: { version: '1.4.0', includedKeys: [task.key] },
    });
    const [first] = (await pm.get(`/cards/${release.key}`).expect(200)).body.data.actions;
    expect(first).toMatchObject({ action: 'release', mode: 'confirm', enabled: true });
    expect(first.destructive).toBeUndefined();
  });
});
