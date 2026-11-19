/**
 * @file A dirty Modal ignores a press outside it, so a stray click never wipes a form; Esc still closes it.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithApp } from '@/test/render';

import { Modal } from './dialog';

// Radix starts listening for outside presses on the next tick.
const outside = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fireEvent.pointerDown(document.body);
};

const mount = (dirty: boolean, onOpenChange = vi.fn()) => {
  renderWithApp(
    <div id="hub-root">
      <Modal open onOpenChange={onOpenChange} title="New card" dirty={dirty}>
        <input aria-label="Title" />
      </Modal>
    </div>,
  );
  return onOpenChange;
};

describe('Modal', () => {
  it('stays open on a press outside while dirty, and closes on Esc', async () => {
    const onOpenChange = mount(true);
    await outside();
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes on a press outside when nothing was typed', async () => {
    const onOpenChange = mount(false);
    await outside();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
