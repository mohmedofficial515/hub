/**
 * @file Builds one stateless `McpServer` per request, bound to who is calling (docs/05 §2.1).
 * @description Every tool passes through the same wrapper: secret filter over the whole input, idempotency for tools
 * that create cards, and errors as `isError` text naming the code from the API catalogue. The idempotency key is the
 * id Claude Code gives a tool use, in `_meta`. JSON-RPC ids restart with each client, so they could wrongly replay
 * another chat's call: with no stable id the call simply runs.
 */
import {
  MCP_PROMPTS,
  MCP_SERVER_INSTRUCTIONS,
  MCP_TOOLS,
  type McpToolEntry,
  type McpToolName,
  type Principal,
} from '@hub/contracts';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { z } from 'zod';

import { IdempotencyService } from '@/modules/cards';
import { normalizeException } from '@/shared/http';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { cardSheet, cardTable, LONG_OUTPUT_LIMIT, OUTPUT_LIMIT, truncate } from './render';
import { McpDeps, ToolContext, type ToolHandler, type ToolHandlers } from './tool-context';
import { cardToolHandlers } from './tools/card.tools';
import { workspaceToolHandlers } from './tools/workspace.tools';

const HANDLERS: ToolHandlers = { ...cardToolHandlers, ...workspaceToolHandlers };

const LONG_OUTPUT: ReadonlySet<McpToolName> = new Set<McpToolName>(['get_card', 'get_plan', 'get_doc']);

const HINTS: Readonly<Record<string, string>> = {
  'hub.cards.not_found': 'Check the key and the project. A deleted card shows in list_deleted.',
  'hub.cards.invalid_transition': 'get_card shows the status and what you may do now.',
  'hub.common.forbidden': 'Your roles in this project do not allow it. get_card lists what you may do.',
  'hub.security.secret_detected': 'Remove the value and describe where it is kept instead.',
  'hub.identity.totp_setup_required': 'The member must enrol two-factor sign-in in the web UI first.',
  'hub.workspaces.not_found': 'list_projects shows your projects.',
  'hub.workspaces.no_project': 'create_project makes one.',
  'hub.workspaces.closed': 'The project is closed. update_project(status="active") reopens it.',
};

/** The arch test reads this, so a row of the tool table cannot lack a handler. */
export const MCP_HANDLER_NAMES = Object.keys(HANDLERS);

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

/** The id Claude Code gives this tool use, when it sends one. */
function toolCallIdOf(meta: Readonly<Record<string, unknown>> | undefined): string | undefined {
  const id = meta?.['claudecode/toolUseId'];
  return typeof id === 'string' && id !== '' ? id : undefined;
}

@Injectable()
export class HubMcpServerFactory {
  private readonly logger = new Logger(HubMcpServerFactory.name);

  constructor(
    private readonly deps: McpDeps,
    private readonly idempotency: IdempotencyService,
    private readonly i18n: I18nService,
  ) {}

  build(principal: Principal, header: string | undefined): McpServer {
    const server = new McpServer(
      { name: 'hub', version: '0.1.0' },
      { instructions: MCP_SERVER_INSTRUCTIONS },
    );
    for (const tool of MCP_TOOLS) this.registerTool(server, tool, principal, header);
    this.registerPrompts(server, principal, header);
    this.registerResources(server, principal, header);
    return server;
  }

