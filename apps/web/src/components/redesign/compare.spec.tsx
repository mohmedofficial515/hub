/**
 * @file The compare bar's segmented controls: each group is one Tab stop, and the arrows move inside it.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Seg } from './compare';

function Bar() {
  const [device, setDevice] = useState<number>(1440);
  const [theme, setTheme] = useState('light');
  return (
    <div dir="ltr">
      <Seg
        label="Device"
        value={device}
        onChange={setDevice}
        options={[390, 768, 1440].map((v) => ({ value: v, label: String(v) }))}
      />
      <Seg
        label="Theme"
        value={theme}
        onChange={setTheme}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />
    </div>
  );
}

describe('Seg', () => {
  it('is one Tab stop per group, on the chosen value', () => {
    render(<Bar />);
    for (const group of screen.getAllByRole('radiogroup')) {
      const stops = within(group)
        .getAllByRole('radio')
        .filter((r) => r.getAttribute('tabindex') === '0');
      expect(stops).toHaveLength(1);
      expect(stops[0]).toHaveAttribute('aria-checked', 'true');
    }
  });

  it('moves with the arrows in reading direction', () => {
    render(<Bar />);
    const device = screen.getByRole('radiogroup', { name: 'Device' });
    const [first, second] = within(device).getAllByRole('radio');
    first?.focus();
    fireEvent.keyDown(first!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(second);
    expect(second).toHaveAttribute('tabindex', '0');
  });
});
