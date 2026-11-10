import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AdminLeadItem,
  type AgentToday,
  type AgentViewing,
  LEAD_STAGES,
  type LeadCard,
  type LeadDetail,
  type LeadNote,
  type LeadSource,
  type LeadStage,
  maskPhone,
  type PropertyCard,
  type UpdateLeadBody,
} from '@maqar/shared';
import { ChatRepository } from '../chat/chat.repository.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PropertiesService } from '../properties/properties.service.js';
import { cairoClock, cairoInstant } from '../viewings/slots.js';
import { type LeadWithClient, LeadsRepository, type ViewingWithLead } from './leads.repository.js';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/** How many viewings "Coming up" shows after today. */
const COMING_UP = 5;

const hourText = (h: number) => `${String(h).padStart(2, '0')}:00`;
/** The Cairo day after this one. */
const nextDay = (date: string) => cairoClock(new Date(cairoInstant(date, '12:00').getTime() + DAY_MS)).date;

/** The sales agent's day and pipeline (contract §10.1, §10.2). Every call is limited to the agent's own leads. */
@Injectable()
export class LeadsService {
  constructor(
    private readonly repo: LeadsRepository,
    private readonly properties: PropertiesService,
    private readonly chats: ChatRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async today(agentId: number, now = new Date()): Promise<AgentToday> {
    const today = cairoClock(now).date;
    const tomorrow = cairoInstant(nextDay(today), '00:00');
    const monthStart = cairoInstant(`${today.slice(0, 8)}01`, '00:00');
    const [names, leads, stages, won, todays, later] = await Promise.all([
      this.repo.agentNames(agentId),
      this.repo.listFor(agentId),
      this.repo.pipeline(agentId),
      this.repo.wonSince(monthStart),
      // Today's live viewings until an hour after they start, as on the client's side.
      this.repo.viewingsBetween(agentId, new Date(Math.max(cairoInstant(today, '00:00').getTime(), now.getTime() - HOUR_MS)), tomorrow),
      this.repo.viewingsBetween(agentId, tomorrow, undefined, COMING_UP),
    ]);
    const pipeline = Object.fromEntries(LEAD_STAGES.map((s) => [s, 0])) as Record<LeadStage, number>;
    for (const { stage, n } of stages) pipeline[stage] = n;
    const mine = won.find((w) => w.agentId === agentId);
    const teamAvg = won.length ? won.reduce((sum, w) => sum + w.won, 0) / won.length : 0;
    const [todayItems, laterItems, cards] = await Promise.all([this.viewingItems(todays), this.viewingItems(later), this.cards(leads)]);
    return {
      firstNameAr: names?.nameAr.split(' ')[0] ?? '',
      firstNameEn: names?.nameEn.split(' ')[0] ?? '',
      stats: { today: todayItems.length, fresh: pipeline.new, active: pipeline.new + pipeline.contacted + pipeline.viewing + pipeline.negotiation },
      target: { won: mine?.won ?? 0, target: mine?.target ?? 0, teamAvg: Math.round(teamAvg * 10) / 10 },
      today: todayItems,
      upcoming: laterItems,
      pipeline,
      firstCall: cards.filter((c) => c.stage === 'new'),
    };
  }

  async list(agentId: number, stage?: LeadStage): Promise<LeadCard[]> {
    return this.cards(await this.repo.listFor(agentId, stage));
  }

  /** The lead page. Opening it marks the lead as seen, which clears "New from app". */
  async detail(agentId: number, id: number, now = new Date()): Promise<LeadDetail> {
    const row = await this.own(agentId, id);
    const [viewing, notes, cards, chatId] = await Promise.all([
      this.repo.viewingOf(row.lead, now),
      this.repo.notesOf(id),
      this.cardsOf([row.lead.propertyId]),
      row.lead.clientId ? this.chats.latestBetween(row.lead.clientId, agentId) : undefined,
    ]);
    const [item] = viewing ? await this.viewingItems([viewing]) : [];
    await this.repo.markSeen(id);
    const { property: _summary, ...card } = this.card(row, cards);
    return {
      ...card,
      phone: row.clientPhone ?? row.lead.phone,
      property: (row.lead.propertyId && cards.get(row.lead.propertyId)) || null,
      viewing: item ?? null,
      notes: notes.map(noteItem),
      chatId: chatId ?? null,
      createdAt: row.lead.createdAt.toISOString(),
    };
  }

  async update(agentId: number, id: number, body: UpdateLeadBody): Promise<LeadCard> {
    await this.own(agentId, id);
    await this.repo.update(id, body);
    const row = (await this.repo.findOwn(agentId, id))!;
    return this.card(row, await this.cardsOf([row.lead.propertyId]));
  }

  async addNote(agentId: number, id: number, text: string): Promise<LeadNote> {
    await this.own(agentId, id);
    const noteId = await this.repo.addNote(id, agentId, text.trim());
    return noteItem((await this.repo.findNote(noteId))!);
  }

  /** Every agent's leads (admins), with the full phone and whose each lead is. */
  async adminList(f: { agentId?: number; stage?: LeadStage }): Promise<AdminLeadItem[]> {
    const rows = await this.repo.listAll(f);
    const [props, agents] = await Promise.all([this.cardsOf(rows.map((r) => r.lead.propertyId)), this.repo.agentsOf(rows.map((r) => r.lead.agentId))]);
    return rows.flatMap((r) => {
      const agent = agents.get(r.lead.agentId);
      if (!agent) return [];
      const { isNew: _isNew, ...card } = this.card(r, props);
      const { active: _active, ...who } = agent;
      return [{ ...card, phone: r.clientPhone ?? r.lead.phone, agent: who }];
    });
  }

  /**
   * Gives a lead to another active agent (contract §11), who gets a notification and sees it as
   * new. The client's chats and viewings stay with the home's advisor.
   */
  async assign(id: number, agentId: number): Promise<AdminLeadItem> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException('Lead not found');
    const to = (await this.repo.agentsOf([agentId])).get(agentId);
    if (!to?.active) throw new BadRequestException('Pick an active sales advisor');
    if (row.lead.agentId !== agentId) {
      if (!(await this.repo.assign(id, agentId))) throw new ConflictException('This client already has a lead with that advisor');
      const name = row.clientName ?? row.lead.name ?? '';
      await this.notifications.notify(agentId, {
        kind: 'lead',
        titleAr: 'عميل جديد اتنقل ليك',
        titleEn: 'A lead was moved to you',
        bodyAr: name ? `${name}: افتح صفحته وكلّمه.` : 'افتح صفحته وكلّمه.',
        bodyEn: name ? `${name}: open the lead and get in touch.` : 'Open the lead and get in touch.',
        href: `/agent/lead/${id}`,
      });
    }
    const [item] = (await this.adminList({})).filter((l) => l.id === id);
    return item!;
  }

