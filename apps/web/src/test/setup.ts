/**
 * @file Test setup: DOM matchers, cleanup, and what jsdom does not have.
 */
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver ??= ResizeObserverStub;
Object.assign(Element.prototype, { scrollIntoView: () => undefined, hasPointerCapture: () => false });

// jsdom has a page URL but Node's Request does not read it, so a same-origin path needs resolving as a browser would.
const NativeRequest = globalThis.Request;
globalThis.Request = class extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    const { signal: _signal, ...rest } = init ?? {};
    super(
      typeof input === 'string' && input.startsWith('/') ? new URL(input, window.location.href).href : input,
      rest,
    );
  }
};
