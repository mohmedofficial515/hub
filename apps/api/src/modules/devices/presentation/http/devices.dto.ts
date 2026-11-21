/**
 * @file REST shapes of the devices module, over the schemas in `@hub/contracts`.
 */
import {
  deviceSchema,
  fixDeviceSchema,
  linkFolderSchema,
  linkResultSchema,
  PAIRING_STATUSES,
  pairingPollSchema,
  pairingStartSchema,
} from '@hub/contracts';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class PairingStartDto extends createZodDto(pairingStartSchema) {}
export class PairingPollDto extends createZodDto(pairingPollSchema) {}
export class FixDeviceDto extends createZodDto(fixDeviceSchema) {}
export class LinkFolderDto extends createZodDto(linkFolderSchema) {}
export class DeviceRowDto extends createZodDto(deviceSchema) {}
export class LinkResultDto extends createZodDto(linkResultSchema) {}
/** What a device's own credential may learn about itself: only whether Hub holds its bridge's socket. */
export class BridgeSelfDto extends createZodDto(z.object({ online: z.boolean() })) {}

export class PairingStartedDto extends createZodDto(
  z.object({
    deviceCode: z.string(),
    userCode: z.string(),
    approveUrl: z.string(),
    expiresInSeconds: z.number().int(),
    pollSeconds: z.number().int(),
  }),
) {}

/** The credentials appear once, in the one answer that claims them. */
export class PairingPollAnswerDto extends createZodDto(
  z.object({
    status: z.enum(PAIRING_STATUSES),
    deviceId: z.string().optional(),
    credential: z.string().optional(),
    hookToken: z.string().optional(),
  }),
) {}

export class PairingViewDto extends createZodDto(
  z.object({
    userCode: z.string(),
    name: z.string(),
    platform: z.string(),
    status: z.enum(PAIRING_STATUSES),
    expiresAt: z.string(),
  }),
) {}

export class ConnectCommandDto extends createZodDto(
  z.object({ apiUrl: z.string(), connect: z.string(), uninstall: z.string() }),
) {}
