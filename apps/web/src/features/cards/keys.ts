/**
 * @file keys.ts
 * @description Every TanStack Query key in the app. The live stream and mutations invalidate through these, so a page that uses
 * them is live without any code of its own.
 */
export const qk = {
  me: ['me'] as const,
  workspaces: ['workspaces'] as const,
  workspace: (ws: string) => ['workspace', ws] as const,
  members: (ws: string) => ['members', ws] as const,
  /** Every list of cards in a project, whatever its filters: prefix for patching rows. */
  cards: (ws: string) => ['cards', ws] as const,
  cardList: (ws: string, filters: Record<string, unknown> = {}) => ['cards', ws, filters] as const,
  card: (ws: string, key: string) => ['card', ws, key] as const,
  events: (ws: string, key: string) => ['card-events', ws, key] as const,
  comments: (ws: string, key: string) => ['card-comments', ws, key] as const,
  counters: (ws: string) => ['counters', ws] as const,
  today: (ws: string) => ['today', ws] as const,
  timeline: (ws: string) => ['timeline', ws] as const,
  inbox: (ws: string) => ['inbox', ws] as const,
  /** Members, invites, settings, sources, audit: `project.updated` on the stream rereads all of them. */
  admin: (ws: string, ...part: readonly unknown[]) => ['admin', ws, ...part] as const,
  search: (ws: string, q: string) => ['search', ws, q] as const,
  /** The agent queue (docs/16 §9), whatever its filter. `queue.changed` and `chat.changed` reread it. */
  /** Schema Studio (docs/17). `schema.changed` rereads it. */
  schema: (ws: string) => ['schema', ws] as const,
  schemaHistory: (ws: string) => ['schema', ws, 'history'] as const,
  queue: (ws: string, card?: string) => (card ? (['queue', ws, card] as const) : (['queue', ws] as const)),
};
