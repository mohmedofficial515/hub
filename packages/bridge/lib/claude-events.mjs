/**
 * @file The one place that knows Claude Code's stream (docs/16 S1 "Event mapping"). Raw events go in, `TurnEvent`s from `@hub/contracts` (`chat.ts`) come out, so a Claude Code update changes this file only.
 * @description Pure, so each shape has a test built from the spike's real logs. Things the panel must not misread: one `assistant` event arrives per content block, so it is never appended to the deltas; `subtype` says nothing
 * about success (signed out is `success` with `is_error: true`); `init` cannot show sign-in; `num_turns` and `total_cost_usd` are not per-turn facts, so they are left out. What the engine does not report stays absent.
 */

const OUTPUT_LIMIT_FOR_TEXT = 500;

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

export function createEventMapper() {
  const state = {
    failure: null,
    failureMessage: null,
    resetsAt: undefined,
    /** Message ids whose text already arrived as deltas. */
    streamed: new Set(),
    currentMessage: null,
    /** Every tool use seen in the stream, for the approval shim to match against. */
    tools: new Map(),
    toolPaths: new Set(),
    sessionId: null,
    model: undefined,
    claudeVersion: undefined,
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
        out.push({
          kind: 'tool.input',
          toolUseId: part.id,
          name: part.name,
          input: part.input ?? {},
          ...(parent ? { parentToolUseId: parent } : {}),
        });
        const path = part.input?.file_path ?? part.input?.notebook_path;
        if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(part.name) && typeof path === 'string') {
          state.toolPaths.add(path);
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
    }
    return out;
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
    /** Answers `{ events, result }`: the stable events for this raw one, and the turn's facts when it was the turn's `result`. */
    map(raw) {
      if (!raw || typeof raw !== 'object') return { events: [], result: null };
      switch (raw.type) {
        case 'system': {
          if (raw.subtype === 'init') {
            state.sessionId = raw.session_id ?? state.sessionId;
            state.model = raw.model ?? state.model;
            state.claudeVersion = raw.claude_code_version ?? state.claudeVersion;
            return {
              events: raw.session_id
                ? [
                    {
                      kind: 'turn.session',
                      sessionId: raw.session_id,
                      ...(raw.model ? { model: raw.model } : {}),
                      ...(raw.claude_code_version ? { claudeVersion: raw.claude_code_version } : {}),
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
      state.streamed = new Set();
    },
  };
}
