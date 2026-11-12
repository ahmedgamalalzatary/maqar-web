import { Injectable } from '@nestjs/common';
import { type Bi, localDigits, LEAD_SOURCE_LABEL, LEAD_SOURCES, LEAD_STAGE_COLOUR, LEAD_STAGE_LABEL, LEAD_STAGES, CATEGORY_LABEL, PROPERTY_STATUS_LABEL, type ReportRow } from '@maqar/shared';
import { firstReplies } from './chat-times.js';
import { type Built, type Ctx, bi, NO_ADVISOR, since, titleOf } from './reports.context.js';
import { type LeadFact, type ListingFact, ReportsRepository } from './reports.repository.js';
import { average, countBy, daysBetween, type Filters, kpi, median, passes, perDay, ratio, type Win, within } from './reports.util.js';

const OPEN = (l: LeadFact) => l.stage !== 'won' && l.stage !== 'lost';
const STALE_DAYS = 7;
const STALE_AR = localDigits(String(STALE_DAYS), 'ar');

/** A lead passes the filters by its advisor and, for area and category, by its home. */
function leadPasses(f: Filters, l: LeadFact, listing: Map<number, ListingFact>): boolean {
  if (f.agentId !== undefined && l.agentId !== f.agentId) return false;
  if (f.areaId === undefined && f.category === undefined) return true;
  const p = l.propertyId ? listing.get(l.propertyId) : undefined;
  return !!p && (f.areaId === undefined || p.areaId === f.areaId) && (f.category === undefined || p.category === f.category);
}

/** Sales reports (phase 27): closed deals, advisor performance, leads and sources. */
@Injectable()
export class SalesReports {
  constructor(private readonly repo: ReportsRepository) {}

