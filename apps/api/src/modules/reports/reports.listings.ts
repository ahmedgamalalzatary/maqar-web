import { Injectable } from '@nestjs/common';
import { type Bi, CATEGORIES, CATEGORY_LABEL, PROPERTY_STATUS_LABEL, PROPERTY_STATUSES, PROPERTY_TYPE_LABEL, PROPERTY_TYPES, type ReportRow } from '@maqar/shared';
import { type Built, type Ctx, bi, NO_ADVISOR, since, sinceDay, titleOf, UNKNOWN } from './reports.context.js';
import { type ListingFact, ReportsRepository } from './reports.repository.js';
import { average, bandOf, countBy, dayWithin, daysBetween, kpi, passes, PRICE_BANDS, ratio, type Win, within } from './reports.util.js';

const LIVE = (l: ListingFact) => l.status === 'approved';
const pricePerM2 = (ls: ListingFact[]) => average(ls.filter((l) => (l.category === 'sale' || l.category === 'project') && l.sizeM2 > 0).map((l) => l.price / l.sizeM2));
const AGES: { upTo: number; label: Bi }[] = [
  { upTo: 30, label: { ar: 'أقل من شهر', en: 'Under a month' } },
  { upTo: 90, label: { ar: '١–٣ شهور', en: '1–3 months' } },
  { upTo: 180, label: { ar: '٣–٦ شهور', en: '3–6 months' } },
  { upTo: Infinity, label: { ar: 'أكتر من ٦ شهور', en: 'Over 6 months' } },
];
/** What a listing should have before clients see it. */
const CHECKS: { key: string; label: Bi; ok: (l: ListingFact, m: { photos: number; tour: boolean; videos: number }) => boolean }[] = [
  { key: 'photos', label: { ar: '٥ صور أو أكتر', en: '5 photos or more' }, ok: (_l, m) => m.photos >= 5 },
  { key: 'pin', label: { ar: 'مكان على الخريطة', en: 'A map pin' }, ok: (l) => l.hasPin },
  { key: 'desc', label: { ar: 'وصف بالعربي والإنجليزي', en: 'Arabic and English descriptions' }, ok: (l) => !!l.descAr.trim() && !!l.descEn.trim() },
  { key: 'tour', label: { ar: 'جولة ٣٦٠°', en: 'A 360° tour' }, ok: (_l, m) => m.tour },
  { key: 'video', label: { ar: 'فيديو', en: 'A video' }, ok: (_l, m) => m.videos > 0 },
  { key: 'owner', label: { ar: 'رقم المالك', en: 'The owner’s phone' }, ok: (l) => !!l.ownerPhone },
];

/** Listing reports (phase 27): inventory, performance, price changes, quality. */
@Injectable()
export class ListingReports {
  constructor(private readonly repo: ReportsRepository) {}

