/**
 * @file Generic card routes (docs/04 §3.8), and the pattern for an endpoint: declare the permission, take
 * `@Actor()`, call `CardService.apply`, answer with the card as it now stands.
 */
import {
  type CardWrittenDto,
  type CommentDto,
  type MemberActor,
  type PermissionAction,
} from '@hub/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AppException } from '@/shared/errors';
import { Actor, Permissions } from '@/shared/http';

import { CardService } from '../../application/card.service';
import { CardQueryService } from '../../application/card-query.service';
import { transitionActionFor } from '../../application/transitions';
import {
  CardFullResponseDto,
  CardQueryDto,
  CardSummaryDto,
  CardWrittenResponseDto,
  CommentBodyDto,
  CommentResponseDto,
  CreateCardDto,
  DeleteCardDto,
  EventResponseDto,
  LinkDto,
  PageQueryDto,
  TransitionDto,
  UpdateCardDto,
} from './card.dto';
import { IdempotencyInterceptor } from './idempotency.interceptor';

/** Any member reaches the write routes; `apply` then judges the row with the card in hand. */
@ApiTags('cards')
@Controller('workspaces/:ws/cards')
export class CardsController {
  constructor(
    private readonly cards: CardService,
    private readonly query: CardQueryService,
  ) {}

  private async run(
    actor: MemberActor,
    key: string,
    action: PermissionAction,
    payload: unknown,
  ): Promise<CardWrittenDto> {
    return this.query.written(actor, await this.cards.apply(actor, { cardKey: key }, action, payload));
  }

  @Get()
  @Permissions('card.read')
  @ApiOperation({ summary: 'List cards', operationId: 'cards_listCards' })
  @ApiOkResponse({ type: CardSummaryDto, isArray: true })
  list(@Actor() actor: MemberActor, @Query() query: CardQueryDto) {
    return this.query.list(actor, query);
  }

  @Get('deleted')
  @Permissions('card.read')
  @ApiOperation({ summary: 'The Deleted view: all for owner and pm, your own otherwise (D28)' })
  @ApiOkResponse({ type: CardSummaryDto, isArray: true })
  deleted(@Actor() actor: MemberActor, @Query() page: PageQueryDto) {
    return this.query.deleted(actor, page);
  }

  @Post()
  @HttpCode(201)
  // `apply` checks the row of the card type in the body, such as release.create.
  @Permissions('card.read')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Create a card' })
  @ApiCreatedResponse({ type: CardWrittenResponseDto })
  async create(@Actor() actor: MemberActor, @Body() body: CreateCardDto): Promise<CardWrittenDto> {
    const { type, ...payload } = body;
    if (type === 'change' || type === 'redesign' || type === 'doc') {
      throw new AppException('hub.cards.type_mismatch', { details: { type } });
    }
    const action = `${type}.create` as PermissionAction;
    return this.query.written(actor, await this.cards.apply(actor, null, action, payload));
  }

  @Get(':key')
  @Permissions('card.read')
  @ApiOperation({ summary: 'A card with everything the sheet shows' })
  @ApiOkResponse({ type: CardFullResponseDto })
  get(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.query.full(actor, key);
  }

