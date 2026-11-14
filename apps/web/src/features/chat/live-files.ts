/**
 * @file live-files.ts
 * @description The files a reply is touching, read from its steps as they arrive: each Write or Edit step names a file and carries the text, so the Live page
 * can show the edit the moment the step starts, before Git or the bridge has anything to say. The reply's own changed files, once known, add their counts.
 */
import type { ChangedFile, ChatMessageDto, ChatStepDto } from '@hub/contracts';

import type { DiffLine } from './thread-items';

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

export interface LiveEdit {
  stepId: string;
  kind: 'write' | 'edit';
  lines: DiffLine[];
  at: string;
  running: boolean;
  failed: boolean;
}

export interface LiveFile {
  path: string;
  edits: LiveEdit[];
  additions: number;
  deletions: number;
  lastAt: string;
  running: boolean;
  /** What the reply's changed files say about it, once they do. */
  changed?: ChangedFile | undefined;
}

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const linesOf = (text: string) => (text === '' ? [] : text.replace(/\r\n/g, '\n').split('\n'));

function editLines(oldText: string, newText: string): DiffLine[] {
  return [
    ...linesOf(oldText).map((text): DiffLine => ({ t: 'del', text })),
    ...linesOf(newText).map((text): DiffLine => ({ t: 'add', text })),
  ];
}

/** The edit one step makes, or null when the step is not an edit. */
export function editOf(step: ChatStepDto): { path: string; edit: LiveEdit } | null {
  if (!EDIT_TOOLS.has(step.name)) return null;
  const input = (step.input ?? {}) as Record<string, unknown>;
  const path = str(input['file_path']) || str(input['notebook_path']) || str(input['path']);
  if (!path) return null;
  let lines: DiffLine[] = [];
  let kind: LiveEdit['kind'] = 'edit';
  if (step.name === 'Write') {
    kind = 'write';
    lines = linesOf(str(input['content'])).map((text) => ({ t: 'add', text }));
  } else if (step.name === 'MultiEdit' && Array.isArray(input['edits'])) {
    (input['edits'] as Record<string, unknown>[]).forEach((e, i) => {
      lines.push({ t: 'hunk', text: `@@ ${i + 1} @@` });
      lines.push(...editLines(str(e['old_string']), str(e['new_string'])));
    });
  } else if (step.name === 'NotebookEdit') {
    lines = linesOf(str(input['new_source'])).map((text) => ({ t: 'add', text }));
  } else {
    lines = editLines(str(input['old_string']), str(input['new_string']));
  }
  return {
    path,
    edit: {
      stepId: step.id,
      kind,
      lines,
      at: step.startedAt,
      running: step.status === 'running' || step.status === 'waiting',
      failed: step.status === 'error' || step.status === 'cut_off',
    },
  };
}

/** Every file the reply touched, the most recent first. */
export function liveFilesOf(message: ChatMessageDto | null | undefined): LiveFile[] {
  if (!message) return [];
  const byPath = new Map<string, LiveFile>();
  for (const step of message.steps) {
    const found = editOf(step);
    if (!found) continue;
    const file = byPath.get(found.path) ?? {
      path: found.path,
      edits: [],
      additions: 0,
      deletions: 0,
      lastAt: found.edit.at,
      running: false,
    };
    file.edits.push(found.edit);
    if (!found.edit.failed) {
      file.additions += found.edit.lines.filter((l) => l.t === 'add').length;
      file.deletions += found.edit.lines.filter((l) => l.t === 'del').length;
    }
    file.running ||= found.edit.running;
    if (found.edit.at > file.lastAt) file.lastAt = found.edit.at;
    byPath.set(found.path, file);
  }
  for (const changed of message.changedFiles ?? []) {
    const known = [...byPath.values()].find(
      (f) => f.path === changed.path || f.path.endsWith(`/${changed.path}`),
    );
    if (known) known.changed = changed;
    else
      byPath.set(changed.path, {
        path: changed.path,
        edits: [],
        additions: changed.additions ?? 0,
        deletions: changed.deletions ?? 0,
        lastAt: '',
        running: false,
        changed,
      });
  }
  return [...byPath.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** A path as the folder shows it: the part after the project folder, when the step named it in full. */
export function shortPath(path: string, folder: string | null | undefined) {
  const norm = (p: string) => p.replace(/\\/g, '/');
  const p = norm(path);
  const f = folder ? norm(folder).replace(/\/$/, '') : '';
  return f && p.toLowerCase().startsWith(`${f.toLowerCase()}/`) ? p.slice(f.length + 1) : p;
}
