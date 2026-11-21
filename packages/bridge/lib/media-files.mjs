/**
 * @file Reading a picture, clip or captions file for a plan's evidence or explainer, on the device where the Claude run made it (owner, 2026-11-20).
 * @description The same folder rule as every other action (`allowlist.mjs`): the path must be absolute and sit in a registered project folder, or
 * Hub's worktree of one, once links are resolved; it is checked again on the file's real path. Only the kinds Hub keeps may be read (by name
 * here, by bytes on Hub's side), never more than Hub's cap, and in pieces, since a frame is at most 1 MB. Hub checks and redraws what it gets.
 */
import { closeSync, openSync, readSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import { allowedEntry } from './allowlist.mjs';
import { Refusal } from './protocol.mjs';

/** What a piece may hold: 512 KB, which is under 700 KB as base64 and well inside the 1 MB frame. */
export const FILE_PIECE_BYTES = 512 * 1024;
/** The largest file asked for at all: an explainer film. */
export const FILE_MAX_BYTES = 120 * 1024 * 1024;
const KINDS = /\.(png|jpe?g|webp|mp4|webm|vtt)$/i;

export const mediaHandlers = {
  'file.read': (args, context) => {
    const { path, offset = 0, maxBytes = FILE_MAX_BYTES } = args;
    if (typeof path !== 'string' || path === '' || path.includes('\0') || !isAbsolute(path)) {
      throw new Refusal('bad_arguments');
    }
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(maxBytes) || maxBytes < 1) {
      throw new Refusal('bad_arguments');
    }
    if (!KINDS.test(path)) throw new Refusal('file_type');
    const { platform } = context.system;
    if (!allowedEntry(path, context.folders(), platform)) throw new Refusal('folder_not_allowed');
    let real;
    try {
      real = realpathSync.native(path);
    } catch {
      throw new Refusal('file_missing');
    }
    // A link inside a project may not lead out of it, nor to a file of another kind.
    if (!allowedEntry(real, context.folders(), platform)) throw new Refusal('folder_not_allowed');
    if (!KINDS.test(real)) throw new Refusal('file_type');
    const info = statSync(real);
    if (!info.isFile()) throw new Refusal('file_missing');
    if (info.size > Math.min(maxBytes, FILE_MAX_BYTES)) throw new Refusal('file_too_large');
    if (offset > info.size) throw new Refusal('bad_arguments');
    const length = Math.min(FILE_PIECE_BYTES, info.size - offset);
    const piece = Buffer.alloc(length);
    const fd = openSync(real, 'r');
    try {
      let read = 0;
      while (read < length) {
        const got = readSync(fd, piece, read, length - read, offset + read);
        if (got === 0) break;
        read += got;
      }
    } finally {
      closeSync(fd);
    }
    return { size: info.size, offset, data: piece.toString('base64') };
  },
};
