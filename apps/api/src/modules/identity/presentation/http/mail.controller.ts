/**
 * @file Settings › System › Mail (docs/16 D68). The owner's alone and web only: no token or agent reads the mail server or sends through it.
 */
import { mailStatusSchema, mailTestResultSchema, type MemberActor } from '@hub/contracts';
import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';

import { Actor, Permissions } from '@/shared/http';

import { MailService } from '../../application/mail.service';
import { SessionOnly } from '../session-only.decorator';

class MailStatusDto extends createZodDto(mailStatusSchema) {}
class MailTestResultDto extends createZodDto(mailTestResultSchema) {}

@ApiTags('mail')
@Controller('workspaces/:ws/mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get()
  @Permissions('mail.manage')
  @SessionOnly()
  @ApiOperation({
    summary: 'Where Hub sends mail: a real server, the local test inbox, or none. Never the password',
  })
  @ApiOkResponse({ type: MailStatusDto })
  status(): MailStatusDto {
    return this.mail.status();
  }

  @Post('test')
  @HttpCode(200)
  @Permissions('mail.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Send a test email to your own address and say how it went' })
  @ApiOkResponse({ type: MailTestResultDto })
  test(@Actor() actor: MemberActor): Promise<MailTestResultDto> {
    return this.mail.sendTest(actor);
  }
}