  /** A snapshot of now. */
  async inventory(c: Ctx): Promise<Built> {
    const [listings, areas] = await Promise.all([this.repo.listings(), this.repo.areas()]);
    const all = listings.filter((l) => passes(c.f, l));
    const live = all.filter(LIVE);
    const ageOf = (l: ListingFact) => (l.publishedAt ? daysBetween(l.publishedAt, c.now) : 0);
    const status = countBy(
      PROPERTY_STATUSES,
      all.map((l) => l.status),
    );
    const byType = countBy(
      PROPERTY_TYPES,
      live.map((l) => l.type),
    );
    const ages = AGES.map((a, i) => ({ label: a.label, value: live.filter((l) => ageOf(l) < a.upTo && (i === 0 || ageOf(l) >= AGES[i - 1]!.upTo)).length }));

    return {
      kpis: [
        kpi('live', { ar: 'منشورة', en: 'Live' }, 'int', live.length),
        kpi('draft', { ar: 'مسودات', en: 'Drafts' }, 'int', status.get('draft')!),
        kpi('unpublished', { ar: 'موقوفة', en: 'Unpublished' }, 'int', status.get('unpublished')!),
        kpi('closed', { ar: 'اتباعت أو اتأجرت', en: 'Sold or rented' }, 'int', status.get('sold')! + status.get('rented')!),
        kpi('age', { ar: 'متوسط مدة النشر', en: 'Average time live' }, 'days', average(live.map(ageOf))),
        kpi('perM2', { ar: 'متوسط سعر المتر (بيع)', en: 'Average price per m² (sale)' }, 'money', pricePerM2(live)),
      ],
      charts: [
        { kind: 'bars', key: 'status', title: { ar: 'حسب الحالة', en: 'By status' }, format: 'int', bars: PROPERTY_STATUSES.map((s) => ({ label: PROPERTY_STATUS_LABEL[s], value: status.get(s)! })) },
        { kind: 'bars', key: 'type', title: { ar: 'المنشور حسب النوع', en: 'Live by type' }, format: 'int', bars: PROPERTY_TYPES.map((t) => ({ label: PROPERTY_TYPE_LABEL[t], value: byType.get(t)! })).filter((b) => b.value > 0) },
        { kind: 'bars', key: 'age', title: { ar: 'المنشور من قد إيه', en: 'How long live listings have been up' }, format: 'int', bars: ages },
      ],
      tables: [
        {
          key: 'areas',
          title: { ar: 'المنشور حسب المنطقة', en: 'Live by area' },
          columns: [
            { key: 'area', label: { ar: 'المنطقة', en: 'Area' }, format: 'text' },
            { key: 'live', label: { ar: 'منشورة', en: 'Live' }, format: 'int' },
            ...CATEGORIES.map((cat) => ({ key: cat, label: CATEGORY_LABEL[cat], format: 'int' as const })),
            { key: 'perM2', label: { ar: 'متوسط سعر المتر (بيع)', en: 'Average price per m² (sale)' }, format: 'money' as const },
            { key: 'age', label: { ar: 'متوسط مدة النشر', en: 'Average time live' }, format: 'days' as const },
          ],
          rows: areas
            .map((a) => {
              const here = live.filter((l) => l.areaId === a.id);
              return {
                cells: {
                  area: bi(a),
                  live: here.length,
                  ...Object.fromEntries(CATEGORIES.map((cat) => [cat, here.filter((l) => l.category === cat).length])),
                  perM2: pricePerM2(here),
                  age: average(here.map(ageOf)),
                },
              };
            })
            .filter((r) => r.cells.live > 0)
            .sort((x, y) => y.cells.live - x.cells.live),
        },
        {
          key: 'prices',
          title: { ar: 'المنشور حسب السعر', en: 'Live by price' },
          columns: [
            { key: 'category', label: { ar: 'الغرض', en: 'Purpose' }, format: 'text' },
            { key: 'band', label: { ar: 'السعر', en: 'Price' }, format: 'text' },
            { key: 'live', label: { ar: 'منشورة', en: 'Live' }, format: 'int' },
          ],
          rows: CATEGORIES.flatMap((cat) =>
            PRICE_BANDS[cat].map((b, i) => ({ cells: { category: CATEGORY_LABEL[cat], band: b.label, live: live.filter((l) => l.category === cat && bandOf(cat, l.price) === i).length } })),
          ).filter((r) => r.cells.live > 0),
        },
      ],
      notes: [{ ar: 'صورة للوضع دلوقتي، من غير مدة.', en: 'A snapshot of now, with no range.' }],
    };
  }

