/**
 * @file sse.ts
 * @description A small SSE client over fetch. EventSource cannot send `X-Requested-With`, cannot refresh a cookie after a
 * 401, and hides why a connection failed, so the live indicator could not tell the truth with it.
 */
export interface SseMessage {
  id: string | null;
  event: string;
  data: string;
}

/** Incremental parser for the `text/event-stream` format. Feed it chunks; it returns the finished messages. */
export class SseParser {
  private buffer = '';
  private id: string | null = null;
  private event = '';
  private data: string[] = [];

  push(chunk: string): SseMessage[] {
    this.buffer += chunk;
    const out: SseMessage[] = [];
    const lines = this.buffer.split(/\r\n|\n|\r/);
    this.buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line === '') {
        if (this.data.length > 0) {
          out.push({ id: this.id, event: this.event || 'message', data: this.data.join('\n') });
        }
        this.event = '';
        this.data = [];
        continue;
      }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'data') this.data.push(value);
      else if (field === 'event') this.event = value;
      else if (field === 'id') this.id = value;
    }
    return out;
  }
}

export class SseHttpError extends Error {
  constructor(readonly status: number) {
    super(`SSE responded ${status}`);
  }
}

export interface ReadStreamOptions {
  url: string;
  lastEventId: string | null;
  signal: AbortSignal;
  onOpen: () => void;
  onMessage: (message: SseMessage) => void;
  /** Any bytes, pings included. The watchdog reads this: silence means the connection is dead. */
  onActivity: () => void;
}

/** Runs until the stream ends. Throws SseHttpError on a refused connection. */
export async function readStream(options: ReadStreamOptions): Promise<void> {
  const headers: Record<string, string> = { Accept: 'text/event-stream', 'X-Requested-With': 'hub' };
  if (options.lastEventId) headers['Last-Event-ID'] = options.lastEventId;
  const response = await fetch(options.url, { headers, credentials: 'same-origin', signal: options.signal });
  if (!response.ok || !response.body) throw new SseHttpError(response.status);
  options.onOpen();
  const parser = new SseParser();
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    options.onActivity();
    for (const message of parser.push(value)) options.onMessage(message);
  }
}

/** docs/09 §3: 1 s doubling to 30 s, with a little jitter so a restart does not reconnect everyone at once. */
export function backoffDelay(attempt: number, random: () => number = Math.random) {
  const base = Math.min(30_000, 1000 * 2 ** attempt);
  return Math.round(base * (0.85 + random() * 0.3));
}
