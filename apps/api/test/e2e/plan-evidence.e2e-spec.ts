/**
 * @file A plan step's evidence (v5-live-plan, batch 3): upload with the file read from its bytes, metadata dropped, SVG and HTML refused, the kind
 * checked, who may add and who may remove, the bytes served safely with a range, evidence kept across a plan save, and the attachment gone with it.
 */
import { deflateSync } from 'node:zlib';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { aProject, created, db, eventsOf } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (data: Buffer) => {
  let c = 0xffffffff;
  for (const byte of data) c = CRC[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, body: Buffer) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
};
/** A real 4×3 PNG with a text chunk holding a place. */
function aPng() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(4, 0);
  ihdr.writeUInt32BE(3, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  // Each row starts with its filter byte (0, none), then four grey pixels.
  const rows = Buffer.concat(
    Array.from({ length: 3 }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(4 * 3, 120)])),
  );
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('tEXt', Buffer.from('Location\0Cairo 30.04,31.23', 'latin1')),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const anMp4 = () =>
  Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom', 'latin1'), Buffer.alloc(64)]);

describe('plan step evidence', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps a picture without its metadata, serves it safely, refuses what is not a picture or a clip, and keeps it across a save', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const qa = await project.member(['qa']);
    const plan = await created(pm, {
      type: 'plan',
      title: 'Evidence plan',
      detail: { steps: [{ title: 'Screens', role: 'designer' }, { title: 'Page' }] },
    });
    const base = `/api/v1/workspaces/${project.slug}`;
    const upload = (
      userId: string,
      step: string,
      kind: string,
      file: Buffer,
      name: string,
      caption?: string,
    ) => {
      const test = request(app.getHttpServer())
        .post(`${base}/plans/${plan.key}/steps/${step}/evidence`)
        .set('x-test-user', userId)
        .field('kind', kind);
      if (caption) test.field('caption', caption);
      return test.attach('file', file, name);
    };

    // A member who did not write the plan may add evidence, like a work report.
    const added = await upload(qa.id, 's1', 'before', aPng(), 'before.png', 'The old screens').expect(200);
    const step = added.body.data.detail.steps[0] as {
      evidence: { attachmentId: string; kind: string; width: number; via: string; caption: string }[];
    };
    expect(step.evidence).toMatchObject([
      {
        kind: 'before',
        width: 4,
        height: 3,
        mime: 'image/png',
        via: 'web',
        caption: 'The old screens',
        addedBy: qa.id,
        thumb: true,
      },
    ]);
    const id = step.evidence[0]!.attachmentId;

    const file = await pm.get(`/cards/${plan.key}/attachments/${id}/file`).expect(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(file.headers['content-security-policy']).toContain("default-src 'none'");
    expect(Buffer.from(file.body as Buffer).toString('latin1')).not.toContain('Cairo');
    expect(Buffer.from(file.body as Buffer).toString('latin1')).toContain('IDAT');

    await upload(pm.id, 's1', 'after', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'x.png')
      .expect(415)
      .expect(({ body }) => expect(body.error.code).toBe('hub.plans.evidence_type'));
    await upload(pm.id, 's1', 'after', Buffer.from('<!doctype html><script>1</script>'), 'x.html').expect(
      415,
    );
    await upload(pm.id, 's1', 'after', anMp4(), 'clip.mp4')
      .expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('hub.plans.evidence_kind'));
    await upload(pm.id, 's9', 'after', aPng(), 'a.png').expect(404);
    const clip = await upload(pm.id, 's2', 'video', anMp4(), 'clip.mp4').expect(200);
    const clipId = (clip.body.data.detail.steps[1].evidence as { attachmentId: string }[])[0]!.attachmentId;
    const part = await pm
      .get(`/cards/${plan.key}/attachments/${clipId}/file`)
      .set('Range', 'bytes=0-15')
      .expect(206);
    expect(part.headers['content-range']).toBe(`bytes 0-15/${anMp4().length}`);

    // A plan save keeps the evidence, and the same steps again is no event.
    const before = (await eventsOf(plan.id)).length;
    await pm
      .patch(`/plans/${plan.key}`, {
        steps: [
          { id: 's1', title: 'Screens', role: 'designer' },
          { id: 's2', title: 'Page' },
        ],
      })
      .expect(200);
    const read = (await pm.get(`/cards/${plan.key}`).expect(200)).body.data.detail.steps as {
      evidence?: unknown[];
    }[];
    expect(read.map((s) => s.evidence?.length ?? 0)).toEqual([1, 1]);
    expect(await eventsOf(plan.id)).toHaveLength(before);
    await pm.patch(`/plans/${plan.key}`, { steps: read }).expect(200);
    expect(await eventsOf(plan.id)).toHaveLength(before);

    // A picture is drawn again: its thumbnail is a small WebP, and a clip has none.
    const thumb = await pm
      .get(`/cards/${plan.key}/attachments/${id}/file`)
      .query({ size: 'thumb' })
      .expect(200);
    expect(thumb.headers['content-type']).toBe('image/webp');
    await pm.get(`/cards/${plan.key}/attachments/${clipId}/file`).query({ size: 'thumb' }).expect(404);

    // Whoever added a file may remove it, and a member may not remove another's; the plan's owners remove any. The bytes go with it.
    const backend = await project.member(['backend']);
    await backend.del(`/plans/${plan.key}/steps/s1/evidence/${id}`).expect(403);
    await qa.del(`/plans/${plan.key}/steps/s2/evidence/${clipId}`).expect(403);
    await qa.del(`/plans/${plan.key}/steps/s1/evidence/${id}`).expect(200);
    await pm.del(`/plans/${plan.key}/steps/s2/evidence/${clipId}`).expect(200);
    expect(await db().cardAttachment.findUnique({ where: { id } })).toBeNull();
    expect(await db().cardAttachmentFile.findUnique({ where: { attachmentId: id } })).toBeNull();
    await pm.get(`/cards/${plan.key}/attachments/${id}/file`).expect(404);
    expect((await eventsOf(plan.id)).slice(-2)).toMatchObject([
      { kind: 'plan_steps_changed', data: { evidence: { stepId: 's1', removed: id } } },
      { kind: 'plan_steps_changed', data: { evidence: { stepId: 's2', removed: clipId } } },
    ]);
  });

  it('another project cannot read the file, and a failed action leaves no file behind', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const plan = await created(pm, { type: 'plan', title: 'Private', detail: { steps: [{ title: 'One' }] } });
    const added = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${project.slug}/plans/${plan.key}/steps/s1/evidence`)
      .set('x-test-user', pm.id)
      .field('kind', 'after')
      .attach('file', aPng(), 'after.png')
      .expect(200);
    const id = (added.body.data.detail.steps[0].evidence as { attachmentId: string }[])[0]!.attachmentId;
    const other = await (await aProject(app)).member(['owner']);
    await other.get(`/cards/${plan.key}/attachments/${id}/file`).expect(404);

    // A step full of evidence refuses the next, and the stored bytes are removed again.
    for (let i = 1; i < 10; i += 1) {
      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${project.slug}/plans/${plan.key}/steps/s1/evidence`)
        .set('x-test-user', pm.id)
        .field('kind', 'after')
        .attach('file', aPng(), `a${i}.png`)
        .expect(200);
    }
    const count = await db().cardAttachment.count({ where: { cardId: plan.id } });
    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${project.slug}/plans/${plan.key}/steps/s1/evidence`)
      .set('x-test-user', pm.id)
      .field('kind', 'after')
      .attach('file', aPng(), 'eleventh.png')
      .expect(409)
      .expect(({ body }) => expect(body.error.code).toBe('hub.plans.evidence_full'));
    expect(await db().cardAttachment.count({ where: { cardId: plan.id } })).toBe(count);
  });
});