  async listings(c: Ctx): Promise<Built> {
    const [listings, agents, areas, stats, interest, threads, viewings, leads] = await Promise.all([
      this.repo.listings(),
      this.repo.agents(),
      this.repo.areas(),
      this.repo.stats(sinceDay(c)),
      this.repo.interest(sinceDay(c)),
      this.repo.threads(since(c)),
      this.repo.viewings(since(c)),
      this.repo.leads(since(c)),
    ]);
    const agentName = new Map(agents.map((a) => [a.id, bi(a)]));
    const areaName = new Map(areas.map((a) => [a.id, bi(a)]));
    const shown = listings.filter((l) => passes(c.f, l));
    const ids = new Set(shown.map((l) => l.id));
    const sum = (w: Win, key: 'views' | 'saves') => stats.filter((s) => ids.has(s.propertyId) && dayWithin(s.day, w)).reduce((a, s) => a + s[key], 0);
    const per = (w: Win) => {
      const views = new Map<number, number>();
      const saves = new Map<number, number>();
      for (const s of stats) {
        if (!dayWithin(s.day, w)) continue;
        views.set(s.propertyId, (views.get(s.propertyId) ?? 0) + s.views);
        saves.set(s.propertyId, (saves.get(s.propertyId) ?? 0) + s.saves);
      }
      const people = new Map<number, Set<number>>();
      for (const i of interest) if (dayWithin(i.day, w)) people.set(i.propertyId, (people.get(i.propertyId) ?? new Set()).add(i.clientId));
      const tally = (xs: { propertyId: number | null }[]) => {
        const m = new Map<number, number>();
        for (const x of xs) if (x.propertyId) m.set(x.propertyId, (m.get(x.propertyId) ?? 0) + 1);
        return m;
      };
      return {
        views,
        saves,
        people,
        chats: tally(threads.threads.filter((t) => within(t.createdAt, w))),
        viewings: tally(viewings.filter((v) => within(v.createdAt, w))),
        leads: tally(leads.filter((l) => within(l.createdAt, w))),
      };
    };
    const cur = per(c.cur);
    const total = (w: Win, pick: (p: ReturnType<typeof per>) => Map<number, number>) => [...pick(per(w))].filter(([id]) => ids.has(id)).reduce((a, [, v]) => a + v, 0);
    const live = shown.filter(LIVE);
    const rowOf = (l: ListingFact): ReportRow => {
      const views = cur.views.get(l.id) ?? 0;
      const booked = cur.viewings.get(l.id) ?? 0;
      return {
        cells: {
          listing: titleOf(l),
          area: areaName.get(l.areaId) ?? l.areaId,
          advisor: l.agentId ? (agentName.get(l.agentId) ?? NO_ADVISOR) : NO_ADVISOR,
          price: l.price,
          views,
          saves: cur.saves.get(l.id) ?? 0,
          interested: cur.people.get(l.id)?.size ?? 0,
          chats: cur.chats.get(l.id) ?? 0,
          viewings: booked,
          leads: cur.leads.get(l.id) ?? 0,
          perView: ratio(booked, views),
          live: l.publishedAt ? Math.floor(daysBetween(l.publishedAt, c.now)) : null,
        },
        link: { kind: 'listing', id: l.id },
      };
    };
    const rows = live.map(rowOf).sort((a, b) => (b.cells.views as number) - (a.cells.views as number));
    const quiet = rows.filter((r) => !r.cells.chats && !r.cells.viewings && !r.cells.leads && ((r.cells.live as number | null) ?? 0) >= 14);
    const columns = [
      { key: 'listing', label: { ar: 'العقار', en: 'Listing' }, format: 'text' as const },
      { key: 'area', label: { ar: 'المنطقة', en: 'Area' }, format: 'text' as const },
      { key: 'advisor', label: { ar: 'المسؤول', en: 'Advisor' }, format: 'text' as const },
      { key: 'price', label: { ar: 'السعر', en: 'Price' }, format: 'money' as const },
      { key: 'views', label: { ar: 'مشاهدات', en: 'Views' }, format: 'int' as const },
      { key: 'saves', label: { ar: 'حفظ', en: 'Saves' }, format: 'int' as const },
      { key: 'interested', label: { ar: 'عملاء مهتمين', en: 'Interested clients' }, format: 'int' as const },
      { key: 'chats', label: { ar: 'محادثات', en: 'Chats' }, format: 'int' as const },
      { key: 'viewings', label: { ar: 'معاينات', en: 'Viewings' }, format: 'int' as const },
      { key: 'leads', label: { ar: 'عملاء محتملين', en: 'Leads' }, format: 'int' as const },
      { key: 'perView', label: { ar: 'معاينات لكل مشاهدة', en: 'Viewings per view' }, format: 'pct' as const },
      { key: 'live', label: { ar: 'منشور من', en: 'Live for' }, format: 'days' as const },
    ];

    return {
      kpis: [
        kpi('views', { ar: 'مشاهدات', en: 'Views' }, 'int', sum(c.cur, 'views'), c.prev ? sum(c.prev, 'views') : null, 'up'),
        kpi('saves', { ar: 'مرات الحفظ', en: 'Saves' }, 'int', sum(c.cur, 'saves'), c.prev ? sum(c.prev, 'saves') : null, 'up'),
        kpi('chats', { ar: 'محادثات جديدة', en: 'New chats' }, 'int', total(c.cur, (p) => p.chats), c.prev ? total(c.prev, (p) => p.chats) : null, 'up'),
        kpi('viewings', { ar: 'معاينات اتحجزت', en: 'Viewings booked' }, 'int', total(c.cur, (p) => p.viewings), c.prev ? total(c.prev, (p) => p.viewings) : null, 'up'),
        kpi('quiet', { ar: 'منشورة ومحدش سأل عليها', en: 'Live with no enquiries' }, 'int', quiet.length, undefined, 'down'),
      ],
      charts: [
        {
          kind: 'bars',
          key: 'top',
          title: { ar: 'أكتر العقارات مشاهدة', en: 'Most viewed listings' },
          format: 'int',
          bars: rows.slice(0, 10).map((r) => ({ label: r.cells.listing as Bi, value: r.cells.views as number })),
        },
      ],
      tables: [
        { key: 'listings', title: { ar: 'العقارات المنشورة', en: 'Live listings' }, columns, rows },
        {
          key: 'quiet',
          title: { ar: 'منشورة من أسبوعين+ ومحدش سأل عليها في المدة دي', en: 'Live for 2+ weeks with no chats, viewings or leads in this range' },
          columns,
          rows: quiet.sort((a, b) => ((b.cells.live as number) ?? 0) - ((a.cells.live as number) ?? 0)),
        },
      ],
      notes: [
        { ar: 'كل فتح لصفحة العقار مشاهدة. الحفظ بيتحسب يوم ما اتعمل حتى لو اتشال بعدها.', en: 'Every page open is a view. A save counts on its day even if undone later.' },
        { ar: 'العملاء المهتمين: حفظوا أو تابعوا السعر أو كلموا أو حجزوا لأول مرة في المدة.', en: 'Interested clients first saved, followed the price, chatted or booked in the range.' },
      ],
    };
  }

