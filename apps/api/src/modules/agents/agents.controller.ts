import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import type { AdminAgentDetail, AdminAgentItem, AgentListingOption, DaysOffResult } from '@maqar/shared';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { DatePipe } from './date.pipe.js';
import { AgentsQueryDto, CreateAgentDto, DaysOffDto, HoursDto, ReassignDto, UpdateAgentDto } from './dto/agents.dto.js';
import { AgentsService } from './agents.service.js';

/** Router for `/v1/admin/agents` (phase 18, contract §11): accounts, weekly hours and days off. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/agents')
export class AdminAgentsController {
  constructor(private readonly agents: AgentsService) {}

  /** Every agent, active ones first and the least busy first; `active=true` for the advisor pickers. */
  @Get()
  list(@Query() q: AgentsQueryDto): Promise<AdminAgentItem[]> {
    return this.agents.list(q.active === true);
  }

  @Post()
  @ApiConflictResponse({ description: 'The email already has an account' })
  create(@Body() body: CreateAgentDto): Promise<AdminAgentDetail> {
    return this.agents.create(body);
  }

  /** The same week for one agent or several. Before `:id`, so "hours" is not read as an id. */
  @Put('hours')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Their slots follow at once' })
  setHours(@Body() body: HoursDto): Promise<void> {
    return this.agents.setHours(body);
  }

  @Post('days-off')
  addDaysOff(@Body() body: DaysOffDto): Promise<DaysOffResult> {
    return this.agents.addDaysOff(body);
  }

  /** Every listing with its advisor, for the picker in the agent's form (phase 29). Before `:id`. */
  @Get('listing-options')
  listingOptions(): Promise<AgentListingOption[]> {
    return this.agents.listingOptions();
  }

  @Get(':id')
  @ApiNotFoundResponse({ description: 'No such agent' })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminAgentDetail> {
    return this.agents.get(id);
  }

  @Patch(':id')
  @ApiConflictResponse({ description: 'Still the advisor of live listings, the email is taken, or there is unassigned work' })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateAgentDto): Promise<AdminAgentDetail> {
    return this.agents.update(id, body);
  }

  /** Moves an advisor's upcoming viewings, conversations and open leads to another advisor. */
  @Post(':id/reassign')
  reassign(@Param('id', ParseIntPipe) id: number, @Body() body: ReassignDto): Promise<{ viewings: number; threads: number; leads: number }> {
    return this.agents.reassign(id, body.reassignTo);
  }

  @Delete(':id/days-off/:date')
  @HttpCode(204)
  @ApiNotFoundResponse({ description: 'Not a day off' })
  removeDayOff(@Param('id', ParseIntPipe) id: number, @Param('date', DatePipe) date: string): Promise<void> {
    return this.agents.removeDayOff(id, date);
  }
}
