/**
 * @file Schema Studio (docs/17): the project's database design as Hub reads it from the Prisma files, the Arabic names and notes the team adds, and the drafts of changes Claude reviews and applies.
 * @description The API parses the files into a `SchemaDoc` and keeps one snapshot per change of their hash. Annotations live in Hub (D62) and are written back as `///` comments when a draft is applied.
 * A draft is a list of proposed changes, reviewed and applied in a live chat (D63): `editing → in_review → applying → applied`, or `discarded`.
 */
import { z } from 'zod';

import { absolutePath } from './projects';

// ── The parsed schema ───────────────────────────────────────────────────────────────────────────

export const SCHEMA_FIELD_KINDS = ['scalar', 'enum', 'relation', 'unsupported'] as const;
export type SchemaFieldKind = (typeof SCHEMA_FIELD_KINDS)[number];

export const schemaFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  kind: z.enum(SCHEMA_FIELD_KINDS),
  list: z.boolean(),
  optional: z.boolean(),
  /** The column's name in the database, from `@map`, when it differs. */
  dbName: z.string().nullable(),
  isId: z.boolean(),
  isUnique: z.boolean(),
  isUpdatedAt: z.boolean(),
  /** The raw argument of `@default(...)`. */
  default: z.string().nullable(),
  /** `@db.VarChar(64)` as `VarChar(64)`. */
  nativeType: z.string().nullable(),
  relation: z
    .object({
      name: z.string().nullable(),
      fields: z.array(z.string()),
      references: z.array(z.string()),
      onDelete: z.string().nullable(),
      onUpdate: z.string().nullable(),
    })
    .nullable(),
  /** The field is a scalar that a relation on this model writes (a foreign key). */
  isForeignKey: z.boolean(),
  /** Every attribute as written, without the `@`. */
  attributes: z.array(z.string()),
  /** The `///` lines above it. */
  doc: z.string().nullable(),
  /** The `//` lines above it and the comment after it on its line. */
  comment: z.string().nullable(),
  line: z.number().int(),
});
export type SchemaField = z.infer<typeof schemaFieldSchema>;

export const schemaIndexSchema = z.object({
  kind: z.enum(['id', 'unique', 'index', 'fulltext']),
  fields: z.array(z.string()),
  name: z.string().nullable(),
  raw: z.string(),
});
export type SchemaIndex = z.infer<typeof schemaIndexSchema>;

export const schemaModelSchema = z.object({
  name: z.string(),
  /** The table's name, from `@@map`. */
  dbName: z.string().nullable(),
  domain: z.string(),
  /** `model` or `view`. */
  block: z.enum(['model', 'view']),
  doc: z.string().nullable(),
  comment: z.string().nullable(),
  fields: z.array(schemaFieldSchema),
  indexes: z.array(schemaIndexSchema),
  /** The `@@` attributes as written, without the `@@`. */
  attributes: z.array(z.string()),
  line: z.number().int(),
});
export type SchemaModel = z.infer<typeof schemaModelSchema>;

export const schemaEnumValueSchema = z.object({
  name: z.string(),
  dbName: z.string().nullable(),
  doc: z.string().nullable(),
  comment: z.string().nullable(),
});
export type SchemaEnumValue = z.infer<typeof schemaEnumValueSchema>;

export const schemaEnumSchema = z.object({
  name: z.string(),
  dbName: z.string().nullable(),
  domain: z.string(),
  doc: z.string().nullable(),
  comment: z.string().nullable(),
  values: z.array(schemaEnumValueSchema),
  line: z.number().int(),
});
export type SchemaEnum = z.infer<typeof schemaEnumSchema>;

export const schemaRelationSchema = z.object({
  /** `Model.field` of the side holding the foreign key. */
  id: z.string(),
  from: z.string(),
  fromField: z.string(),
  to: z.string(),
  /** The back-relation field on `to`, when there is one. */
  toField: z.string().nullable(),
  fields: z.array(z.string()),
  references: z.array(z.string()),
  cardinality: z.enum(['one_to_one', 'many_to_one']),
  optional: z.boolean(),
  onDelete: z.string().nullable(),
  name: z.string().nullable(),
  /** Read from a column's name (`userId` next to a `User` model) with no `@relation`: no foreign key holds it. */
  implied: z.boolean(),
});
export type SchemaRelation = z.infer<typeof schemaRelationSchema>;

