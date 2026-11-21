/**
 * @file The files a plan step's evidence may be (v5-live-plan, batch 3): what a file is, read from its own bytes and never from the name or the
 * type a client claims, and the picture kept without its hidden data.
 * @description Hub has no image library, so nothing is re-encoded. Instead:
 * - PNG, JPEG and WebP are accepted, recognised by their signature, and their size is read from their header.
 * - Their metadata is dropped, chunk by chunk: PNG text, time and EXIF chunks; JPEG APP1 to APP15 and comments (APP0, the JFIF header, stays);
 *   WebP EXIF and XMP chunks, with the VP8X flags that named them cleared. What remains is the picture as it was drawn.
 * - MP4 (an ISO `ftyp` box) and WebM (an EBML header) are accepted as they are: a video is not rewritten.
 * - Anything else is refused, SVG and HTML included, so a file can never run in a page.
 * Pure: no I/O.
 */

export type EvidenceMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'video/mp4' | 'video/webm';

export const EVIDENCE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const EVIDENCE_VIDEO_MAX_BYTES = 40 * 1024 * 1024;

export interface EvidenceFile {
  mime: EvidenceMime;
  /** The bytes Hub keeps: an image without its metadata, a video as it came. */
  data: Buffer;
  width: number | null;
  height: number | null;
}

export type EvidenceRefusal = 'type' | 'too_large' | 'damaged';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** What the bytes are, or null for anything Hub does not keep. */
export function sniff(data: Buffer): EvidenceMime | null {
  if (data.length >= 8 && data.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (
    data.length >= 12 &&
    data.toString('latin1', 0, 4) === 'RIFF' &&
    data.toString('latin1', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  if (data.length >= 12 && data.toString('latin1', 4, 8) === 'ftyp') return 'video/mp4';
  if (data.length >= 4 && data.readUInt32BE(0) === 0x1a45dfa3) return 'video/webm';
  return null;
}

/** PNG: every chunk but the ones that carry text, time or EXIF. */
const PNG_DROPPED = new Set(['tEXt', 'zTXt', 'iTXt', 'tIME', 'eXIf']);

function cleanPng(data: Buffer): { data: Buffer; width: number; height: number } | null {
  const parts: Buffer[] = [PNG_SIGNATURE];
  let at = 8;
  let width = 0;
  let height = 0;
  let ended = false;
  while (at + 12 <= data.length) {
    const length = data.readUInt32BE(at);
    const type = data.toString('latin1', at + 4, at + 8);
    const end = at + 12 + length;
    if (end > data.length) return null;
    if (type === 'IHDR') {
      width = data.readUInt32BE(at + 8);
      height = data.readUInt32BE(at + 12);
    }
    if (!PNG_DROPPED.has(type)) parts.push(data.subarray(at, end));
    at = end;
    if (type === 'IEND') {
      ended = true;
      break;
    }
  }
  if (!ended || width === 0 || height === 0) return null;
  return { data: Buffer.concat(parts), width, height };
}

/** JPEG: every segment but APP1 to APP15 and comments; the frame header gives the size. */
function cleanJpeg(data: Buffer): { data: Buffer; width: number; height: number } | null {
  const parts: Buffer[] = [data.subarray(0, 2)];
  let at = 2;
  let width = 0;
  let height = 0;
  while (at + 4 <= data.length) {
    if (data[at] !== 0xff) return null;
    const marker = data[at + 1]!;
    // Start of scan: the rest is the picture itself, up to and with the end marker.
    if (marker === 0xda) {
      parts.push(data.subarray(at));
      return width && height ? { data: Buffer.concat(parts), width, height } : null;
    }
    const length = data.readUInt16BE(at + 2);
    const end = at + 2 + length;
    if (length < 2 || end > data.length) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame && length >= 7) {
      height = data.readUInt16BE(at + 5);
      width = data.readUInt16BE(at + 7);
    }
    const dropped = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!dropped) parts.push(data.subarray(at, end));
    at = end;
  }
  return null;
}

/** WebP: every chunk but EXIF and XMP, the VP8X flags that named them cleared, and the RIFF size set again. */
function cleanWebp(data: Buffer): { data: Buffer; width: number; height: number } | null {
  const chunks: Buffer[] = [];
  let at = 12;
  let width = 0;
  let height = 0;
  while (at + 8 <= data.length) {
    const type = data.toString('latin1', at, at + 4);
    const size = data.readUInt32LE(at + 4);
    const end = at + 8 + size + (size % 2);
    if (at + 8 + size > data.length) return null;
    const chunk = Buffer.from(data.subarray(at, Math.min(end, data.length)));
    if (type === 'VP8X' && size >= 10) {
      // Bit 3 is EXIF, bit 2 XMP.
      chunk[8] = chunk[8]! & ~0x0c;
      width = 1 + chunk.readUIntLE(12, 3);
      height = 1 + chunk.readUIntLE(15, 3);
    } else if (type === 'VP8 ' && size >= 10 && !width) {
      width = chunk.readUInt16LE(14) & 0x3fff;
      height = chunk.readUInt16LE(16) & 0x3fff;
    } else if (type === 'VP8L' && size >= 5 && !width) {
      const bits = chunk.readUInt32LE(9);
      width = (bits & 0x3fff) + 1;
      height = ((bits >> 14) & 0x3fff) + 1;
    }
    if (type !== 'EXIF' && type !== 'XMP ') chunks.push(chunk);
    at = end;
  }
  if (!width || !height || chunks.length === 0) return null;
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'latin1');
  head.writeUInt32LE(body.length + 4, 4);
  head.write('WEBP', 8, 'latin1');
  return { data: Buffer.concat([head, body]), width, height };
}

/** The file as Hub keeps it, or why it is refused. */
export function readEvidenceFile(
  data: Buffer,
  videoMaxBytes: number = EVIDENCE_VIDEO_MAX_BYTES,
): EvidenceFile | { refused: EvidenceRefusal } {
  const mime = sniff(data);
  if (!mime) return { refused: 'type' };
  const video = mime.startsWith('video/');
  if (data.length > (video ? videoMaxBytes : EVIDENCE_IMAGE_MAX_BYTES)) return { refused: 'too_large' };
  if (video) return { mime, data, width: null, height: null };
  const clean =
    mime === 'image/png' ? cleanPng(data) : mime === 'image/jpeg' ? cleanJpeg(data) : cleanWebp(data);
  if (!clean) return { refused: 'damaged' };
  return { mime, ...clean };
}

/** The kind a file may be: a video is only ever `video`, and a picture `before` or `after`. */
export const kindFits = (mime: EvidenceMime, kind: 'before' | 'after' | 'video') =>
  mime.startsWith('video/') ? kind === 'video' : kind !== 'video';
