/**
 * @file Where the old Live address goes: the queue's "Running now" tab, every parameter kept (`chat`, `pane`).
 */
type Search = Record<string, string | string[] | undefined>;

export function liveTarget(locale: string, ws: string, search: Search) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(search)) {
    if (name === 'show') continue;
    for (const one of Array.isArray(value) ? value : value === undefined ? [] : [value])
      params.append(name, one);
  }
  params.set('show', 'live');
  return `/${locale}/${encodeURIComponent(ws)}/queue?${params.toString()}`;
}
