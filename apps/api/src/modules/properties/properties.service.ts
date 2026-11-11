import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
  type Category,
  DEFAULT_PREFS,
  GOOD_MATCH,
  type ListingAgent,
  type ListingFacets,
  type MatchCount,
  matchScore,
  type Prefs,
  type ListingFilters,
  type Page,
  type PropertyCard,
  type PropertyDetail,
  priceScale,
  SIZE_SCALE,
} from '@maqar/shared';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import type { AgentRow } from '../agents/agents.schema.js';
import { UsersService } from '../users/users.service.js';
import { type ListingFiltersDto, type PropertiesQueryDto, toListingFilters } from './dto/properties-query.dto.js';
import { PropertiesRepository } from './properties.repository.js';
import type { PropertyRow } from './properties.schema.js';

type AreaName = PropertyCard['area'];

/** How many similar homes the property page shows. */
const SIMILAR_LIMIT = 6;
/** How many picks Home shows (contract §8.2). */
const PICKS_LIMIT = 6;

/** The query's filters. A range whose minimum is above its maximum is a 400. */
function filtersOf(q: ListingFiltersDto): ListingFilters {
  const f = toListingFilters(q);
  if (f.minPrice !== undefined && f.maxPrice !== undefined && f.minPrice > f.maxPrice) {
    throw new BadRequestException('minPrice must not be above maxPrice');
  }
  if (f.minSize !== undefined && f.maxSize !== undefined && f.minSize > f.maxSize) {
    throw new BadRequestException('minSize must not be above maxSize');
  }
  return f;
}

function toCard(p: PropertyRow, area: AreaName, cover: string | null, tour: boolean): PropertyCard {
  return {
    id: p.id,
    category: p.category,
    type: p.type,
    titleAr: p.titleAr,
    titleEn: p.titleEn,
    area,
    compoundAr: p.compoundAr,
    compoundEn: p.compoundEn,
    price: p.price,
    oldPrice: p.oldPrice,
    beds: p.beds,
    baths: p.baths,
    sizeM2: p.sizeM2,
    finishing: p.finishing,
    delivery: p.deliveryYear ?? 'ready',
    plan: p.planDownPct != null && p.planYears != null ? { downPct: p.planDownPct, years: p.planYears } : null,
    cover,
    tour,
    featured: p.featured,
    // Approved listings always have a publish time; created_at only guards bad rows.
    publishedAt: (p.publishedAt ?? p.createdAt).toISOString(),
  };
}

function toAgent(a: AgentRow): PropertyDetail['agent'] {
  return {
    id: a.userId,
    nameAr: a.nameAr,
    nameEn: a.nameEn,
    roleTitleAr: a.roleTitleAr,
    roleTitleEn: a.roleTitleEn,
    rating: a.rating,
    dealsCount: a.dealsCount,
    years: a.years,
    languagesAr: a.languagesAr,
    languagesEn: a.languagesEn,
    avgReplyMins: a.avgReplyMins,
    phone: a.phone,
    colour: a.colour,
  };
}

@Injectable()
export class PropertiesService {
  constructor(
    private readonly repo: PropertiesRepository,
    private readonly users: UsersService,
  ) {}

  /** The list. Best match needs a signed-in client, and then every card carries its match. */
  async browse(q: PropertiesQueryDto, user?: AuthUser): Promise<Page<PropertyCard>> {
    const { page, limit, sort } = q;
    const prefs = sort === 'match' ? await this.prefsOf(user) : undefined;
    const { rows, total } = await this.repo.findPublicPage({
      ...filtersOf(q),
      sort,
      prefs,
      offset: (page - 1) * limit,
      limit,
    });
    return { items: await this.cards(rows, prefs), page, limit, total };
  }

  /** "Picked for you" (contract §8.2): the best matches, each with its reasons. */
  async recommended(user: AuthUser): Promise<PropertyCard[]> {
    const prefs = await this.prefsOf(user);
    const { rows } = await this.repo.findPublicPage({ sort: 'match', prefs, offset: 0, limit: PICKS_LIMIT });
    return this.cards(rows, prefs);
  }

  /** Onboarding's live count: homes that fit the preferences being picked 70% or more. */
  async matchCount(prefs: Prefs): Promise<MatchCount> {
    return { count: await this.repo.countGoodMatches(prefs, GOOD_MATCH) };
  }

  /** A client's preferences to score with: saved ones, or the defaults if onboarding was skipped. */
  private async prefsOf(user: AuthUser | undefined): Promise<Prefs> {
    if (!user) throw new UnauthorizedException('Sign in to sort by best match');
    if (user.role !== 'client') throw new ForbiddenException('Best match is for client accounts');
    return (await this.users.prefsFor(user.id)) ?? DEFAULT_PREFS;
  }

