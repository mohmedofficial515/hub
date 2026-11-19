/**
 * @file The images a document names, read from its source's local folder (decision 13b, docs/04 §3.15).
 * @description Copies the lab screenshot route's guard (`modules/redesign/application/lab-files.service.ts`): the address
 * is resolved against the document's own folder by `resolveDocImage`, then the real path after links must still lie inside
 * the real source root, and only a regular file of an image type up to `DOC_IMAGE_MAX_BYTES` is served. Read only. A source
 * that lives on a paired device has no local file, so its images are not found here; a remote `https:` image never reaches
 * this service, since the viewer shows it as its alt text with a link (09 §11).
 */
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

import { type Actor, localPathSourceConfigSchema } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CardQueryService } from '@/modules/cards';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { DOC_IMAGE_MAX_BYTES, resolveDocImage } from '../domain/doc-image-path';
import { ALWAYS_EXCLUDED, matchesGlob } from '../domain/markdown';

export interface DocImage {
  readonly absolute: string;
  readonly type: string;
  readonly size: number;
  /** Weak validator from size and modification time, for `If-None-Match`. */
  readonly etag: string;
  /** Set for SVG: its text, already read to pass the secret filter. */
  readonly body?: Buffer;
}

/** A source-relative path with `/`, for the same globs the indexer applies. */
const toPosix = (path: string) => path.split(sep).join('/');

const inside = (root: string, path: string) => {
  const inner = relative(root, path);
  return inner !== '' && !inner.startsWith('..') && !isAbsolute(inner);
};

@Injectable()
export class DocImagesService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly query: CardQueryService,
  ) {}

  /** The image `src` that the document `key` names. Throws the `hub.docs.image_*` codes; never a path outside the source. */
  async image(actor: Actor, key: string, src: string): Promise<DocImage> {
    const card = await this.query.readable(actor, { cardKey: key }).catch((cause: unknown) => {
      throw new AppException('hub.docs.not_found', { cause });
    });
    if (card.type !== 'doc') throw new AppException('hub.docs.not_found');
    const docPath = card.detail?.['path'];
    const resolved = resolveDocImage(typeof docPath === 'string' ? docPath : '', src);
    if (!resolved.ok) {
      throw new AppException(
        resolved.reason === 'type' ? 'hub.docs.image_type_refused' : 'hub.docs.image_bad_path',
      );
    }
    const source = await this.txHost.tx.source.findUnique({
      where: { id: String(card.detail?.['sourceId']), workspaceId: actor.workspaceId },
      select: { kind: true, config: true },
    });
    const config = localPathSourceConfigSchema.safeParse(source?.config);
    if (!source || source.kind !== 'local_path' || !config.success || config.data.deviceId) {
      throw new AppException('hub.docs.image_not_found');
    }
    // What the indexer leaves out (`.git`, `node_modules`, the source's own `exclude`) is not served either.
    const excluded = [...ALWAYS_EXCLUDED, ...(config.data.exclude ?? [])];
    const isExcluded = (path: string) => excluded.some((glob) => matchesGlob(path, glob));
    if (isExcluded(resolved.path)) throw new AppException('hub.docs.image_not_found');
    const root = resolve(config.data.path);
    const joined = join(root, ...resolved.path.split('/'));
    if (!inside(root, joined)) throw new AppException('hub.docs.image_bad_path');
    let real: string;
    let realRoot: string;
    try {
      [realRoot, real] = await Promise.all([realpath(root), realpath(joined)]);
    } catch (cause) {
      throw new AppException('hub.docs.image_not_found', { cause });
    }
    // A link that leads out of the source is the same as no file: nothing says what lies beyond it.
    if (!real.startsWith(realRoot + sep)) throw new AppException('hub.docs.image_not_found');
    // A link inside the source that leads into an excluded folder is refused the same way.
    if (isExcluded(toPosix(relative(realRoot, real)))) throw new AppException('hub.docs.image_not_found');
    const info = await stat(real);
    if (!info.isFile()) throw new AppException('hub.docs.image_not_found');
    if (info.size > DOC_IMAGE_MAX_BYTES) {
      throw new AppException('hub.docs.image_too_large', { details: { maxBytes: DOC_IMAGE_MAX_BYTES } });
    }
    const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    if (resolved.type !== 'image/svg+xml') {
      return { absolute: real, type: resolved.type, size: info.size, etag };
    }
    // SVG is text: it passes the secret filter like the document that names it.
    const body = await this.bytes({ absolute: real, type: resolved.type, size: info.size, etag });
    try {
      assertNoSecrets({ body: body.toString('utf8') });
    } catch (cause) {
      throw new AppException('hub.docs.image_not_found', { cause, details: { reason: 'secret' } });
    }
    return { absolute: real, type: resolved.type, size: body.length, etag, body };
  }

  /**
   * The image's bytes, read whole (it is at most `DOC_IMAGE_MAX_BYTES`). A file removed, locked (`EBUSY` on Windows) or
   * grown past the limit since `image` looked at it becomes an `AppException`, never an unhandled stream error.
   */
  async bytes(image: DocImage): Promise<Buffer> {
    if (image.body) return image.body;
    let body: Buffer;
    try {
      body = await readFile(image.absolute);
    } catch (cause) {
      throw new AppException('hub.docs.image_not_found', { cause });
    }
    if (body.length > DOC_IMAGE_MAX_BYTES) {
      throw new AppException('hub.docs.image_too_large', { details: { maxBytes: DOC_IMAGE_MAX_BYTES } });
    }
    return body;
  }
}