export const schemaDomainSchema = z.object({
  /** The file's name without `.prisma`: `bookings`. */
  name: z.string(),
  file: z.string(),
  /** The comment lines at the top of the file. */
  header: z.string().nullable(),
  models: z.array(z.string()),
  enums: z.array(z.string()),
});
export type SchemaDomain = z.infer<typeof schemaDomainSchema>;

export const schemaStatsSchema = z.object({
  domains: z.number().int(),
  models: z.number().int(),
  enums: z.number().int(),
  fields: z.number().int(),
  relations: z.number().int(),
  impliedRelations: z.number().int(),
  /** Models and fields with a `///` comment in the files. */
  documentedInFiles: z.number().int(),
});
export type SchemaStats = z.infer<typeof schemaStatsSchema>;

export const schemaDocSchema = z.object({
  provider: z.string().nullable(),
  domains: z.array(schemaDomainSchema),
  models: z.array(schemaModelSchema),
  enums: z.array(schemaEnumSchema),
  relations: z.array(schemaRelationSchema),
  stats: schemaStatsSchema,
  /** Lines the parser could not read, so a gap is visible rather than silent. */
  warnings: z.array(z.string()),
});
export type SchemaDoc = z.infer<typeof schemaDocSchema>;

// ── Where it is read from ───────────────────────────────────────────────────────────────────────

export const SCHEMA_DEFAULT_DIR = 'prisma/schema';

const relativeDir = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => !/^([A-Za-z]:|[\\/])/.test(value) && !/(^|[\\/])\.\.([\\/]|$)/.test(value), {
    message: 'must be a folder inside the repository',
  });

export const schemaSourceInputSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,32}$/),
  /** The repository's folder, which must be one of the project's folders. */
  path: absolutePath,
  schemaDir: relativeDir.default(SCHEMA_DEFAULT_DIR),
  /** The paired device that holds the folder, when the API cannot read it itself. */
  deviceId: z.uuid().nullable().optional(),
});
export type SchemaSourceInput = z.input<typeof schemaSourceInputSchema>;

export const schemaSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  schemaDir: z.string(),
  deviceId: z.string().nullable(),
});
export type SchemaSourceDto = z.infer<typeof schemaSourceSchema>;

// ── Snapshots ───────────────────────────────────────────────────────────────────────────────────

export const SNAPSHOT_TRIGGERS = ['manual', 'mcp', 'after_apply'] as const;
export type SnapshotTrigger = (typeof SNAPSHOT_TRIGGERS)[number];

export const schemaChangeSummarySchema = z.object({
  addedModels: z.array(z.string()),
  removedModels: z.array(z.string()),
  changedModels: z.array(z.string()),
  /** `Model.field` */
  addedFields: z.array(z.string()),
  removedFields: z.array(z.string()),
  changedFields: z.array(z.string()),
  addedEnums: z.array(z.string()),
  removedEnums: z.array(z.string()),
  changedEnums: z.array(z.string()),
});
export type SchemaChangeSummary = z.infer<typeof schemaChangeSummarySchema>;

export const schemaSnapshotRowSchema = z.object({
  id: z.string(),
  hash: z.string(),
  trigger: z.enum(SNAPSHOT_TRIGGERS),
  takenBy: z.string().nullable(),
  createdAt: z.string(),
  stats: schemaStatsSchema,
  /** Against the snapshot before it; null for the first. */
  changes: schemaChangeSummarySchema.nullable(),
  draftId: z.string().nullable(),
});
export type SchemaSnapshotRow = z.infer<typeof schemaSnapshotRowSchema>;

// ── Annotations (D62) ───────────────────────────────────────────────────────────────────────────

/** `model:Booking`, `field:Booking.status`, `enum:BookingStatus`, `enumValue:BookingStatus.PAID`. */
export const ANNOTATION_TARGET_PATTERN =
  /^(model|field|enum|enumValue):[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/;
export const annotationTargetSchema = z.string().max(200).regex(ANNOTATION_TARGET_PATTERN);

export const SENSITIVITIES = ['none', 'pii', 'money', 'secret'] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];

export const SCHEMA_LIMITS = {
  nameAr: 120,
  descriptionAr: 2_000,
  notes: 4_000,
  tags: 12,
  tag: 40,
  changes: 200,
  changeText: 2_000,
  annotationsPerCall: 500,
  snapshots: 50,
} as const;

