/**
 * @file A step's evidence (v5-live-plan, batch 3): the before and after slider by pointer and keys in reading direction, clips and pictures from the
 * card's attachment route, the lightbox, the add form's own checks, and the upload it sends.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StepEvidence } from '@/features/cards/types';
import type { JourneyStep } from '@/features/planning/journey';
import { renderWithApp } from '@/test/render';

import { compareKey } from './compare';
import { fileProblem, StepEvidenceSection } from './step-evidence';

// The real request is multipart through ky, which jsdom cannot carry; the browser test sends it for real (e2e/specs/plan-evidence.spec.ts).
const { addEvidence } = vi.hoisted(() => ({
  addEvidence: vi.fn<
    (key: string, stepId: string, input: { file: File; kind: string; caption?: string }) => Promise<unknown>
  >(async () => ({})),
}));
vi.mock('@/features/planning/evidence', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  addEvidence: (key: string, stepId: string, input: { file: File; kind: string; caption?: string }) =>
    addEvidence(key, stepId, input),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/en/demo/planning',
}));

const item = (over: Partial<StepEvidence>): StepEvidence => ({
  attachmentId: 'a1',
  kind: 'before',
  mime: 'image/png',
  addedAt: '2026-11-20T10:00:00.000Z',
  via: 'web',
  ...over,
});

const step = (evidence: StepEvidence[]): JourneyStep => ({
  id: 's2',
  title: 'Build the page',
  done: true,
  n: 2,
  evidence,
});

const show = (evidence: StepEvidence[], locale: 'ar' | 'en' = 'en', can = { add: true, remove: true }) =>
  renderWithApp(
    <Tooltip.Provider>
      <StepEvidenceSection cardKey="P-1" step={step(evidence)} canAdd={can.add} canRemove={can.remove} />
    </Tooltip.Provider>,
    { locale },
  );

beforeEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/en/demo/planning?plan=P-1');
});

describe('the compare slider’s keys', () => {
  it('follows reading direction, takes bigger steps with Shift, and stops at the ends', () => {
    expect(compareKey('ArrowRight', false, 50, false)).toBe(52);
    expect(compareKey('ArrowLeft', false, 50, false)).toBe(48);
    expect(compareKey('ArrowLeft', false, 50, true)).toBe(52);
    expect(compareKey('ArrowRight', true, 50, true)).toBe(40);
    expect(compareKey('End', false, 50, false)).toBe(100);
    expect(compareKey('Home', false, 50, false)).toBe(0);
    expect(compareKey('ArrowUp', false, 99, false)).toBe(100);
    expect(compareKey('Enter', false, 50, false)).toBeNull();
  });
});

describe('a step’s evidence', () => {
  const full = [
    item({ attachmentId: 'b', kind: 'before', caption: 'The old form' }),
    item({ attachmentId: 'c', kind: 'after', caption: 'The new form', via: 'mcp' }),
    item({ attachmentId: 'v', kind: 'video', mime: 'video/mp4', caption: 'Walkthrough' }),
  ];

  it('shows before and after on one frame, the clip in a player, every picture from the card’s attachment route', () => {
    show(full);
    const slider = screen.getByRole('slider', { name: 'Before and after' });
    expect(screen.getByAltText('The old form').getAttribute('src')).toBe(
      '/api/v1/workspaces/demo/cards/P-1/attachments/b/file',
    );
    // Under reduced motion or with no animation, it rests at the middle; the keys move it.
    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider.getAttribute('aria-valuenow')).toBe('100');
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider.getAttribute('aria-valuenow')).toBe('98');
    const video = document.querySelector('video');
    expect(video?.getAttribute('src')).toBe('/api/v1/workspaces/demo/cards/P-1/attachments/v/file');
    expect(screen.getByText('Walkthrough')).toBeTruthy();
    expect(screen.getAllByLabelText('Attached by Claude').length).toBeGreaterThan(0);
  });

  it('in Arabic the left arrow shows more of the after picture', () => {
    window.history.replaceState(null, '', '/ar/demo/planning?plan=P-1');
    show(full, 'ar');
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'Home' });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider.getAttribute('aria-valuenow')).toBe('2');
  });

  it('opens a picture in the lightbox', async () => {
    show(full);
    fireEvent.click(screen.getByRole('button', { name: 'Open The new form' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('says there is none, and offers no add or remove to a member who may not', () => {
    show([], 'en', { add: false, remove: false });
    expect(screen.getByText('No evidence on this step yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add evidence' })).toBeNull();
  });

  it('checks a file before sending it, then uploads it with its kind and caption', async () => {
    show([]);
    fireEvent.click(screen.getByRole('button', { name: 'Add evidence' }));
    const form = document.querySelector<HTMLElement>('[data-pj-evidence-form]')!;
    fireEvent.click(within(form).getByRole('button', { name: 'Upload' }));
    expect(await within(form).findByText('Choose a file first.')).toBeTruthy();

    const input = within(form).getByLabelText('Image or video');
    const svg = new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' });
    fireEvent.change(input, { target: { files: [svg] } });
    fireEvent.click(within(form).getByRole('button', { name: 'Upload' }));
    expect(await within(form).findByText(/Hub takes PNG, JPEG or WebP/)).toBeTruthy();

    const png = new File([new Uint8Array([0x89, 0x50])], 'after.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [png] } });
    fireEvent.change(within(form).getByLabelText('Kind'), { target: { value: 'after' } });
    fireEvent.change(within(form).getByLabelText(/^Caption/), { target: { value: 'The new form' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Upload' }));
    await waitFor(() => expect(addEvidence).toHaveBeenCalled());
    const [key, stepId, sent] = addEvidence.mock.calls[0]!;
    expect([key, stepId, sent.kind, sent.caption, sent.file.name]).toEqual([
      'P-1',
      's2',
      'after',
      'The new form',
      'after.png',
    ]);
    // Sent: the form is ready for the next file.
    await waitFor(() => expect(within(form).getByLabelText<HTMLInputElement>(/^Caption/).value).toBe(''));
  });

  it('takes a dropped file, shows its name and size, and says a wrong type at once', async () => {
    show([]);
    fireEvent.click(screen.getByRole('button', { name: 'Add evidence' }));
    const zone = document.querySelector<HTMLElement>('[data-pj-file-drop]')!;
    const html = new File(['<b>x</b>'], 'page.html', { type: 'text/html' });
    fireEvent.drop(zone, { dataTransfer: { files: [html] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Hub takes PNG, JPEG or WebP/);
    const png = new File([new Uint8Array(2048)], 'after.png', { type: 'image/png' });
    fireEvent.drop(zone, { dataTransfer: { files: [png] } });
    expect(document.querySelector('[data-pj-file-chosen]')?.textContent).toContain('after.png · 2 KB');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove the chosen file' }));
    expect(document.querySelector('[data-pj-file-chosen]')).toBeNull();
    // The zone's button opens the system's chooser: the hidden input is the one control.
    expect(screen.getByRole('button', { name: 'Choose a file' })).toBeTruthy();
  });

  it('whoever added a file may remove it; another member only with the plan’s rights', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input instanceof Request ? input.url : input), 'http://hub.local')
          .pathname;
        const body = path.endsWith('/auth/me')
          ? {
              data: {
                id: 'u1',
                displayName: 'Me',
                workspaces: [{ slug: 'demo', name: 'Demo', keyPrefix: 'DMO', roles: ['qa'] }],
              },
            }
          : { data: [] };
        return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
      }),
    );
    show(
      [
        item({ attachmentId: 'mine', kind: 'after', caption: 'Mine', addedBy: 'u1' }),
        item({ attachmentId: 'theirs', kind: 'before', caption: 'Theirs', addedBy: 'u2' }),
      ],
      'en',
      { add: true, remove: false },
    );
    expect(await screen.findByRole('button', { name: 'Remove Mine' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove Theirs' })).toBeNull();
  });

  it('a file’s problem: its type, its size, or a kind it cannot be', () => {
    const big = new File([new Uint8Array(1)], 'x.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 9 * 1024 * 1024 });
    expect(fileProblem(big, 'after')).toBe('size');
    expect(fileProblem(new File(['x'], 'x.html', { type: 'text/html' }), 'after')).toBe('type');
    expect(fileProblem(new File(['x'], 'x.mp4', { type: 'video/mp4' }), 'after')).toBe('kind');
    expect(fileProblem(new File(['x'], 'x.webp', { type: 'image/webp' }), 'before')).toBeNull();
  });
});
