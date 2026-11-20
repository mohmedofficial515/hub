/**
 * @file A picture of evidence, drawn again (owner, 2026-11-20): after the byte checks of `evidence-media.ts` let a PNG, JPEG or WebP through, sharp
 * decodes it and writes a new file of the same type. Nothing of the original travels but its pixels: EXIF, XMP, ICC notes, comments and any
 * trailing bytes are gone because they are never written. Its turn from EXIF is applied first, so a phone photo stands the right way.
 * @description The size is capped: a width of 2560 (a 1440 screen at 1.75×) and a height of 16000, below WebP's own limit, so a full-page
 * screenshot stays readable. A thumbnail of at most 480 by 480 in WebP goes with it, for the step's grid. A decoder bomb is stopped by sharp's
 * pixel limit.
 */
import sharp from 'sharp';

import type { EvidenceMime } from '../domain/evidence-media';

export const EVIDENCE_MAX_WIDTH = 2560;
export const EVIDENCE_MAX_HEIGHT = 16000;
export const EVIDENCE_THUMB_SIDE = 480;
/** About 270 megapixels: more than any screen, far less than a crafted file asks for. */
const PIXEL_LIMIT = 16384 * 16384;

export interface RedrawnImage {
  data: Buffer;
  width: number;
  height: number;
  thumb: Buffer;
}

/** The picture drawn again in its own type, capped, with its thumbnail. Throws when sharp cannot read it. */
export async function redrawImage(
  data: Buffer,
  mime: Exclude<EvidenceMime, `video/${string}`>,
): Promise<RedrawnImage> {
  const base = sharp(data, { limitInputPixels: PIXEL_LIMIT, failOn: 'error' }).rotate().resize({
    width: EVIDENCE_MAX_WIDTH,
    height: EVIDENCE_MAX_HEIGHT,
    fit: 'inside',
    withoutEnlargement: true,
  });
  const encoded =
    mime === 'image/png'
      ? base.png({ compressionLevel: 7 })
      : mime === 'image/jpeg'
        ? base.jpeg({ quality: 86, mozjpeg: true })
        : base.webp({ quality: 86 });
  const { data: out, info } = await encoded.toBuffer({ resolveWithObject: true });
  const thumb = await sharp(out)
    .resize({
      width: EVIDENCE_THUMB_SIDE,
      height: EVIDENCE_THUMB_SIDE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 76 })
    .toBuffer();
  return { data: out, width: info.width, height: info.height, thumb };
}