  async prices(c: Ctx): Promise<Built> {
    const [listings, changes, followers] = await Promise.all([this.repo.listings(), this.repo.priceChanges(since(c)), this.repo.followers()]);
    const listing = new Map(listings.map((l) => [l.id, l]));
    const mine = changes.filter((ch) => passes(c.f, listing.get(ch.propertyId)));
    const inW = (w: Win) => mine.filter((ch) => within(ch.at, w));
    const drops = (w: Win) => inW(w).filter((ch) => ch.newPrice < ch.oldPrice);
    const avgDrop = (w: Win) => average(drops(w).map((ch) => (ch.oldPrice - ch.newPrice) / ch.oldPrice));
    const cur = inW(c.cur);

    return {
      kpis: [
        kpi('changes', { ar: 'تغييرات سعر', en: 'Price changes' }, 'int', cur.length, c.prev ? inW(c.prev).length : null),
        kpi('drops', { ar: 'تخفيضات', en: 'Drops' }, 'int', drops(c.cur).length, c.prev ? drops(c.prev).length : null),
        kpi('raises', { ar: 'زيادات', en: 'Raises' }, 'int', cur.length - drops(c.cur).length, c.prev ? inW(c.prev).length - drops(c.prev).length : null),
        kpi('avgDrop', { ar: 'متوسط التخفيض', en: 'Average drop' }, 'pct', avgDrop(c.cur), c.prev ? avgDrop(c.prev) : null),
        kpi('followers', { ar: 'عملاء متابعين العقارات اللي نزلت', en: 'Clients following the dropped listings' }, 'int', [...new Set(drops(c.cur).map((d) => d.propertyId))].reduce((a, id) => a + (followers.get(id) ?? 0), 0)),
      ],
      charts: [],
      tables: [
        {
          key: 'changes',
          title: { ar: 'التغييرات', en: 'Changes' },
          columns: [
            { key: 'date', label: { ar: 'التاريخ', en: 'Date' }, format: 'date' },
            { key: 'listing', label: { ar: 'العقار', en: 'Listing' }, format: 'text' },
            { key: 'category', label: { ar: 'الغرض', en: 'Purpose' }, format: 'text' },
            { key: 'old', label: { ar: 'كان', en: 'Was' }, format: 'money' },
            { key: 'new', label: { ar: 'بقى', en: 'Now' }, format: 'money' },
            { key: 'change', label: { ar: 'التغيير', en: 'Change' }, format: 'pct' },
            { key: 'by', label: { ar: 'مين غيّره', en: 'Changed by' }, format: 'text' },
            { key: 'followers', label: { ar: 'متابعين السعر', en: 'Following the price' }, format: 'int' },
          ],
          rows: [...cur].reverse().map((ch): ReportRow => {
            const l = listing.get(ch.propertyId);
            return {
              cells: {
                date: ch.at.toISOString().slice(0, 10),
                listing: l ? titleOf(l) : UNKNOWN,
                category: l ? CATEGORY_LABEL[l.category] : null,
                old: ch.oldPrice,
                new: ch.newPrice,
                change: (ch.newPrice - ch.oldPrice) / ch.oldPrice,
                by: ch.byName ?? UNKNOWN,
                followers: followers.get(ch.propertyId) ?? 0,
              },
              link: { kind: 'listing', id: ch.propertyId },
            };
          }),
        },
      ],
      notes: [{ ar: 'عدد المتابعين هو اللي متابعين دلوقتي. لما السعر بينزل، المتابعين بيوصلهم إشعار.', en: 'Followers are those following now. Followers are notified when a price drops.' }],
    };
  }

