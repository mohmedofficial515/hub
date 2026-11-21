/**
 * @file The one place that knows Claude Code's stream (docs/16 S1 "Event mapping"). Raw events go in, `TurnEvent`s from `@hub/contracts` (`chat.ts`) come out, so a Claude Code update changes this file only.
 * @description Pure, so each shape has a test built from the spike's real logs. Things the panel must not misread: one `assistant` event arrives per content block, so it is never appended to the deltas; `subtype` says nothing
 * about success (signed out is `success` with `is_error: true`); `init` cannot show sign-in; `num_turns` and `total_cost_usd` are not per-turn facts, so they are left out. What the engine does not report stays absent.
 */

import { describeCall, isReadOnlyMcpTool } from './permissions.mjs';

const OUTPUT_LIMIT_FOR_TEXT = 500;
const QUESTION_TOOL = 'AskUserQuestion';
/** The tools that carry a shell command. `tool.input` gives their `command`, so nothing past here needs their names. */
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
/** Refused by rule in Ask and Plan, by name, so a failure of a read is never mistaken for a refusal. */
const WRITING_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'PowerShell']);
const PLAN_FILE = /[\\/]\.claude[\\/]plans[\\/]/;
const READ_ONLY_MODES = new Set(['ask', 'plan']);
/** `ENGINE_FACT_LIMITS` in `@hub/contracts`, and a test holds them together. */
export const ENGINE_FACT_LIMITS = { skills: 500, mcpServers: 100, nameChars: 200 };

/** Names only: a server's status is a moment's fact, and `init` reads `pending` for one that connects later (S1 Q6). */
function namesOf(list, limit, nameOf) {
  if (!Array.isArray(list)) return undefined;
  return list
    .map(nameOf)
    .filter((name) => typeof name === 'string' && name !== '')
    .slice(0, limit)
    .map((name) => name.slice(0, ENGINE_FACT_LIMITS.nameChars));
}

function textOfResult(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => (part?.type === 'text' ? (part.text ?? '') : `[${part?.type ?? 'part'}]`))
    .join('\n');
}