  async deals(c: Ctx): Promise<Built> {
    const [listings, agents, areas, leads] = await Promise.all([this.repo.listings(), this.repo.agents(), this.repo.areas(), this.repo.leads(since(c))]);
    const listing = new Map(listings.map((l) => [l.id, l]));
    const agentName = new Map(agents.map((a) => [a.id, bi(a)]));
    const areaName = new Map(areas.map((a) => [a.id, bi(a)]));
    const closedIn = (w: Win) => listings.filter((l) => (l.status === 'sold' || l.status === 'rented') && within(l.closedAt, w) && passes(c.f, l));
    const daysOn = (l: ListingFact) => (l.publishedAt && l.closedAt ? Math.max(0, daysBetween(l.publishedAt, l.closedAt)) : null);
    const soldValue = (ls: ListingFact[]) => ls.filter((l) => l.status === 'sold').reduce((a, l) => a + l.price, 0);
    const rentValue = (ls: ListingFact[]) => ls.filter((l) => l.status === 'rented' && l.category === 'rent').reduce((a, l) => a + l.price, 0);
    const avgDays = (ls: ListingFact[]) => average(ls.map(daysOn).filter((d): d is number => d !== null));
    const won = (w: Win) => leads.filter((l) => within(l.wonAt, w) && leadPasses(c.f, l, listing)).length;
    const cur = closedIn(c.cur);
    const prev = c.prev ? closedIn(c.prev) : [];

    const byAgent = new Map<number | null, ListingFact[]>();
    for (const l of cur) byAgent.set(l.agentId, [...(byAgent.get(l.agentId) ?? []), l]);
    const byArea = countBy(
      areas.map((a) => a.id),
      cur.map((l) => l.areaId),
    );
    const name = (id: number | null): Bi => (id === null ? NO_ADVISOR : (agentName.get(id) ?? NO_ADVISOR));

    return {
      kpis: [
        kpi('deals', { ar: 'صفقات اتقفلت', en: 'Deals closed' }, 'int', cur.length, prev.length, 'up'),
        kpi('sold', { ar: 'قيمة المبيعات (سعر العرض)', en: 'Sold (asking prices)' }, 'money', soldValue(cur), soldValue(prev), 'up'),
        kpi('rented', { ar: 'الإيجارات (شهري، سعر العرض)', en: 'Rented (monthly asking)' }, 'money', rentValue(cur), rentValue(prev), 'up'),
        kpi('daysOnMarket', { ar: 'متوسط الأيام في السوق', en: 'Average days on the market' }, 'days', avgDays(cur), avgDays(prev), 'down'),
        kpi('leadsWon', { ar: 'عملاء اتقفلوا بيع', en: 'Leads won' }, 'int', won(c.cur), c.prev ? won(c.prev) : null, 'up'),
      ],
      charts: [
        {
          kind: 'bars',
          key: 'byAdvisor',
          title: { ar: 'الصفقات حسب المسؤول', en: 'Deals by advisor' },
          format: 'int',
          bars: [...byAgent].map(([id, ls]) => ({ label: name(id), value: ls.length, colour: agents.find((a) => a.id === id)?.colour })).sort((a, b) => b.value - a.value),
        },
        {
          kind: 'bars',
          key: 'byArea',
          title: { ar: 'الصفقات حسب المنطقة', en: 'Deals by area' },
          format: 'int',
          bars: [...byArea].filter(([, v]) => v > 0).map(([id, value]) => ({ label: areaName.get(id)!, value })).sort((a, b) => b.value - a.value),
        },
      ],
      tables: [
        {
          key: 'deals',
          title: { ar: 'الصفقات', en: 'Deals' },
          columns: [
            { key: 'closed', label: { ar: 'اتقفلت', en: 'Closed' }, format: 'date' },
            { key: 'listing', label: { ar: 'العقار', en: 'Listing' }, format: 'text' },
            { key: 'status', label: { ar: 'الحالة', en: 'Status' }, format: 'text' },
            { key: 'category', label: { ar: 'الغرض', en: 'Purpose' }, format: 'text' },
            { key: 'area', label: { ar: 'المنطقة', en: 'Area' }, format: 'text' },
            { key: 'advisor', label: { ar: 'المسؤول', en: 'Advisor' }, format: 'text' },
            { key: 'price', label: { ar: 'سعر العرض', en: 'Asking price' }, format: 'money' },
            { key: 'days', label: { ar: 'في السوق', en: 'On the market' }, format: 'days' },
          ],
          rows: [...cur]
            .sort((a, b) => b.closedAt!.getTime() - a.closedAt!.getTime())
            .map((l) => ({
              cells: {
                closed: l.closedAt!.toISOString().slice(0, 10),
                listing: titleOf(l),
                status: PROPERTY_STATUS_LABEL[l.status],
                category: CATEGORY_LABEL[l.category],
                area: areaName.get(l.areaId) ?? l.areaId,
                advisor: name(l.agentId),
                price: l.price,
                days: daysOn(l),
              },
              link: { kind: 'listing', id: l.id },
            })),
        },
        {
          key: 'advisors',
          title: { ar: 'حسب المسؤول', en: 'By advisor' },
          columns: [
            { key: 'advisor', label: { ar: 'المسؤول', en: 'Advisor' }, format: 'text' },
            { key: 'deals', label: { ar: 'الصفقات', en: 'Deals' }, format: 'int' },
            { key: 'sold', label: { ar: 'المبيعات', en: 'Sold' }, format: 'money' },
            { key: 'rented', label: { ar: 'الإيجارات الشهرية', en: 'Monthly rents' }, format: 'money' },
            { key: 'days', label: { ar: 'متوسط الأيام في السوق', en: 'Average days on the market' }, format: 'days' },
          ],
          rows: [...byAgent]
            .sort((a, b) => b[1].length - a[1].length)
            .map(([id, ls]): ReportRow => ({
              cells: { advisor: name(id), deals: ls.length, sold: soldValue(ls), rented: rentValue(ls), days: avgDays(ls) },
              ...(id === null ? {} : { link: { kind: 'agent' as const, id } }),
            })),
        },
      ],
      notes: [
        { ar: 'السعر هو سعر العرض وقت القفل، مش السعر اللي اتفق عليه.', en: 'Prices are the asking price at closing, not the agreed price.' },
        { ar: 'العقارات اللي اتقفلت قبل ما نسجل تاريخ القفل مش محسوبة.', en: 'Listings closed before close dates were recorded are not counted.' },
      ],
    };
  }

