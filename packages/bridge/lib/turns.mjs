/**
 * @file The extension point for Slice 3: chat turns (docs/16 §7, S1 "Recommended commands" and "Event mapping").
 * @description Each handler receives `(args, context, emit)`. The folder rule has already passed by the time it runs, and `context.claudePath()` gives the newest binary. For a turn, call
 * `emit(kind, data)` once per stream event and return when the turn ends: the frames arrive in order on the API's `BridgeHub.request(..., { onEvent })`, and the return value is the one `result`.
 * Spawn with `system.run`'s rules: no shell, prompt on stdin, and Stop by the interrupt control message, then `taskkill /T /F`, never `child.kill()` alone (S1 Q7).
 * They are refused here on purpose, so that nothing can start a turn before Slice 3 brings the D41 approvals with it.
 */
import { Refusal } from './protocol.mjs';

const notYet = (name) => async () => {
  throw new Refusal('not_implemented', `${name} arrives with the chat panel`);
};

export const turnHandlers = {
  'turn.start': notYet('turn.start'),
  'turn.answer': notYet('turn.answer'),
  'turn.stop': notYet('turn.stop'),
};
