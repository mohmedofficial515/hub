/**
 * @file Auth routes (docs/04 §3.2). Cookies are set here; everything else is in the services.
 */
import type { Principal } from '@hub/contracts';
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req, Res } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { RateLimit } from '@/infra/throttler/rate-limit.guard';
import { AppException } from '@/shared/errors';
import { CurrentPrincipal, Permissions, Public } from '@/shared/http';

import type { Authenticated, SignInOutcome } from '../../application/auth.service';
import { AuthService } from '../../application/auth.service';
import { MeService } from '../../application/me.service';
import { SessionService } from '../../application/session.service';
import { TotpService } from '../../application/totp.service';
import {
  assertCsrfHeader,
  clearSessionCookies,
  cookieOf,
  REFRESH_COOKIE,
  setSessionCookies,
} from '../cookies';
import { sessionFamilyOf } from '../credentials.resolver';
import { SessionOnly } from '../session-only.decorator';
import {
  MeDto,
  PasswordChangeDto,
  PasswordForgotDto,
  PasswordResetDto,
  RefreshResultDto,
  SessionRowDto,
  SignInDto,
  SignInResultDto,
  TotpCodeDto,
  TotpConfirmResultDto,
  TotpRecoverDto,
  TotpSetupResultDto,
  TotpVerifyDto,
} from './identity.dto';

