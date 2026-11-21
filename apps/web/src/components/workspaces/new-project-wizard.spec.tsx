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
    const { calls } = stubFetch((url) =>
      url.pathname.endsWith('/me/devices')
        ? { body: { data: [] } }
        : { status: 201, body: { data: { slug: 'test-project' } } },
    );
    const onCreated = open();
    await user.type(screen.getByLabelText(/Project name/), 'Test Project');
    expect(screen.getByLabelText(/Name in the URL/)).toHaveValue('test-project');
    expect(screen.getByLabelText(/Key prefix/)).toHaveValue('TP');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('test-project'));
    expect(calls.find((call) => call.method === 'POST')).toMatchObject({
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

  it('links the folder on the new project in the same flow, on the explicit press (docs/16 §11, D44)', async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch((url, init, request) => {
      if (url.pathname.endsWith('/me/devices')) {
        return {
          body: {
            data: [
              { id: 'd1', name: 'Main PC', online: true },
              { id: 'd2', name: 'Laptop', online: false },
            ],
          },
        };
      }
      if (url.pathname.endsWith('/devices/d1/link')) {
        return {
          body: {
            data: {
              outcome: 'linked',
              folder: 'F:/Projects/side',
              project: 'side',
              backup: null,
              registered: true,
            },
          },
        };
      }
      return (request?.method ?? init?.method) === 'POST'
        ? { status: 201, body: { data: { slug: 'side' } } }
        : undefined;
    });
    const onCreated = open();
    await user.type(screen.getByLabelText(/Project name/), 'Side');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Step 3 of 3/)).toBeInTheDocument();
    expect(screen.getByText(/writes this folder's trust into Claude Code/)).toBeInTheDocument();
    // Only connected devices are offered.
    expect(screen.getByRole('option', { name: 'Main PC' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Laptop' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Project folder/), 'relative/path');
    await user.click(screen.getByRole('button', { name: 'Create and link' }));
    expect(await screen.findByText(/Use a full path/)).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);

    await user.clear(screen.getByLabelText(/Project folder/));
    await user.type(screen.getByLabelText(/Project folder/), 'F:/Projects/side');
    await user.click(screen.getByRole('button', { name: 'Create and link' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('side'));
    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts.map((call) => call.path)).toEqual([
      '/api/v1/workspaces',
      '/api/v1/workspaces/side/devices/d1/link',
    ]);
    expect(posts[1]?.body).toEqual({ folder: 'F:/Projects/side' });
  });

  it('with no device connected it says so, and still creates the project', async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch((url, init, request) =>
      url.pathname.endsWith('/me/devices')
        ? { body: { data: [] } }
        : (request?.method ?? init?.method) === 'POST'
          ? { status: 201, body: { data: { slug: 'solo' } } }
          : undefined,
    );
    const onCreated = open();
    await user.type(screen.getByLabelText(/Project name/), 'Solo');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText(/No device is connected now/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('solo'));
    expect(calls.filter((call) => call.method === 'POST').map((call) => call.path)).toEqual([
      '/api/v1/workspaces',
    ]);
  });
});
