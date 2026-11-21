/**
 * @file rich-tip.spec.tsx
 * @description The rich tooltip's rules: its copy comes from the catalog, a control that is off says why and how to fix it, and compact keeps the values.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { setPreference } from '@/lib/preferences';
import { renderWithApp } from '@/test/render';

import { Tip, TipProvider } from './rich-tip';

const shown = async (name: string) => {
  fireEvent.pointerMove(screen.getByRole('button', { name }), { pointerType: 'mouse' });
  fireEvent.pointerEnter(screen.getByRole('button', { name }), { pointerType: 'mouse' });
  fireEvent.focus(screen.getByRole('button', { name }));
};

describe('Tip', () => {
  it('renders its child untouched', () => {
    renderWithApp(
      <TipProvider>
        <Tip k="stop">
          <button type="button">Stop</button>
        </Tip>
      </TipProvider>,
    );
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
  });

  it('wraps a control that is off so it can still be reached, with the name given', () => {
    renderWithApp(
      <TipProvider>
        <Tip k="send" off="empty" label="Send">
          <button type="button" disabled>
            Send
          </button>
        </Tip>
      </TipProvider>,
      { locale: 'en' },
    );
    const wrapper = screen.getAllByRole('button', { name: 'Send' })[0] as HTMLElement;
    expect(wrapper.getAttribute('aria-disabled')).toBe('true');
    expect(wrapper.getAttribute('tabindex')).toBe('0');
  });

  it('a control that is off still says what it is for, then why and how to fix it', async () => {
    renderWithApp(
      <TipProvider>
        <Tip
          content={{ what: 'Sends the message', then: 'Claude answers' }}
          off={{ why: 'Offline', fix: 'Reconnect' }}
          label="Send"
        >
          <button type="button" disabled>
            Send
          </button>
        </Tip>
      </TipProvider>,
      { locale: 'en' },
    );
    const wrapper = screen.getAllByRole('button', { name: 'Send' })[0] as HTMLElement;
    fireEvent.pointerMove(wrapper, { pointerType: 'mouse' });
    fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' });
    fireEvent.focus(wrapper);
    await waitFor(() => expect(document.querySelector('[data-wb-tip-off]')).toBeTruthy());
    const text = document.querySelector('[data-wb-tip-off]')?.textContent ?? '';
    expect(text.indexOf('Sends the message')).toBeLessThan(text.indexOf('Offline'));
    expect(text).toContain('Reconnect');
    expect(text).not.toContain('Claude answers');
  });

  it('is told how much to say by the preference', async () => {
    setPreference('tipLevel', 'compact');
    renderWithApp(
      <TipProvider>
        <Tip content={{ what: 'What it does', then: 'What happens' }} facts={[['Device', 'Main']]}>
          <button type="button">Go</button>
        </Tip>
      </TipProvider>,
      { locale: 'en' },
    );
    await shown('Go');
    await waitFor(() => expect(document.querySelector('[data-wb-tiplevel="compact"]')).toBeTruthy());
    expect(document.body.textContent).not.toContain('What happens');
    expect(document.body.textContent).toContain('Main');
    setPreference('tipLevel', 'full');
  });
});
