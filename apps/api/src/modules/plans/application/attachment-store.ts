/**
 * @file Uploaded attachments of a plan card, kept in the database (batch 3's storage, shared by the explainer of batch 4): a row in
 * `card_attachments` with its bytes in `card_attachment_files`, served at `GET /cards/{key}/attachments/{id}/file`.
 */
import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';

/** Where the API serves an attachment's bytes, as the web reads it. */
export const attachmentFileUrl = (slug: string, key: string, id: string) =>
  `/api/v1/workspaces/${slug}/cards/${key}/attachments/${id}/file`;

export interface StoredFile {
  kind: string;
  name: string;
  mime: string;
  data: Buffer;
  width?: number | null;
  height?: number | null;
  thumb?: Buffer | null;
}

@Injectable()
export class AttachmentStore {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionalAdapter>) {}

  /** Stores the files in one transaction; their ids in order. */
  async store(
    card: { id: string; key: string },
    slug: string,
    files: readonly StoredFile[],
  ): Promise<string[]> {
    return this.txHost.withTransaction(async () => {
      const ids: string[] = [];
      for (const file of files) {
        const row = await this.txHost.tx.cardAttachment.create({
          data: {
            cardId: card.id,
            kind: file.kind,
            name: file.name.slice(0, 200) || file.kind,
            url: '',
            mime: file.mime,
            width: file.width ?? null,
            height: file.height ?? null,
            file: {
              create: {
                data: new Uint8Array(file.data),
                size: file.data.length,
                sha256: createHash('sha256').update(file.data).digest('hex'),
                ...(file.thumb ? { thumb: new Uint8Array(file.thumb) } : {}),
              },
            },
          },
          select: { id: true },
        });
        await this.txHost.tx.cardAttachment.update({
          where: { id: row.id },
          data: { url: attachmentFileUrl(slug, card.key, row.id) },
        });
        ids.push(row.id);
      }
      return ids;
    });
  }

  /** Removes attachments and their bytes; only the card's own when `cardId` is given. */
  async forget(ids: readonly string[], cardId?: string): Promise<void> {
    if (ids.length === 0) return;
    await this.txHost.withTransaction(() =>
      this.txHost.tx.cardAttachment.deleteMany({
        where: { id: { in: [...ids] }, ...(cardId ? { cardId } : {}) },
      }),
    );
  }
}