export const annotationInputSchema = z.object({
  target: annotationTargetSchema,
  nameAr: z.string().trim().max(SCHEMA_LIMITS.nameAr).nullable().optional(),
  descriptionAr: z.string().trim().max(SCHEMA_LIMITS.descriptionAr).nullable().optional(),
  notes: z.string().trim().max(SCHEMA_LIMITS.notes).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(SCHEMA_LIMITS.tag)).max(SCHEMA_LIMITS.tags).optional(),
  sensitivity: z.enum(SENSITIVITIES).optional(),
});
export type AnnotationInput = z.infer<typeof annotationInputSchema>;

export const putAnnotationsSchema = z.object({
  annotations: z.array(annotationInputSchema).min(1).max(SCHEMA_LIMITS.annotationsPerCall),
});
export type PutAnnotationsInput = z.infer<typeof putAnnotationsSchema>;

export const annotationSchema = z.object({
  target: z.string(),
  nameAr: z.string().nullable(),
  descriptionAr: z.string().nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  sensitivity: z.enum(SENSITIVITIES),
  updatedBy: z.string().nullable(),
  updatedAt: z.string(),
  /** When it was last written into the files as a `///` comment; null while only Hub has it. */
  syncedAt: z.string().nullable(),
});
export type SchemaAnnotationDto = z.infer<typeof annotationSchema>;

// ── Drafts (D63) ────────────────────────────────────────────────────────────────────────────────

export const SCHEMA_CHANGE_KINDS = [
  'add_model',
  'add_field',
  'change_field',
  'rename',
  'remove',
  'split_model',
  'add_relation',
  'add_index',
  'add_enum',
  'change_enum',
  'note',
] as const;
export type SchemaChangeKind = (typeof SCHEMA_CHANGE_KINDS)[number];

const changeText = z.string().trim().max(SCHEMA_LIMITS.changeText);

export const schemaChangeSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(SCHEMA_CHANGE_KINDS),
  /** `Booking`, `Booking.status`, or a new name for an addition. */
  target: z.string().trim().min(1).max(200),
  /** What to do, in a line. */
  summary: changeText.pipe(z.string().min(1)),
  /** The detail: a type, attributes, Prisma lines, a split's parts. */
  detail: changeText.optional(),
  reason: changeText.optional(),
});
export type SchemaChange = z.infer<typeof schemaChangeSchema>;

export const SCHEMA_DRAFT_STATUSES = ['editing', 'in_review', 'applying', 'applied', 'discarded'] as const;
export type SchemaDraftStatus = (typeof SCHEMA_DRAFT_STATUSES)[number];

const DRAFT_MOVES: Readonly<Record<SchemaDraftStatus, readonly SchemaDraftStatus[]>> = {
  editing: ['in_review', 'discarded'],
  in_review: ['editing', 'applying', 'applied', 'discarded'],
  applying: ['in_review', 'applied', 'discarded'],
  applied: [],
  discarded: [],
};

export const canMoveDraft = (from: SchemaDraftStatus, to: SchemaDraftStatus): boolean =>
  DRAFT_MOVES[from].includes(to);
export const isOpenDraft = (status: SchemaDraftStatus): boolean => DRAFT_MOVES[status].length > 0;

export const createSchemaDraftSchema = z.object({
  title: z.string().trim().min(1).max(160),
  changes: z.array(schemaChangeSchema).max(SCHEMA_LIMITS.changes).default([]),
});
export type CreateSchemaDraftInput = z.input<typeof createSchemaDraftSchema>;

export const updateSchemaDraftSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  changes: z.array(schemaChangeSchema).max(SCHEMA_LIMITS.changes).optional(),
  status: z.enum(SCHEMA_DRAFT_STATUSES).optional(),
  /** Claude's review: what it found, what was agreed. Markdown. */
  review: z.string().trim().max(20_000).nullable().optional(),
});
export type UpdateSchemaDraftInput = z.infer<typeof updateSchemaDraftSchema>;

export const schemaDraftSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(SCHEMA_DRAFT_STATUSES),
  changes: z.array(schemaChangeSchema),
  review: z.string().nullable(),
  chatId: z.string().nullable(),
  baseSnapshotId: z.string().nullable(),
  appliedSnapshotId: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SchemaDraftDto = z.infer<typeof schemaDraftSchema>;

export const reviewDraftResultSchema = z.object({
  draft: schemaDraftSchema,
  /** What the page sends to the panel, in Plan. */
  prompt: z.string(),
});
export type ReviewDraftResult = z.infer<typeof reviewDraftResultSchema>;

export const attachDraftChatSchema = z.object({ chatId: z.uuid() });

// ── What the page reads ─────────────────────────────────────────────────────────────────────────

