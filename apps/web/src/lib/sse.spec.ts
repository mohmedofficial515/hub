/**
 * @file The SSE parser and the reconnect delays.
 */
import { describe, expect, it } from 'vitest';

import { backoffDelay, SseParser } from './sse';

describe('SseParser', () => {
  it('yields a message at the blank line, with id, event and data', () => {
    const parser = new SseParser();
    expect(parser.push('id: 7\nevent: card.event\ndata: {"a":1}\n')).toEqual([]);
    expect(parser.push('\n')).toEqual([{ id: '7', event: 'card.event', data: '{"a":1}' }]);
  });

  it('survives a chunk boundary in the middle of a line', () => {
    const parser = new SseParser();
    expect(parser.push('data: hel')).toEqual([]);
    expect(parser.push('lo\n\n')).toEqual([{ id: null, event: 'message', data: 'hello' }]);
  });

  it('ignores comments, so pings produce nothing', () => {
    const parser = new SseParser();
    expect(parser.push(': ping\n\n')).toEqual([]);
  });

  it('keeps the last id for later messages, as the format says', () => {
    const parser = new SseParser();
    parser.push('id: 1\ndata: a\n\n');
    expect(parser.push('data: b\n\n')[0]?.id).toBe('1');
  });

  it('joins several data lines', () => {
    expect(new SseParser().push('data: a\ndata: b\n\n')[0]?.data).toBe('a\nb');
  });

  it('accepts CRLF', () => {
    expect(new SseParser().push('data: a\r\n\r\n')[0]?.data).toBe('a');
  });
});

describe('backoffDelay', () => {
  it('doubles from about 1 s and stops at about 30 s', () => {
    const middle = () => 0.5;
    expect(backoffDelay(0, middle)).toBe(1000);
    expect(backoffDelay(1, middle)).toBe(2000);
    expect(backoffDelay(10, middle)).toBe(30_000);
  });
});
