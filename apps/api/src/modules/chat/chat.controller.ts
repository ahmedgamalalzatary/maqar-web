import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConflictResponse, ApiConsumes, ApiNoContentResponse, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import { CHAT_IMAGES_MAX, type ChatMessage, type ChatPage, type ChatReport, type ChatThread, type SendChatBody, type ViewingItem } from '@maqar/shared';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RateLimited } from '../../common/rate-limit.js';
import { ChatService } from './chat.service.js';
import { BookSlotDto, PageQueryDto, ReportChatDto, SendMessageDto, StartChatDto } from './dto/chat.dto.js';

/** Photos up to 8 MB each, before resizing. */
const PHOTO_BYTES = 8 * 1024 * 1024;

/** Router for `/v1/chats` (contract §8.12, §10.3, §14). Each conversation is only for its client and agent. */
@ApiTags('chat')
@ApiBearerAuth()
@Roles('client', 'agent')
@RateLimited()
@Controller('chats')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /** The user's conversations that have messages, the latest first, with unread counts. */
  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ChatThread[]> {
    return this.chat.list(user);
  }

  /** Opens the conversation about a home (clients), starting it the first time. */
  @Post()
  @Roles('client')
  @ApiNotFoundResponse({ description: 'Missing or not approved' })
  start(@CurrentUser() user: AuthUser, @Body() body: StartChatDto): Promise<ChatThread> {
    return this.chat.start(user, body.propertyId);
  }

  @Get(':id')
  @ApiNotFoundResponse({ description: 'Missing, or someone else’s' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<ChatThread> {
    return this.chat.get(user, id);
  }

  /** Thirty messages, oldest first; `before` pages back. */
  @Get(':id/messages')
  page(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Query() q: PageQueryDto): Promise<ChatPage> {
    return this.chat.page(user, id, q.before);
  }

  @Post(':id/messages')
  send(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: SendMessageDto): Promise<ChatMessage> {
    return this.chat.send(user, id, body as SendChatBody);
  }

  /** One to four photos in the `photos` field. */
  @Post(':id/images')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('photos', CHAT_IMAGES_MAX, {
      limits: { fileSize: PHOTO_BYTES },
      fileFilter: (_req, file, done) => done(null, /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)),
    }),
  )
  sendImages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: { buffer: Buffer; mimetype: string }[] = [],
  ): Promise<ChatMessage> {
    if (!files.length) throw new BadRequestException('Add one to four photos (JPEG, PNG, WebP or HEIC)');
    return this.chat.sendImages(user, id, files);
  }

  @Post(':id/read')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'The other side’s messages are read' })
  read(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.chat.read(user, id);
  }

  /** Reports the conversation to the admins (phase 24). */
  @Post(':id/report')
  report(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: ReportChatDto): Promise<ChatReport> {
    return this.chat.report(user, id, body);
  }

  /** Closes the conversation for both sides (phase 24); only an admin opens it again. */
  @Post(':id/block')
  @ApiConflictResponse({ description: 'Already closed' })
  block(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<ChatThread> {
    return this.chat.block(user, id);
  }

  /** Books a time from an agent's times card (clients). */
  @Post(':id/messages/:messageId/book')
  @Roles('client')
  book(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('messageId', ParseIntPipe) messageId: number,
    @Body() body: BookSlotDto,
  ): Promise<{ viewing: ViewingItem; card: ChatMessage }> {
    return this.chat.book(user, id, messageId, body.time);
  }
}
