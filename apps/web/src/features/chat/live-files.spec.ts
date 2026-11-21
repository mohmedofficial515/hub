import type { ChatMessageDto, ChatStepDto } from '@hub/contracts';
import { describe, expect, it } from 'vitest';

import { liveFilesOf, shortPath } from './live-files';

const step = (over: Partial<ChatStepDto>): ChatStepDto => ({
  id: 's',
  toolUseId: 't',
  parentToolUseId: null,
  name: 'Edit',
  status: 'done',
  input: {},
  command: null,
  output: null,
  decision: null,
  textOffset: 0,
  startedAt: '2026-11-09T10:00:00.000Z',
  endedAt: null,
  ...over,
});

const message = (steps: ChatStepDto[], changedFiles: ChatMessageDto['changedFiles'] = []) =>
  ({ steps, changedFiles }) as unknown as ChatMessageDto;

describe('liveFilesOf', () => {
  it('reads Write and Edit steps into files, newest first, with counts', () => {
    const files = liveFilesOf(
      message([
        step({ id: 'a', name: 'Write', input: { file_path: 'a.ts', content: 'x\ny' } }),
        step({
          id: 'b',
          name: 'Edit',
          status: 'running',
          startedAt: '2026-11-09T10:01:00.000Z',
          input: { file_path: 'b.ts', old_string: 'old', new_string: 'new\nmore' },
        }),
        step({ id: 'c', name: 'Bash', input: { command: 'ls' } }),
      ]),
    );
    expect(files.map((f) => f.path)).toEqual(['b.ts', 'a.ts']);
    expect(files[0]).toMatchObject({ additions: 2, deletions: 1, running: true });
    expect(files[1]?.edits[0]?.kind).toBe('write');
  });

  it('adds files only Git saw', () => {
    const files = liveFilesOf(message([], [{ path: 'c.ts', source: 'git', additions: 3, deletions: 0 }]));
    expect(files[0]).toMatchObject({ path: 'c.ts', additions: 3 });
  });
});

describe('shortPath', () => {
  it('drops the project folder', () => {
    expect(shortPath('F:\\proj\\src\\a.ts', 'F:\\proj')).toBe('src/a.ts');
    expect(shortPath('src/a.ts', null)).toBe('src/a.ts');
  });
});
