import { Body, Controller, Get, Header, Param, ParseIntPipe, Patch, Post, Query, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { AdminViewingItem, AdminViewingsPage, SlotsResponse, UpdateViewingBody, ViewingItem } from '@maqar/shared';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RateLimited } from '../../common/rate-limit.js';
import { AdminViewingsQueryDto, AdminViewingUpdateDto, BookViewingDto, SlotsQueryDto, UpdateViewingDto } from './dto/viewings.dto.js';
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
    return this.viewings.slots(id, q.reschedule, q.reschedule !== undefined);
  }
}

/** Router for `/v1/viewings` (contract §8.7, §8.8). Clients book and change theirs; agents see the ones they meet. */
@ApiTags('viewings')
@ApiBearerAuth()
@RateLimited()
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

/** Router for `/v1/admin/viewings` (phase 23, contract §11): every viewing; move or cancel one. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/viewings')
export class AdminViewingsController {
  constructor(private readonly viewings: ViewingsService) {}

  /** Upcoming soonest first (default) or past latest first, by status, advisor, Cairo days and words. */
  @Get()
  list(@Query() q: AdminViewingsQueryDto): Promise<AdminViewingsPage> {
    return this.viewings.adminList(q);
  }

  /** A free hour of the same advisor (`GET /properties/:id/slots?reschedule=:id` lists them), or cancel. */
  @Patch(':id')
  @ApiNotFoundResponse({ description: 'No such viewing' })
  @ApiConflictResponse({ description: 'Not active any more, already started, or the hour is taken' })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: AdminViewingUpdateDto): Promise<AdminViewingItem> {
    return this.viewings.adminUpdate(id, body);
  }
}