  @Patch(':key')
  @Permissions('card.read')
  @ApiOperation({ summary: 'Edit the header of a card' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  update(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: UpdateCardDto) {
    return this.run(actor, key, 'card.edit_content', body);
  }

  @Post(':key/transition')
  @HttpCode(200)
  @Permissions('card.read')
  @ApiOperation({ summary: 'Move the status, for moves with no dedicated endpoint' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  async transition(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: TransitionDto) {
    const card = await this.query.readable(actor, { cardKey: key });
    const move = transitionActionFor(card.type, card.status, body.to);
    if (!move) {
      throw new AppException('hub.cards.type_mismatch', { details: { type: card.type, to: body.to } });
    }
    return this.run(actor, key, move, body.reason ? { reason: body.reason } : {});
  }

  @Post(':key/delete')
  @HttpCode(200)
  @Permissions('card.delete')
  @ApiOperation({ summary: 'Delete a card: hidden everywhere, recoverable (D28)' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  delete(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: DeleteCardDto) {
    return this.run(actor, key, 'card.delete', body);
  }

  @Post(':key/restore')
  @HttpCode(200)
  @Permissions('card.restore')
  @ApiOperation({ summary: 'Restore a deleted card' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  restore(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.run(actor, key, 'card.restore', {});
  }

  @Get(':key/events')
  @Permissions('card.read')
  @ApiOperation({ summary: 'A card’s history, oldest first' })
  @ApiOkResponse({ type: EventResponseDto, isArray: true })
  events(@Actor() actor: MemberActor, @Param('key') key: string, @Query() page: PageQueryDto) {
    return this.query.events(actor, key, page);
  }

  @Get(':key/comments')
  @Permissions('card.read')
  @ApiOperation({ summary: 'A card’s comments, oldest first' })
  @ApiOkResponse({ type: CommentResponseDto, isArray: true })
  comments(@Actor() actor: MemberActor, @Param('key') key: string, @Query() page: PageQueryDto) {
    return this.query.comments(actor, key, page);
  }

  @Post(':key/comments')
  @HttpCode(201)
  @Permissions('card.comment')
  @ApiOperation({ summary: 'Comment. Mentions: @user:<id>, @role:<role>' })
  @ApiCreatedResponse({ type: CommentResponseDto })
  async addComment(
    @Actor() actor: MemberActor,
    @Param('key') key: string,
    @Body() body: CommentBodyDto,
  ): Promise<CommentDto> {
    const { event } = await this.cards.apply(actor, { cardKey: key }, 'card.comment', body);
    return this.query.comment(actor, event.data['commentId'] as string);
  }

  @Patch(':key/comments/:id')
  @Permissions('card.read')
  @ApiOperation({ summary: 'Edit your own comment, within 15 minutes' })
  @ApiOkResponse({ type: CommentResponseDto })
  async editComment(
    @Actor() actor: MemberActor,
    @Param('key') key: string,
    @Param('id') id: string,
    @Body() body: CommentBodyDto,
  ): Promise<CommentDto> {
    await this.cards.apply(actor, { cardKey: key }, 'card.comment_edit', { ...body, commentId: id });
    return this.query.comment(actor, id);
  }

  @Post(':key/comments/:id/redact')
  @HttpCode(200)
  @Permissions('card.comment_redact')
  @ApiOperation({ summary: 'Redact a comment: the text is gone, the fact stays' })
  @ApiOkResponse({ type: CommentResponseDto })
  async redactComment(
    @Actor() actor: MemberActor,
    @Param('key') key: string,
    @Param('id') id: string,
  ): Promise<CommentDto> {
    await this.cards.apply(actor, { cardKey: key }, 'card.comment_redact', { commentId: id });
    return this.query.comment(actor, id);
  }

  @Post(':key/links')
  @HttpCode(201)
  @Permissions('card.link')
  @ApiOperation({ summary: 'Link two cards' })
  @ApiCreatedResponse({ type: CardWrittenResponseDto })
  link(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: LinkDto) {
    return this.run(actor, key, 'card.link', { ...body, op: 'add' });
  }

  @Delete(':key/links')
  @Permissions('card.link')
  @ApiOperation({ summary: 'Remove a link' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  unlink(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: LinkDto) {
    return this.run(actor, key, 'card.link', { ...body, op: 'remove' });
  }

  @Post(':key/watch')
  @HttpCode(204)
  @Permissions('card.watch')
  @ApiOperation({ summary: 'Watch a card' })
  @ApiNoContentResponse()
  async watch(@Actor() actor: MemberActor, @Param('key') key: string): Promise<void> {
    await this.cards.apply(actor, { cardKey: key }, 'card.watch', { op: 'add' });
  }

  @Delete(':key/watch')
  @HttpCode(204)
  @Permissions('card.watch')
  @ApiOperation({ summary: 'Stop watching a card' })
  @ApiNoContentResponse()
  async unwatch(@Actor() actor: MemberActor, @Param('key') key: string): Promise<void> {
    await this.cards.apply(actor, { cardKey: key }, 'card.watch', { op: 'remove' });
  }

  @Get(':key/attachments')
  @Permissions('card.read')
  @ApiOperation({ summary: 'Lab screenshots and review files of a card' })
  attachments(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.query.attachments(actor, key);
  }
}
