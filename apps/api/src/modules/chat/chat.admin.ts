import { Body, ConflictException, Controller, Get, Injectable, NotFoundException, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import { CHAT_PAGE, type AdminChatDetail, type AdminChatItem, type AdminChatsPage, type AdminReportItem, type ChatPage, type ChatReport } from '@maqar/shared';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PeopleService } from '../people/people.service.js';
import { PropertiesService } from '../properties/properties.service.js';
import { ChatRepository } from './chat.repository.js';
import type { ChatThreadRow } from './chat.schema.js';
import { blockOf, ChatService, toMessage } from './chat.service.js';
import { AdminChatsQueryDto, AdminReportsQueryDto, PageQueryDto, ResolveReportDto } from './dto/chat.dto.js';

/**
 * The admin's view of chat (phase 24, contract §11): every conversation, read-only (an admin
 * never sends, and reading marks nothing read), and the reports to close.
 */
@Injectable()
export class ChatAdminService {
  constructor(
    private readonly repo: ChatRepository,
    private readonly chat: ChatService,
    private readonly properties: PropertiesService,
    private readonly people: PeopleService,
  ) {}

  async list(q: AdminChatsQueryDto): Promise<AdminChatsPage> {
    const { rows, total } = await this.repo.adminThreads(q);
    return { items: await this.items(rows), page: q.page, limit: q.limit, total };
  }

  async get(id: number): Promise<AdminChatDetail> {
    const thread = await this.thread(id);
    const [item] = await this.items([thread]);
    return { ...item!, reports: await this.chat.reportItems(await this.repo.reports({ threadIds: [id] })) };
  }

  /** Messages oldest first, like the apps read them. Nothing is marked read. */
  async page(id: number, before?: number): Promise<ChatPage> {
    await this.thread(id);
    const { items, hasMore } = await this.repo.page(id, CHAT_PAGE, before);
    return { items: items.map(toMessage), hasMore };
  }

  async unblock(id: number): Promise<AdminChatDetail> {
    await this.chat.reopen(await this.thread(id));
    return this.get(id);
  }

  async reports(open: boolean): Promise<AdminReportItem[]> {
    const rows = await this.repo.reports({ open });
    const threads = await Promise.all([...new Set(rows.map((r) => r.threadId))].map((id) => this.repo.findThread(id)));
    const chats = new Map((await this.items(threads.filter((t): t is ChatThreadRow => !!t))).map((c) => [c.id, c]));
    const reports = await this.chat.reportItems(rows);
    return reports.flatMap((r) => (chats.has(r.threadId) ? [{ ...r, chat: chats.get(r.threadId)! }] : []));
  }

  /**
   * Closes a report: dismissed, the conversation closed (by an admin), or the client suspended (phase
   * 22's suspension: signed out, upcoming viewings cancelled). A report is closed once.
   */
  async resolve(id: number, outcome: ResolveReportDto['outcome'], admin: AuthUser): Promise<ChatReport> {
    const report = await this.repo.findReport(id);
    if (!report) throw new NotFoundException('Report not found');
    if (report.resolvedAt) throw new ConflictException('This report is already closed');
    const thread = (await this.repo.findThread(report.threadId))!;
    if (outcome === 'blocked' && !thread.blockedAt) await this.chat.close(thread, 'admin');
    if (outcome === 'suspended') await this.people.updateClient(thread.clientId, { suspended: true });
    if (!(await this.repo.resolveReport(id, outcome, admin.id))) throw new ConflictException('This report is already closed');
    return (await this.chat.reportItems([(await this.repo.findReport(id))!]))[0]!;
  }

  private async thread(id: number): Promise<ChatThreadRow> {
    const thread = await this.repo.findThread(id);
    if (!thread) throw new NotFoundException('Conversation not found');
    return thread;
  }

  private async items(rows: ChatThreadRow[]): Promise<AdminChatItem[]> {
    const ids = rows.map((r) => r.id);
    const [cards, agents, last, counts, reports, clients] = await Promise.all([
      this.properties.cardsById(rows.map((r) => r.propertyId)),
      this.properties.agentsById(rows.map((r) => r.agentId)),
      this.repo.lastMessages(ids),
      this.repo.messageCounts(ids),
      this.repo.openReports(ids),
      this.repo.clients(rows.map((r) => r.clientId)),
    ]);
    return rows.flatMap((r) => {
      const card = cards.get(r.propertyId);
      const agent = agents.get(r.agentId);
      if (!card || !agent) return [];
      const client = clients.get(r.clientId);
      const lastRow = last.get(r.id);
      return {
        id: r.id,
        property: { id: card.id, titleAr: card.titleAr, titleEn: card.titleEn },
        agent: { id: agent.id, nameAr: agent.nameAr, nameEn: agent.nameEn, colour: agent.colour },
        client: client && client.name ? { id: r.clientId, name: client.name, phone: client.phone } : null,
        last: lastRow ? toMessage(lastRow) : null,
        messages: counts.get(r.id) ?? 0,
        blocked: blockOf(r),
        openReports: reports.get(r.id) ?? 0,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }
}

/** Router for `/v1/admin/chats` (phase 24): every conversation, read-only. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/chats')
export class AdminChatsController {
  constructor(private readonly admin: ChatAdminService) {}

  /** Latest first, by advisor, client or home; `reported=true` for those with open reports. */
  @Get()
  list(@Query() q: AdminChatsQueryDto): Promise<AdminChatsPage> {
    return this.admin.list(q);
  }

  @Get(':id')
  @ApiNotFoundResponse({ description: 'No such conversation' })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminChatDetail> {
    return this.admin.get(id);
  }

  @Get(':id/messages')
  page(@Param('id', ParseIntPipe) id: number, @Query() q: PageQueryDto): Promise<ChatPage> {
    return this.admin.page(id, q.before);
  }

  @Post(':id/unblock')
  unblock(@Param('id', ParseIntPipe) id: number): Promise<AdminChatDetail> {
    return this.admin.unblock(id);
  }
}

/** Router for `/v1/admin/reports` (phase 24): reports on conversations, and closing them. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly admin: ChatAdminService) {}

  /** Newest first; `open=true` for the ones still to handle. */
  @Get()
  list(@Query() q: AdminReportsQueryDto): Promise<AdminReportItem[]> {
    return this.admin.reports(q.open === true);
  }

  @Patch(':id')
  @ApiNotFoundResponse({ description: 'No such report' })
  @ApiConflictResponse({ description: 'Already closed' })
  resolve(@Param('id', ParseIntPipe) id: number, @Body() body: ResolveReportDto, @CurrentUser() admin: AuthUser): Promise<ChatReport> {
    return this.admin.resolve(id, body.outcome, admin);
  }
}
