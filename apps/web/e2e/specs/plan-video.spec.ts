/**
 * @file The plan on video (v5-live-plan, batch 4) on the throwaway stack: the owner asks for the explainer, the film Hams made is attached through
 * MCP as the run would (from a folder registered on the project), and the page plays it with its chapters by phase, captions, poster and "Open in
 * Hams"; asking again says first what leaves the machine. No Claude run and no Gemini request: the files are the lab's real GTV-472 export when it
 * is on this machine, or stand-ins made here. Shots go to `src/components/planning/shots/plan-page-v5/`.
 */
import { copyFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

import { expect, mcp, test, view, word, words } from '../support/hub';
import { aPhasedPlan, shoot } from '../support/plan-pages';

const HEADERS = { 'X-Requested-With': 'hub' };
const LAB_FILM = resolve(__dirname, '../../../lab/hub/plan-page/v5-live-plan/media/video');

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
/** A plain 320×180 PNG poster. */
function aPoster() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(320, 0);
  ihdr.writeUInt32BE(180, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(320 * 3, 90)]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: 180 }, () => row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** The export plan-film writes: the lab's real one when present, else stand-ins (a header-only MP4, a plain poster, short captions). */
function anExport() {
  const folder = mkdtempSync(join(tmpdir(), 'hub-hams-e2e-'));
  if (existsSync(join(LAB_FILM, 'plan-explainer.mp4'))) {
    for (const name of ['plan-explainer.mp4', 'plan-explainer-poster.jpg', 'plan-explainer.ar.vtt']) {
      copyFileSync(join(LAB_FILM, name), join(folder, name));
    }
    return { folder, video: 'plan-explainer.mp4', poster: 'plan-explainer-poster.jpg', real: true };
  }
  writeFileSync(
    join(folder, 'plan-explainer.mp4'),
    Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom', 'latin1'), Buffer.alloc(256)]),
  );
  writeFileSync(join(folder, 'poster.png'), aPoster());
  writeFileSync(
    join(folder, 'plan-explainer.ar.vtt'),
    ['WEBVTT', '', '1', '00:00:00.000 --> 00:00:03.000', 'دي الخطة', ''].join('\n'),
  );
  return { folder, video: 'plan-explainer.mp4', poster: 'poster.png', real: false };
}

test('the plan on video: asked for, attached as the run would, played by chapters, and asked again with the privacy line first', async ({
  page,
  owner,
  locale,
  ws,
}) => {
  test.setTimeout(240_000);
  const v = words(locale, 'planning');
  const plan = await aPhasedPlan(owner, `Video ${locale} ${Date.now()}`);
  const asked = await owner.context.post(`/api/v1/workspaces/${ws}/plans/${plan.key}/explainer`, {
    headers: HEADERS,
    data: { voice: 'google', googleVoice: 'Charon' },
  });
  expect(asked.ok()).toBe(true);

  const film = anExport();
  const project = await owner.get<{ repoPaths: string[] }>(`workspaces/${ws}`);
  const setFolders = (repoPaths: string[]) =>
    owner.context.patch(`/api/v1/workspaces/${ws}`, { data: { repoPaths }, headers: HEADERS });
  expect((await setFolders([...project.repoPaths, film.folder])).ok()).toBe(true);
  try {
    const hub = await mcp(ws);
    try {
      const done = await hub.call('attach_plan_explainer', {
        key: plan.key,
        revision: 1,
        video: join(film.folder, film.video),
        poster: join(film.folder, film.poster),
        captions: join(film.folder, 'plan-explainer.ar.vtt'),
        chapters: [
          { phase: null, start: 0 },
          { phase: 0, start: 14.64 },
          { phase: 1, start: 32.09 },
          { phase: 2, start: 77.53 },
        ],
        hamsProject: { id: 'plan-e2e', url: 'http://127.0.0.1:4700/projects/plan-e2e' },
      });
      expect(done).toContain(plan.key);
    } finally {
      await hub.close();
    }
  } finally {
    await setFolders(project.repoPaths);
  }

  await page.goto(view(locale, ws, 'planning', `plan=${plan.key}`));
  const section = page.locator('[data-pj-explainer="ready"]');
  await expect(section).toBeVisible({ timeout: 60_000 });
  const chapters = section.getByRole('navigation', { name: word(v, 'detail.video.chapters') });
  await expect(chapters.getByRole('button')).toHaveCount(4);
  await expect(chapters.getByRole('button').nth(2)).toContainText('Build');
  await expect(section.getByRole('link', { name: word(v, 'detail.video.openInHams') })).toHaveAttribute(
    'href',
    'http://127.0.0.1:4700/projects/plan-e2e',
  );
  const video = section.locator('video');
  await expect(video.locator('track')).toHaveCount(1);
  if (film.real) {
    // The real film plays from a chapter, and that chapter lights its phase on the map.
    await chapters.getByRole('button').nth(2).click();
    await expect(chapters.getByRole('button').nth(2)).toHaveAttribute('aria-current', 'true', {
      timeout: 15_000,
    });
    await video.evaluate((el: HTMLVideoElement) => el.pause());
  }
  await section.scrollIntoViewIfNeeded();
  await shoot(page, 'video-ready', locale, async () => {
    await section.scrollIntoViewIfNeeded();
  });

  // Asking again: what leaves the machine is said before anything starts.
  await section.getByRole('button', { name: word(v, 'detail.video.again') }).click();
  const notice = page.locator('[data-pj-explainer-notice="google"]');
  await expect(notice).toContainText(word(v, 'detail.video.googleNotice'));
  await shoot(page, 'video-request', locale, async () => {
    await page.locator('[data-pj-explainer-request]').scrollIntoViewIfNeeded();
  });
});
