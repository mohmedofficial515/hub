/**
 * @file Reads Prisma schema files into a `SchemaDoc` (docs/17 §3): domains, models, fields, enums and the relations between them, with every `///` and `//` comment kept.
 * @description A small reader of the Prisma language, for showing a design rather than running it: blocks, fields, attributes with balanced arguments and quoted strings, and comments.
 * What it cannot read becomes a warning, so a gap shows on the page instead of a field silently missing. Prisma itself stays the judge of a schema's validity.
 */
import type {
  SchemaDoc,
  SchemaDomain,
  SchemaEnum,
  SchemaEnumValue,
  SchemaField,
  SchemaIndex,
  SchemaModel,
  SchemaRelation,
} from '@hub/contracts';

export interface SchemaFile {
  /** Relative to the repository, with forward slashes. */
  readonly path: string;
  readonly text: string;
}

const BLOCK_START = /^(model|view|enum|type|generator|datasource)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{\s*$/;
const FIELD_LINE =
  /^([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_.]*(?:\((?:"(?:[^"\\]|\\.)*"|[^()"])*\))?)(\[\])?(\?)?(?:\s+(.*))?$/;
const ENUM_VALUE = /^([A-Za-z_][A-Za-z0-9_]*)(?:\s+(.*))?$/;

/** Splits the comment after code, outside strings and brackets. */
function splitTrailingComment(text: string): { code: string; comment: string | null } {
  let quote = false;
  for (let index = 0; index < text.length - 1; index += 1) {
    const char = text[index];
    if (char === '\\' && quote) {
      index += 1;
      continue;
    }
    if (char === '"') quote = !quote;
    if (!quote && char === '/' && text[index + 1] === '/') {
      return {
        code: text.slice(0, index).trimEnd(),
        comment:
          text
            .slice(index)
            .replace(/^\/{2,3}\s?/, '')
            .trim() || null,
      };
    }
  }
  return { code: text, comment: null };
}

interface Attribute {
  readonly name: string;
  /** The text inside the brackets, or null when there were none. */
  readonly args: string | null;
  readonly raw: string;
}

/** `@id @default(dbgenerated("x()")) @db.Uuid` into its attributes. `prefix` is `@` or `@@`. */
export function readAttributes(text: string, prefix: '@' | '@@' = '@'): Attribute[] {
  const found: Attribute[] = [];
  let index = 0;
  while (index < text.length) {
    const at = text.indexOf(prefix, index);
    if (at === -1) break;
    if (prefix === '@' && text[at + 1] === '@') {
      index = at + 2;
      continue;
    }
    let cursor = at + prefix.length;
    const nameMatch = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(text.slice(cursor));
    if (!nameMatch) {
      index = cursor;
      continue;
    }
    const name = nameMatch[0];
    cursor += name.length;
    let args: string | null = null;
    if (text[cursor] === '(') {
      let depth = 0;
      let quote = false;
      const start = cursor;
      for (; cursor < text.length; cursor += 1) {
        const char = text[cursor];
        if (char === '\\' && quote) {
          cursor += 1;
          continue;
        }
        if (char === '"') quote = !quote;
        if (quote) continue;
        if (char === '(') depth += 1;
        if (char === ')') {
          depth -= 1;
          if (depth === 0) {
            cursor += 1;
            break;
          }
        }
      }
      args = text.slice(start + 1, cursor - 1);
    }
    found.push({ name, args, raw: text.slice(at + prefix.length, cursor) });
    index = cursor;
  }
  return found;
}

/** Splits arguments on top-level commas. */
function splitArgs(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = false;
  let start = 0;
  for (let index = 0; index < args.length; index += 1) {
    const char = args[index];
    if (char === '\\' && quote) {
      index += 1;
      continue;
    }
    if (char === '"') quote = !quote;
    if (quote) continue;
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(args.slice(start, index).trim());
      start = index + 1;
    }
  }
  const last = args.slice(start).trim();
  if (last) parts.push(last);
  return parts;
}

