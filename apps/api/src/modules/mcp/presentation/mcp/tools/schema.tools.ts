/**
 * @file Handlers of the Schema Studio tools (docs/17 §3). They call the same service as the page.
 * @description `get_schema` with nothing narrows to an overview, because the whole design does not fit in one answer: each domain with its models and how many are named. A domain or a model gives every field.
 * Starting a draft and sending it to review are the owner's presses on the page; the review's chat then uses these tools.
 */
import type { SchemaAnnotationDto, SchemaDoc, SchemaDraftDto, SchemaModel } from '@hub/contracts';

import type { ToolHandlers } from '../tool-context';

const MISSING_SHOWN = 400;

function annotationMap(annotations: readonly SchemaAnnotationDto[]): Map<string, SchemaAnnotationDto> {
  return new Map(annotations.map((entry) => [entry.target, entry]));
}

const named = (entry: SchemaAnnotationDto | undefined) => (entry?.nameAr ? ` «${entry.nameAr}»` : '');

function renderModel(model: SchemaModel, names: Map<string, SchemaAnnotationDto>): string {
  const own = names.get(`model:${model.name}`);
  const lines = [
    `### ${model.name}${named(own)}${model.dbName ? ` (table ${model.dbName})` : ''}, domain ${model.domain}`,
    ...(model.doc ? [`/// ${model.doc.replaceAll('\n', ' ')}`] : []),
    ...(own?.descriptionAr ? [`Arabic description: ${own.descriptionAr}`] : []),
    ...(own?.notes ? [`Notes: ${own.notes}`] : []),
    ...model.fields.map((field) => {
      const entry = names.get(`field:${model.name}.${field.name}`);
      const flags = [
        field.isId ? 'id' : '',
        field.isUnique ? 'unique' : '',
        field.isForeignKey ? 'fk' : '',
        entry?.sensitivity && entry.sensitivity !== 'none' ? entry.sensitivity : '',
      ].filter(Boolean);
      return `- ${field.name}${named(entry)}: ${field.type}${field.attributes.length ? ` @${field.attributes.join(' @')}` : ''}${flags.length ? ` [${flags.join(', ')}]` : ''}${field.doc ? ` /// ${field.doc.replaceAll('\n', ' ')}` : ''}`;
    }),
    ...model.attributes.map((attribute) => `- @@${attribute}`),
  ];
  return lines.join('\n');
}

function missingTargets(
  schema: SchemaDoc,
  names: Map<string, SchemaAnnotationDto>,
  models: readonly SchemaModel[],
): string[] {
  const missing: string[] = [];
  const has = (target: string) => Boolean(names.get(target)?.nameAr);
  for (const model of models) {
    if (!has(`model:${model.name}`)) missing.push(`model:${model.name}`);
    for (const field of model.fields)
      if (!has(`field:${model.name}.${field.name}`)) missing.push(`field:${model.name}.${field.name}`);
  }
  const domains = new Set(models.map((model) => model.domain));
  for (const value of schema.enums) {
    if (!domains.has(value.domain)) continue;
    if (!has(`enum:${value.name}`)) missing.push(`enum:${value.name}`);
  }
  return missing;
}

function renderDraft(draft: SchemaDraftDto): string {
  return [
    `Draft \`${draft.id}\` "${draft.title}": ${draft.status}${draft.createdBy ? `, by ${draft.createdBy}` : ''}, updated ${draft.updatedAt}.`,
    ...(draft.changes.length === 0
      ? ['No changes proposed: only the Arabic names to write back.']
      : draft.changes.map(
          (change, index) =>
            `${index + 1}. [${change.kind}] ${change.target}: ${change.summary}${change.detail ? `\n   ${change.detail.replaceAll('\n', '\n   ')}` : ''}${change.reason ? `\n   Why: ${change.reason}` : ''}`,
        )),
    ...(draft.review ? ['', 'Review so far:', draft.review] : []),
  ].join('\n');
}