function usageOf(usage) {
  if (!usage || typeof usage !== 'object') return undefined;
  const out = {};
  if (typeof usage.input_tokens === 'number') out.inputTokens = usage.input_tokens;
  if (typeof usage.output_tokens === 'number') out.outputTokens = usage.output_tokens;
  if (typeof usage.cache_read_input_tokens === 'number') out.cacheReadTokens = usage.cache_read_input_tokens;
  if (typeof usage.cache_creation_input_tokens === 'number') {
    out.cacheWriteTokens = usage.cache_creation_input_tokens;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function limitOf(info) {
  if (!info || typeof info !== 'object' || typeof info.status !== 'string') return null;
  const limit = { status: info.status.slice(0, 40) };
  if (typeof info.rateLimitType === 'string') limit.limitType = info.rateLimitType.slice(0, 40);
  if (typeof info.resetsAt === 'number') limit.resetsAt = info.resetsAt;
  const windows = info.unifiedWindows;
  const window = windows && info.rateLimitType ? windows[info.rateLimitType] : null;
  if (typeof window?.utilization === 'number') limit.utilization = window.utilization;
  return limit;
}

const ASSISTANT_ERRORS = {
  authentication_failed: 'signed_out',
  rate_limit: 'rate_limited',
  billing_error: 'billing',
  overloaded: 'overloaded',
};

/** A stage reported through Hub's `report_stage` tool, whichever name the server has here. */
export function isStageTool(name) {
  return /^mcp__.*hub.*__report_stage$/.test(name ?? '');
}

export function stageFromInput(input) {
  const { protocol, stage, state, note } = input ?? {};
  if (!['work', 'doc'].includes(protocol) || typeof stage !== 'string') return null;
  if (!['started', 'done', 'failed'].includes(state)) return null;
  return {
    kind: 'stage',
    protocol,
    stage: stage.slice(0, 40),
    state,
    ...(typeof note === 'string' ? { note: note.slice(0, 500) } : {}),
  };
}

/** `AskUserQuestion`'s input in Hub's own shape, or null when it does not have the shape this mapper knows. */
export function questionsFromInput(input) {
  if (!Array.isArray(input?.questions) || input.questions.length === 0) return null;
  const questions = [];
  for (const raw of input.questions.slice(0, 8)) {
    if (typeof raw?.question !== 'string') return null;
    questions.push({
      text: raw.question.slice(0, 2_000),
      ...(typeof raw.header === 'string' ? { header: raw.header.slice(0, 100) } : {}),
      multiSelect: raw.multiSelect === true,
      options: (Array.isArray(raw.options) ? raw.options : []).slice(0, 20).flatMap((option) =>
        typeof option?.label === 'string'
          ? [
              {
                label: option.label.slice(0, 200),
                ...(typeof option.description === 'string'
                  ? { description: option.description.slice(0, 1_000) }
                  : {}),
              },
            ]
          : [],
      ),
    });
  }
  return questions;
}

export const isQuestionTool = (name) => name === QUESTION_TOOL;

/** What the engine takes as the answer: its own input, with the answers by question text. */
export function questionAnswerInput(input, answers) {
  return { ...input, answers };
}

function commandOf(name, input) {
  return SHELL_TOOLS.has(name) && typeof input?.command === 'string' ? input.command : undefined;
}

/** A known event that lacks what it must hold (D53). An event type this mapper does not know is left alone: new ones appear with no harm, and only these can lose work silently. */
function unreadableReason(raw) {
  if (raw.type === 'assistant' && !Array.isArray(raw.message?.content))
    return 'an assistant message with no content';
  if (raw.type === 'user' && typeof raw.message !== 'object') return 'a user message with no body';
  if (raw.type === 'stream_event' && typeof raw.event !== 'object') return 'a stream event with no body';
  if (raw.type === 'result' && typeof raw.is_error !== 'boolean') return 'a result with no outcome';
  return null;
}

export function createEventMapper(options = {}) {
  const readOnly = READ_ONLY_MODES.has(options.mode);
  const state = {
    failure: null,
    failureMessage: null,
    resetsAt: undefined,
    /** Message ids whose text already arrived as deltas. */
    streamed: new Set(),
    currentMessage: null,
    /** Every tool use seen in the stream, for the approval shim to match against. */
    tools: new Map(),
    toolInputs: new Map(),
    toolPaths: new Set(),
    sessionId: null,
    model: undefined,
    claudeVersion: undefined,
    planSent: false,
  };

  function onStream(raw) {
    const event = raw.event ?? {};
    const parent = raw.parent_tool_use_id ?? undefined;
    if (event.type === 'message_start') {
      state.currentMessage = event.message?.id ?? null;
      return [];
    }
    if (event.type === 'content_block_start') {
      const block = event.content_block ?? {};
      if (block.type === 'tool_use' && block.id) {
        state.tools.set(block.id, block.name);
        return [
          {
            kind: 'tool.started',
            toolUseId: block.id,
            name: block.name,
            ...(parent ? { parentToolUseId: parent } : {}),
          },
        ];
      }
      if (block.type === 'thinking') return [{ kind: 'turn.status', state: 'thinking' }];
      return [];
    }
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      if (parent) return [];
      if (state.currentMessage) state.streamed.add(state.currentMessage);
      return [{ kind: 'text.delta', text: event.delta.text ?? '' }];
    }
    return [];
  }

  function onAssistant(raw) {
    const out = [];
    const message = raw.message ?? {};
    const parent = raw.parent_tool_use_id ?? undefined;
    if (typeof raw.error === 'string') {
      state.failure = ASSISTANT_ERRORS[raw.error] ?? 'unknown';
      const said = (message.content ?? []).find((part) => part?.type === 'text')?.text;
      if (said) state.failureMessage = String(said).slice(0, OUTPUT_LIMIT_FOR_TEXT);
    }
    for (const part of message.content ?? []) {
      if (part?.type === 'text' && !parent && !state.streamed.has(message.id) && part.text) {
        out.push({ kind: 'text.delta', text: part.text });
      }
      if (part?.type === 'tool_use' && part.id) {
        if (!state.tools.has(part.id)) {
          state.tools.set(part.id, part.name);
          out.push({
            kind: 'tool.started',
            toolUseId: part.id,
            name: part.name,
            ...(parent ? { parentToolUseId: parent } : {}),
          });
        }
        state.toolInputs.set(part.id, part.input ?? {});
        const command = commandOf(part.name, part.input);
        out.push({
          kind: 'tool.input',
          toolUseId: part.id,
          name: part.name,
          input: part.input ?? {},
          ...(command === undefined ? {} : { command }),
          ...(parent ? { parentToolUseId: parent } : {}),
        });
        const path = part.input?.file_path ?? part.input?.notebook_path;
        if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(part.name) && typeof path === 'string') {
          state.toolPaths.add(path);
        }
        if (part.name === 'ExitPlanMode' && typeof part.input?.plan === 'string' && !state.planSent) {
          state.planSent = true;
          out.push({ kind: 'plan.proposed', plan: part.input.plan });
        }
        // Seen with the real model in Plan mode: it writes the plan to a plan file, which this mode refuses, so this is where the plan is.
        if (
          part.name === 'Write' &&
          PLAN_FILE.test(part.input?.file_path ?? '') &&
          typeof part.input?.content === 'string' &&
          !state.planSent
        ) {
          state.planSent = true;
          out.push({ kind: 'plan.proposed', plan: part.input.content });
        }
        if (isStageTool(part.name)) {
          const stage = stageFromInput(part.input);
          if (stage) out.push(stage);
        }
      }
    }
    return out;
  }

  function onUser(raw) {
    const out = [];
    const decisions = new Map(
      (Array.isArray(raw.tool_result_meta) ? raw.tool_result_meta : []).map((meta) => [
        meta?.tool_use_id,
        meta?.permission_decision,
      ]),
    );
    for (const part of raw.message?.content ?? []) {
      if (part?.type !== 'tool_result' || !part.tool_use_id) continue;
      const decision = decisions.get(part.tool_use_id);
      out.push({
        kind: 'tool.result',
        toolUseId: part.tool_use_id,
        isError: part.is_error === true,
        output: textOfResult(part.content),
        ...(typeof decision === 'string' ? { decision: decision.slice(0, 40) } : {}),
      });
      const blocked = part.is_error === true ? blockedBy(part.tool_use_id) : null;
      if (blocked) out.push(blocked);
    }
    return out;
  }

  /** Ask or Plan refused this tool, in any of the three ways that happen: `deny` rule, read-only guard, or the permission tool. */
  function blockedBy(toolUseId) {
    if (!readOnly) return null;
    const name = state.tools.get(toolUseId);
    if (typeof name !== 'string') return null;
    const refusable = WRITING_TOOLS.has(name) || (name.startsWith('mcp__') && !isReadOnlyMcpTool(name));
    if (!refusable) return null;
    const input = state.toolInputs.get(toolUseId) ?? {};
    // Plan mode's own plan file is refused on purpose, and the plan reaches the owner another way.
    if (PLAN_FILE.test(input.file_path ?? '')) return null;
    return {
      kind: 'tool.blocked',
      toolUseId,
      name,
      command: describeCall(name, input).slice(0, 4_000),
      mode: options.mode,
    };
  }

  function onResult(raw) {
    const facts = {
      durationMs: typeof raw.duration_ms === 'number' ? raw.duration_ms : undefined,
      apiDurationMs: typeof raw.duration_api_ms === 'number' ? raw.duration_api_ms : undefined,
      usage: usageOf(raw.usage),
    };
    if (raw.session_id) state.sessionId = raw.session_id;
    const models = raw.modelUsage && typeof raw.modelUsage === 'object' ? Object.keys(raw.modelUsage) : [];
    const model = models[0] ?? state.model;
    if (model) facts.model = model;
    if (raw.is_error !== true) return { ...facts, ok: true };
    const errors = Array.isArray(raw.errors) ? raw.errors.join(' ') : '';
    const text = `${errors} ${typeof raw.result === 'string' ? raw.result : ''}`.trim();
    let failure = state.failure;
    if (!failure && /No conversation found/i.test(text)) failure = 'session_missing';
    if (!failure && /not logged in|login expired/i.test(text)) failure = 'signed_out';
    if (!failure && /hit your .*limit/i.test(text)) failure = 'rate_limited';
    return {
      ...facts,
      ok: false,
      failure: failure ?? 'unknown',
      message: (state.failureMessage ?? text).slice(0, OUTPUT_LIMIT_FOR_TEXT),
      ...(state.resetsAt ? { resetsAt: state.resetsAt } : {}),
    };
  }

  return {
    state,
    /** One line of stdout. `{ unreadable }` says the turn must stop (D53). */
    mapLine(line) {
      let raw;
      try {
        raw = JSON.parse(line);
      } catch {
        return { events: [], result: null, unreadable: 'a line that is not JSON' };
      }
      if (!raw || typeof raw !== 'object') {
        return { events: [], result: null, unreadable: 'a line that is not an event' };
      }
      const reason = unreadableReason(raw);
      if (reason) return { events: [], result: null, unreadable: reason };
      return this.map(raw);
    },
    /** Answers `{ events, result }`: the stable events for this raw one, and the turn's facts when it was the turn's `result`. */
    map(raw) {
      if (!raw || typeof raw !== 'object') return { events: [], result: null };
      switch (raw.type) {
        case 'system': {
          if (raw.subtype === 'init') {
            state.sessionId = raw.session_id ?? state.sessionId;
            state.model = raw.model ?? state.model;
            state.claudeVersion = raw.claude_code_version ?? state.claudeVersion;
            const skills = namesOf(raw.skills, ENGINE_FACT_LIMITS.skills, (skill) => skill);
            const mcpServers = namesOf(
              raw.mcp_servers,
              ENGINE_FACT_LIMITS.mcpServers,
              (server) => server?.name,
            );
            return {
              events: raw.session_id
                ? [
                    {
                      kind: 'turn.session',
                      sessionId: raw.session_id,
                      ...(raw.model ? { model: raw.model } : {}),
                      ...(raw.claude_code_version ? { claudeVersion: raw.claude_code_version } : {}),
                      ...(skills ? { skills } : {}),
                      ...(mcpServers ? { mcpServers } : {}),
                    },
                  ]
                : [],
              result: null,
            };
          }
          if (raw.subtype === 'status' && raw.status === 'requesting') {
            return { events: [{ kind: 'turn.status', state: 'requesting' }], result: null };
          }
          if (raw.subtype === 'api_retry') {
            return {
              events: [
                {
                  kind: 'turn.status',
                  state: 'retrying',
                  ...(typeof raw.attempt === 'number' ? { attempt: raw.attempt } : {}),
                  ...(typeof raw.retry_delay_ms === 'number' ? { retryInMs: raw.retry_delay_ms } : {}),
                },
              ],
              result: null,
            };
          }
          return { events: [], result: null };
        }
        case 'stream_event':
          return { events: onStream(raw), result: null };
        case 'assistant':
          return { events: onAssistant(raw), result: null };
        case 'user':
          return { events: onUser(raw), result: null };
        case 'rate_limit_event': {
          const limit = limitOf(raw.rate_limit_info);
          if (!limit) return { events: [], result: null };
          if (limit.status === 'rejected') {
            state.failure = 'rate_limited';
            if (limit.resetsAt) state.resetsAt = limit.resetsAt;
          }
          return { events: [{ kind: 'limit', limit }], result: null };
        }
        case 'result':
          return { events: [], result: onResult(raw) };
        default:
          return { events: [], result: null };
      }
    },
    /** A new turn in a live process keeps the session and forgets the last turn's failure and files. */
    nextTurn() {
      state.failure = null;
      state.failureMessage = null;
      state.resetsAt = undefined;
      state.toolPaths = new Set();
      state.planSent = false;
      state.streamed = new Set();
    },
  };
}
