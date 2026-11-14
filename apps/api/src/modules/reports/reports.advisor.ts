import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CATEGORY_LABEL,
  LEAD_SOURCE_LABEL,
  LEAD_STAGE_COLOUR,
  LEAD_STAGE_LABEL,
  LEAD_STAGES,
  localDigits,
  PROPERTY_STATUS_LABEL,
  VIEWING_CANCELLER_LABEL,
  VIEWING_STATUS_LABEL,
} from '@maqar/shared';
import { firstReplies } from './chat-times.js';
import { type Built, type Ctx, bi, since, titleOf, UNKNOWN } from './reports.context.js';
import { type LeadFact, type ListingFact, ReportsRepository } from './reports.repository.js';
import { daysBetween, kpi, median, perDay, ratio, type Win, within } from './reports.util.js';

const OPEN = (l: LeadFact) => l.stage !== 'won' && l.stage !== 'lost';
const STALE_DAYS = 7;
const STALE_AR = localDigits(String(STALE_DAYS), 'ar');
const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * One advisor's own report (phase 29), opened from a row of the advisors report: the same
 * numbers as their row there, with the leads, deals, viewings and listings behind them.
 */
@Injectable()
export class AdvisorReport {
  constructor(private readonly repo: ReportsRepository) {}

  async advisor(c: Ctx): Promise<Built> {
    const id = c.f.agentId!;
    const [agents, areas, allListings, allLeads, allViewings, chats] = await Promise.all([
      this.repo.agents(),
      this.repo.areas(),
      this.repo.listings(),
      this.repo.leads(since(c)),
      this.repo.viewings(since(c)),
      this.repo.threads(since(c)),
    ]);
    const a = agents.find((x) => x.id === id);
    if (!a) throw new NotFoundException('Agent not found');
    const listing = new Map(allListings.map((l) => [l.id, l]));
    const areaName = new Map(areas.map((x) => [x.id, bi(x)]));
    const listings = allListings.filter((l) => l.agentId === id);
    const leads = allLeads.filter((l) => l.agentId === id);
    const viewings = allViewings.filter((v) => v.agentId === id);
    const threads = chats.threads.filter((t) => t.agentId === id);
    const staleBefore = new Date(c.now.getTime() - STALE_DAYS * 86_400_000);

    const newLeads = (w: Win) => leads.filter((l) => within(l.createdAt, w));
    const won = (w: Win) => leads.filter((l) => within(l.wonAt, w)).length;
    const lost = (w: Win) => leads.filter((l) => within(l.lostAt, w)).length;
    const booked = (w: Win) => viewings.filter((v) => within(v.createdAt, w));
    const completed = (w: Win) => viewings.filter((v) => v.status === 'completed' && within(v.startsAt, w)).length;
    const cancelled = (w: Win) => viewings.filter((v) => v.status === 'cancelled' && within(v.updatedAt, w)).length;
    const reply = (w: Win) =>
      median(
        firstReplies(threads, chats.messages, w)
          .map((r) => r.minutes)
          .filter((m): m is number => m !== null),
      );
    const closedIn = (w: Win) => listings.filter((l) => (l.status === 'sold' || l.status === 'rented') && within(l.closedAt, w));
    const open = leads.filter(OPEN);
    const target = a.monthlyTarget ? Math.round(a.monthlyTarget * (c.cur.days.length / 30.4) * 10) / 10 : null;
    const prev = <T>(f: (w: Win) => T): T | null => (c.prev ? f(c.prev) : null);
    const home = (propertyId: number | null) => {
      const p = propertyId ? listing.get(propertyId) : undefined;
      return p ? titleOf(p) : null;
    };
    const daysOn = (l: ListingFact) => (l.publishedAt && l.closedAt ? Math.max(0, daysBetween(l.publishedAt, l.closedAt)) : null);
    // The leads the numbers count: new, won or lost in the range, and every open one.
    const shownLeads = leads.filter((l) => within(l.createdAt, c.cur) || within(l.wonAt, c.cur) || within(l.lostAt, c.cur) || OPEN(l));
    // The viewings they count: booked, set or cancelled in the range.
    const shownViewings = viewings.filter((v) => within(v.createdAt, c.cur) || within(v.startsAt, c.cur) || (v.status === 'cancelled' && within(v.updatedAt, c.cur)));

    return {
      kpis: [
        kpi('leads', { ar: 'عملاء محتملين جداد', en: 'New leads' }, 'int', newLeads(c.cur).length, prev((w) => newLeads(w).length), 'up'),
        kpi('won', { ar: 'اتقفلوا بيع', en: 'Won' }, 'int', won(c.cur), prev(won), 'up'),
        kpi('lost', { ar: 'ضاعوا', en: 'Lost' }, 'int', lost(c.cur), prev(lost), 'down'),
        kpi('conversion', { ar: 'التحويل (اتقفل ÷ جداد)', en: 'Conversion (won ÷ new)' }, 'pct', ratio(won(c.cur), newLeads(c.cur).length), prev((w) => ratio(won(w), newLeads(w).length)), 'up'),
        kpi('attainment', { ar: 'من الهدف في المدة دي', en: 'Of the target for this range' }, 'pct', target ? won(c.cur) / target : null, undefined, 'up'),
        kpi('booked', { ar: 'معاينات اتحجزت', en: 'Viewings booked' }, 'int', booked(c.cur).length, prev((w) => booked(w).length), 'up'),
        kpi('completed', { ar: 'معاينات اتعملت', en: 'Viewings done' }, 'int', completed(c.cur), prev(completed), 'up'),
        kpi('cancelled', { ar: 'معاينات اتلغت', en: 'Viewings cancelled' }, 'int', cancelled(c.cur), prev(cancelled), 'down'),
        kpi('deals', { ar: 'صفقات اتقفلت', en: 'Deals closed' }, 'int', closedIn(c.cur).length, prev((w) => closedIn(w).length), 'up'),
        kpi('reply', { ar: 'أول رد في الشات (الوسيط)', en: 'First chat reply (median)' }, 'minutes', reply(c.cur), prev(reply), 'down'),
        kpi('open', { ar: 'عملاء مفتوحين دلوقتي', en: 'Open leads now' }, 'int', open.length),
        kpi('stale', { ar: `واقفين ${STALE_AR} أيام+`, en: `Idle ${STALE_DAYS}+ days` }, 'int', open.filter((l) => l.lastActivityAt < staleBefore).length, undefined, 'down'),
        kpi('live', { ar: 'عقارات منشورة', en: 'Live listings' }, 'int', listings.filter((l) => l.status === 'approved').length),
      ],
      charts: [
        { kind: 'daily', key: 'leads', title: { ar: 'عملاء جداد في اليوم', en: 'New leads a day' }, format: 'int', points: perDay(newLeads(c.cur).map((l) => l.createdAt), c.cur.days) },
        {
          kind: 'bars',
          key: 'stages',
          title: { ar: 'عملاؤه المفتوحين حسب المرحلة', en: 'Their open leads by stage' },
          format: 'int',
          bars: LEAD_STAGES.filter((s) => s !== 'won' && s !== 'lost').map((s) => ({ label: LEAD_STAGE_LABEL[s], value: open.filter((l) => l.stage === s).length, colour: LEAD_STAGE_COLOUR[s] })),
        },
      ],
      tables: [
        {
          key: 'leads',
          title: { ar: 'العملاء المحتملين', en: 'Leads' },
          columns: [
            { key: 'client', label: { ar: 'العميل', en: 'Client' }, format: 'text' },
            { key: 'phone', label: { ar: 'الموبايل', en: 'Phone' }, format: 'text' },
            { key: 'home', label: { ar: 'العقار', en: 'Home' }, format: 'text' },
            { key: 'source', label: { ar: 'المصدر', en: 'Source' }, format: 'text' },
            { key: 'stage', label: { ar: 'المرحلة', en: 'Stage' }, format: 'text' },
            { key: 'created', label: { ar: 'اتسجل', en: 'Created' }, format: 'date' },
            { key: 'activity', label: { ar: 'آخر نشاط', en: 'Last activity' }, format: 'date' },
          ],
          rows: [...shownLeads]
            .sort((x, y) => y.lastActivityAt.getTime() - x.lastActivityAt.getTime())
            .map((l) => ({
              cells: { client: l.name ?? UNKNOWN, phone: l.phone, home: home(l.propertyId), source: LEAD_SOURCE_LABEL[l.source], stage: LEAD_STAGE_LABEL[l.stage], created: day(l.createdAt), activity: day(l.lastActivityAt) },
              ...(l.clientId ? { link: { kind: 'client' as const, id: l.clientId } } : {}),
            })),
          note: { ar: 'العملاء الجداد أو اللي اتقفلوا أو ضاعوا في المدة، وكل المفتوحين.', en: 'Leads that are new, won or lost in the range, and every open one.' },
        },
        {
          key: 'deals',
          title: { ar: 'الصفقات', en: 'Deals' },
          columns: [
            { key: 'closed', label: { ar: 'اتقفلت', en: 'Closed' }, format: 'date' },
            { key: 'listing', label: { ar: 'العقار', en: 'Listing' }, format: 'text' },
            { key: 'status', label: { ar: 'الحالة', en: 'Status' }, format: 'text' },
            { key: 'area', label: { ar: 'المنطقة', en: 'Area' }, format: 'text' },
            { key: 'price', label: { ar: 'سعر العرض', en: 'Asking price' }, format: 'money' },
            { key: 'days', label: { ar: 'في السوق', en: 'On the market' }, format: 'days' },
          ],
          rows: closedIn(c.cur)
            .sort((x, y) => y.closedAt!.getTime() - x.closedAt!.getTime())
            .map((l) => ({
              cells: { closed: day(l.closedAt!), listing: titleOf(l), status: PROPERTY_STATUS_LABEL[l.status], area: areaName.get(l.areaId) ?? l.areaId, price: l.price, days: daysOn(l) },
              link: { kind: 'listing' as const, id: l.id },
            })),
        },
        {
          key: 'viewings',
          title: { ar: 'المعاينات', en: 'Viewings' },
          columns: [
            { key: 'when', label: { ar: 'الميعاد', en: 'When' }, format: 'date' },
            { key: 'home', label: { ar: 'العقار', en: 'Home' }, format: 'text' },
            { key: 'status', label: { ar: 'الحالة', en: 'Status' }, format: 'text' },
            { key: 'cancelledBy', label: { ar: 'مين لغاها', en: 'Cancelled by' }, format: 'text' },
            { key: 'booked', label: { ar: 'اتحجزت', en: 'Booked' }, format: 'date' },
          ],
          rows: [...shownViewings]
            .sort((x, y) => y.startsAt.getTime() - x.startsAt.getTime())
            .map((v) => ({
              cells: {
                when: day(v.startsAt),
                home: home(v.propertyId),
                status: VIEWING_STATUS_LABEL[v.status],
                cancelledBy: v.status === 'cancelled' ? VIEWING_CANCELLER_LABEL[v.cancelledBy ?? 'unknown'] : null,
                booked: day(v.createdAt),
              },
              link: { kind: 'listing' as const, id: v.propertyId },
            })),
        },
        {
          key: 'listings',
          title: { ar: 'عقاراته', en: 'Their listings' },
          columns: [
            { key: 'listing', label: { ar: 'العقار', en: 'Listing' }, format: 'text' },
            { key: 'status', label: { ar: 'الحالة', en: 'Status' }, format: 'text' },
            { key: 'category', label: { ar: 'الغرض', en: 'Purpose' }, format: 'text' },
            { key: 'area', label: { ar: 'المنطقة', en: 'Area' }, format: 'text' },
            { key: 'price', label: { ar: 'السعر', en: 'Price' }, format: 'money' },
            { key: 'published', label: { ar: 'اتنشر', en: 'Published' }, format: 'date' },
          ],
          rows: listings.map((l) => ({
            cells: {
              listing: titleOf(l),
              status: PROPERTY_STATUS_LABEL[l.status],
              category: CATEGORY_LABEL[l.category],
              area: areaName.get(l.areaId) ?? l.areaId,
              price: l.price,
              published: l.publishedAt ? day(l.publishedAt) : null,
            },
            link: { kind: 'listing' as const, id: l.id },
          })),
        },
      ],
      notes: [
        { ar: 'الهدف للمدة = الهدف الشهري × عدد الأيام ÷ ٣٠٫٤.', en: 'Target for the range = monthly target × days ÷ 30.4.' },
        { ar: 'التحويل = اللي اتقفلوا بيع في المدة ÷ العملاء الجداد في المدة.', en: 'Conversion = leads won in the range ÷ new leads in the range.' },
        { ar: 'أول رد بيتحسب على مدار اليوم كله، مش ساعات الشغل بس.', en: 'First reply time counts every hour, not only working hours.' },
        { ar: `"واقفين" = عملاء مفتوحين محدش لمسهم من ${STALE_AR} أيام أو أكتر.`, en: `“Idle” = open leads untouched for ${STALE_DAYS} days or more.` },
      ],
    };
  }
}
