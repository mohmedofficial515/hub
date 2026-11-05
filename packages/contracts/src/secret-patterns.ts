/**
 * @file Inbound secret filter patterns (D10, docs/12 H0-01).
 * @description Applied to every free-text input. A match names the pattern, never the value. A bare
 * 40-character hex string is a commit sha and passes; the same string after `token=` does not.
 */
export interface SecretPattern {
  readonly name: string;
  readonly pattern: RegExp;
}

export const SECRET_PATTERNS: readonly SecretPattern[] = [
  { name: 'aws_access_key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'github_token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'github_pat', pattern: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { name: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { name: 'private_key', pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/ },
  { name: 'stripe_live_key', pattern: /\b[sr]k_live_[A-Za-z0-9]{16,}\b/ },
  { name: 'slack_token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'anthropic_key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'hub_token', pattern: /\bhub_[A-Za-z0-9]{8}_?[A-Za-z0-9]{24,}\b/ },
  {
    name: 'generic_token_32+',
    pattern:
      /(?:\b|_)(?:token|secret|password|passwd|pwd|api[_-]?key|access[_-]?key|private[_-]?key|key)["']?\s*[:=]\s*["']?[A-Za-z0-9+/_=-]{32,}/i,
  },
];

/** The name of the first pattern that matches, or null. */
export function findSecret(text: string): string | null {
  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(text)) return name;
  }
  return null;
}