  private registerTool(
    server: McpServer,
    tool: McpToolEntry,
    principal: Principal,
    header: string | undefined,
  ): void {
    const inputSchema = tool.input;
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema,
        annotations: {
          readOnlyHint: tool.readOnly === true,
          destructiveHint: tool.destructive === true,
        },
      },
      (input: Record<string, unknown>, extra: { _meta?: Record<string, unknown> }) =>
        this.call(tool, principal, header, input, toolCallIdOf(extra._meta)),
    );
  }

  private async call(
    tool: McpToolEntry,
    principal: Principal,
    header: string | undefined,
    input: Record<string, unknown>,
    toolCallId: string | undefined,
  ): Promise<ToolResult> {
    try {
      assertNoSecrets(input);
      const context = new ToolContext(this.deps, principal, header, input['project'] as string | undefined);
      const handler = HANDLERS[tool.name] as ToolHandler<McpToolName>;
      const work = () => handler(context, input);
      const limit = LONG_OUTPUT.has(tool.name) ? LONG_OUTPUT_LIMIT : OUTPUT_LIMIT;
      if (!tool.createsCards) return this.text(truncate(await work(), limit));
      const { result, replayed } = await this.idempotency.run(
        principal.userId,
        tool.name,
        toolCallId,
        input,
        work,
      );
      return this.text(truncate(replayed ? `(Already done by this same call.)\n${result}` : result, limit));
    } catch (error) {
      return this.failure(error, tool.name);
    }
  }

  private text(text: string): ToolResult {
    return { content: [{ type: 'text', text }] };
  }

  private failure(error: unknown, name: string): ToolResult {
    const normalized = normalizeException(error);
    if (normalized.status >= 500 && normalized.code !== 'hub.common.unavailable') {
      this.logger.error({ err: error, tool: name, code: normalized.code });
    }
    const message = String(this.i18n.t(`errors.${normalized.code}`, { lang: 'en', args: normalized.params }));
    const issues = normalized.details ? `\nDetails: ${JSON.stringify(normalized.details)}` : '';
    const hint = HINTS[normalized.code];
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `ERROR ${normalized.code}: ${message}${issues}${hint ? `\nHint: ${hint}` : ''}`,
        },
      ],
    };
  }

  private registerPrompts(server: McpServer, principal: Principal, header: string | undefined): void {
    for (const prompt of MCP_PROMPTS) {
      const argsSchema = Object.fromEntries(
        Object.entries(prompt.args ?? {}).map(([name, required]) => [
          name,
          required ? z.string() : z.string().optional(),
        ]),
      );
      server.registerPrompt(
        prompt.name,
        { title: prompt.title, description: prompt.description, argsSchema },
        async (args: Record<string, string | undefined>) => {
          const context = new ToolContext(this.deps, principal, header, undefined);
          const [actor, project, displayName] = await Promise.all([
            context.actor(),
            context.project(),
            this.deps.me.get(principal.userId).then((me) => me.displayName),
          ]);
          const text = prompt.render({ displayName, roles: actor.roles, project: project.slug }, args);
          return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] };
        },
      );
    }
  }

  private registerResources(server: McpServer, principal: Principal, header: string | undefined): void {
    const context = () => new ToolContext(this.deps, principal, header, undefined);
    const markdown = (uri: URL, text: string) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text }],
    });

    server.registerResource(
      'decisions-open',
      'hub://decisions/open',
      { title: 'Open decisions', mimeType: 'text/markdown' },
      async (uri) => {
        const page = await this.deps.query.listWithDetail(await context().actor(), 'decision', {
          statuses: ['open'],
          sort: 'due',
          limit: 100,
        });
        return markdown(uri, cardTable('Open decisions, by deadline', page.items));
      },
    );
    server.registerResource(
      'handoffs-pending',
      'hub://handoffs/pending',
      { title: 'Handoffs pending for your roles', mimeType: 'text/markdown' },
      async (uri) => {
        const actor = await context().actor();
        const page = await this.deps.query.listWithDetail(actor, 'handoff', {
          statuses: ['pending'],
          roles: actor.roles,
          sort: 'createdAsc',
          limit: 100,
        });
        return markdown(uri, cardTable('Handoffs pending for your roles', page.items));
      },
    );
    server.registerResource(
      'brief-today',
      'hub://brief/today',
      { title: 'Your brief', mimeType: 'text/markdown' },
      async (uri) => {
        const brief = await this.deps.briefs.today(await context().actor());
        return markdown(uri, [brief.narrative, brief.markdown].filter(Boolean).join('\n\n'));
      },
    );
    server.registerResource(
      'card',
      new ResourceTemplate('hub://card/{key}', { list: undefined }),
      { title: 'A card', mimeType: 'text/markdown' },
      async (uri, variables) => {
        const tool = context();
        const actor = await tool.actor();
        const key = String(variables['key']);
        const [card, comments] = await Promise.all([
          this.deps.query.full(actor, key),
          this.deps.query.comments(actor, key, { limit: 50 }),
        ]);
        return markdown(uri, cardSheet(card, await tool.project(), comments.items));
      },
    );
  }
}
