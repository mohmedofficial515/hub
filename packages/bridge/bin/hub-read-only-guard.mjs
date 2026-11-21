#!/usr/bin/env node
/**
 * @file A `PreToolUse` hook for Ask and Plan: an MCP tool outside Hub's read list does not run, even if the owner's own rules allow it (tested: such a tool ran in Ask without this).
 * @description Rules can deny a named tool, and no rule can say "every other server's tools", and nothing tells a read from a write on another server. So in a read-only mode they are refused here. Anything unreadable refuses too: exit 2 blocks the call.
 */
import { isReadOnlyMcpTool } from '../lib/permissions.mjs';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let tool;
  try {
    tool = JSON.parse(raw).tool_name;
  } catch {
    process.stderr.write('Hub could not read this tool call, so it is refused in a read-only mode.\n');
    process.exit(2);
  }
  if (typeof tool !== 'string' || !tool.startsWith('mcp__') || isReadOnlyMcpTool(tool)) process.exit(0);
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'This chat is read only, so tools of other servers do not run here.',
      },
    }),
  );
});
