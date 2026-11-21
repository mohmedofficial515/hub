/**
 * @file `/mcp`: stateless Streamable HTTP (docs/05 §2.1). A new server and transport per request, answers as plain
 * JSON, so restarting the API drops nothing. GET and DELETE answer 405, since there is no session and no stream.
 * @description Only an API token reaches it: a session cookie or a hook token is refused. `ActorGuard` authenticates and
 * `RateLimitGuard` applies the agent limit. There is no DNS rebinding risk to guard, as a browser page has no token and
 * cookies are refused here. A 401 says `WWW-Authenticate`, so Claude Code reports a clear auth error.
 */
import { type Principal, PROJECT_HEADER } from '@hub/contracts';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { ArgumentsHost } from '@nestjs/common';
import {
  All,
  Catch,
  Controller,
  Headers,
  HttpStatus,
  Injectable,
  Req,
  Res,
  UseFilters,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AppException } from '@/shared/errors';
import {
  AllExceptionsFilter,
  CurrentPrincipal,
  normalizeException,
  Permissions,
  RawResponse,
} from '@/shared/http';

import { HubMcpServerFactory } from './hub-mcp-server.factory';

@Injectable()
@Catch()
export class McpAuthFilter extends AllExceptionsFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    if (normalizeException(exception).status === Number(HttpStatus.UNAUTHORIZED)) {
      host
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
    }
    super.catch(exception, host);
  }
}

@ApiExcludeController()
@UseFilters(McpAuthFilter)
@Controller('mcp')
export class McpController {
  constructor(private readonly factory: HubMcpServerFactory) {}

  @All()
  @RawResponse()
  @Permissions('project.read')
  async handle(
    @CurrentPrincipal() principal: Principal,
    @Headers(PROJECT_HEADER) header: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (principal.kind !== 'agent') throw new AppException('hub.identity.token_scope');
    if (request.method !== 'POST') {
      response.status(HttpStatus.METHOD_NOT_ALLOWED).setHeader('Allow', 'POST').end();
      return;
    }
    const server = this.factory.build(principal, header);
    const transport = new StreamableHTTPServerTransport({
      // No `sessionIdGenerator`: stateless.
      enableJsonResponse: true,
    });
    response.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  }
}