interface Args {
  readonly positional: string[];
  readonly named: Record<string, string>;
}

function readArgs(args: string | null): Args {
  const positional: string[] = [];
  const named: Record<string, string> = {};
  for (const part of splitArgs(args ?? '')) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([\s\S]*)$/.exec(part);
    if (match?.[1] && match[2] !== undefined) named[match[1]] = match[2].trim();
    else positional.push(part);
  }
  return { positional, named };
}

const unquote = (value: string | undefined): string | null => {
  if (value === undefined) return null;
  const match = /^"((?:[^"\\]|\\.)*)"$/.exec(value.trim());
  return match?.[1] ?? null;
};

/** `[a, b(sort: Desc)]` into `['a', 'b']`. */
function fieldList(value: string | undefined): string[] {
  if (!value) return [];
  const inner = value.trim().replace(/^\[/, '').replace(/\]$/, '');
  return splitArgs(inner)
    .map((part) => part.replace(/\(.*\)$/, '').trim())
    .filter(Boolean);
}

/** Block comments, which Prisma also accepts, become `///` lines (`/**`) or `//` lines (`/*`), so the rest reads one kind of comment. */
function unfoldBlockComments(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').trim();
    if (!line.startsWith('/*')) {
      out.push(lines[index] ?? '');
      continue;
    }
    const marker = line.startsWith('/**') ? '///' : '//';
    let text = line.replace(/^\/\*\*?/, '');
    // One line out for each line in, so line numbers still point at the file. An empty piece is dropped by `joinLines`.
    for (;;) {
      const end = text.indexOf('*/');
      const piece = (end === -1 ? text : text.slice(0, end)).trim().replace(/^\*\s?/, '');
      out.push(piece ? `${marker} ${piece}` : marker);
      if (end !== -1 || index + 1 >= lines.length) break;
      index += 1;
      text = (lines[index] ?? '').trim();
    }
  }
  return out;
}

const joinLines = (lines: readonly string[]): string | null => {
  const kept = lines.filter((line) => line !== '');
  return kept.length > 0 ? kept.join('\n') : null;
};

interface RawField extends Omit<SchemaField, 'kind' | 'isForeignKey'> {
  readonly baseType: string;
}

interface RawModel extends Omit<SchemaModel, 'fields'> {
  readonly fields: RawField[];
}

function readField(
  name: string,
  typeText: string,
  list: boolean,
  optional: boolean,
  rest: string,
  doc: string[],
  comment: string[],
  line: number,
): RawField {
  const { code, comment: trailing } = splitTrailingComment(rest);
  const attributes = readAttributes(code, '@');
  const byName = (wanted: string) => attributes.find((attribute) => attribute.name === wanted);
  const native = attributes.find((attribute) => attribute.name.startsWith('db.'));
  const relationAttribute = byName('relation');
  let relation: SchemaField['relation'] = null;
  if (relationAttribute) {
    const args = readArgs(relationAttribute.args);
    relation = {
      name: unquote(args.positional[0]) ?? unquote(args.named['name']),
      fields: fieldList(args.named['fields']),
      references: fieldList(args.named['references']),
      onDelete: args.named['onDelete'] ?? null,
      onUpdate: args.named['onUpdate'] ?? null,
    };
  }
  const comments = [...comment, ...(trailing ? [trailing] : [])];
  return {
    name,
    type: `${typeText}${list ? '[]' : ''}${optional ? '?' : ''}`,
    baseType: typeText,
    list,
    optional,
    dbName: unquote(readArgs(byName('map')?.args ?? null).positional[0]),
    isId: Boolean(byName('id')),
    isUnique: Boolean(byName('unique')),
    isUpdatedAt: Boolean(byName('updatedAt')),
    default: byName('default')?.args ?? null,
    nativeType: native ? `${native.name.slice(3)}${native.args !== null ? `(${native.args})` : ''}` : null,
    relation,
    attributes: attributes.map((attribute) => attribute.raw),
    doc: joinLines(doc),
    comment: joinLines(comments),
    line,
  };
}