export const schemaStudioSchema = z.object({
  source: schemaSourceSchema.nullable(),
  snapshot: z
    .object({
      id: z.string(),
      hash: z.string(),
      createdAt: z.string(),
      trigger: z.enum(SNAPSHOT_TRIGGERS),
      schema: schemaDocSchema,
      /** Against the snapshot before it, to light up what changed. */
      changes: schemaChangeSummarySchema.nullable(),
    })
    .nullable(),
  annotations: z.array(annotationSchema),
  drafts: z.array(schemaDraftSchema),
});
export type SchemaStudioDto = z.infer<typeof schemaStudioSchema>;

export const refreshSchemaSchema = z.object({
  /** A draft this refresh closes: it becomes `applied` with this snapshot. */
  draftId: z.uuid().optional(),
});
export type RefreshSchemaInput = z.infer<typeof refreshSchemaSchema>;

export const refreshSchemaResultSchema = z.object({
  snapshotId: z.string(),
  created: z.boolean(),
  changes: schemaChangeSummarySchema.nullable(),
  stats: schemaStatsSchema,
});
export type RefreshSchemaResult = z.infer<typeof refreshSchemaResultSchema>;

/** The realtime envelope `schema.changed`: the page rereads its query. */
export interface SchemaChanged {
  readonly what: 'snapshot' | 'annotations' | 'draft' | 'source';
}

export const changeCount = (changes: SchemaChangeSummary | null): number =>
  changes ? Object.values(changes).reduce((total, list: readonly string[]) => total + list.length, 0) : 0;

/** The text a draft review starts with (docs/17 §5). The draft and the schema come from the tools, so the prompt stays short and current. */
export function schemaReviewPrompt(
  draft: { id: string; title: string; changes: readonly SchemaChange[] },
  source: { name: string; path: string; schemaDir: string },
): string {
  const lines = draft.changes.map(
    (change, index) =>
      `${index + 1}. [${change.kind}] ${change.target}: ${change.summary}${change.detail ? `\n   ${change.detail.replaceAll('\n', '\n   ')}` : ''}${change.reason ? `\n   Why: ${change.reason}` : ''}`,
  );
  return [
    `Review the database design draft "${draft.title}" (schema draft \`${draft.id}\`) for the ${source.name} schema in ${source.path}/${source.schemaDir}.`,
    '',
    'Proposed changes:',
    ...(lines.length > 0 ? lines : ['(none yet: only the Arabic names and notes to write back)']),
    '',
    'How to work:',
    `1. Read the draft with get_schema_draft and the current design with get_schema, then the Prisma files themselves and the docs that cover these tables.`,
    '2. Review each change: naming against the files around it, types and native types, nullability and defaults, indexes and unique keys, relations and onDelete, what the migration does to existing rows, and anything a change breaks in the code that reads these tables.',
    '3. Discuss it with me: say what you agree with, what you would change and why, and propose better options. This chat starts in Plan, so edit nothing yet.',
    '4. When I agree and switch to Execute: save the outcome with update_schema_draft (`review` in Markdown, `changes` as agreed, status `applying`), edit the Prisma files, write the Arabic names and descriptions that are not synced yet as `///` comments above their model, field or enum, create the migration with `prisma migrate dev --create-only`, and run the typecheck and the tests.',
    '5. Then call refresh_schema with the draft id, so the draft is marked applied and the page shows the new design.',
    'Ask me before creating a branch. Never run a migration against a shared database.',
  ].join('\n');
}

/** The text of "Suggest Arabic names": Claude fills the gaps with set_schema_annotations, and the owner edits them on the page. */
export function schemaNamesPrompt(scope: {
  domain?: string | undefined;
  model?: string | undefined;
}): string {
  const where = scope.model
    ? `the model ${scope.model} and its fields`
    : scope.domain
      ? `every model, field and enum of the ${scope.domain} domain`
      : 'every model, field and enum';
  return [
    `Suggest Arabic names and descriptions for ${where} in the database design.`,
    '1. Read the design with get_schema (it shows which targets have no Arabic name yet), and the Prisma files and docs for what each one means.',
    '2. For each target without an Arabic name: a short Arabic name (nameAr) a business reader understands, and a one- or two-sentence Arabic description (descriptionAr) of what it holds and why. Mark money, personal data and secrets with `sensitivity`.',
    '3. Save them with set_schema_annotations, in batches. Do not overwrite a name someone already wrote.',
    '4. Then tell me in a few lines what you named and anything you were unsure of.',
  ].join('\n');
}
