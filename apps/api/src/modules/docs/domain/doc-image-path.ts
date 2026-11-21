/**
 * @file Where an image a document names lives in its source (decision 13b, docs/04 §3.15).
 * @description Pure: no file system. The image's address is read as written in the Markdown, relative to the document's
 * own folder, decoded once, with a query or fragment dropped. Anything that is not a plain relative path inside the source
 * is refused: a scheme (`https:`, `data:`, `C:`) or any other `:`, a leading `/` or `//`, a backslash, a NUL, or a `..` that climbs above
 * the source's root. Only image types pass. The service still checks the real path after links (`DocImagesService`).
 */
import { extname } from 'node:path';

/** What the endpoint serves, by extension. SVG goes out under a CSP that runs nothing. */
export const DOC_IMAGE_TYPES: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/** The largest image served: a document's picture, not a release artefact. */
export const DOC_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const MAX_SRC = 500;

export type DocImageResolution =
  { ok: true; path: string; type: string } | { ok: false; reason: 'bad_path' | 'type' };

const BAD: DocImageResolution = { ok: false, reason: 'bad_path' };

/** A scheme, or a Windows drive: `https:`, `data:`, `C:`. */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

// A `:` anywhere is refused too: inside a name it opens an NTFS alternate data stream (`notes.txt:hidden.png`).
const unsafe = (text: string) =>
  text.includes('\0') ||
  text.includes('\\') ||
  text.includes(':') ||
  text.startsWith('/') ||
  SCHEME.test(text);

/** Segments of a relative path, `.` and `..` applied. Null when it climbs above the root or names no file. */
function walk(segments: readonly string[]): string[] | null {
  const out: string[] = [];
  for (const [i, segment] of segments.entries()) {
    if (segment === '' && i < segments.length - 1) continue;
    if (segment === '.') continue;
    if (segment === '..') {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(segment);
  }
  const last = out.at(-1);
  return last ? out : null;
}

/**
 * The source-relative path of the image `src` that the document at `docPath` names, with its type.
 * `docPath` is the document's own path inside the source (`DocDetail.path`).
 */
export function resolveDocImage(docPath: string, src: string): DocImageResolution {
  const written = src.trim();
  if (!written || written.length > MAX_SRC || unsafe(written) || unsafe(docPath)) return BAD;
  const bare = written.split('#')[0]?.split('?')[0] ?? '';
  let decoded: string;
  try {
    decoded = decodeURIComponent(bare);
  } catch {
    return BAD;
  }
  if (!decoded || unsafe(decoded)) return BAD;
  const folder = docPath.split('/').slice(0, -1);
  if (folder.includes('..')) return BAD;
  const segments = walk([...folder, ...decoded.split('/')]);
  if (!segments) return BAD;
  const path = segments.join('/');
  const type = DOC_IMAGE_TYPES[extname(path).toLowerCase()];
  return type ? { ok: true, path, type } : { ok: false, reason: 'type' };
}