  async advisors(c: Ctx): Promise<Built> {
    const [agents, listings, leads, viewings, chats] = await Promise.all([
      this.repo.agents(),
      this.repo.listings(),
      this.repo.leads(since(c)),
      this.repo.viewings(since(c)),
      this.repo.threads(since(c)),
    ]);
    const staleBefore = new Date(c.now.getTime() - STALE_DAYS * 86_400_000);
    const replies = (w: Win) => firstReplies(chats.threads, chats.messages, w);
    const curReplies = replies(c.cur);
    const prevReplies = c.prev ? replies(c.prev) : [];
    const minutes = (rs: { minutes: number | null }[]) => rs.map((r) => r.minutes).filter((m): m is number => m !== null);
    const months = c.cur.days.length / 30.4;

    const rows = agents.map((a) => {
      const mine = <T extends { agentId: number | null }>(xs: T[]) => xs.filter((x) => x.agentId === a.id);
      const newLeads = mine(leads).filter((l) => within(l.createdAt, c.cur));
      const won = mine(leads).filter((l) => within(l.wonAt, c.cur)).length;
      const open = mine(leads).filter(OPEN);
      const target = a.monthlyTarget ? Math.round(a.monthlyTarget * months * 10) / 10 : null;
      const reply = median(minutes(mine(curReplies)));
      return {
        a,
        cells: {
          advisor: bi(a),
          live: mine(listings).filter((l) => l.status === 'approved').length,
          leads: newLeads.length,
          contacted: ratio(newLeads.filter((l) => l.stage !== 'new').length, newLeads.length),
          booked: mine(viewings).filter((v) => within(v.createdAt, c.cur)).length,
          completed: mine(viewings).filter((v) => v.status === 'completed' && within(v.startsAt, c.cur)).length,
          cancelled: mine(viewings).filter((v) => v.status === 'cancelled' && within(v.updatedAt, c.cur)).length,
          won,
          lost: mine(leads).filter((l) => within(l.lostAt, c.cur)).length,
          conversion: ratio(won, newLeads.length),
          target,
          attainment: target ? won / target : null,
          reply,
          open: open.length,
          stale: open.filter((l) => l.lastActivityAt < staleBefore).length,
        },
      };
    });
    const shown = rows.filter((r) => r.a.active || Object.entries(r.cells).some(([k, v]) => k !== 'advisor' && k !== 'target' && typeof v === 'number' && v > 0));
    const sumOf = (key: 'leads' | 'won' | 'booked' | 'stale') => shown.reduce((s, r) => s + (r.cells[key] as number), 0);
    const leadsIn = (w: Win) => leads.filter((l) => within(l.createdAt, w)).length;
    const wonIn = (w: Win) => leads.filter((l) => within(l.wonAt, w)).length;

    return {
      kpis: [
        kpi('leads', { ar: 'عملاء محتملين جداد', en: 'New leads' }, 'int', leadsIn(c.cur), c.prev ? leadsIn(c.prev) : null, 'up'),
        kpi('won', { ar: 'اتقفلوا بيع', en: 'Won' }, 'int', wonIn(c.cur), c.prev ? wonIn(c.prev) : null, 'up'),
        kpi('conversion', { ar: 'التحويل (اتقفل ÷ جداد)', en: 'Conversion (won ÷ new)' }, 'pct', ratio(wonIn(c.cur), leadsIn(c.cur)), c.prev ? ratio(wonIn(c.prev), leadsIn(c.prev)) : null, 'up'),
        kpi('reply', { ar: 'أول رد في الشات (الوسيط)', en: 'First chat reply (median)' }, 'minutes', median(minutes(curReplies)), c.prev ? median(minutes(prevReplies)) : null, 'down'),
        kpi('stale', { ar: `عملاء مفتوحين واقفين ${STALE_AR} أيام+`, en: `Open leads idle ${STALE_DAYS}+ days` }, 'int', sumOf('stale'), undefined, 'down'),
      ],
      charts: [
        { kind: 'bars', key: 'won', title: { ar: 'اتقفل بيع حسب المسؤول', en: 'Won by advisor' }, format: 'int', bars: shown.map((r) => ({ label: bi(r.a), value: r.cells.won, colour: r.a.colour })) },
        {
          kind: 'bars',
          key: 'attainment',
          title: { ar: 'من الهدف في المدة دي', en: 'Of the target for this range' },
          format: 'pct',
          bars: shown.filter((r) => r.cells.attainment !== null).map((r) => ({ label: bi(r.a), value: r.cells.attainment!, colour: r.a.colour })),
        },
      ],
      tables: [
        {
          key: 'advisors',
          title: { ar: 'المسؤولين', en: 'Advisors' },
          columns: [
            { key: 'advisor', label: { ar: 'المسؤول', en: 'Advisor' }, format: 'text' },
            { key: 'live', label: { ar: 'عقارات منشورة', en: 'Live listings' }, format: 'int' },
            { key: 'leads', label: { ar: 'عملاء جداد', en: 'New leads' }, format: 'int' },
            { key: 'contacted', label: { ar: 'اتكلم معاهم', en: 'Contacted' }, format: 'pct' },
            { key: 'booked', label: { ar: 'معاينات اتحجزت', en: 'Viewings booked' }, format: 'int' },
            { key: 'completed', label: { ar: 'معاينات اتعملت', en: 'Viewings done' }, format: 'int' },
            { key: 'cancelled', label: { ar: 'معاينات اتلغت', en: 'Viewings cancelled' }, format: 'int' },
            { key: 'won', label: { ar: 'اتقفل بيع', en: 'Won' }, format: 'int' },
            { key: 'lost', label: { ar: 'ضاع', en: 'Lost' }, format: 'int' },
            { key: 'conversion', label: { ar: 'التحويل', en: 'Conversion' }, format: 'pct' },
            { key: 'target', label: { ar: 'الهدف للمدة', en: 'Target for the range' }, format: 'decimal' },
            { key: 'attainment', label: { ar: 'من الهدف', en: 'Of target' }, format: 'pct' },
            { key: 'reply', label: { ar: 'أول رد (الوسيط)', en: 'First reply (median)' }, format: 'minutes' },
            { key: 'open', label: { ar: 'مفتوحين دلوقتي', en: 'Open now' }, format: 'int' },
            { key: 'stale', label: { ar: 'واقفين', en: 'Idle' }, format: 'int' },
          ],
          rows: shown.map((r) => ({ cells: r.cells, link: { kind: 'agent', id: r.a.id } })),
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

  async leads(c: Ctx): Promise<Built> {
    const [listings, agents, leads] = await Promise.all([this.repo.listings(), this.repo.agents(), this.repo.leads(since(c))]);
    const listing = new Map(listings.map((l) => [l.id, l]));
    const agentName = new Map(agents.map((a) => [a.id, bi(a)]));
    const mine = leads.filter((l) => leadPasses(c.f, l, listing));
    const made = (w: Win) => mine.filter((l) => within(l.createdAt, w));
    const wonIn = (w: Win) => mine.filter((l) => within(l.wonAt, w));
    const lostIn = (w: Win) => mine.filter((l) => within(l.lostAt, w));
    const daysToWin = (w: Win) => median(wonIn(w).map((l) => daysBetween(l.createdAt, l.wonAt!)));
    const cur = made(c.cur);
    const staleBefore = new Date(c.now.getTime() - STALE_DAYS * 86_400_000);
    const stale = mine.filter((l) => OPEN(l) && l.lastActivityAt < staleBefore).sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime());
    const stages = countBy(
      LEAD_STAGES,
      cur.map((l) => l.stage),
    );
    const sources = LEAD_SOURCES.map((s) => {
      const ls = cur.filter((l) => l.source === s);
      const won = ls.filter((l) => l.stage === 'won').length;
      return {
        source: s,
        cells: {
          source: LEAD_SOURCE_LABEL[s],
          leads: ls.length,
          movedOn: ls.filter((l) => l.stage !== 'new').length,
          viewing: ls.filter((l) => l.stage === 'viewing' || l.stage === 'negotiation' || l.stage === 'won').length,
          won,
          lost: ls.filter((l) => l.stage === 'lost').length,
          conversion: ratio(won, ls.length),
        },
      };
    }).filter((r) => r.cells.leads > 0);

    return {
      kpis: [
        kpi('leads', { ar: 'عملاء محتملين جداد', en: 'New leads' }, 'int', cur.length, c.prev ? made(c.prev).length : null, 'up'),
        kpi('won', { ar: 'اتقفلوا بيع', en: 'Won' }, 'int', wonIn(c.cur).length, c.prev ? wonIn(c.prev).length : null, 'up'),
        kpi('lost', { ar: 'ضاعوا', en: 'Lost' }, 'int', lostIn(c.cur).length, c.prev ? lostIn(c.prev).length : null, 'down'),
        kpi('hot', { ar: 'نسبة المهتمين جدًا', en: 'Share marked hot' }, 'pct', ratio(cur.filter((l) => l.hot).length, cur.length), c.prev ? ratio(made(c.prev).filter((l) => l.hot).length, made(c.prev).length) : null, 'up'),
        kpi('daysToWin', { ar: 'أيام لحد القفل (الوسيط)', en: 'Days to win (median)' }, 'decimal', daysToWin(c.cur), c.prev ? daysToWin(c.prev) : null, 'down'),
      ],
      charts: [
        { kind: 'daily', key: 'perDay', title: { ar: 'عملاء جداد في اليوم', en: 'New leads per day' }, format: 'int', points: perDay(cur.map((l) => l.createdAt), c.cur.days) },
        { kind: 'bars', key: 'sources', title: { ar: 'جايين منين', en: 'Where they came from' }, format: 'int', bars: sources.map((s) => ({ label: s.cells.source, value: s.cells.leads })).sort((a, b) => b.value - a.value) },
        {
          kind: 'bars',
          key: 'stages',
          title: { ar: 'وصلوا لفين دلوقتي', en: 'Where they are now' },
          format: 'int',
          bars: LEAD_STAGES.map((s) => ({ label: LEAD_STAGE_LABEL[s], value: stages.get(s)!, colour: LEAD_STAGE_COLOUR[s] })),
        },
      ],
      tables: [
        {
          key: 'sources',
          title: { ar: 'حسب المصدر', en: 'By source' },
          columns: [
            { key: 'source', label: { ar: 'المصدر', en: 'Source' }, format: 'text' },
            { key: 'leads', label: { ar: 'عملاء', en: 'Leads' }, format: 'int' },
            { key: 'movedOn', label: { ar: 'اتكلم معاهم', en: 'Contacted' }, format: 'int' },
            { key: 'viewing', label: { ar: 'وصلوا لمعاينة', en: 'Reached a viewing' }, format: 'int' },
            { key: 'won', label: { ar: 'اتقفلوا بيع', en: 'Won' }, format: 'int' },
            { key: 'lost', label: { ar: 'ضاعوا', en: 'Lost' }, format: 'int' },
            { key: 'conversion', label: { ar: 'التحويل', en: 'Conversion' }, format: 'pct' },
          ],
          rows: sources.map((s) => ({ cells: s.cells })),
        },
        {
          key: 'stale',
          title: { ar: `عملاء مفتوحين محدش لمسهم من ${STALE_AR} أيام+`, en: `Open leads untouched for ${STALE_DAYS}+ days` },
          columns: [
            { key: 'name', label: { ar: 'العميل', en: 'Client' }, format: 'text' },
            { key: 'phone', label: { ar: 'الموبايل', en: 'Phone' }, format: 'text' },
            { key: 'listing', label: { ar: 'العقار', en: 'Listing' }, format: 'text' },
            { key: 'advisor', label: { ar: 'المسؤول', en: 'Advisor' }, format: 'text' },
            { key: 'stage', label: { ar: 'المرحلة', en: 'Stage' }, format: 'text' },
            { key: 'last', label: { ar: 'آخر نشاط', en: 'Last activity' }, format: 'date' },
            { key: 'idle', label: { ar: 'واقف من', en: 'Idle for' }, format: 'days' },
          ],
          rows: stale.map((l): ReportRow => {
            const p = l.propertyId ? listing.get(l.propertyId) : undefined;
            return {
              cells: {
                name: l.name,
                phone: l.phone,
                listing: p ? titleOf(p) : null,
                advisor: agentName.get(l.agentId) ?? NO_ADVISOR,
                stage: LEAD_STAGE_LABEL[l.stage],
                last: l.lastActivityAt.toISOString().slice(0, 10),
                idle: Math.floor(daysBetween(l.lastActivityAt, c.now)),
              },
              ...(l.clientId ? { link: { kind: 'client' as const, id: l.clientId } } : {}),
            };
          }),
        },
      ],
      notes: [
        { ar: 'المصدر والمرحلة للعملاء اللي اتعملوا في المدة، بمرحلتهم دلوقتي.', en: 'Sources and stages are for leads made in the range, at their stage now.' },
        { ar: 'تاريخ الضياع بيتسجل من وقت ما التقارير اتضافت بس.', en: 'Lost dates are recorded only since reports were added.' },
      ],
    };
  }
}
