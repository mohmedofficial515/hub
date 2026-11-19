/**
 * @file A toast that holds Undo closes on its timer, and a sticky one waits for the owner (review m9: Claim is the first Tab stop after a sheet's title).
 */
import { act, waitFor } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp } from '@/test/render';

import { dismissToast, showToast, ToastRegion } from './toast';

describe('ToastRegion', () => {
  // jsdom never finishes an exit animation, so a closed toast would stay in the DOM.
  beforeAll(() => (MotionGlobalConfig.skipAnimations = true));
  afterAll(() => (MotionGlobalConfig.skipAnimations = false));
  // Only the toast's own timer is faked, so the exit animation still runs on real frames.
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }));
  afterEach(() => {
    act(() => dismissToast());
    vi.useRealTimers();
  });

  it('closes an Undo toast on its timer', async () => {
    const { container } = renderWithApp(<ToastRegion />);
    act(() => showToast({ message: 'Read', onUndo: () => undefined }));
    expect(container.textContent).toContain('Read');
    act(() => {
      vi.advanceTimersByTime(11_000);
    });
    await waitFor(() => expect(container.textContent).not.toContain('Read'));
  });

  it('keeps a sticky toast until it is dismissed', async () => {
    const { container } = renderWithApp(<ToastRegion />);
    act(() => showToast({ message: 'Claimed', onUndo: () => undefined, sticky: true }));
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(container.textContent).toContain('Claimed');
    act(() => dismissToast());
    await waitFor(() => expect(container.textContent).not.toContain('Claimed'));
  });
});

describe('ToastRegion errors', () => {
  beforeAll(() => (MotionGlobalConfig.skipAnimations = true));
  afterAll(() => (MotionGlobalConfig.skipAnimations = false));
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }));
  afterEach(() => {
    act(() => dismissToast());
    vi.useRealTimers();
  });

  it('keeps an error until it is dismissed, and announces it as an alert', () => {
    const { container, getByRole } = renderWithApp(<ToastRegion />);
    act(() => showToast({ tone: 'error', message: 'Refused: pick a role first' }));
    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    expect(container.textContent).toContain('Refused: pick a role first');
    expect(getByRole('alert').textContent).toContain('Refused');
  });

  it('closes an error on Esc', async () => {
    const { container } = renderWithApp(<ToastRegion />);
    act(() => showToast({ tone: 'error', message: 'Refused' }));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
    });
    await waitFor(() => expect(container.textContent).not.toContain('Refused'));
  });

  it('closes a plain notice after five seconds', async () => {
    const { container } = renderWithApp(<ToastRegion />);
    act(() => showToast({ message: 'Saved' }));
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(container.textContent).toContain('Saved');
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    await waitFor(() => expect(container.textContent).not.toContain('Saved'));
  });
});
