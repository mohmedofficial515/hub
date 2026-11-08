/**
 * @file Devices (docs/16 §4, §5): pairing, the bridge channel, the health panel and the Link button.
 */
import { Module } from '@nestjs/common';

import { AuditModule } from '@/modules/audit';
import { IdentityModule } from '@/modules/identity';
import { WorkspacesModule } from '@/modules/workspaces';

import { BridgeHub } from './application/bridge-hub';
import { ConnectBundleService } from './application/connect-bundle.service';
import { DevicesService } from './application/devices.service';
import { PairingService } from './application/pairing.service';
import { PublishingService } from './application/publishing.service';
import { BridgeGateway } from './presentation/bridge.gateway';
import { BridgeSelfController } from './presentation/http/bridge-self.controller';
import { ConnectController } from './presentation/http/connect.controller';
import { DevicesController, WorkspaceDevicesController } from './presentation/http/devices.controller';
import { PairingController } from './presentation/http/pairing.controller';

@Module({
  imports: [AuditModule, IdentityModule, WorkspacesModule],
  controllers: [
    BridgeSelfController,
    ConnectController,
    DevicesController,
    PairingController,
    WorkspaceDevicesController,
  ],
  providers: [
    BridgeGateway,
    BridgeHub,
    ConnectBundleService,
    DevicesService,
    PairingService,
    PublishingService,
  ],
  exports: [BridgeHub, DevicesService, PairingService, PublishingService],
})
export class DevicesModule {}
