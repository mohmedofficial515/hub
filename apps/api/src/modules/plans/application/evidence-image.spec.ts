/**
 * @file A picture of evidence drawn again by sharp: no EXIF survives, the turn is applied, the size is capped, and a thumbnail comes with it.
 */
import sharp from 'sharp';

import { EVIDENCE_MAX_WIDTH, EVIDENCE_THUMB_SIDE, redrawImage } from './evidence-image';

const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#3366cc' } })
    .withExif({ IFD0: { Make: 'Phone', Copyright: 'Owner' }, IFD3: { GPSLatitudeRef: 'N' } })
    .jpeg()
    .toBuffer();

describe('redrawImage', () => {
  it('keeps the pixels and nothing else, in the same type, with a WebP thumbnail', async () => {
    const before = await photo(800, 600);
    expect((await sharp(before).metadata()).exif).toBeDefined();
    const image = await redrawImage(before, 'image/jpeg');
    const after = await sharp(image.data).metadata();
    expect(after.format).toBe('jpeg');
    expect(after.exif).toBeUndefined();
    expect(after.icc).toBeUndefined();
    expect([image.width, image.height]).toEqual([800, 600]);
    const thumb = await sharp(image.thumb).metadata();
    expect(thumb.format).toBe('webp');
    expect(Math.max(thumb.width ?? 0, thumb.height ?? 0)).toBe(EVIDENCE_THUMB_SIDE);
  });

  it('caps a wide picture and keeps a tall full-page screenshot tall', async () => {
    const wide = await sharp({ create: { width: 3000, height: 300, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    const capped = await redrawImage(wide, 'image/png');
    expect([capped.width, capped.height]).toEqual([EVIDENCE_MAX_WIDTH, 256]);
    // Tall like a full-page screenshot, kept small so the test stays quick.
    const tall = await sharp({ create: { width: 400, height: 6000, channels: 3, background: '#fff' } })
      .jpeg()
      .toBuffer();
    const page = await redrawImage(tall, 'image/jpeg');
    expect([page.width, page.height]).toEqual([400, 6000]);
  });

  it('applies the EXIF turn before dropping it', async () => {
    const turned = await sharp({ create: { width: 300, height: 100, channels: 3, background: '#000' } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const image = await redrawImage(turned, 'image/jpeg');
    expect([image.width, image.height]).toEqual([100, 300]);
    expect((await sharp(image.data).metadata()).orientation).toBeUndefined();
  });

  it('throws on a picture it cannot read', async () => {
    const broken = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(40),
    ]);
    await expect(redrawImage(broken, 'image/png')).rejects.toThrow();
  });
});
