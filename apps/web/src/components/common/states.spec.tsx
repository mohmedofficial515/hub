/**
 * @file ErrorState: only a failure is an alert in the danger tone; no access and not found are neutral facts. The request id is readable.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithApp } from '@/test/render';

import { ErrorState } from './states';

describe('ErrorState', () => {
  it('reads a 403 as a neutral status, not an alert', () => {
    renderWithApp(<ErrorState forbiddenRole="Owner or PM" />);
    const box = screen.getByRole('status');
    expect(box).toHaveAttribute('data-error-kind', 'forbidden');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(box.querySelector('.bg-destructive-soft')).toBeNull();
  });

  it('reads a 404 as a neutral status too', () => {
    renderWithApp(<ErrorState kind="notFound" title="This page does not exist" code="404" />);
    expect(screen.getByRole('status')).toHaveAttribute('data-error-kind', 'notFound');
  });

  it('keeps a failure an alert, with the request id written out and copyable', () => {
    renderWithApp(
      <ErrorState thing="the list" code="hub.common.internal" requestId="req-42" onRetry={() => undefined} />,
    );
    const box = screen.getByRole('alert');
    expect(box).toHaveTextContent('req-42');
    expect(screen.getByRole('button', { name: /req-42/ })).toBeTruthy();
  });
});
