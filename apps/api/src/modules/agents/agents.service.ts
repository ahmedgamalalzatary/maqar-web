import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type AdminAgentDetail, type AdminAgentItem, type AgentListingOption, daysBetween, type DaysOffResult, weekProblem } from '@maqar/shared';
import { hashPassword } from '../auth/password.js';
import { cairoClock, cairoInstant, DEFAULT_HOURS } from '../viewings/slots.js';
import type { CreateAgentDto, DaysOffDto, HoursDto, UpdateAgentDto } from './dto/agents.dto.js';
import { AgentsRepository, AgentStateError } from './agents.repository.js';
import type { AgentRow } from './agents.schema.js';

type Row = AgentRow & { email: string | null; live: number; openLeads: number };

const toItem = (a: Row): AdminAgentItem => ({
  id: a.userId,
  nameAr: a.nameAr,
  nameEn: a.nameEn,
  colour: a.colour,
  email: a.email,
  phone: a.phone,
  roleTitleAr: a.roleTitleAr,
  roleTitleEn: a.roleTitleEn,
  active: a.active,
  live: a.live,
  openLeads: a.openLeads,
  monthlyTarget: a.monthlyTarget,
});

/** The calendar day after `date` (YYYY-MM-DD). */
function dayAfter(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * Agents for the admin tools (phase 18, contract §11, §16.1 #8). Slots and the chat's away reply
 * read the hours and days off when they are needed, so a change here applies at once.
 */
@Injectable()
export class AgentsService {
  constructor(private readonly repo: AgentsRepository) {}

  async list(activeOnly: boolean): Promise<AdminAgentItem[]> {
    return (await this.repo.list(activeOnly)).map(toItem);
  }

  async get(id: number): Promise<AdminAgentDetail> {
    const a = await this.repo.find(id);
    if (!a) throw new NotFoundException('Agent not found');
    const [hours, daysOff, listingIds] = await Promise.all([this.repo.hours(id), this.repo.daysOffFrom(id, cairoClock(new Date()).date), this.repo.listingIds(id)]);
    return {
      ...toItem(a),
      languagesAr: a.languagesAr,
      languagesEn: a.languagesEn,
      years: a.years,
      hours: hours.length ? hours : [...DEFAULT_HOURS].map(([weekday, h]) => ({ weekday, from: h.from, to: h.to })),
      defaultHours: hours.length === 0,
      daysOff,
      listingIds,
    };
  }

  listingOptions(): Promise<AgentListingOption[]> {
    return this.repo.listingOptions();
  }

  /** The listings picked in the agent's form must all exist. */
  private async assertListings(ids: number[] | undefined): Promise<void> {
    if (ids?.length && (await this.repo.countListings(ids)) !== ids.length) throw new BadRequestException('One of those listings does not exist');
  }

  /** A new agent with the default week, who signs in with the starting password the admin passes on. */
  async create(body: CreateAgentDto): Promise<AdminAgentDetail> {
    if (await this.repo.emailTaken(body.email)) throw new ConflictException('That email already has an account');
    const { password, email, listingIds, ...profile } = body;
    await this.assertListings(listingIds);
    const id = await this.repo.create(
      { role: 'agent', name: body.nameAr, email, phone: body.phone, passwordHash: await hashPassword(password) },
      { ...profile, years: profile.years ?? 0 },
      listingIds,
    );
    return this.get(id);
  }

  /**
   * Changes what is sent. Turning an agent off signs them out at once; it is refused while they
   * are the advisor of a live listing, which must move to someone else first, and while they have
   * upcoming viewings, conversations or open leads — unless `reassignTo` names the advisor who
   * takes them over (or there is nothing to move). `listingIds` makes them the advisor of those
   * listings too (phase 29); only an agent who is on can take listings.
   */
  async update(id: number, body: UpdateAgentDto): Promise<AdminAgentDetail> {
    const cur = await this.repo.find(id);
    if (!cur) throw new NotFoundException('Agent not found');
    const { password, email, active, reassignTo, listingIds, ...profile } = body;
    if (listingIds?.length && !(active ?? cur.active)) throw new BadRequestException('Only an active sales advisor can take listings');
    await this.assertListings(listingIds);
    const emailChanged = email !== undefined && email !== cur.email;
    if (emailChanged && (await this.repo.emailTaken(email))) throw new ConflictException('That email already has an account');
    if (active === false && cur.active && cur.live > 0) {
      throw new ConflictException('Move this advisor’s live listings to someone else first');
    }
    if (active === false && cur.active) {
      const work = await this.repo.upcomingWork(id);
      const total = work.viewings + work.threads + work.leads;
      if (total > 0) {
        if (reassignTo === undefined) {
          throw new ConflictException(
            `This advisor still has ${work.viewings} upcoming viewing(s), ${work.threads} conversation(s) and ${work.leads} open lead(s). Pass reassignTo to hand them over.`,
          );
        }
        await this.assertHandover(id, reassignTo);
        await this.repo.reassign(id, reassignTo);
      }
    }
    // One transaction: the fields, the listings and the sign-out land together or not at all. The
    // repository rechecks the agent's state under a row lock, since it may have changed since `cur`.
    try {
      await this.repo.update(
        id,
        {
          ...(email ? { email } : {}),
          ...(profile.nameAr ? { name: profile.nameAr } : {}),
          ...(profile.phone ? { phone: profile.phone } : {}),
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
        },
        { ...profile, ...(active === undefined ? {} : { active }) },
        { listingIds, endSessions: !!(password || emailChanged || active === false), touchCredentials: !!(password || emailChanged) },
      );
    } catch (e) {
      if (e instanceof AgentStateError) {
        if (e.reason === 'live') throw new ConflictException('Move this advisor’s live listings to someone else first');
        throw new BadRequestException('Only an active sales advisor can take listings');
      }
      throw e;
    }
    return this.get(id);
  }

  /** Hands an agent's open work to another advisor, without deactivating anyone. */
  async reassign(id: number, reassignTo: number): Promise<{ viewings: number; threads: number; leads: number }> {
    await this.assertHandover(id, reassignTo);
    return this.repo.reassign(id, reassignTo);
  }

  private async assertHandover(id: number, reassignTo: number): Promise<void> {
    if (reassignTo === id) throw new BadRequestException('Pick a different advisor to hand over to');
    const to = await this.repo.find(reassignTo);
    if (!to || !to.active) throw new NotFoundException('That advisor is not an active agent');
  }

  /** The same week for each agent. */
  async setHours(body: HoursDto): Promise<void> {
    const problem = weekProblem(body.hours);
    if (problem) {
      throw new BadRequestException(
        problem === 'twice' ? 'A weekday is there twice' : problem === 'order' ? 'A day ends before it starts' : 'Hours are 0 to 23, weekdays 0 to 6',
      );
    }
    await this.assertAgents(body.agentIds);
    await this.repo.setHours(body.agentIds, body.hours);
  }

  /**
   * Days off for each agent. Viewings already booked on them stay: the answer says how many, so
   * the admin can move them.
   */
  async addDaysOff(body: DaysOffDto): Promise<DaysOffResult> {
    const dates = daysBetween(body.from, body.to ?? body.from);
    if (!dates.length) throw new BadRequestException('Pick a first day and a last day on or after it, at most 60 days');
    await this.assertAgents(body.agentIds);
    await this.repo.addDaysOff(body.agentIds, dates, body.reason || null);
    // From Cairo midnight on the first day to Cairo midnight after the last.
    const booked = await this.repo.bookedBetween(body.agentIds, cairoInstant(dates[0]!, '00:00'), cairoInstant(dayAfter(dates[dates.length - 1]!), '00:00'));
    return { days: dates.length, booked: body.agentIds.flatMap((agentId) => (booked.get(agentId) ? [{ agentId, viewings: booked.get(agentId)! }] : [])) };
  }

  async removeDayOff(id: number, date: string): Promise<void> {
    if (!(await this.repo.removeDayOff(id, date))) throw new NotFoundException('That day is not a day off');
  }

  private async assertAgents(ids: number[]): Promise<void> {
    if ((await this.repo.countExisting(ids)) !== ids.length) throw new NotFoundException('Agent not found');
  }
}
