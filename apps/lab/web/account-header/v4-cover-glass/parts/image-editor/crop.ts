/**
 * Client checks and crop maths for the image editor. In the port the cropper is react-easy-crop (not installed in
 * the lab); this file keeps the same contract: a crop is { zoom, rotation, x, y } and the client exports a WebP of
 * fixed size that the backend re-encodes (JPEG/PNG/WebP only, docs/27).
 */

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_BYTES = 5 * 1024 * 1024;
export const MIN_SIDE = 200;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

export type EditorKind = 'cover' | 'avatar';

/** Cover 3:1 (desktop and phone guides drawn on top), avatar 1:1 under a round mask. */
export const ASPECT: Record<EditorKind, number> = { cover: 3, avatar: 1 };
export const OUTPUT_WIDTH: Record<EditorKind, number> = { cover: 1800, avatar: 512 };

/**
 * The part of a 3:1 cover each layout shows (object-fit: cover, centred), as fractions of the cover:
 * desktop 1440 × ~300 (header 64 + hero) is ~4.8:1, so it keeps the full width and the middle 62 % of the height;
 * a 390 px phone with a ~290 px band is ~1.35:1, so it keeps the full height and the middle 45 % of the width.
 */
export const COVER_GUIDES = {
  desktop: { width: 1, height: 3 / 4.8 },
  phone: { width: 1.35 / 3, height: 1 },
};

export type CheckError =
  | { code: 'type' }
  | { code: 'size'; mb: string }
  | { code: 'dimensions'; width: number; height: number }
  | { code: 'unreadable' };

export interface Source {
  /** Object URL of the original file; revoked when the editor drops it. */
  url: string;
  image: HTMLImageElement;
  width: number;
  height: number;
}

/** Type and size first (no decode), then decode once to read the real pixel size. */
export async function checkFile(file: File): Promise<{ ok: true; source: Source } | { ok: false; error: CheckError }> {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return { ok: false, error: { code: 'type' } };
  if (file.size > MAX_BYTES) return { ok: false, error: { code: 'size', mb: (file.size / 1024 / 1024).toFixed(1) } };
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    return { ok: false, error: { code: 'unreadable' } };
  }
  const { naturalWidth: width, naturalHeight: height } = image;
  if (Math.min(width, height) < MIN_SIDE) {
    URL.revokeObjectURL(url);
    return { ok: false, error: { code: 'dimensions', width, height } };
  }
  return { ok: true, source: { url, image, width, height } };
}

export interface Crop {
  zoom: number;
  /** 0, 90, 180 or 270, clockwise. */
  rotation: number;
  /** Offset of the image centre from the frame centre, as a fraction of the frame width / height. */
  x: number;
  y: number;
}

export const INITIAL_CROP: Crop = { zoom: 1, rotation: 0, x: 0, y: 0 };

/** Scale that makes the (rotated) image just cover the frame at zoom 1. */
export function coverScale(source: Pick<Source, 'width' | 'height'>, rotation: number, frameW: number, frameH: number) {
  const turned = rotation % 180 !== 0;
  const w = turned ? source.height : source.width;
  const h = turned ? source.width : source.height;
  return { scale: Math.max(frameW / w, frameH / h), w, h };
}

/** Keeps the frame fully covered: the offset can never reveal an empty edge. */
export function clampCrop(crop: Crop, source: Pick<Source, 'width' | 'height'>, aspect: number): Crop {
  // Work in a frame of width 1 and height 1/aspect.
  const frameW = 1;
  const frameH = 1 / aspect;
  const { scale, w, h } = coverScale(source, crop.rotation, frameW, frameH);
  const s = scale * crop.zoom;
  const maxX = Math.max(0, (w * s - frameW) / 2) / frameW;
  const maxY = Math.max(0, (h * s - frameH) / 2) / frameH;
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, crop.zoom));
  return {
    zoom,
    rotation: ((crop.rotation % 360) + 360) % 360,
    x: Math.min(maxX, Math.max(-maxX, crop.x)),
    y: Math.min(maxY, Math.max(-maxY, crop.y)),
  };
}

/** Draws the crop into a canvas of `outW` × `outW / aspect`: the same transform the on-screen frame uses. */
export function renderCrop(source: Source, crop: Crop, aspect: number, outW: number): HTMLCanvasElement {
  const outH = Math.round(outW / aspect);
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const { scale } = coverScale(source, crop.rotation, outW, outH);
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(outW / 2 + crop.x * outW, outH / 2 + crop.y * outH);
  ctx.rotate((crop.rotation * Math.PI) / 180);
  ctx.scale(scale * crop.zoom, scale * crop.zoom);
  ctx.drawImage(source.image, -source.width / 2, -source.height / 2);
  return canvas;
}

export function toBlob(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/webp', quality),
  );
}

/** First image file on a clipboard or drop. */
export function imageFrom(list: DataTransferItemList | FileList | null | undefined): File | null {
  if (!list) return null;
  for (const entry of Array.from(list as ArrayLike<DataTransferItem | File>)) {
    const file = entry instanceof File ? entry : entry.kind === 'file' ? entry.getAsFile() : null;
    if (file) return file;
  }
  return null;
}