export const schemaToolHandlers = {
  async get_schema(context, input) {
    const actor = await context.allowed('schema.read');
    const { schema, annotations, source, at } = await context.deps.schema.latestSchema(actor);
    const names = annotationMap(annotations);
    const head = `Schema ${source.name}: ${source.path}/${source.schemaDir}, read ${at}. ${schema.stats.models} models, ${schema.stats.enums} enums, ${schema.stats.fields} fields, ${schema.stats.relations} relations (+${schema.stats.impliedRelations} implied by column names). ${annotations.filter((entry) => entry.nameAr).length} targets named in Arabic, ${annotations.filter((entry) => entry.nameAr && !entry.syncedAt).length} not yet written to the files.`;

    const models = schema.models.filter(
      (model) =>
        (!input.domain || model.domain === input.domain) && (!input.model || model.name === input.model),
    );
    if ((input.domain || input.model) && models.length === 0) {
      return `${head}\nNo ${input.model ? `model ${input.model}` : `domain ${input.domain}`}. Domains: ${schema.domains.map((domain) => domain.name).join(', ')}.`;
    }
    if (input.missingNames) {
      const missing = missingTargets(schema, names, models);
      return [
        head,
        `${missing.length} targets have no Arabic name${missing.length > MISSING_SHOWN ? `; the first ${MISSING_SHOWN}` : ''}:`,
        ...missing.slice(0, MISSING_SHOWN),
        ...(missing.length > MISSING_SHOWN ? ['Narrow it with `domain` for the rest.'] : []),
      ].join('\n');
    }
    if (!input.domain && !input.model) {
      return [
        head,
        'Pass `domain` or `model` for the fields.',
        ...schema.domains.map((domain) => {
          const list = domain.models.map((name) => `${name}${named(names.get(`model:${name}`))}`).join(', ');
          return `- ${domain.name} (${domain.file})${domain.header ? `: ${domain.header.split('\n')[0]}` : ''}\n  Models: ${list || 'none'}\n  Enums: ${domain.enums.join(', ') || 'none'}`;
        }),
      ].join('\n');
    }
    const relations = schema.relations.filter((relation) =>
      models.some((model) => model.name === relation.from || model.name === relation.to),
    );
    const enumNames = new Set(
      models.flatMap((model) =>
        model.fields
          .filter((field) => field.kind === 'enum')
          .map((field) => field.type.replace(/[[\]?]/g, '')),
      ),
    );
    const enums = schema.enums.filter(
      (value) => enumNames.has(value.name) || (input.domain && value.domain === input.domain),
    );
    return [
      head,
      ...models.map((model) => renderModel(model, names)),
      ...(relations.length
        ? [
            '### Relations',
            ...relations.map(
              (relation) =>
                `- ${relation.from}.${relation.fromField} → ${relation.to}${relation.toField ? `.${relation.toField}` : ''} (${relation.cardinality}${relation.implied ? ', implied, no foreign key' : ''}${relation.onDelete ? `, onDelete ${relation.onDelete}` : ''})`,
            ),
          ]
        : []),
      ...(enums.length
        ? [
            '### Enums',
            ...enums.map(
              (value) =>
                `- ${value.name}${named(names.get(`enum:${value.name}`))}: ${value.values.map((item) => item.name).join(', ')}`,
            ),
          ]
        : []),
    ].join('\n\n');
  },

  async refresh_schema(context, input) {
    const actor = await context.allowed('schema.manage');
    const result = await context.deps.schema.refresh(actor, input, 'mcp');
    const changes = result.changes;
    const what = changes
      ? Object.entries(changes)
          .filter(([, list]) => list.length > 0)
          .map(([kind, list]) => `${kind}: ${list.join(', ')}`)
          .join('\n')
      : '';
    return [
      result.created
        ? `New snapshot \`${result.snapshotId}\`: ${result.stats.models} models, ${result.stats.fields} fields.`
        : 'The files have not changed since the last snapshot.',
      ...(what ? [what] : []),
      ...(input.draftId ? [`Draft \`${input.draftId}\` is applied. The page shows the new design.`] : []),
    ].join('\n');
  },

  async get_schema_draft(context, input) {
    const actor = await context.allowed('schema.read');
    return renderDraft(await context.deps.schema.draft(actor, input.draftId));
  },

  async update_schema_draft(context, input) {
    const actor = await context.allowed('schema.draft');
    const { draftId, project: _project, ...change } = input;
    return `Saved.\n${renderDraft(await context.deps.schema.updateDraft(actor, draftId, change))}`;
  },

  async set_schema_annotations(context, input) {
    const actor = await context.allowed('schema.annotate');
    const saved = await context.deps.schema.putAnnotations(actor, input.annotations);
    return `Saved ${input.annotations.length}. ${saved.filter((entry) => entry.nameAr).length} targets now have an Arabic name. The page shows them at once.`;
  },
} satisfies Partial<ToolHandlers>;
