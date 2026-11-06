/**
 * @file lab-path.ts
 * @description What may pass through Hub's proxy to the lab (docs/16 §6). The dev server has its own list of folders; this refuses a path that tries to
 * climb out before it gets there, however many times it was encoded. Runs in the middleware, so no Node imports.
 */
/** The packages' folders. Any other dot-folder is refused. */
const DOT_FOLDERS_ALLOWED = /^\.(?:pnpm|vite(?:-\d+)?)$/;

/** Undoes percent-encoding until it settles. Null when it is malformed or will not settle. */
function decoded(path: string): string | null {
  let current = path;
  for (let i = 0; i < 4; i += 1) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      return null;
    }
    if (next === current) return current;
    current = next;
  }
  return null;
}

export function labPathAllowed(pathname: string): boolean {
  const path = decoded(pathname);
  if (path === null || path.includes('\\') || path.includes('\0')) return false;
  return path.split('/').every((segment) => {
    if (segment === '.' || segment === '..') return false;
    return !segment.startsWith('.') || DOT_FOLDERS_ALLOWED.test(segment);
  });
}
