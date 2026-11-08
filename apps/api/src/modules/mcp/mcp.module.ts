/**
 * @file MCP (H1-01, H1-03, H1-04, docs/15 §6): Claude Code's full control of Hub, through the same services as the web.
 */
import { Module } from '@nestjs/common';

import { AgentQueueModule } from '@/modules/agent-queue';
import { AuditModule } from '@/modules/audit';
import { CaptureModule } from '@/modules/capture';
import { CardsModule } from '@/modules/cards';
import { ChatsModule } from '@/modules/chats';
import { DevicesModule } from '@/modules/devices';
import { DigestsModule } from '@/modules/digests';
import { DocsModule } from '@/modules/docs';
import { IdentityModule } from '@/modules/identity';
import { NotificationsModule } from '@/modules/notifications';
import { PlansModule } from '@/modules/plans';
import { ReleasesModule } from '@/modules/releases';
import { SearchModule } from '@/modules/search';
import { SystemModule } from '@/modules/system';
import { TasksModule } from '@/modules/tasks';
import { WorkspacesModule } from '@/modules/workspaces';

import { HubMcpServerFactory } from './presentation/mcp/hub-mcp-server.factory';
import { McpAuthFilter, McpController } from './presentation/mcp/mcp.controller';
import { McpDeps } from './presentation/mcp/tool-context';

@Module({
  imports: [
    AgentQueueModule,
    AuditModule,
    CaptureModule,
    CardsModule,
    ChatsModule,
    DevicesModule,
    DigestsModule,
    DocsModule,
    IdentityModule,
    NotificationsModule,
    PlansModule,
    ReleasesModule,
    SearchModule,
    SystemModule,
    TasksModule,
    WorkspacesModule,
  ],
  controllers: [McpController],
  providers: [HubMcpServerFactory, McpAuthFilter, McpDeps],
})
export class McpModule {}
