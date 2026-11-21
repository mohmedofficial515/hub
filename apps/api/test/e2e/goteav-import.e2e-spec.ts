/**
 * @file The importer on real Postgres (docs/06 §7): backdating, idempotency, "edited since import", secrets refused.
 */
import type { INestApplication } from '@nestjs/common';

import { GoteavImportService } from '@/modules/capture';
import { CardService } from '@/modules/cards';

import { aMember, aWorkspace, userActor } from '../factories';
import { db } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';

const input = {
  decisionsYaml: `decisions:
  - { id: d.open, titleAr: مفتوح, status: proposed, modules: [payments], questionAr: سؤال؟, recommendationAr: نعم. }
  - { id: d.done, titleAr: مقرر, status: done, modules: [flights], lastVerifiedAt: "2026-09-01", questionAr: سؤال؟, summaryAr: لأن, recommendationAr: نعم. }
`,
  suggestionsYaml: `suggestions:
  - { id: s.a, titleAr: أ, target: backend, status: proposed, priority: P1, effort: S, modules: [wallet], category: ux }
  - { id: s.b, titleAr: ب, target: both, status: done, priority: P2, effort: M, modules: [wallet], category: ux }
  - { id: s.c, titleAr: ج, target: dashboard, status: in_progress, modules: [reporting] }
`,
  statusFiles: [
    { name: '2026-09-20-progress-ar.md', content: '# تقرير\nنص', firstCommitAt: null },
    { name: 'release-2026-09-30.ar.md', content: '# إصدار\nنص', firstCommitAt: null },
    { name: 'integration-gaps.md', content: '# Gaps', firstCommitAt: '2026-09-22T10:00:00.000Z' },
  ],
  contractChangesMd: '- 2026-09-28 `feat/x` `631e423` (dev): **breaking** Moved. (IR-1)\n',
  docsPath: 'F:/Goteav/backend/docs',
  repoPaths: ['F:/Goteav/backend'],
};

describe('Goteav import', () => {
  let app: INestApplication;
  let service: GoteavImportService;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    service = app.get(GoteavImportService, { strict: false });
  });

  async function project() {
    const workspace = await aWorkspace(db());
    const owner = await aMember(db(), workspace.id, ['owner']);
    return { workspace, owner };
  }

  it('creates the cards, backdated, with no realtime or clock in the dates', async () => {
    const { workspace, owner } = await project();
    const report = await service.run(workspace.slug, input);
    expect(report).toMatchObject({
      created: { decision: 2, task: 3, doc: 3, release: 1, handoff: 1 },
      problems: [],
      skippedEdited: [],
    });

    const decided = await db().card.findFirst({
      where: { workspaceId: workspace.id, externalKey: 'import:decision:d.done' },
      include: { decision: true, events: { orderBy: { seq: 'asc' } } },
    });
    expect(decided).toMatchObject({ status: 'decided', createdVia: 'import', source: 'import' });
    expect(decided?.createdAt.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(decided?.lastEventAt.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(decided?.decision?.decidedById).toBe(owner.id);
    expect(decided?.events.map((event) => [event.kind, event.via])).toEqual([
      ['created', 'import'],
      ['decided', 'import'],
    ]);

    const handoff = await db().card.findFirst({
      where: { workspaceId: workspace.id, type: 'handoff' },
      include: { handoff: true },
    });
    expect(handoff).toMatchObject({ status: 'applied', commitSha: '631e423', branch: 'feat/x' });
    expect(handoff?.createdAt.toISOString()).toBe('2026-09-28T12:00:00.000Z');

    const release = await db().card.findFirst({
      where: { workspaceId: workspace.id, type: 'release' },
      include: { release: true },
    });
    expect(release?.release?.version).toBe('2026-09-30');
    expect(await db().cardLink.count({ where: { workspaceId: workspace.id } })).toBe(1);

    const undated = await db().card.findFirst({
      where: { workspaceId: workspace.id, externalKey: 'doc:backend-docs:docs/status/integration-gaps.md' },
    });
    expect(undated?.createdAt.toISOString()).toBe('2026-09-22T10:00:00.000Z');

    const settings = await db().workspaceSetting.findMany({ where: { workspaceId: workspace.id } });
    expect(settings.map((row) => row.key).sort()).toEqual(['modules.catalogue', 'onboarding.paths']);
    expect((await db().workspace.findUnique({ where: { id: workspace.id } }))?.repoPaths).toEqual([
      'F:/Goteav/backend',
    ]);
    const run = await db().captureRun.findFirst({
      where: { kind: 'import' },
      orderBy: { startedAt: 'desc' },
    });
    expect(run?.status).toBe('ok');
  });

  it('a second run creates nothing, and a third takes a changed text', async () => {
    const { workspace } = await project();
    await service.run(workspace.slug, input);
    const count = await db().card.count({ where: { workspaceId: workspace.id } });
    const again = await service.run(workspace.slug, input);
    expect(again.created).toEqual({});
    expect(again.unchanged).toBe(count);
    expect(await db().card.count({ where: { workspaceId: workspace.id } })).toBe(count);
    expect(await db().cardLink.count({ where: { workspaceId: workspace.id } })).toBe(1);

    const changed = await service.run(workspace.slug, {
      ...input,
      suggestionsYaml: input.suggestionsYaml.replace('titleAr: أ,', 'titleAr: أ جديد,'),
    });
    expect(changed.updated).toEqual({ task: 1 });
  });

  it('leaves alone a card edited since, and reports it', async () => {
    const { workspace, owner } = await project();
    await service.run(workspace.slug, input);
    const task = await db().card.findFirstOrThrow({
      where: { workspaceId: workspace.id, externalKey: 'import:suggestion:s.a' },
    });
    const actor = userActor(owner.id, workspace.id, ['owner']);
    await app.get(CardService, { strict: false }).apply(actor, { cardKey: task.key }, 'card.edit_content', {
      title: 'Edited by a person',
    });
    const report = await service.run(workspace.slug, {
      ...input,
      suggestionsYaml: input.suggestionsYaml.replace('titleAr: أ,', 'titleAr: أ جديد,'),
    });
    expect(report.skippedEdited).toEqual([task.key]);
    const after = await db().card.findUnique({ where: { id: task.id } });
    expect(after?.title).toBe('Edited by a person');
  });

  it('a dry run writes nothing', async () => {
    const { workspace } = await project();
    const report = await service.run(workspace.slug, { ...input, dryRun: true });
    expect(report.created).toMatchObject({ decision: 2, task: 3 });
    expect(await db().card.count({ where: { workspaceId: workspace.id } })).toBe(0);
    expect(await db().source.count({ where: { workspaceId: workspace.id } })).toBe(0);
  });

  it('refuses a card holding a secret, and says so', async () => {
    const { workspace } = await project();
    const report = await service.run(workspace.slug, {
      ...input,
      suggestionsYaml: `suggestions:\n  - { id: s.x, titleAr: "AKIAIOSFODNN7EXAMPLE", target: backend, status: proposed }\n`,
    });
    expect(report.problems).toEqual([
      'import:suggestion:s.x holds something like a secret, so it was not imported',
    ]);
    expect(await db().card.count({ where: { workspaceId: workspace.id, type: 'task' } })).toBe(0);
  });
});
