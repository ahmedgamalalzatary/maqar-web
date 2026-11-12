import { Injectable } from '@nestjs/common';
import { type Bi, type Category, LANGS, PUSH_PLATFORMS, type ReportRow } from '@maqar/shared';
import { type Built, type Ctx, bi, since, sinceDay } from './reports.context.js';
import { ReportsRepository } from './reports.repository.js';
import { bandOf, dayWithin, kpi, median, perDay, PRICE_BANDS, ratio, type Win, within } from './reports.util.js';

const LANG_LABEL: Record<(typeof LANGS)[number], Bi> = { ar: { ar: 'عربي', en: 'Arabic' }, en: { ar: 'إنجليزي', en: 'English' } };
const PLATFORM_LABEL: Record<(typeof PUSH_PLATFORMS)[number], Bi> = { ios: { ar: 'آيفون', en: 'iPhone' }, android: { ar: 'أندرويد', en: 'Android' } };

/** Client and demand reports (phase 27): clients and engagement, demand by area. */
@Injectable()
export class PeopleReports {
  constructor(private readonly repo: ReportsRepository) {}

  async clients(c: Ctx): Promise<Built> {
    const s = since(c);
    const [clients, saves, alerts, messages, viewings, prefs, platforms] = await Promise.all([
      this.repo.clients(),
      this.repo.favoritesSince(s),
      this.repo.alertsSince(s),
      this.repo.messagesSince(s),
      this.repo.viewings(s),
      this.repo.prefs(),
      this.repo.pushPlatforms(),
    ]);
    const clientIds = new Set(clients.map((x) => x.id));
    const signUps = (w: Win) => clients.filter((x) => within(x.createdAt, w));
    const did = (w: Win) => {
      const of = <T>(xs: T[], at: (x: T) => Date, who: (x: T) => number) => new Set(xs.filter((x) => within(at(x), w)).map(who).filter((id) => clientIds.has(id)));
      return {
        saved: of(saves, (x) => x.createdAt, (x) => x.userId),
        followed: of(alerts, (x) => x.createdAt, (x) => x.userId),
        chatted: of(
          messages.filter((m) => m.sender === 'client'),
          (x) => x.createdAt,
          (x) => x.clientId,
        ),
        booked: of(viewings, (x) => x.createdAt, (x) => x.clientId),
      };
    };
    const active = (w: Win) => {
      const d = did(w);
      return new Set([...d.saved, ...d.followed, ...d.chatted, ...d.booked]);
    };
    const now = did(c.cur);
    const activeNow = active(c.cur);
    const existing = clients.filter((x) => !x.deletedAt);
    const deleted = (w: Win) => clients.filter((x) => within(x.deletedAt, w)).length;
    const withPhone = new Map<number, Set<string>>();
    for (const p of platforms) if (clientIds.has(p.userId)) withPhone.set(p.userId, (withPhone.get(p.userId) ?? new Set()).add(p.platform));
    const prefSet = new Set(prefs.map((p) => p.userId));

    // The most active clients in the range: how much of each they did.
    const score = new Map<number, { saves: number; messages: number; viewings: number; last: Date }>();
    const bump = (id: number, key: 'saves' | 'messages' | 'viewings', at: Date) => {
      if (!clientIds.has(id) || !within(at, c.cur)) return;
      const cur = score.get(id) ?? { saves: 0, messages: 0, viewings: 0, last: at };
      cur[key] += 1;
      if (at > cur.last) cur.last = at;
      score.set(id, cur);
    };
    for (const x of saves) bump(x.userId, 'saves', x.createdAt);
    for (const m of messages) if (m.sender === 'client') bump(m.clientId, 'messages', m.createdAt);
    for (const v of viewings) bump(v.clientId, 'viewings', v.createdAt);
    const byId = new Map(clients.map((x) => [x.id, x]));
    const top = [...score]
      .map(([id, s]) => ({ id, s, total: s.saves + s.messages + s.viewings * 3 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 50);

    return {
      kpis: [
        kpi('signUps', { ar: 'تسجيلات جديدة', en: 'Sign-ups' }, 'int', signUps(c.cur).length, c.prev ? signUps(c.prev).length : null, 'up'),
        kpi('active', { ar: 'عملاء نشطين', en: 'Active clients' }, 'int', activeNow.size, c.prev ? active(c.prev).size : null, 'up'),
        kpi('total', { ar: 'كل العملاء دلوقتي', en: 'All clients now' }, 'int', existing.length),
        kpi('prefs', { ar: 'حددوا تفضيلاتهم', en: 'Have set preferences' }, 'pct', ratio(existing.filter((x) => prefSet.has(x.id)).length, existing.length)),
        kpi('deleted', { ar: 'حسابات اتمسحت', en: 'Accounts deleted' }, 'int', deleted(c.cur), c.prev ? deleted(c.prev) : null, 'down'),
        kpi('suspended', { ar: 'موقوفين دلوقتي', en: 'Suspended now' }, 'int', existing.filter((x) => x.suspendedAt).length),
      ],
      charts: [
        { kind: 'daily', key: 'signUps', title: { ar: 'تسجيلات في اليوم', en: 'Sign-ups per day' }, format: 'int', points: perDay(signUps(c.cur).map((x) => x.createdAt), c.cur.days) },
        {
          kind: 'bars',
          key: 'did',
          title: { ar: 'العملاء النشطين عملوا إيه', en: 'What active clients did' },
          format: 'int',
          bars: [
            { label: { ar: 'حفظوا عقار', en: 'Saved a home' }, value: now.saved.size },
            { label: { ar: 'تابعوا سعر', en: 'Followed a price' }, value: now.followed.size },
            { label: { ar: 'كلموا مسؤول', en: 'Messaged an advisor' }, value: now.chatted.size },
            { label: { ar: 'حجزوا معاينة', en: 'Booked a viewing' }, value: now.booked.size },
          ],
        },
        {
          kind: 'bars',
          key: 'platforms',
          title: { ar: 'الموبايلات (اللي شغلوا الإشعارات)', en: 'Phones (with notifications on)' },
          format: 'int',
          bars: PUSH_PLATFORMS.map((p) => ({ label: PLATFORM_LABEL[p], value: [...withPhone.values()].filter((set) => set.has(p)).length })),
        },
        { kind: 'bars', key: 'langs', title: { ar: 'لغة التطبيق', en: 'App language' }, format: 'int', bars: LANGS.map((l) => ({ label: LANG_LABEL[l], value: existing.filter((x) => x.lang === l).length })) },
      ],
      tables: [
        {
          key: 'top',
          title: { ar: 'أنشط العملاء في المدة', en: 'Most active clients in the range' },
          columns: [
            { key: 'name', label: { ar: 'العميل', en: 'Client' }, format: 'text' },
            { key: 'phone', label: { ar: 'الموبايل', en: 'Phone' }, format: 'text' },
            { key: 'email', label: { ar: 'الإيميل', en: 'Email' }, format: 'text' },
            { key: 'saves', label: { ar: 'حفظ', en: 'Saves' }, format: 'int' },
            { key: 'messages', label: { ar: 'رسايل', en: 'Messages' }, format: 'int' },
            { key: 'viewings', label: { ar: 'معاينات', en: 'Viewings' }, format: 'int' },
            { key: 'last', label: { ar: 'آخر نشاط', en: 'Last active' }, format: 'date' },
          ],
          rows: top.map(({ id, s }): ReportRow => {
            const x = byId.get(id)!;
            return {
              cells: { name: x.deletedAt ? { ar: 'حساب اتمسح', en: 'Deleted account' } : x.name, phone: x.deletedAt ? null : x.phone, email: x.deletedAt ? null : x.email, ...s, last: s.last.toISOString().slice(0, 10) },
              ...(x.deletedAt ? {} : { link: { kind: 'client' as const, id } }),
            };
          }),
        },
      ],
      notes: [
        { ar: 'العميل النشط حفظ عقار أو تابع سعر أو بعت رسالة أو حجز معاينة في المدة.', en: 'An active client saved a home, followed a price, sent a message or booked a viewing in the range.' },
        { ar: 'الموبايلات بتتعد من اللي شغلوا الإشعارات بس.', en: 'Phones are counted only for clients who turned notifications on.' },
      ],
    };
  }

  async areas(c: Ctx): Promise<Built> {
    const s = since(c);
    const [areas, listings, stats, leads, viewings, prefs] = await Promise.all([
      this.repo.areas(),
      this.repo.listings(),
      this.repo.stats(sinceDay(c)),
      this.repo.leads(s),
      this.repo.viewings(s),
      this.repo.prefs(),
    ]);
    const cat = c.f.category;
    const listing = new Map(listings.map((l) => [l.id, l]));
    const fits = (id: number | null) => {
      const l = id ? listing.get(id) : undefined;
      return l && (cat === undefined || l.category === cat) ? l : undefined;
    };
    const wants = (purposes: Category[]) => cat === undefined || purposes.includes(cat) || (cat === 'project' && purposes.includes('sale'));
    const per = (w: Win) => {
      const m = new Map(areas.map((a) => [a.id, { views: 0, saves: 0, leads: 0, viewings: 0, deals: 0 }]));
      for (const st of stats) {
        const l = fits(st.propertyId);
        if (l && dayWithin(st.day, w)) {
          m.get(l.areaId)!.views += st.views;
          m.get(l.areaId)!.saves += st.saves;
        }
      }
      for (const x of leads) {
        const l = fits(x.propertyId);
        if (l && within(x.createdAt, w)) m.get(l.areaId)!.leads += 1;
      }
      for (const v of viewings) {
        const l = fits(v.propertyId);
        if (l && within(v.createdAt, w)) m.get(l.areaId)!.viewings += 1;
      }
      for (const l of listings) if ((cat === undefined || l.category === cat) && (l.status === 'sold' || l.status === 'rented') && within(l.closedAt, w)) m.get(l.areaId)!.deals += 1;
      return m;
    };
    const cur = per(c.cur);
    const prev = c.prev ? per(c.prev) : null;
    const total = (m: Map<string, Record<string, number>>, k: string) => [...m.values()].reduce((a, v) => a + v[k]!, 0);
    const live = (areaId: string) => listings.filter((l) => l.status === 'approved' && l.areaId === areaId && (cat === undefined || l.category === cat)).length;
    const wanting = (areaId: string) => prefs.filter((p) => p.areaIds.includes(areaId) && wants(p.purposes));
    const rows = areas
      .map((a) => {
        const v = cur.get(a.id)!;
        const supply = live(a.id);
        const fans = wanting(a.id);
        return {
          cells: {
            area: bi(a),
            live: supply,
            views: v.views,
            saves: v.saves,
            leads: v.leads,
            viewings: v.viewings,
            deals: v.deals,
            wanting: fans.length,
            budget: median(fans.map((p) => p.budgetMax)),
            leadsPerLive: ratio(v.leads, supply),
          },
        };
      })
      .filter((r) => Object.values(r.cells).some((x) => typeof x === 'number' && x > 0))
      .sort((a, b) => b.cells.leads - a.cells.leads || b.cells.views - a.cells.views);
    // Budgets of clients by what they want: buyers and tenants pay on different scales.
    const budgets = (['sale', 'rent'] as const).flatMap((purpose) =>
      PRICE_BANDS[purpose].map((band, i) => ({
        cells: {
          purpose: purpose === 'sale' ? { ar: 'شراء', en: 'Buying' } : { ar: 'إيجار', en: 'Renting' },
          band: band.label,
          clients: prefs.filter((p) => p.purposes.includes(purpose) && bandOf(purpose, p.budgetMax) === i).length,
        },
      })),
    );

    return {
      kpis: [
        kpi('live', { ar: 'عقارات منشورة', en: 'Live listings' }, 'int', areas.reduce((a, x) => a + live(x.id), 0)),
        kpi('views', { ar: 'مشاهدات', en: 'Views' }, 'int', total(cur, 'views'), prev ? total(prev, 'views') : null, 'up'),
        kpi('leads', { ar: 'عملاء محتملين', en: 'Leads' }, 'int', total(cur, 'leads'), prev ? total(prev, 'leads') : null, 'up'),
        kpi('viewings', { ar: 'معاينات اتحجزت', en: 'Viewings booked' }, 'int', total(cur, 'viewings'), prev ? total(prev, 'viewings') : null, 'up'),
        kpi('deals', { ar: 'صفقات', en: 'Deals' }, 'int', total(cur, 'deals'), prev ? total(prev, 'deals') : null, 'up'),
        kpi('budget', { ar: 'وسيط ميزانية الشراء', en: 'Median buying budget' }, 'money', median(prefs.filter((p) => p.purposes.includes('sale')).map((p) => p.budgetMax))),
      ],
      charts: [
        { kind: 'bars', key: 'leads', title: { ar: 'عملاء محتملين حسب المنطقة', en: 'Leads by area' }, format: 'int', bars: rows.slice(0, 12).map((r) => ({ label: r.cells.area, value: r.cells.leads })) },
        {
          kind: 'bars',
          key: 'wanting',
          title: { ar: 'العملاء اللي بيفضلوا المنطقة', en: 'Clients who prefer the area' },
          format: 'int',
          bars: [...rows].sort((a, b) => b.cells.wanting - a.cells.wanting).slice(0, 12).map((r) => ({ label: r.cells.area, value: r.cells.wanting })),
        },
      ],
      tables: [
        {
          key: 'areas',
          title: { ar: 'المناطق', en: 'Areas' },
          columns: [
            { key: 'area', label: { ar: 'المنطقة', en: 'Area' }, format: 'text' },
            { key: 'live', label: { ar: 'منشورة', en: 'Live' }, format: 'int' },
            { key: 'views', label: { ar: 'مشاهدات', en: 'Views' }, format: 'int' },
            { key: 'saves', label: { ar: 'حفظ', en: 'Saves' }, format: 'int' },
            { key: 'leads', label: { ar: 'عملاء محتملين', en: 'Leads' }, format: 'int' },
            { key: 'viewings', label: { ar: 'معاينات', en: 'Viewings' }, format: 'int' },
            { key: 'deals', label: { ar: 'صفقات', en: 'Deals' }, format: 'int' },
            { key: 'leadsPerLive', label: { ar: 'عملاء لكل عقار منشور', en: 'Leads per live listing' }, format: 'decimal' },
            { key: 'wanting', label: { ar: 'بيفضلوها', en: 'Prefer it' }, format: 'int' },
            { key: 'budget', label: { ar: 'وسيط ميزانيتهم', en: 'Their median budget' }, format: 'money' },
          ],
          rows,
        },
        {
          key: 'budgets',
          title: { ar: 'ميزانيات العملاء في تفضيلاتهم', en: 'Client budgets in their preferences' },
          columns: [
            { key: 'purpose', label: { ar: 'عايزين', en: 'Looking to' }, format: 'text' },
            { key: 'band', label: { ar: 'الميزانية', en: 'Budget' }, format: 'text' },
            { key: 'clients', label: { ar: 'عملاء', en: 'Clients' }, format: 'int' },
          ],
          rows: budgets,
        },
      ],
      notes: [
        { ar: 'اللي بيفضلوا المنطقة وميزانياتهم من تفضيلات العملاء دلوقتي.', en: 'Who prefers an area, and their budgets, come from clients’ preferences now.' },
        { ar: 'عملاء لكل عقار منشور: رقم عالي يعني طلب أكتر من المعروض.', en: 'Leads per live listing: a high number means more demand than supply.' },
      ],
    };
  }
}
