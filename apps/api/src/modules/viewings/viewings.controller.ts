import { Body, Controller, Get, Header, Param, ParseIntPipe, Patch, Post, Query, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { SlotsResponse, UpdateViewingBody, ViewingItem } from '@maqar/shared';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { BookViewingDto, SlotsQueryDto, UpdateViewingDto } from './dto/viewings.dto.js';
import { ViewingsService } from './viewings.service.js';

/** `GET /v1/properties/:id/slots`: public, so a guest sees the times before signing in. */
@ApiTags('viewings')
@Controller('properties')
export class SlotsController {
  constructor(private readonly viewings: ViewingsService) {}

  @Public()
  @Get(':id/slots')
  @ApiNotFoundResponse({ description: 'Missing or not approved' })
  slots(@Param('id', ParseIntPipe) id: number, @Query() q: SlotsQueryDto): Promise<SlotsResponse> {
    return this.viewings.slots(id, q.reschedule);
  }
}

/** Router for `/v1/viewings` (contract §8.7, §8.8). Clients book and change theirs; agents see the ones they meet. */
@ApiTags('viewings')
@ApiBearerAuth()
@Controller('viewings')
export class ViewingsController {
  constructor(private readonly viewings: ViewingsService) {}

  @Post()
  @Roles('client')
  @ApiConflictResponse({ description: 'The hour is taken, past or closed, or the client already has a viewing of this home' })
  book(@CurrentUser() user: AuthUser, @Body() body: BookViewingDto): Promise<ViewingItem> {
    return this.viewings.book(user, body);
  }

  @Get()
  @Roles('client', 'agent')
  list(@CurrentUser() user: AuthUser): Promise<ViewingItem[]> {
    return this.viewings.list(user);
  }

  /** Reschedule (keeps where it was in `rescheduledFrom`) or cancel. Only the client's own. */
  @Patch(':id')
  @Roles('client')
  @ApiNotFoundResponse({ description: 'Missing or someone else’s' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateViewingDto): Promise<ViewingItem> {
    return this.viewings.update(user, id, body as UpdateViewingBody);
  }

  @Get(':id/ics')
  @Roles('client', 'agent')
  @ApiProduces('text/calendar')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="maqar-viewing.ics"')
  async ics(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<StreamableFile> {
    return new StreamableFile(Buffer.from(await this.viewings.ics(user, id), 'utf8'));
  }
}
