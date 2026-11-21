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

const REDACTED = (name: string): string => `[secret removed by Hub: ${name}]`;
const KEY_BLOCK =
  /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----|$)/g;

/** The text with anything that looks like a secret replaced. For output Hub records but did not ask for, where refusing would lose the chat. */
export function redactSecrets(text: string): string {
  let clean = text.replace(KEY_BLOCK, REDACTED('private_key'));
  for (const { name, pattern } of SECRET_PATTERNS) {
    clean = clean.replace(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`), REDACTED(name));
  }
  return clean;
}

/** `redactSecrets` over every string in a JSON value, keys included. */
export function redactDeep(value: unknown): unknown {
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [redactSecrets(key), redactDeep(item)]),
    );
  }
  return value;
}

/** How many whitespace-separated words stay back: `token : value` can span three. */
const HELD_WORDS = 3;
const MAX_HELD_CHARS = 8_000;
const BLOCK_START = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY/;
const BLOCK_END = /-----END (?:[A-Z0-9]+ )*PRIVATE KEY/;

export interface StreamRedactor {
  /** Adds text, and answers what is now safe to show. */
  push(text: string): string;
  /** The turn ended: everything left, cleaned. */
  end(): string;
}

/** Where an unfinished private key block starts, if one does. */
function openBlockAt(text: string): number {
  const block = BLOCK_START.exec(text);
  return block && !BLOCK_END.test(text.slice(block.index)) ? block.index : -1;
}

function safeCut(text: string): number {
  let cut = text.length;
  for (let words = 0; words < HELD_WORDS && cut > 0; words += 1) {
    let index = cut - 1;
    while (index >= 0 && /\s/.test(text.charAt(index))) index -= 1;
    while (index >= 0 && !/\s/.test(text.charAt(index))) index -= 1;
    cut = index + 1;
  }
  return Math.max(cut, text.length - MAX_HELD_CHARS);
}

/**
 * Streamed text can split a secret across pieces, so the tail waits until a later piece shows where it ends. A long run with no space is let go at `MAX_HELD_CHARS`, and an open
 * private key block waits for its end and is removed whole.
 */
export function createStreamRedactor(): StreamRedactor {
  let held = '';
  return {
    push(text) {
      const all = held + text;
      const open = openBlockAt(all);
      const clean = redactSecrets(open === -1 ? all : all.slice(0, open));
      const cut = safeCut(clean);
      held = clean.slice(cut) + (open === -1 ? '' : all.slice(open));
      return clean.slice(0, cut);
    },
    end() {
      const rest = redactSecrets(held);
      held = '';
      return rest;
    },
  };
}

/** The name of the first pattern that matches, or null. */
export function findSecret(text: string): string | null {
  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(text)) return name;
  }
  return null;
}
