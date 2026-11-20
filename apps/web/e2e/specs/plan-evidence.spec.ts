/**
 * @file A plan step's evidence (v5-live-plan, batch 3) on the throwaway stack: pictures and a clip uploaded to a step through the API and through the
 * drawer's form, served from the card with their hidden data gone, the before and after slider by keys in reading direction, the clip's player, the
 * count on the step's row, and an SVG refused. Shots go to `src/components/planning/shots/plan-page-v5/`.
 */
import { deflateSync } from 'node:zlib';

import { expect, test, view, word, words } from '../support/hub';
import { aPhasedPlan, shoot } from '../support/plan-pages';

const HEADERS = { 'X-Requested-With': 'hub' };

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (data: Buffer) => {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const pngChunk = (type: string, body: Buffer) => {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([head, typed, crc]);
};

/** A real PNG of one colour with a stripe, and a text chunk holding a place, which Hub must drop. */
function aPng(rgb: [number, number, number], stripe: [number, number, number]) {
  const width = 320;
  const height = 180;
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      const colour = y > 70 && y < 110 ? stripe : rgb;
      row.set(colour, 1 + x * 3);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('tEXt', Buffer.from('Location\0Cairo 30.04,31.23', 'latin1')),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** The first bytes of an MP4: enough for Hub to know it, not a playable clip. */
const anMp4 = () =>
  Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom', 'latin1'), Buffer.alloc(64)]);

test('a step’s evidence: upload, served without its hidden data, compared by keys, counted, and SVG refused', async ({
  page,
  owner,
  locale,
  ws,
}) => {
  const l = words(locale, 'planning');
  const plan = await aPhasedPlan(owner, `Evidence ${locale} ${Date.now()}`);
  const card = await owner.card<{ detail: { steps: { id: string }[] } }>(plan.key);
  const stepId = card.detail.steps[0]!.id;
  const base = `/api/v1/workspaces/${ws}/plans/${plan.key}/steps/${stepId}/evidence`;
  const upload = (name: string, mimeType: string, buffer: Buffer, kind: string, caption?: string) =>
    owner.context.post(base, {
      headers: HEADERS,
      multipart: { kind, ...(caption ? { caption } : {}), file: { name, mimeType, buffer } },
    });

  expect(
    (
      await upload(
        'before.png',
        'image/png',
        aPng([200, 60, 60], [250, 250, 250]),
        'before',
        'The old screens',
      )
    ).ok(),
  ).toBe(true);
  // An SVG is refused whatever it claims to be.
  const svg = await upload(
    'x.png',
    'image/png',
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    'after',
  );
  expect(svg.status()).toBe(415);
  // A clip cannot be a picture's kind.
  expect((await upload('clip.mp4', 'video/mp4', anMp4(), 'after')).status()).toBe(422);
  expect((await upload('clip.mp4', 'video/mp4', anMp4(), 'video', 'A walk through')).ok()).toBe(true);

  const saved = await owner.card<{
    detail: { steps: { evidence?: { attachmentId: string; kind: string; width?: number }[] }[] };
  }>(plan.key);
  const evidence = saved.detail.steps[0]!.evidence ?? [];
  expect(evidence.map((e) => e.kind)).toEqual(['before', 'video']);
  expect(evidence[0]!.width).toBe(320);
  const file = await owner.context.get(
    `/api/v1/workspaces/${ws}/cards/${plan.key}/attachments/${evidence[0]!.attachmentId}/file`,
  );
  expect(file.headers()['content-type']).toBe('image/png');
  expect(file.headers()['x-content-type-options']).toBe('nosniff');
  const bytes = await file.body();
  expect(bytes.toString('latin1')).not.toContain('Cairo');
  // A clip answers a range, so a player can seek.
  const range = await owner.context.get(
    `/api/v1/workspaces/${ws}/cards/${plan.key}/attachments/${evidence[1]!.attachmentId}/file`,
    { headers: { Range: 'bytes=0-15' } },
  );
  expect(range.status()).toBe(206);
  expect((await range.body()).length).toBe(16);

  // The after picture, through the drawer's own form.
  // The first step is in the chapter the page opens on: Setup, which holds the next step.
  await page.goto(view(locale, ws, 'planning', `plan=${plan.key}`));
  const row = page.locator('#pj-chapter li', { hasText: 'Decide the scope' });
  await expect(row.locator('[data-pj-evidence-count]')).toBeVisible({ timeout: 60_000 });
  await row.getByRole('button', { name: /Decide the scope/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Decide the scope' });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: word(l, 'detail.evidence.add') }).click();
  await drawer.getByLabel(word(l, 'detail.evidence.file')).setInputFiles({
    name: 'after.png',
    mimeType: 'image/png',
    buffer: aPng([40, 120, 200], [255, 220, 80]),
  });
  await drawer.getByLabel(word(l, 'detail.evidence.kind')).selectOption('after');
  await drawer.getByLabel(new RegExp(`^${word(l, 'detail.evidence.caption')}`)).fill('The new screens');
  await drawer.getByRole('button', { name: word(l, 'detail.evidence.upload'), exact: true }).click();

  const slider = drawer.getByRole('slider', { name: word(l, 'detail.evidence.compareLabel') });
  await expect(slider).toBeVisible({ timeout: 30_000 });
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  await page.keyboard.press(locale === 'ar' ? 'ArrowLeft' : 'ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuenow', '2');
  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuenow', '100');
  await page.keyboard.press('Shift+' + (locale === 'ar' ? 'ArrowRight' : 'ArrowLeft'));
  await expect(slider).toHaveAttribute('aria-valuenow', '90');
  await expect(drawer.locator('video')).toHaveCount(1);
  await expect(drawer.getByAltText('The new screens')).toBeVisible();
  // The grid shows each picture's thumbnail, drawn again by Hub as a small WebP.
  const grid = drawer
    .getByRole('button', { name: word(l, 'detail.evidence.open').replace('{name}', 'The new screens') })
    .locator('img');
  await expect(grid).toHaveAttribute('src', /size=thumb$/);
  await shoot(page, 'evidence-drawer', locale);
});
