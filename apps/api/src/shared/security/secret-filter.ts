/**
 * @file Secret filter over any input value (D10).
 * @description Walks every string in a payload. A hit answers 422 with the pattern and the field path,
 * never the value.
 */
import { findSecret } from '@hub/contracts';

import { AppException } from '../errors';

function walk(value: unknown, path: string): { pattern: string; field: string } | null {
  if (typeof value === 'string') {
    const pattern = findSecret(value);
    return pattern === null ? null : { pattern, field: path };
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const hit = walk(item, path === '' ? String(index) : `${path}.${index}`);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      const hit = walk(item, path === '' ? key : `${path}.${key}`);
      if (hit) return hit;
    }
  }
  return null;
}

export function assertNoSecrets(value: unknown): void {
  const hit = walk(value, '');
  if (hit) {
    throw new AppException('hub.security.secret_detected', {
      params: { pattern: hit.pattern, field: hit.field },
      details: hit,
    });
  }
}