  /** A snapshot of now: what each listing that is not closed still lacks. */
  async quality(c: Ctx): Promise<Built> {
    const [listings, media, agents] = await Promise.all([this.repo.listings(), this.repo.media(), this.repo.agents()]);
    const agentName = new Map(agents.map((a) => [a.id, bi(a)]));
    const open = listings.filter((l) => (l.status === 'draft' || l.status === 'approved' || l.status === 'unpublished') && passes(c.f, l));
    const checked = open.map((l) => {
      const m = { photos: media.photos.get(l.id) ?? 0, tour: media.tours.has(l.id), videos: media.videos.get(l.id) ?? 0 };
      const missing = CHECKS.filter((ch) => !ch.ok(l, m));
      return { l, m, missing, score: (CHECKS.length - missing.length) / CHECKS.length };
    });
    const lacking = (key: string) => checked.filter((x) => x.missing.some((m) => m.key === key)).length;
    const join = (labels: Bi[]): Bi => ({ ar: labels.map((x) => x.ar).join('، '), en: labels.map((x) => x.en).join(', ') });

    return {
      kpis: [
        kpi('checked', { ar: 'عقارات مش مقفولة', en: 'Listings not closed' }, 'int', checked.length),
        kpi('complete', { ar: 'كاملة', en: 'Complete' }, 'int', checked.filter((x) => !x.missing.length).length, undefined, 'up'),
        kpi('score', { ar: 'متوسط الاكتمال', en: 'Average completeness' }, 'pct', average(checked.map((x) => x.score)), undefined, 'up'),
        kpi('liveIncomplete', { ar: 'منشورة وناقصها حاجة', en: 'Live and incomplete' }, 'int', checked.filter((x) => x.l.status === 'approved' && x.missing.length).length, undefined, 'down'),
      ],
      charts: [{ kind: 'bars', key: 'missing', title: { ar: 'ناقصها', en: 'Missing' }, format: 'int', bars: CHECKS.map((ch) => ({ label: ch.label, value: lacking(ch.key) })) }],
      tables: [
        {
          key: 'listings',
          title: { ar: 'العقارات اللي ناقصها حاجة', en: 'Listings with something missing' },
          columns: [
            { key: 'listing', label: { ar: 'العقار', en: 'Listing' }, format: 'text' },
            { key: 'status', label: { ar: 'الحالة', en: 'Status' }, format: 'text' },
            { key: 'advisor', label: { ar: 'المسؤول', en: 'Advisor' }, format: 'text' },
            { key: 'photos', label: { ar: 'صور', en: 'Photos' }, format: 'int' },
            { key: 'missing', label: { ar: 'ناقصها', en: 'Missing' }, format: 'text' },
            { key: 'score', label: { ar: 'الاكتمال', en: 'Completeness' }, format: 'pct' },
          ],
          rows: checked
            .filter((x) => x.missing.length)
            .sort((a, b) => a.score - b.score || (a.l.status === 'approved' ? -1 : 1))
            .map((x) => ({
              cells: {
                listing: titleOf(x.l),
                status: PROPERTY_STATUS_LABEL[x.l.status],
                advisor: x.l.agentId ? (agentName.get(x.l.agentId) ?? NO_ADVISOR) : NO_ADVISOR,
                photos: x.m.photos,
                missing: join(x.missing.map((m) => m.label)),
                score: x.score,
              },
              link: { kind: 'listing', id: x.l.id },
            })),
        },
      ],
      notes: [{ ar: 'المسودات والمنشورة والموقوفة، من غير اللي اتباع أو اتأجر. صورة للوضع دلوقتي.', en: 'Drafts, live and unpublished listings, not sold or rented ones. A snapshot of now.' }],
    };
  }
}
