import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import type { AgentToday, LeadCard, LeadDetail, LeadNote } from '@maqar/shared';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AddLeadNoteDto, LeadsQueryDto, UpdateLeadDto } from './dto/leads.dto.js';
import { LeadsService } from './leads.service.js';

/** Router for `/v1/agent`: the sales agent's day and leads (contract §10.1, §10.2, §14). Only their own. */
@ApiTags('agent')
@ApiBearerAuth()
@Roles('agent')
@Controller('agent')
export class AgentController {
  constructor(private readonly leads: LeadsService) {}

  /** Stats, the monthly target, today's and coming viewings, the pipeline and "Needs a first call". */
  @Get('today')
  today(@CurrentUser() user: AuthUser): Promise<AgentToday> {
    return this.leads.today(user.id);
  }

  /** The agent's leads, the latest activity first; `stage` narrows them. Phones are masked. */
  @Get('leads')
  list(@CurrentUser() user: AuthUser, @Query() q: LeadsQueryDto): Promise<LeadCard[]> {
    return this.leads.list(user.id, q.stage);
  }

  /** The lead page, with the phone in full. Opening it marks the lead as seen. */
  @Get('leads/:id')
  @ApiNotFoundResponse({ description: 'Missing, or another agent’s' })
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<LeadDetail> {
    return this.leads.detail(user.id, id);
  }

  /** Moves the lead to another stage, or marks it hot or not. */
  @Patch('leads/:id')
  @ApiNotFoundResponse({ description: 'Missing, or another agent’s' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateLeadDto): Promise<LeadCard> {
    if (body.stage === undefined && body.hot === undefined) throw new BadRequestException('Nothing to change');
    return this.leads.update(user.id, id, body);
  }

  @Post('leads/:id/notes')
  @ApiNotFoundResponse({ description: 'Missing, or another agent’s' })
  addNote(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: AddLeadNoteDto): Promise<LeadNote> {
    return this.leads.addNote(user.id, id, body.text);
  }
}
