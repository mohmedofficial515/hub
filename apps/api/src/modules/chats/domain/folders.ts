/**
 * @file Whether a folder is on a project's list (docs/16 §4). The bridge checks again with links resolved; this refuses early with a clear word.
 */
const normal = (path: string, platform: string): string => {
  const plain = path.replaceAll('\\', '/').replace(/\/+$/, '');
  return platform === 'win32' ? plain.toLowerCase() : plain;
};

export function folderIsRegistered(folder: string, repoPaths: readonly string[], platform: string): boolean {
  if (/(^|[\\/])\.\.([\\/]|$)/.test(folder)) return false;
  const inner = normal(folder, platform);
  return repoPaths.some((path) => {
    const outer = normal(path, platform);
    return inner === outer || inner.startsWith(`${outer}/`);
  });
}

/** A chat's first words become its title, cut at a word. */
export function titleFrom(text: string): string {
  const line = text.trim().split('\n')[0] ?? '';
  if (line.length <= 60) return line;
  const cut = line.slice(0, 60);
  const space = cut.lastIndexOf(' ');
  return `${space > 20 ? cut.slice(0, space) : cut}…`;
}

/** JSON that is too large is kept as the start of its text, marked, rather than cut anywhere that would break it. */
export function capJson(value: unknown, limit: number): unknown {
  const text = JSON.stringify(value ?? null);
  if (text.length <= limit) return value ?? null;
  return { truncatedByHub: true, start: text.slice(0, limit) };
}
