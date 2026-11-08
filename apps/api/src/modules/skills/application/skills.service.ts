/**
 * @file The Skills page (docs/16 §11, D64 to D66): Hub's skills, written through Hub with each earlier text kept, and the owner's personal ones, read only, with Move to Hub.
 * @description Hub's skills are folders of the team pack on the main machine (`PluginBundleService.skillsDir`), which the plugin sync carries to every device. A save from the panel
 * writes `SKILL.md` atomically under a lock on that skill, refuses a save over a newer text, and keeps what the file held as a `skill_revisions` row, as `save_doc` does for a document.
 * Hub's own protocols (`HUB_CORE_SKILLS`) are shown and never written here (D65). Move to Hub copies a personal folder's text files into Hub under a free name: the original is never
 * changed or removed, and a folder with a binary file, a secret or too much in it is refused whole. Nothing is committed to Git: that stays the owner's step.
 */
import { createHash } from 'node:crypto';

import {
  type CreateSkillInput,
  isAllowed,
  isCoreSkill,
  type MemberActor,
  type MoveSkillInput,
  redactSecrets,
  type SkillDetail,
  type SkillRevision,
  type SkillRevisionDetail,
  type Skills,
  type SkillSource,
  type SkillSummary,
  type SkillWritten,
  type UpdateSkillInput,
} from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { z } from 'zod';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit';
import { PluginBundleService, PluginSyncService, skillHashOf } from '@/modules/devices';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { parseSkillFile, readHead, renameSkillFile, writeSkillFile } from '../domain/skill-file';
import { asText, type SkillFolder, SkillFolders, toBundle } from './skill-folders';

const REVISIONS_LIMIT = 50;
const hashOf = (text: string): string => createHash('sha256').update(text).digest('hex');

interface DeviceSkills {
  id: string;
  name: string;
  online: boolean;
  skills: Record<string, string>;
}

