/**
 * @file The New project wizard: fields that follow the name, validation, a taken slug, and the request (docs/15 §5).
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { NewProjectWizard, prefixFrom, slugFrom } from './new-project-wizard';

describe('name helpers', () => {
  it('derives a slug and a prefix', () => {
    expect(slugFrom('Goteav Backend!')).toBe('goteav-backend');
    expect(prefixFrom('Goteav Backend')).toBe('GB');
    expect(prefixFrom('Bitaqaty')).toBe('BITA');
  });

  it('gives nothing valid for an Arabic name, so the member must type them', () => {
    expect(slugFrom('جوتيف')).toBe('');
    expect(prefixFrom('جوتيف')).toBe('');
  });
});

describe('NewProjectWizard', () => {
  const open = (onCreated = vi.fn()) => {
    renderWithApp(
      <div id="hub-root">
        <NewProjectWizard open onOpenChange={vi.fn()} onCreated={onCreated} />
      </div>,
    );
    return onCreated;
  };

  it('fills slug and prefix from the name, and creates with what was chosen', async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch(() => ({ status: 201, body: { data: { slug: 'test-project' } } }));
    const onCreated = open();
    await user.type(screen.getByLabelText(/Project name/), 'Test Project');
    expect(screen.getByLabelText(/Name in the URL/)).toHaveValue('test-project');
    expect(screen.getByLabelText(/Key prefix/)).toHaveValue('TP');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('test-project'));
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/workspaces',
      body: { name: 'Test Project', slug: 'test-project', keyPrefix: 'TP', timezone: 'Europe/Istanbul' },
    });
  });

  it('stays on the first step until the fields are valid', async () => {
    const user = userEvent.setup();
    stubFetch(() => undefined);
    open();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Enter a name to continue.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create project' })).not.toBeInTheDocument();
  });

  it('brings a taken slug back to its field', async () => {
    const user = userEvent.setup();
    stubFetch(() => ({ status: 409, body: { error: { code: 'hub.workspaces.slug_taken', message: 'x' } } }));
    open();
    await user.type(screen.getByLabelText(/Project name/), 'Taken');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('That name is taken. Choose another.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Name in the URL/)).toBeInTheDocument();
  });
});
