import { Injectable } from '@nestjs/common';
import { CHAT_REPORT_REASON_LABEL, CHAT_REPORT_REASONS, REPORT_OUTCOME_LABEL, type ReportRow, VIEWING_CANCELLER_LABEL, VIEWING_CANCELLERS } from '@maqar/shared';
import { firstReplies } from './chat-times.js';
import { type Built, type Ctx, bi, NO_ADVISOR, since, titleOf, UNKNOWN } from './reports.context.js';
import { ReportsRepository, type ViewingFact } from './reports.repository.js';
import { cairoClock } from '../viewings/slots.js';
import { daysBetween, kpi, median, passes, perDay, ratio, type Win, within } from './reports.util.js';

/** Egypt's week starts on Saturday. */
const WEEK = [6, 0, 1, 2, 3, 4, 5];
const ANSWERED_WITHIN_MIN = 60;

/** Operations reports (phase 27): viewings, chats and response times. */
@Injectable()
export class OpsReports {
  constructor(private readonly repo: ReportsRepository) {}

  async viewings(c: Ctx): Promise<Built> {
    const [listings, agents, viewings] = await Promise.all([this.repo.listings(), this.repo.agents(), this.repo.viewings(since(c))]);
    const listing = new Map(listings.map((l) => [l.id, l]));
    const mine = viewings.filter((v) => (c.f.agentId === undefined || v.agentId === c.f.agentId) && passes({ ...c.f, agentId: undefined }, listing.get(v.propertyId)));
    const booked = (w: Win) => mine.filter((v) => within(v.createdAt, w));
    const held = (w: Win) => mine.filter((v) => within(v.startsAt, w));
    const done = (w: Win) => held(w).filter((v) => v.status === 'completed');
    const cancelled = (w: Win) => mine.filter((v) => v.status === 'cancelled' && within(v.updatedAt, w));
    const cancelRate = (w: Win) => ratio(held(w).filter((v) => v.status === 'cancelled').length, held(w).length);
    const ahead = (w: Win) => median(booked(w).map((v) => daysBetween(v.createdAt, v.startsAt)));
    const cur = booked(c.cur);
    const canc = cancelled(c.cur);

    // Week by hour: viewings that take place in the range and were not cancelled.
    const happening = held(c.cur).filter((v) => v.status !== 'cancelled');
    const slots = happening.map((v) => {
      const { date, hour } = cairoClock(v.startsAt);
      return { weekday: new Date(`${date}T00:00:00Z`).getUTCDay(), hour };
    });
    const hoursSeen = slots.map((s) => s.hour);
    const first = Math.min(10, ...hoursSeen);
    const last = Math.max(20, ...hoursSeen);
    const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
    const values = WEEK.map((d) => hours.map((h) => slots.filter((s) => s.weekday === d && s.hour === h).length));

    const byAgent = agents
      .map((a) => {
        const of = (vs: ViewingFact[]) => vs.filter((v) => v.agentId === a.id);
        const heldHere = of(held(c.cur));
        return {
          cells: {
            advisor: bi(a),
            booked: of(cur).length,
            completed: of(done(c.cur)).length,
            cancelled: of(canc).length,
            cancelRate: ratio(heldHere.filter((v) => v.status === 'cancelled').length, heldHere.length),
            rescheduled: of(cur).filter((v) => v.rescheduled).length,
          },
          link: { kind: 'agent' as const, id: a.id },
        };
      })
      .filter((r) => r.cells.booked || r.cells.completed || r.cells.cancelled);
    const byListing = new Map<number, number>();
    for (const v of cur) byListing.set(v.propertyId, (byListing.get(v.propertyId) ?? 0) + 1);

    return {
      kpis: [
        kpi('booked', { ar: 'اتحجزت', en: 'Booked' }, 'int', cur.length, c.prev ? booked(c.prev).length : null, 'up'),
        kpi('completed', { ar: 'اتعملت', en: 'Done' }, 'int', done(c.cur).length, c.prev ? done(c.prev).length : null, 'up'),
        kpi('cancelled', { ar: 'اتلغت', en: 'Cancelled' }, 'int', canc.length, c.prev ? cancelled(c.prev).length : null, 'down'),
        kpi('cancelRate', { ar: 'نسبة الإلغاء', en: 'Cancellation rate' }, 'pct', cancelRate(c.cur), c.prev ? cancelRate(c.prev) : null, 'down'),
        kpi('ahead', { ar: 'بتتحجز قبلها بـ (الوسيط)', en: 'Booked ahead (median)' }, 'days', ahead(c.cur), c.prev ? ahead(c.prev) : null),
        kpi('rescheduled', { ar: 'اتغير ميعادها', en: 'Rescheduled' }, 'int', cur.filter((v) => v.rescheduled).length, c.prev ? booked(c.prev).filter((v) => v.rescheduled).length : null, 'down'),
      ],
      charts: [
        { kind: 'daily', key: 'perDay', title: { ar: 'معاينات اتحجزت في اليوم', en: 'Viewings booked per day' }, format: 'int', points: perDay(cur.map((v) => v.createdAt), c.cur.days) },
        {
          kind: 'bars',
          key: 'cancelledBy',
          title: { ar: 'مين لغى', en: 'Who cancelled' },
          format: 'int',
          bars: [...VIEWING_CANCELLERS, 'unknown' as const].map((who) => ({ label: VIEWING_CANCELLER_LABEL[who], value: canc.filter((v) => (v.cancelledBy ?? 'unknown') === who).length })),
        },
        { kind: 'heatmap', key: 'week', title: { ar: 'أكتر الأيام والساعات', en: 'Busiest days and hours' }, hours, weekdays: WEEK, values },
      ],
      tables: [
        {
          key: 'advisors',
          title: { ar: 'حسب المسؤول', en: 'By advisor' },
          columns: [
            { key: 'advisor', label: { ar: 'المسؤول', en: 'Advisor' }, format: 'text' },
            { key: 'booked', label: { ar: 'اتحجزت', en: 'Booked' }, format: 'int' },
            { key: 'completed', label: { ar: 'اتعملت', en: 'Done' }, format: 'int' },
            { key: 'cancelled', label: { ar: 'اتلغت', en: 'Cancelled' }, format: 'int' },
            { key: 'cancelRate', label: { ar: 'نسبة الإلغاء', en: 'Cancellation rate' }, format: 'pct' },
            { key: 'rescheduled', label: { ar: 'اتغير ميعادها', en: 'Rescheduled' }, format: 'int' },
          ],
          rows: byAgent,
        },
        {
          key: 'listings',
          title: { ar: 'أكتر العقارات معاينة', en: 'Most viewed listings' },
          columns: [
            { key: 'listing', label: { ar: 'العقار', en: 'Listing' }, format: 'text' },
            { key: 'advisor', label: { ar: 'المسؤول', en: 'Advisor' }, format: 'text' },
            { key: 'booked', label: { ar: 'معاينات اتحجزت', en: 'Viewings booked' }, format: 'int' },
          ],
          rows: [...byListing]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([id, count]): ReportRow => {
              const l = listing.get(id);
              const a = agents.find((x) => x.id === l?.agentId);
              return { cells: { listing: l ? titleOf(l) : UNKNOWN, advisor: a ? bi(a) : NO_ADVISOR, booked: count }, link: { kind: 'listing', id } };
            }),
        },
      ],
      notes: [
        { ar: 'اتحجزت: اتعملت في المدة. اتعملت ونسبة الإلغاء: ميعادها في المدة. اتلغت: اتلغت في المدة.', en: 'Booked: made in the range. Done and the cancellation rate: due in the range. Cancelled: cancelled in the range.' },
        { ar: 'مين لغى بيتسجل من وقت ما التقارير اتضافت بس.', en: 'Who cancelled is recorded only since reports were added.' },
      ],
    };
  }

  async chats(c: Ctx): Promise<Built> {
    const s = since(c);
    const [agents, listings, data, messages, waiting, reports] = await Promise.all([
      this.repo.agents(),
      this.repo.listings(),
      this.repo.threads(s),
      this.repo.messagesSince(s),
      this.repo.waiting(),
      this.repo.chatReports(s),
    ]);
    const listing = new Map(listings.map((l) => [l.id, l]));
    const agentName = new Map(agents.map((a) => [a.id, bi(a)]));
    const forAgent = <T extends { agentId: number }>(xs: T[]) => (c.f.agentId === undefined ? xs : xs.filter((x) => x.agentId === c.f.agentId));
    const threads = forAgent(data.threads);
    const started = (w: Win) => threads.filter((t) => within(t.createdAt, w));
    const sent = (w: Win) => forAgent(messages).filter((m) => within(m.createdAt, w));
    const replies = (w: Win) => forAgent(firstReplies(data.threads, data.messages, w));
    const mins = (rs: { minutes: number | null }[]) => rs.map((r) => r.minutes).filter((m): m is number => m !== null);
    const quick = (w: Win) => {
      const rs = replies(w);
      return ratio(rs.filter((r) => r.minutes !== null && r.minutes <= ANSWERED_WITHIN_MIN).length, rs.length);
    };
    const waitingNow = forAgent(waiting).filter((t) => c.now.getTime() - t.lastMessageAt.getTime() >= ANSWERED_WITHIN_MIN * 60_000);
    const reportsIn = forAgent(reports).filter((r) => within(r.createdAt, c.cur));
    const cur = replies(c.cur);

    return {
      kpis: [
        kpi('conversations', { ar: 'محادثات جديدة', en: 'New conversations' }, 'int', started(c.cur).length, c.prev ? started(c.prev).length : null, 'up'),
        kpi('messages', { ar: 'رسايل', en: 'Messages' }, 'int', sent(c.cur).length, c.prev ? sent(c.prev).length : null, 'up'),
        kpi('reply', { ar: 'أول رد (الوسيط)', en: 'First reply (median)' }, 'minutes', median(mins(cur)), c.prev ? median(mins(replies(c.prev))) : null, 'down'),
        kpi('quick', { ar: 'اترد عليها في ساعة', en: 'Answered within an hour' }, 'pct', quick(c.cur), c.prev ? quick(c.prev) : null, 'up'),
        kpi('waiting', { ar: 'مستنيين رد دلوقتي', en: 'Waiting for a reply now' }, 'int', waitingNow.length, undefined, 'down'),
        kpi('reports', { ar: 'بلاغات', en: 'Reports' }, 'int', reportsIn.length, c.prev ? forAgent(reports).filter((r) => within(r.createdAt, c.prev!)).length : null, 'down'),
      ],
      charts: [
        { kind: 'daily', key: 'perDay', title: { ar: 'محادثات جديدة في اليوم', en: 'New conversations per day' }, format: 'int', points: perDay(started(c.cur).map((t) => t.createdAt), c.cur.days) },
        { kind: 'bars', key: 'reasons', title: { ar: 'البلاغات حسب السبب', en: 'Reports by reason' }, format: 'int', bars: CHAT_REPORT_REASONS.map((r) => ({ label: CHAT_REPORT_REASON_LABEL[r], value: reportsIn.filter((x) => x.reason === r).length })) },
        {
          kind: 'bars',
          key: 'outcomes',
          title: { ar: 'البلاغات اتقفلت إزاي', en: 'How reports were closed' },
          format: 'int',
          bars: (['open', 'dismissed', 'blocked', 'suspended'] as const).map((o) => ({ label: REPORT_OUTCOME_LABEL[o], value: reportsIn.filter((x) => (x.outcome ?? 'open') === o).length })),
        },
      ],
      tables: [
        {
          key: 'advisors',
          title: { ar: 'حسب المسؤول', en: 'By advisor' },
          columns: [
            { key: 'advisor', label: { ar: 'المسؤول', en: 'Advisor' }, format: 'text' },
            { key: 'conversations', label: { ar: 'محادثات جديدة', en: 'New conversations' }, format: 'int' },
            { key: 'messages', label: { ar: 'رسايله', en: 'Their messages' }, format: 'int' },
            { key: 'reply', label: { ar: 'أول رد (الوسيط)', en: 'First reply (median)' }, format: 'minutes' },
            { key: 'quick', label: { ar: 'في ساعة', en: 'Within an hour' }, format: 'pct' },
            { key: 'unanswered', label: { ar: 'لسه مارد', en: 'Not answered yet' }, format: 'int' },
            { key: 'waiting', label: { ar: 'مستنيين رد', en: 'Waiting now' }, format: 'int' },
          ],
          rows: agents
            .filter((a) => c.f.agentId === undefined || a.id === c.f.agentId)
            .map((a) => {
              const rs = cur.filter((r) => r.agentId === a.id);
              return {
                cells: {
                  advisor: bi(a),
                  conversations: started(c.cur).filter((t) => t.agentId === a.id).length,
                  messages: sent(c.cur).filter((m) => m.agentId === a.id && m.sender === 'agent').length,
                  reply: median(mins(rs)),
                  quick: ratio(rs.filter((r) => r.minutes !== null && r.minutes <= ANSWERED_WITHIN_MIN).length, rs.length),
                  unanswered: rs.filter((r) => r.minutes === null).length,
                  waiting: waitingNow.filter((t) => t.agentId === a.id).length,
                },
                link: { kind: 'agent' as const, id: a.id },
              };
            })
            .filter((r) => r.cells.conversations || r.cells.messages || r.cells.waiting),
        },
        {
          key: 'waiting',
          title: { ar: 'مستنيين رد من ساعة أو أكتر', en: 'Waiting an hour or more for a reply' },
          columns: [
            { key: 'client', label: { ar: 'العميل', en: 'Client' }, format: 'text' },
            { key: 'listing', label: { ar: 'العقار', en: 'Listing' }, format: 'text' },
            { key: 'advisor', label: { ar: 'المسؤول', en: 'Advisor' }, format: 'text' },
            { key: 'since', label: { ar: 'من', en: 'Since' }, format: 'date' },
            { key: 'waiting', label: { ar: 'مستني من', en: 'Waiting for' }, format: 'minutes' },
          ],
          rows: [...waitingNow]
            .sort((a, b) => a.lastMessageAt.getTime() - b.lastMessageAt.getTime())
            .map((t): ReportRow => {
              const l = listing.get(t.propertyId);
              return {
                cells: {
                  client: t.clientName,
                  listing: l ? titleOf(l) : UNKNOWN,
                  advisor: agentName.get(t.agentId) ?? NO_ADVISOR,
                  since: t.lastMessageAt.toISOString().slice(0, 10),
                  waiting: (c.now.getTime() - t.lastMessageAt.getTime()) / 60_000,
                },
                link: { kind: 'chat', id: t.id },
              };
            }),
        },
      ],
      notes: [
        { ar: 'أول رد: من أول رسالة للعميل لحد أول رد من المسؤول، في المحادثات اللي بدأت في المدة. بيتحسب على مدار اليوم كله.', en: 'First reply: from the client’s first message to the advisor’s first answer, in conversations started in the range. Every hour counts.' },
        { ar: 'المستنيين: محادثات مفتوحة آخر رسالة فيها من العميل.', en: 'Waiting: open conversations whose last message is the client’s.' },
      ],
    };
  }
}
