/**
 * @file Evidence files: recognised from their bytes, metadata dropped, size read, and SVG, HTML and oversized files refused.
 */
import { EVIDENCE_IMAGE_MAX_BYTES, kindFits, readEvidenceFile, sniff } from './evidence-media';

const chunk = (type: string, body: Buffer) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, body, Buffer.alloc(4)]);
};
const ihdr = () => {
  const body = Buffer.alloc(13);
  body.writeUInt32BE(640, 0);
  body.writeUInt32BE(480, 4);
  return body;
};
const png = (...extra: Buffer[]) =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr()),
    ...extra,
    chunk('IDAT', Buffer.from('pixels')),
    chunk('IEND', Buffer.alloc(0)),
  ]);

const segment = (marker: number, body: Buffer) => {
  const head = Buffer.from([0xff, marker, 0, 0]);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
};
const jpeg = (...extra: Buffer[]) => {
  const sof = Buffer.alloc(6);
  sof[0] = 8;
  sof.writeUInt16BE(300, 1);
  sof.writeUInt16BE(400, 3);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, Buffer.from('JFIF\0')),
    ...extra,
    segment(0xc0, sof),
    Buffer.from([0xff, 0xda, 0, 2]),
    Buffer.from('scan'),
    Buffer.from([0xff, 0xd9]),
  ]);
};

const webp = (...extra: Buffer[]) => {
  const riffChunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, 'latin1');
    head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, body, body.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  const vp8x = Buffer.alloc(10);
  vp8x[0] = 0x0c;
  vp8x.writeUIntLE(99, 4, 3);
  vp8x.writeUIntLE(49, 7, 3);
  const body = Buffer.concat([
    riffChunk('VP8X', vp8x),
    riffChunk('VP8L', Buffer.alloc(8)),
    ...extra.map((e) => riffChunk(e.toString('latin1', 0, 4), e.subarray(4))),
  ]);
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'latin1');
  head.writeUInt32LE(body.length + 4, 4);
  head.write('WEBP', 8, 'latin1');
  return Buffer.concat([head, body]);
};

describe('evidence files', () => {
  it('keeps a PNG without its text, time and EXIF chunks, and reads its size', () => {
    const file = readEvidenceFile(
      png(chunk('tEXt', Buffer.from('GPS 30.1,31.2')), chunk('eXIf', Buffer.from('cam'))),
    );
    expect(file).toMatchObject({ mime: 'image/png', width: 640, height: 480 });
    const kept = (file as { data: Buffer }).data.toString('latin1');
    expect(kept).not.toContain('GPS');
    expect(kept).not.toContain('eXIf');
    expect(kept).toContain('IDAT');
  });

  it('keeps a JPEG without APP1 (EXIF) and comments, and reads its size from the frame', () => {
    const file = readEvidenceFile(
      jpeg(segment(0xe1, Buffer.from('Exif\0\0GPS')), segment(0xfe, Buffer.from('note'))),
    );
    expect(file).toMatchObject({ mime: 'image/jpeg', width: 400, height: 300 });
    const kept = (file as { data: Buffer }).data.toString('latin1');
    expect(kept).not.toContain('Exif');
    expect(kept).not.toContain('note');
    expect(kept).toContain('JFIF');
    expect(kept.endsWith('\xff\xd9')).toBe(true);
  });

  it('keeps a WebP without EXIF and XMP, clears their flags, and sets the RIFF size again', () => {
    const file = readEvidenceFile(webp(Buffer.from('EXIFgps!'), Buffer.from('XMP <x/>')));
    expect(file).toMatchObject({ mime: 'image/webp', width: 100, height: 50 });
    const kept = (file as { data: Buffer }).data;
    expect(kept.toString('latin1')).not.toContain('EXIF');
    expect(kept.toString('latin1')).not.toContain('XMP ');
    expect(kept.readUInt32LE(4)).toBe(kept.length - 8);
    expect(kept[20]! & 0x0c).toBe(0);
  });

  it('takes MP4 and WebM as they are', () => {
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(12)]);
    expect(readEvidenceFile(mp4)).toMatchObject({ mime: 'video/mp4', width: null });
    expect(sniff(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1]))).toBe('video/webm');
  });

  it('refuses SVG, HTML, a damaged picture and an oversized one, whatever the name says', () => {
    expect(readEvidenceFile(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toEqual({
      refused: 'type',
    });
    expect(readEvidenceFile(Buffer.from('<!doctype html><script>x</script>'))).toEqual({ refused: 'type' });
    expect(readEvidenceFile(png().subarray(0, 30))).toEqual({ refused: 'damaged' });
    const big = Buffer.concat([png(), Buffer.alloc(EVIDENCE_IMAGE_MAX_BYTES)]);
    expect(readEvidenceFile(big)).toEqual({ refused: 'too_large' });
  });

  it('a clip is capped at 40 MB unless the caller allows more (an explainer film, 120 MB)', () => {
    const big = Buffer.concat([
      Buffer.from([0, 0, 0, 24]),
      Buffer.from('ftypisom', 'latin1'),
      Buffer.alloc(50 * 1024 * 1024),
    ]);
    expect(readEvidenceFile(big)).toEqual({ refused: 'too_large' });
    expect(readEvidenceFile(big, 120 * 1024 * 1024)).toMatchObject({ mime: 'video/mp4' });
  });

  it('a video is only video, and a picture before or after', () => {
    expect(kindFits('video/mp4', 'video')).toBe(true);
    expect(kindFits('video/mp4', 'after')).toBe(false);
    expect(kindFits('image/png', 'video')).toBe(false);
    expect(kindFits('image/png', 'before')).toBe(true);
  });
});
