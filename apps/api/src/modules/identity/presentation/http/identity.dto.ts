/**
 * @file HTTP shapes of the identity routes, over the schemas in `@hub/contracts`.
 */
import {
  acceptInviteSchema,
  apiTokenCreatedSchema,
  apiTokenRowSchema,
  createApiTokenSchema,
  createInviteSchema,
  inviteAcceptedSchema,
  inviteCreatedSchema,
  inviteLinkSchema,
  invitePreviewSchema,
  inviteRowSchema,
  meSchema,
  oneTimeUrlSchema,
  passwordChangeSchema,
  passwordForgotSchema,
  passwordResetSchema,
  refreshResultSchema,
  sessionRowSchema,
  setDefaultProjectSchema,
  signInResultSchema,
  signInSchema,
  totpCodeSchema,
  totpConfirmResultSchema,
  totpRecoverSchema,
  totpSetupResultSchema,
  totpVerifySchema,
  updateProfileSchema,
} from '@hub/contracts';
import { createZodDto } from 'nestjs-zod';

export class SignInDto extends createZodDto(signInSchema) {}
export class TotpVerifyDto extends createZodDto(totpVerifySchema) {}
export class TotpRecoverDto extends createZodDto(totpRecoverSchema) {}
export class TotpCodeDto extends createZodDto(totpCodeSchema) {}
export class PasswordForgotDto extends createZodDto(passwordForgotSchema) {}
export class PasswordResetDto extends createZodDto(passwordResetSchema) {}
export class PasswordChangeDto extends createZodDto(passwordChangeSchema) {}
export class AcceptInviteDto extends createZodDto(acceptInviteSchema) {}
export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
export class CreateApiTokenDto extends createZodDto(createApiTokenSchema) {}
export class SetDefaultProjectDto extends createZodDto(setDefaultProjectSchema) {}
export class CreateInviteDto extends createZodDto(createInviteSchema) {}

export class MeDto extends createZodDto(meSchema) {}
export class SignInResultDto extends createZodDto(signInResultSchema) {}
export class RefreshResultDto extends createZodDto(refreshResultSchema) {}
export class TotpSetupResultDto extends createZodDto(totpSetupResultSchema) {}
export class TotpConfirmResultDto extends createZodDto(totpConfirmResultSchema) {}
export class SessionRowDto extends createZodDto(sessionRowSchema) {}
export class ApiTokenRowDto extends createZodDto(apiTokenRowSchema) {}
export class ApiTokenCreatedDto extends createZodDto(apiTokenCreatedSchema) {}
export class InvitePreviewDto extends createZodDto(invitePreviewSchema) {}
export class InviteAcceptedDto extends createZodDto(inviteAcceptedSchema) {}
export class InviteRowDto extends createZodDto(inviteRowSchema) {}
export class InviteCreatedDto extends createZodDto(inviteCreatedSchema) {}
export class InviteLinkDto extends createZodDto(inviteLinkSchema) {}
export class OneTimeUrlDto extends createZodDto(oneTimeUrlSchema) {}
