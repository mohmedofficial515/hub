/**
 * @file What changed between two snapshots of a design (docs/17 §3): models, fields and enums added, removed or changed.
 * @description A field changed when its type, attributes or `///` text changed. A model changed when its own attributes or text changed, or any of its fields did. Line numbers do not count, so moving a block is not a change.
 */
import type { SchemaChangeSummary, SchemaDoc, SchemaField, SchemaModel } from '@hub/contracts';

const fieldShape = (field: SchemaField) => JSON.stringify([field.type, field.attributes, field.doc]);
const modelShape = (model: SchemaModel) => JSON.stringify([model.attributes, model.doc, model.domain]);

export function diffSchemas(before: SchemaDoc, after: SchemaDoc): SchemaChangeSummary {
  const summary: SchemaChangeSummary = {
    addedModels: [],
    removedModels: [],
    changedModels: [],
    addedFields: [],
    removedFields: [],
    changedFields: [],
    addedEnums: [],
    removedEnums: [],
    changedEnums: [],
  };
  const old = new Map(before.models.map((model) => [model.name, model]));
  const next = new Map(after.models.map((model) => [model.name, model]));
  for (const [name, model] of next) {
    const was = old.get(name);
    if (!was) {
      summary.addedModels.push(name);
      continue;
    }
    let changed = modelShape(was) !== modelShape(model);
    const oldFields = new Map(was.fields.map((field) => [field.name, field]));
    const newFields = new Map(model.fields.map((field) => [field.name, field]));
    for (const [fieldName, field] of newFields) {
      const previous = oldFields.get(fieldName);
      if (!previous) {
        summary.addedFields.push(`${name}.${fieldName}`);
        changed = true;
      } else if (fieldShape(previous) !== fieldShape(field)) {
        summary.changedFields.push(`${name}.${fieldName}`);
        changed = true;
      }
    }
    for (const fieldName of oldFields.keys()) {
      if (!newFields.has(fieldName)) {
        summary.removedFields.push(`${name}.${fieldName}`);
        changed = true;
      }
    }
    if (changed) summary.changedModels.push(name);
  }
  for (const name of old.keys()) if (!next.has(name)) summary.removedModels.push(name);

  const oldEnums = new Map(before.enums.map((value) => [value.name, value]));
  const newEnums = new Map(after.enums.map((value) => [value.name, value]));
  for (const [name, value] of newEnums) {
    const was = oldEnums.get(name);
    if (!was) summary.addedEnums.push(name);
    else if (
      JSON.stringify([was.values, was.dbName, was.doc]) !==
      JSON.stringify([value.values, value.dbName, value.doc])
    ) {
      summary.changedEnums.push(name);
    }
  }
  for (const name of oldEnums.keys()) if (!newEnums.has(name)) summary.removedEnums.push(name);
  return summary;
}