  /** The filter sheet's counts: matches, price and size histograms, and the delivery years. */
  async facets(q: ListingFiltersDto): Promise<ListingFacets> {
    const f = filtersOf(q);
    const price = priceScale(f.category);
    const [total, priceCounts, sizeCounts, deliveryYears] = await Promise.all([
      this.repo.countMatching(f),
      this.repo.priceHistogram(f, price),
      this.repo.sizeHistogram(f, SIZE_SCALE),
      this.repo.deliveryYears(f.category),
    ]);
    return {
      total,
      price: { ...price, counts: priceCounts },
      size: { ...SIZE_SCALE, counts: sizeCounts },
      deliveryYears,
    };
  }

  /** The property page. Each call counts as one view. Missing and unapproved listings are 404. */
  async detail(id: number): Promise<PropertyDetail> {
    const row = await this.repo.findApprovedById(id);
    if (!row) throw new NotFoundException('Listing not found');
    const detail = await this.toDetail(row);
    await this.repo.addView(id);
    return { ...detail, views: detail.views + 1 };
  }

  /** The compare screen: these homes in the order asked, leaving out missing and unapproved ones. Counts no view. */
  async compare(ids: number[]): Promise<PropertyDetail[]> {
    const rows = await Promise.all([...new Set(ids)].map((id) => this.repo.findApprovedById(id)));
    return Promise.all(rows.filter((r) => r !== undefined).map((r) => this.toDetail(r)));
  }

  private async toDetail({ p, area, agent }: NonNullable<Awaited<ReturnType<PropertiesRepository['findApprovedById']>>>): Promise<PropertyDetail> {
    const [images, features, tourRooms] = await Promise.all([
      this.repo.findImages(p.id),
      this.repo.findFeatures(p.id),
      this.repo.findTourRooms(p.id),
    ]);
    return {
      ...toCard(p, area, images[0] ?? null, tourRooms.length > 0),
      developerAr: p.developerAr,
      developerEn: p.developerEn,
      floor: p.floor,
      maintenanceFee: p.maintenanceFee,
      descAr: p.descAr,
      descEn: p.descEn,
      features,
      images,
      views: p.views,
      tourRooms,
      location: p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null,
      agent: toAgent(agent),
    };
  }

  async similar(id: number): Promise<PropertyCard[]> {
    const row = await this.repo.findApprovedById(id);
    if (!row) throw new NotFoundException('Listing not found');
    return this.cards(await this.repo.findSimilar(row.p, SIMILAR_LIMIT));
  }

  /** 404 unless the listing exists and is approved. */
  async assertApproved(id: number): Promise<void> {
    if (!(await this.repo.isApproved(id))) throw new NotFoundException('Listing not found');
  }

  /** Cards of these listings in this order, leaving out any that are not approved. */
  async approvedCards(ids: number[]): Promise<PropertyCard[]> {
    const rows = await this.repo.findApprovedByIds(ids);
    const byId = new Map(rows.map((r) => [r.p.id, r]));
    return this.cards(ids.flatMap((id) => byId.get(id) ?? []));
  }

  /** Cards of these listings whatever their status, by id. For viewings, whose home may be unpublished since. */
  async cardsById(ids: number[]): Promise<Map<number, PropertyCard & { location: { lat: number; lng: number } | null }>> {
    const rows = await this.repo.findByIds([...new Set(ids)]);
    const cards = await this.cards(rows);
    const at = new Map(rows.map(({ p }) => [p.id, p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null]));
    return new Map(cards.map((c) => [c.id, { ...c, location: at.get(c.id) ?? null }]));
  }

  /** Sales advisors by id, as the property page shows them. */
  async agentsById(ids: number[]): Promise<Map<number, ListingAgent>> {
    const rows = await this.repo.findAgents([...new Set(ids)]);
    return new Map(rows.map((a) => [a.userId, toAgent(a)]));
  }

  /** What booking a viewing needs to know about an approved listing; 404 otherwise. */
  async bookingTarget(id: number): Promise<{ id: number; category: Category; agent: ListingAgent; titleAr: string; titleEn: string }> {
    const row = await this.repo.findApprovedById(id);
    if (!row) throw new NotFoundException('Listing not found');
    return { id, category: row.p.category, agent: toAgent(row.agent), titleAr: row.p.titleAr, titleEn: row.p.titleEn };
  }

  /** Cards with their covers and, when scoring for a client, their match and reasons. */
  private async cards(rows: { p: PropertyRow; area: AreaName }[], prefs?: Prefs): Promise<PropertyCard[]> {
    const ids = rows.map((r) => r.p.id);
    const [covers, tours, features] = await Promise.all([
      this.repo.findCovers(ids),
      this.repo.findWithTour(ids),
      prefs ? this.repo.findFeaturesOf(ids) : undefined,
    ]);
    return rows.map(({ p, area }) => {
      const card = toCard(p, area, covers.get(p.id) ?? null, tours.has(p.id));
      if (!prefs) return card;
      const match = matchScore({ ...card, features: features?.get(p.id) ?? [], plan: card.plan !== null }, prefs);
      return { ...card, match };
    });
  }
}
