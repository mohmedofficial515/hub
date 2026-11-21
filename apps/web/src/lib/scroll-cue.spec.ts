import { describe, expect, it } from 'vitest';

import { scrollEdges } from './scroll-cue';

describe('scrollEdges', () => {
  it('says nothing when the strip fits', () => {
    expect(scrollEdges({ scrollLeft: 0, scrollWidth: 600, clientWidth: 600 }, false)).toEqual({
      left: false,
      right: false,
    });
  });

  it('marks the far edge at the start, and both in the middle, left to right', () => {
    expect(scrollEdges({ scrollLeft: 0, scrollWidth: 770, clientWidth: 629 }, false)).toEqual({
      left: false,
      right: true,
    });
    expect(scrollEdges({ scrollLeft: 60, scrollWidth: 770, clientWidth: 629 }, false)).toEqual({
      left: true,
      right: true,
    });
    expect(scrollEdges({ scrollLeft: 141, scrollWidth: 770, clientWidth: 629 }, false)).toEqual({
      left: true,
      right: false,
    });
  });

  it('starts on the right in Arabic, where scrolling on goes negative', () => {
    expect(scrollEdges({ scrollLeft: 0, scrollWidth: 770, clientWidth: 629 }, true)).toEqual({
      left: true,
      right: false,
    });
    expect(scrollEdges({ scrollLeft: -141, scrollWidth: 770, clientWidth: 629 }, true)).toEqual({
      left: false,
      right: true,
    });
  });
});