  private async own(agentId: number, id: number): Promise<LeadWithClient> {
    const row = await this.repo.findOwn(agentId, id);
    if (!row) throw new NotFoundException('Lead not found');
    return row;
  }

  private async cards(rows: LeadWithClient[]): Promise<LeadCard[]> {
    const props = await this.cardsOf(rows.map((r) => r.lead.propertyId));
    return rows.map((r) => this.card(r, props));
  }

  private card({ lead, clientName, clientPhone }: LeadWithClient, props: Map<number, PropertyCard>): LeadCard {
    const p = lead.propertyId ? props.get(lead.propertyId) : undefined;
    return {
      id: lead.id,
      name: clientName ?? lead.name ?? '',
      phone: maskPhone(clientPhone ?? lead.phone),
      stage: lead.stage,
      source: lead.source as LeadSource,
      hot: lead.hot,
      fromApp: lead.fromApp,
      isNew: lead.fromApp && lead.seenAt === null,
      budget: lead.budget,
      property: p ? { id: p.id, titleAr: p.titleAr, titleEn: p.titleEn } : null,
      lastActivityAt: lead.lastActivityAt.toISOString(),
    };
  }

  /** Cards of these listings whatever their status (a lead keeps its home after it is unpublished). */
  private async cardsOf(ids: (number | null)[]): Promise<Map<number, PropertyCard>> {
    const found = await this.properties.cardsById([...new Set(ids.filter((id): id is number => id !== null))]);
    return new Map([...found].map(([id, { location: _location, ...card }]) => [id, card]));
  }

  private async viewingItems(rows: ViewingWithLead[]): Promise<AgentViewing[]> {
    const props = await this.cardsOf(rows.map((r) => r.propertyId));
    return rows.flatMap((r) => {
      const property = props.get(r.propertyId);
      if (!property) return [];
      const at = cairoClock(r.startsAt);
      return {
        id: r.id,
        leadId: r.leadId,
        date: at.date,
        time: hourText(at.hour),
        startsAt: r.startsAt.toISOString(),
        mode: r.mode,
        clientName: r.clientName ?? r.leadName ?? '',
        newFromApp: r.seenAt === null || r.createdAt.getTime() > r.seenAt.getTime(),
        property,
      };
    });
  }
}

const noteItem = (n: { id: number; text: string; createdAt: Date }): LeadNote => ({ id: n.id, text: n.text, createdAt: n.createdAt.toISOString() });