function ipOf(request: Request): string {
  return request.ip ?? 'unknown';
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly totp: TotpService,
    private readonly me: MeService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Post('sign-in')
  @HttpCode(200)
  @Public()
  @RateLimit('auth')
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ type: SignInResultDto })
  async signIn(
    @Body() body: SignInDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignInResultDto> {
    return this.finish(await this.auth.signIn(body.email, body.password, ipOf(request)), response);
  }

  @Post('totp/verify')
  @HttpCode(200)
  @Public()
  @RateLimit('auth')
  @ApiOperation({ summary: 'Finish a sign-in with a TOTP code' })
  @ApiOkResponse({ type: SignInResultDto })
  async verifyTotp(
    @Body() body: TotpVerifyDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignInResultDto> {
    return this.finish(await this.auth.verifyTotp(body.challenge, body.code, ipOf(request)), response);
  }

  @Post('totp/recover')
  @HttpCode(200)
  @Public()
  @RateLimit('auth')
  @ApiOperation({ summary: 'Finish a sign-in with a recovery code' })
  @ApiOkResponse({ type: SignInResultDto })
  async recover(
    @Body() body: TotpRecoverDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignInResultDto> {
    return this.finish(await this.auth.recover(body.challenge, body.recoveryCode, ipOf(request)), response);
  }

  @Post('refresh')
  @HttpCode(200)
  @Public()
  @ApiOperation({ summary: 'Rotate the session cookies' })
  @ApiOkResponse({ type: RefreshResultDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResultDto> {
    assertCsrfHeader(request);
    const token = cookieOf(request, REFRESH_COOKIE);
    if (!token) throw new AppException('hub.identity.refresh_invalid');
    try {
      const session = await this.sessions.rotate(token);
      setSessionCookies(response, session, this.config, this.clock.now());
      return { expiresAt: session.accessExpiresAt.toISOString() };
    } catch (error) {
      clearSessionCookies(response, this.config);
      throw error;
    }
  }

  @Post('sign-out')
  @HttpCode(204)
  @Permissions('profile.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Sign out and revoke this session' })
  @ApiNoContentResponse()
  async signOut(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const family = sessionFamilyOf(request);
    if (family) await this.sessions.revokeFamily(family);
    clearSessionCookies(response, this.config);
  }

  @Get('me')
  @Permissions('project.read')
  @ApiOperation({ summary: 'The signed-in member and their projects' })
  @ApiOkResponse({ type: MeDto })
  getMe(@CurrentPrincipal() principal: Principal): Promise<MeDto> {
    return this.me.get(principal.userId);
  }

  @Post('password/forgot')
  @HttpCode(202)
  @Public()
  @RateLimit('auth')
  @ApiOperation({ summary: 'Mail a reset link. Answers 202 whether or not the account exists' })
  @ApiAcceptedResponse()
  async forgot(@Body() body: PasswordForgotDto): Promise<void> {
    await this.auth.forgotPassword(body.email);
  }

  @Post('password/reset')
  @HttpCode(204)
  @Public()
  @RateLimit('auth')
  @ApiOperation({ summary: 'Set a new password with a reset token' })
  @ApiNoContentResponse()
  async reset(@Body() body: PasswordResetDto): Promise<void> {
    await this.auth.resetPassword(body.token, body.password);
  }

  @Post('password/change')
  @HttpCode(204)
  @Permissions('profile.manage')
  @SessionOnly()
  @RateLimit('auth')
  @ApiOperation({ summary: 'Change the password; other sessions end' })
  @ApiNoContentResponse()
  async change(
    @CurrentPrincipal() principal: Principal,
    @Body() body: PasswordChangeDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.changePassword(principal.userId, sessionFamilyOf(request), body.current, body.next);
  }

  @Post('totp/setup')
  @HttpCode(201)
  @Permissions('profile.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Start TOTP enrolment. The secret is shown this one time' })
  @ApiCreatedResponse({ type: TotpSetupResultDto })
  setupTotp(@CurrentPrincipal() principal: Principal): Promise<TotpSetupResultDto> {
    return this.totp.setup(principal.userId);
  }

  @Post('totp/confirm')
  @HttpCode(200)
  @Permissions('profile.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Finish TOTP enrolment. Recovery codes are shown this one time' })
  @ApiOkResponse({ type: TotpConfirmResultDto })
  confirmTotp(
    @CurrentPrincipal() principal: Principal,
    @Body() body: TotpCodeDto,
  ): Promise<TotpConfirmResultDto> {
    return this.totp.confirm(principal.userId, body.code);
  }

  @Delete('totp')
  @HttpCode(204)
  @Permissions('profile.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Turn TOTP off, unless a role requires it' })
  @ApiNoContentResponse()
  async disableTotp(@CurrentPrincipal() principal: Principal, @Body() body: TotpCodeDto): Promise<void> {
    await this.totp.disable(principal.userId, body.code);
  }

  @Get('sessions')
  @Permissions('profile.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'The member’s live sessions' })
  @ApiOkResponse({ type: [SessionRowDto] })
  listSessions(@CurrentPrincipal() principal: Principal, @Req() request: Request): Promise<SessionRowDto[]> {
    return this.sessions.list(principal.userId, sessionFamilyOf(request));
  }

  @Post('sessions/revoke-all')
  @HttpCode(204)
  @Permissions('profile.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'End every session except this one' })
  @ApiNoContentResponse()
  async revokeAll(@CurrentPrincipal() principal: Principal, @Req() request: Request): Promise<void> {
    await this.sessions.revokeAll(principal.userId, sessionFamilyOf(request) ?? undefined);
  }

  @Delete('sessions/:familyId')
  @HttpCode(204)
  @Permissions('profile.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'End one session' })
  @ApiNoContentResponse()
  async revokeSession(
    @CurrentPrincipal() principal: Principal,
    @Param('familyId') familyId: string,
  ): Promise<void> {
    await this.sessions.revokeOwnFamily(principal.userId, familyId);
  }

  private finish(outcome: SignInOutcome, response: Response): SignInResultDto {
    if (outcome.totpRequired) return { totpRequired: true, challenge: outcome.challenge };
    return this.signedIn(outcome, response);
  }

  private signedIn(outcome: Authenticated, response: Response): SignInResultDto {
    setSessionCookies(response, outcome.session, this.config, this.clock.now());
    return { totpRequired: false, user: outcome.user };
  }
}