@Injectable()
export class SkillsService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly folders: SkillFolders,
    private readonly bundle: PluginBundleService,
    private readonly sync: PluginSyncService,
    private readonly audit: AuditService,
  ) {}

  /** Both lists, and the plugin each device has. Personal skills are the owner's, so only `skill.manage` sees them. */
  async list(actor: MemberActor): Promise<Skills> {
    const devices = await this.sync.deviceSkills();
    const hubNames = this.folders.names(this.folders.hubRoot);
    const hub = hubNames.map((name) =>
      this.summary('hub', this.folders.read(this.folders.hubRoot, name), devices, hubNames),
    );
    const owner = isAllowed('skill.manage', actor.roles);
    const personalRoot = this.folders.personalRoot;
    const personal = owner
      ? this.folders.names(personalRoot).flatMap((name) => {
          try {
            return [this.summary('personal', this.folders.read(personalRoot, name), [], hubNames)];
          } catch {
            return [];
          }
        })
      : [];
    return {
      hub,
      personal,
      personalFolder: owner && this.folders.names(personalRoot).length > 0 ? personalRoot : null,
      sync: {
        version: this.bundle.current().version,
        mode: this.sync.mode,
        devices: await this.sync.devices(),
      },
    };
  }

  async get(actor: MemberActor, source: SkillSource, name: string): Promise<SkillDetail> {
    if (source === 'personal' && !isAllowed('skill.manage', actor.roles)) {
      throw new AppException('hub.common.forbidden', { details: { action: 'skill.manage' } });
    }
    return this.detail(source, name, source === 'hub' ? await this.sync.deviceSkills() : []);
  }

  async create(actor: MemberActor, input: CreateSkillInput): Promise<SkillWritten> {
    assertNoSecrets(input);
    this.assertFreeName(input.name);
    const text = writeSkillFile(
      { name: input.name, description: input.description, userInvocable: input.userInvocable },
      input.body,
    );
    await this.txHost.withTransaction(async () => {
      await this.lock(input.name);
      await this.folders.createFolder(input.name, [{ path: 'SKILL.md', text }]);
      await this.audit.record(actor, {
        action: 'skills.create',
        targetType: 'skill',
        targetId: null,
        summary: `Created the Hub skill ${input.name}`,
      });
    });
    return this.written(input.name, null);
  }

  async update(actor: MemberActor, name: string, input: UpdateSkillInput): Promise<SkillWritten> {
    assertNoSecrets({ description: input.description, body: input.body });
    this.assertWritable(name);
    const revisionId = await this.txHost.withTransaction(async () => {
      await this.lock(name);
      const folder = this.folders.read(this.folders.hubRoot, name);
      this.assertBase(folder, input.baseHash);
      const current = await this.folders.readSkillMd(name);
      const next = writeSkillFile(
        { name, description: input.description, userInvocable: input.userInvocable },
        input.body,
        parseSkillFile(current),
      );
      if (next === current) return null;
      const revision = await this.keep(actor, name, current, 'edit');
      await this.folders.writeFile(name, 'SKILL.md', next);
      await this.audit.record(actor, {
        action: 'skills.update',
        targetType: 'skill',
        targetId: null,
        summary: `Saved the Hub skill ${name}`,
      });
      return revision;
    });
    return this.written(name, revisionId);
  }

  /** Copies a personal skill into Hub. The personal folder is read, never written. */
  async move(actor: MemberActor, input: MoveSkillInput): Promise<SkillWritten> {
    const personalRoot = this.folders.personalRoot;
    if (!this.folders.names(personalRoot).includes(input.name)) {
      throw new AppException('hub.skills.personal_not_found');
    }
    const target = input.as ?? input.name;
    const valid = z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(64)
      .safeParse(target);
    if (!valid.success)
      throw new AppException('hub.common.validation', { details: { issues: [{ path: ['as'] }] } });
    this.assertFreeName(target);
    const source = this.folders.read(personalRoot, input.name, true);
    const files = source.files.map((file) => {
      const text = asText(file.bytes);
      if (text === null) throw new AppException('hub.skills.not_text', { params: { file: file.path } });
      return { path: file.path, text: file.path === 'SKILL.md' ? renameSkillFile(text, target) : text };
    });
    assertNoSecrets(Object.fromEntries(files.map((file) => [file.path, file.text])));
    await this.txHost.withTransaction(async () => {
      await this.lock(target);
      await this.folders.createFolder(target, files);
      await this.audit.record(actor, {
        action: 'skills.move',
        targetType: 'skill',
        targetId: null,
        summary: `Copied the personal skill ${input.name} into Hub as ${target}`.slice(0, 500),
      });
    });
    return this.written(target, null);
  }

  async revisions(name: string): Promise<SkillRevision[]> {
    this.folders.read(this.folders.hubRoot, name);
    const rows = await this.txHost.tx.skillRevision.findMany({
      where: { name },
      orderBy: { createdAt: 'desc' },
      take: REVISIONS_LIMIT,
    });
    const people = await this.people(rows.map((row) => row.savedById));
    return rows.map((row) => this.revisionDto(row, people));
  }

  async revision(name: string, id: string): Promise<SkillRevisionDetail> {
    const row = await this.revisionRow(name, id);
    const people = await this.people([row.savedById]);
    return { ...this.revisionDto(row, people), text: row.content };
  }

  /** A restore is a save: what is there now becomes a revision of its own, so a restore can be undone. */
  async restore(actor: MemberActor, name: string, id: string, baseHash: string): Promise<SkillWritten> {
    this.assertWritable(name);
    const row = await this.revisionRow(name, id);
    const revisionId = await this.txHost.withTransaction(async () => {
      await this.lock(name);
      this.assertBase(this.folders.read(this.folders.hubRoot, name), baseHash);
      const current = await this.folders.readSkillMd(name);
      if (current === row.content) return null;
      const revision = await this.keep(actor, name, current, 'restore');
      await this.folders.writeFile(name, 'SKILL.md', row.content);
      await this.audit.record(actor, {
        action: 'skills.restore',
        targetType: 'skill',
        targetId: row.id,
        summary: `Restored the Hub skill ${name} to its text of ${row.createdAt.toISOString()}`,
      });
      return revision;
    });
    return this.written(name, revisionId);
  }

  // ── Inside ─────────────────────────────────────────────────────────────────────────────────────

  private async written(name: string, revisionId: string | null): Promise<SkillWritten> {
    const syncing = this.sync.afterChange();
    return { skill: this.detail('hub', name, await this.sync.deviceSkills()), revisionId, syncing };
  }

  private detail(source: SkillSource, name: string, devices: DeviceSkills[]): SkillDetail {
    const root = source === 'hub' ? this.folders.hubRoot : this.folders.personalRoot;
    if (source === 'personal' && !this.folders.names(root).includes(name)) {
      throw new AppException('hub.skills.personal_not_found');
    }
    if (source === 'hub' && !this.folders.names(root).includes(name))
      throw new AppException('hub.skills.not_found');
    const folder = this.folders.read(root, name);
    const hubNames = this.folders.names(this.folders.hubRoot);
    const summary = this.summary(source, folder, devices, hubNames);
    const text = folder.files.find((file) => file.path === 'SKILL.md')?.bytes.toString('utf8') ?? '';
    const { body } = readHead(text, name);
    return {
      ...summary,
      // Hub stores no secret, and a personal file is not Hub's: a value that looks like one is masked on the way out.
      body: source === 'personal' ? redactSecrets(body) : body,
      otherFiles: folder.files.map((file) => file.path).filter((path) => path !== 'SKILL.md'),
    };
  }

  private summary(
    source: SkillSource,
    folder: SkillFolder,
    devices: DeviceSkills[],
    hubNames: readonly string[],
  ): SkillSummary {
    const text = folder.files.find((file) => file.path === 'SKILL.md')?.bytes.toString('utf8') ?? '';
    const head = readHead(text, folder.name);
    const hash = skillHashOf(toBundle(folder.files));
    return {
      name: folder.name,
      declaredName: head.declaredName,
      description: source === 'personal' ? redactSecrets(head.description) : head.description,
      source,
      core: source === 'hub' && isCoreSkill(folder.name),
      userInvocable: head.userInvocable,
      files: folder.files.length,
      hash,
      updatedAt: folder.updatedAt?.toISOString() ?? null,
      devices:
        source === 'hub'
          ? devices.map((device) => ({
              id: device.id,
              name: device.name,
              online: device.online,
              synced: device.skills[folder.name] === hash,
            }))
          : [],
      nameInHub: source === 'personal' && hubNames.includes(folder.name),
    };
  }

  private assertFreeName(name: string): void {
    if (isCoreSkill(name) || this.folders.names(this.folders.hubRoot).includes(name)) {
      throw new AppException('hub.skills.name_taken', { params: { name } });
    }
  }

  private assertWritable(name: string): void {
    if (isCoreSkill(name)) throw new AppException('hub.skills.core_read_only', { params: { name } });
    if (!this.folders.names(this.folders.hubRoot).includes(name))
      throw new AppException('hub.skills.not_found');
  }

  private assertBase(folder: SkillFolder, baseHash: string): void {
    const hash = skillHashOf(toBundle(folder.files));
    if (hash !== baseHash)
      throw new AppException('hub.skills.stale_base', { details: { currentHash: hash } });
  }

  /** One writer per skill across processes. */
  private async lock(name: string): Promise<void> {
    await this.txHost.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`skill:${name}`}, 0))`;
  }

  /** The text being replaced becomes a revision. Hub stores no secret: a file holding one is not saved over, and the owner removes the value by hand. */
  private async keep(
    actor: MemberActor,
    name: string,
    text: string,
    reason: 'edit' | 'restore',
  ): Promise<string> {
    assertNoSecrets({ current: text });
    const row = await this.txHost.tx.skillRevision.create({
      data: { name, contentHash: hashOf(text), content: text, reason, savedById: actor.userId },
    });
    return row.id;
  }

  private async revisionRow(name: string, id: string) {
    if (!z.uuid().safeParse(id).success) throw new AppException('hub.skills.revision_not_found');
    const row = await this.txHost.tx.skillRevision.findFirst({ where: { id, name } });
    if (!row) throw new AppException('hub.skills.revision_not_found');
    return row;
  }

  private async people(ids: readonly (string | null)[]): Promise<Map<string, string>> {
    const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
    if (wanted.length === 0) return new Map();
    const users = await this.txHost.tx.user.findMany({
      where: { id: { in: wanted } },
      select: { id: true, displayName: true },
    });
    return new Map(users.map((user) => [user.id, user.displayName]));
  }

  private revisionDto(
    row: {
      id: string;
      name: string;
      contentHash: string;
      reason: string;
      savedById: string | null;
      createdAt: Date;
    },
    people: Map<string, string>,
  ): SkillRevision {
    return {
      id: row.id,
      name: row.name,
      hash: row.contentHash,
      reason: row.reason === 'restore' ? 'restore' : 'edit',
      savedBy: row.savedById ? { id: row.savedById, displayName: people.get(row.savedById) ?? '' } : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