function readIndex(attribute: Attribute): SchemaIndex | null {
  const kinds: Record<string, SchemaIndex['kind']> = {
    id: 'id',
    unique: 'unique',
    index: 'index',
    fulltext: 'fulltext',
  };
  const kind = kinds[attribute.name];
  if (!kind) return null;
  const args = readArgs(attribute.args);
  return {
    kind,
    fields: fieldList(args.named['fields'] ?? args.positional[0]),
    name: unquote(args.named['name']) ?? unquote(args.named['map']),
    raw: attribute.raw,
  };
}

export function parsePrismaFiles(files: readonly SchemaFile[]): SchemaDoc {
  const warnings: string[] = [];
  const models: RawModel[] = [];
  const enums: SchemaEnum[] = [];
  const domains: SchemaDomain[] = [];
  let provider: string | null = null;

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const domainName = (file.path.split('/').pop() ?? file.path).replace(/\.prisma$/i, '');
    const domain: SchemaDomain = { name: domainName, file: file.path, header: null, models: [], enums: [] };
    const lines = unfoldBlockComments(file.text.replace(/\r\n?/g, '\n').split('\n'));
    let doc: string[] = [];
    let comment: string[] = [];
    let headerDone = false;
    const header: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = (lines[index] ?? '').trim();
      if (!headerDone) {
        if (line.startsWith('//') && !line.startsWith('///')) {
          header.push(line.replace(/^\/\/\s?/, ''));
          continue;
        }
        headerDone = true;
        if (line === '') continue;
      }
      if (line === '') {
        doc = [];
        comment = [];
        continue;
      }
      if (line.startsWith('///')) {
        doc.push(line.replace(/^\/\/\/\s?/, ''));
        continue;
      }
      if (line.startsWith('//')) {
        comment.push(line.replace(/^\/\/\s?/, ''));
        continue;
      }
      // `model SessionLog {   // one row per session` opens a block too: its comment joins the block's.
      const opening = splitTrailingComment(line);
      const start = BLOCK_START.exec(opening.code);
      if (!start) {
        warnings.push(`${file.path}:${index + 1}: not read: ${line.slice(0, 80)}`);
        continue;
      }
      const [, block, name] = start as unknown as [string, string, string];
      const blockDoc = doc;
      const blockComment = opening.comment ? [...comment, opening.comment] : comment;
      doc = [];
      comment = [];
      const startLine = index + 1;
      const body: { text: string; line: number }[] = [];
      index += 1;
      while (index < lines.length && splitTrailingComment((lines[index] ?? '').trim()).code !== '}') {
        body.push({ text: (lines[index] ?? '').trim(), line: index + 1 });
        index += 1;
      }
      if (index >= lines.length)
        warnings.push(`${file.path}:${startLine}: ${block} ${name} has no closing brace`);

      if (block === 'datasource') {
        const providerLine = body.find((entry) => /^provider\s*=/.test(entry.text));
        provider = unquote(providerLine?.text.split('=')[1]?.trim()) ?? provider;
        continue;
      }
      if (block === 'generator') continue;

      if (block === 'enum') {
        const values: SchemaEnumValue[] = [];
        let dbName: string | null = null;
        let valueDoc: string[] = [];
        let valueComment: string[] = [];
        for (const entry of body) {
          if (entry.text === '') {
            valueDoc = [];
            valueComment = [];
          } else if (entry.text.startsWith('///')) valueDoc.push(entry.text.replace(/^\/\/\/\s?/, ''));
          else if (entry.text.startsWith('//')) valueComment.push(entry.text.replace(/^\/\/\s?/, ''));
          else if (entry.text.startsWith('@@')) {
            const map = readAttributes(entry.text, '@@').find((attribute) => attribute.name === 'map');
            if (map) dbName = unquote(readArgs(map.args).positional[0]);
          } else {
            const match = ENUM_VALUE.exec(entry.text);
            if (!match?.[1]) {
              warnings.push(`${file.path}:${entry.line}: not read: ${entry.text.slice(0, 80)}`);
              continue;
            }
            const { code, comment: trailing } = splitTrailingComment(match[2] ?? '');
            const map = readAttributes(code, '@').find((attribute) => attribute.name === 'map');
            values.push({
              name: match[1],
              dbName: map ? unquote(readArgs(map.args).positional[0]) : null,
              doc: joinLines(valueDoc),
              comment: joinLines([...valueComment, ...(trailing ? [trailing] : [])]),
            });
            valueDoc = [];
            valueComment = [];
          }
        }
        enums.push({
          name,
          dbName,
          domain: domainName,
          doc: joinLines(blockDoc),
          comment: joinLines(blockComment),
          values,
          line: startLine,
        });
        domain.enums.push(name);
        continue;
      }

      if (block === 'type') {
        warnings.push(`${file.path}:${startLine}: composite type ${name} is shown as a note only`);
        continue;
      }

      const fields: RawField[] = [];
      const indexes: SchemaIndex[] = [];
      const attributes: string[] = [];
      let dbName: string | null = null;
      let fieldDoc: string[] = [];
      let fieldComment: string[] = [];
      for (let cursor = 0; cursor < body.length; cursor += 1) {
        const entry = body[cursor] as { text: string; line: number };
        if (entry.text === '') {
          fieldDoc = [];
          fieldComment = [];
          continue;
        }
        if (entry.text.startsWith('///')) {
          fieldDoc.push(entry.text.replace(/^\/\/\/\s?/, ''));
          continue;
        }
        if (entry.text.startsWith('//')) {
          fieldComment.push(entry.text.replace(/^\/\/\s?/, ''));
          continue;
        }
        if (entry.text.startsWith('@@')) {
          // A block attribute may run over several lines until its brackets close.
          let text = splitTrailingComment(entry.text).code;
          while (
            cursor + 1 < body.length &&
            (text.split('(').length !== text.split(')').length ||
              text.split('[').length !== text.split(']').length)
          ) {
            cursor += 1;
            text += ` ${splitTrailingComment((body[cursor] as { text: string }).text).code}`;
          }
          for (const attribute of readAttributes(text, '@@')) {
            attributes.push(attribute.raw);
            if (attribute.name === 'map') dbName = unquote(readArgs(attribute.args).positional[0]);
            const found = readIndex(attribute);
            if (found) indexes.push(found);
          }
          fieldDoc = [];
          fieldComment = [];
          continue;
        }
        const match = FIELD_LINE.exec(entry.text);
        if (!match?.[1] || !match[2]) {
          warnings.push(`${file.path}:${entry.line}: not read: ${entry.text.slice(0, 80)}`);
          continue;
        }
        fields.push(
          readField(
            match[1],
            match[2],
            Boolean(match[3]),
            Boolean(match[4]),
            match[5] ?? '',
            fieldDoc,
            fieldComment,
            entry.line,
          ),
        );
        fieldDoc = [];
        fieldComment = [];
      }
      models.push({
        name,
        dbName,
        domain: domainName,
        block: block === 'view' ? 'view' : 'model',
        doc: joinLines(blockDoc),
        comment: joinLines(blockComment),
        fields,
        indexes,
        attributes,
        line: startLine,
      });
      domain.models.push(name);
    }
    domain.header = joinLines(header);
    if (domain.models.length > 0 || domain.enums.length > 0) domains.push(domain);
  }

  const modelNames = new Set(models.map((model) => model.name));
  const enumNames = new Set(enums.map((value) => value.name));
  const byName = new Map(models.map((model) => [model.name, model]));
  const relations: SchemaRelation[] = [];
  const foreignKeys = new Set<string>();

  for (const model of models) {
    for (const field of model.fields) {
      if (!modelNames.has(field.baseType) || !field.relation || field.relation.fields.length === 0) continue;
      const target = byName.get(field.baseType);
      const back =
        target?.fields.find(
          (other) =>
            other.baseType === model.name &&
            !(target.name === model.name && other.name === field.name) &&
            (other.relation?.name ?? null) === field.relation?.name &&
            (other.relation?.fields.length ?? 0) === 0,
        ) ?? null;
      const fkUnique =
        (field.relation.fields.length === 1 &&
          model.fields.some(
            (other) => other.name === field.relation?.fields[0] && (other.isUnique || other.isId),
          )) ||
        model.indexes.some(
          (found) =>
            (found.kind === 'unique' || found.kind === 'id') &&
            found.fields.length === field.relation?.fields.length &&
            found.fields.every((name) => field.relation?.fields.includes(name)),
        );
      const oneToOne = back ? !back.list : fkUnique;
      for (const name of field.relation.fields) foreignKeys.add(`${model.name}.${name}`);
      relations.push({
        id: `${model.name}.${field.name}`,
        from: model.name,
        fromField: field.name,
        to: field.baseType,
        toField: back?.name ?? null,
        fields: field.relation.fields,
        references: field.relation.references,
        cardinality: oneToOne ? 'one_to_one' : 'many_to_one',
        optional: field.optional,
        onDelete: field.relation.onDelete,
        name: field.relation.name,
        implied: false,
      });
    }
  }

  // A column named for a model (`userId`, `bookingId`, `parentBookingId`) that no `@relation` writes is shown as an implied relation.
  const declared = relations.length;
  for (const model of models) {
    const held = new Set(model.fields.flatMap((field) => field.relation?.fields ?? []));
    for (const field of model.fields) {
      if (
        field.list ||
        held.has(field.name) ||
        modelNames.has(field.baseType) ||
        !/^[a-z][A-Za-z0-9]*Id$/.test(field.name)
      )
        continue;
      const stem = field.name.slice(0, -2);
      const words = stem.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ');
      // The longest model name the column ends with: `parentBookingId` points at `Booking`, `stripeCustomerId` at nothing.
      let target: string | null = null;
      for (let start = 0; start < words.length && !target; start += 1) {
        const candidate = words
          .slice(start)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join('');
        if (modelNames.has(candidate)) target = candidate;
      }
      if (!target) continue;
      relations.push({
        id: `${model.name}.${field.name}`,
        from: model.name,
        fromField: field.name,
        to: target,
        toField: null,
        fields: [field.name],
        references: ['id'],
        cardinality: field.isUnique ? 'one_to_one' : 'many_to_one',
        optional: field.optional,
        onDelete: null,
        name: null,
        implied: true,
      });
    }
  }

  const finalModels: SchemaModel[] = models.map((model) => ({
    ...model,
    fields: model.fields.map(({ baseType, ...field }) => ({
      ...field,
      kind: modelNames.has(baseType)
        ? 'relation'
        : enumNames.has(baseType)
          ? 'enum'
          : baseType.startsWith('Unsupported')
            ? 'unsupported'
            : 'scalar',
      isForeignKey: foreignKeys.has(`${model.name}.${field.name}`),
    })),
  }));

  const fieldCount = finalModels.reduce((total, model) => total + model.fields.length, 0);
  const documented =
    finalModels.filter((model) => model.doc).length +
    finalModels.reduce((total, model) => total + model.fields.filter((field) => field.doc).length, 0);

  return {
    provider,
    domains,
    models: finalModels,
    enums,
    relations,
    stats: {
      domains: domains.length,
      models: finalModels.length,
      enums: enums.length,
      fields: fieldCount,
      relations: declared,
      impliedRelations: relations.length - declared,
      documentedInFiles: documented,
    },
    warnings,
  };
}
