import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AdminListing,
  type AdminListingItem,
  type AdminListingsPage,
  canMoveTo,
  closedStatusFor,
  defaultTitle,
  type ListingBody,
  PROPERTY_STATUS_LABEL,
  PROPERTY_STATUSES,
  type PropertyStatus,
} from '@maqar/shared';
import { PricesService } from '../prices/prices.service.js';
import type { NewPropertyRow } from '../properties/properties.schema.js';
import type { AdminListingsQueryDto } from './dto/listing.dto.js';
import { type AreaName, type ListingRow, ListingsRepository } from './listings.repository.js';

function toItem({ p, area, agent }: ListingRow, images: string[], tour: boolean): AdminListingItem {
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
    cover: images[0] ?? null,
    tour,
    featured: p.featured,
    status: p.status,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    ownerName: p.ownerName,
    ownerPhone: p.ownerPhone,
    agent,
    views: p.views,
  };
}

/** The body's columns. Undefined fields are left out, so a PATCH only changes what it sends. */
function columnsOf(b: Partial<ListingBody>): Partial<NewPropertyRow> {
  const set: Partial<NewPropertyRow> = {
    category: b.category,
    type: b.type,
    areaId: b.areaId,
    compoundAr: b.compoundAr,
    compoundEn: b.compoundEn,
    developerAr: b.developerAr === undefined ? undefined : b.developerAr || null,
    developerEn: b.developerEn === undefined ? undefined : b.developerEn || null,
    beds: b.beds,
    baths: b.baths,
    sizeM2: b.sizeM2,
    floor: b.floor,
    finishing: b.finishing,
    deliveryYear: b.delivery === undefined ? undefined : b.delivery === 'ready' ? null : b.delivery,
    maintenanceFee: b.maintenanceFee,
    planDownPct: b.plan === undefined ? undefined : (b.plan?.downPct ?? null),
    planYears: b.plan === undefined ? undefined : (b.plan?.years ?? null),
    descAr: b.descAr,
    descEn: b.descEn,
    lat: b.location === undefined ? undefined : (b.location?.lat ?? null),
    lng: b.location === undefined ? undefined : (b.location?.lng ?? null),
    ownerName: b.ownerName === undefined ? undefined : b.ownerName || null,
    ownerPhone: b.ownerPhone === undefined ? undefined : b.ownerPhone || null,
  };
  return Object.fromEntries(Object.entries(set).filter(([, v]) => v !== undefined));
}

/**
 * Admin listings (phase 17). There are no owner accounts: an admin creates the listing for the
 * owner and publishes it, which assigns a sales advisor. There is no review step.
 */
@Injectable()
export class ListingsService {
  constructor(
    private readonly repo: ListingsRepository,
    private readonly prices: PricesService,
  ) {}

  async page(q: AdminListingsQueryDto): Promise<AdminListingsPage> {
    const { rows, total, byStatus } = await this.repo.page({ status: q.status, q: q.q, offset: (q.page - 1) * q.limit, limit: q.limit });
    const ids = rows.map((r) => r.p.id);
    const [images, tours] = await Promise.all([this.repo.images(ids), this.repo.withTour(ids)]);
    const counts = Object.fromEntries(PROPERTY_STATUSES.map((s) => [s, 0])) as Record<PropertyStatus, number>;
    for (const { status, n } of byStatus) counts[status] = n;
    return { items: rows.map((r) => toItem(r, images.get(r.p.id) ?? [], tours.has(r.p.id))), page: q.page, limit: q.limit, total, counts };
  }

  async get(id: number): Promise<AdminListing> {
    const row = await this.repo.find(id);
    if (!row) throw new NotFoundException('Listing not found');
    const [images, tours, features] = await Promise.all([this.repo.images([id]), this.repo.withTour([id]), this.repo.features(id)]);
    const { p } = row;
    return {
      ...toItem(row, images.get(id) ?? [], tours.has(id)),
      developerAr: p.developerAr,
      developerEn: p.developerEn,
      floor: p.floor,
      maintenanceFee: p.maintenanceFee,
      descAr: p.descAr,
      descEn: p.descEn,
      features,
      images: images.get(id) ?? [],
      location: p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null,
    };
  }

  /** A new listing, as a draft with no advisor yet. An empty title becomes the default one. */
  async create(body: ListingBody): Promise<AdminListing> {
    const area = await this.areaOf(body.areaId);
    const title = defaultTitle(body, area);
    const id = await this.repo.insert(
      {
        compoundAr: '',
        compoundEn: '',
        descAr: '',
        descEn: '',
        ...columnsOf(body),
        category: body.category,
        type: body.type,
        areaId: body.areaId,
        beds: body.beds,
        baths: body.baths,
        sizeM2: body.sizeM2,
        finishing: body.finishing,
        titleAr: body.titleAr || title.ar,
        titleEn: body.titleEn || title.en,
        price: body.price,
        status: 'draft',
      },
      body.images,
      body.features,
    );
    return this.get(id);
  }

  /** Changes what is sent. A new price goes through the price history, so a drop alerts followers. */
  async update(id: number, body: Partial<ListingBody> & { featured?: boolean; agentId?: number }, by: number): Promise<AdminListing> {
    const cur = await this.get(id);
    const area = body.areaId && body.areaId !== cur.area.id ? await this.areaOf(body.areaId) : cur.area;
    const set = columnsOf(body);
    if (body.titleAr !== undefined || body.titleEn !== undefined) {
      const title = defaultTitle({ type: body.type ?? cur.type, beds: body.beds ?? cur.beds }, area);
      if (body.titleAr !== undefined) set.titleAr = body.titleAr || title.ar;
      if (body.titleEn !== undefined) set.titleEn = body.titleEn || title.en;
    }
    if (body.featured !== undefined) set.featured = body.featured;
    if (body.agentId !== undefined && body.agentId !== cur.agent?.id) {
      if (!(await this.repo.isActiveAgent(body.agentId))) throw new BadRequestException('Pick an active sales advisor');
      set.agentId = body.agentId;
    }
    await this.repo.update(id, set, body.images, body.features);
    if (body.price !== undefined && body.price !== cur.price) await this.prices.changePrice(id, body.price, by);
    return this.get(id);
  }

  /** Puts the listing live with an advisor: the one picked, the one it had, or the least busy. */
  async publish(id: number, agentId: number | undefined): Promise<AdminListing> {
    const cur = await this.movable(id, 'approved');
    let advisor = agentId;
    if (advisor !== undefined) {
      if (!(await this.repo.isActiveAgent(advisor))) throw new BadRequestException('Pick an active sales advisor');
    } else if (cur.agent && (await this.repo.isActiveAgent(cur.agent.id))) {
      advisor = cur.agent.id;
    } else {
      const [least] = await this.repo.agentOptions();
      if (!least) throw new BadRequestException('There is no active sales advisor to assign');
      advisor = least.id;
    }
    await this.repo.update(id, { status: 'approved', agentId: advisor, publishedAt: cur.publishedAt ? undefined : new Date() });
    return this.get(id);
  }

  async unpublish(id: number): Promise<AdminListing> {
    await this.movable(id, 'unpublished');
    await this.repo.update(id, { status: 'unpublished' });
    return this.get(id);
  }

  /** Sold for a home for sale or a project; rented for one to rent or a stay. */
  async close(id: number): Promise<AdminListing> {
    const cur = await this.get(id);
    const to = closedStatusFor(cur.category);
    await this.movable(id, to, cur);
    await this.repo.update(id, { status: to });
    return this.get(id);
  }

  private async movable(id: number, to: PropertyStatus, cur?: AdminListing): Promise<AdminListing> {
    const listing = cur ?? (await this.get(id));
    if (!canMoveTo(listing.status, to)) {
      throw new ConflictException(`A listing that is ${PROPERTY_STATUS_LABEL[listing.status].en.toLowerCase()} cannot become ${PROPERTY_STATUS_LABEL[to].en.toLowerCase()}`);
    }
    return listing;
  }

  private async areaOf(id: string): Promise<AreaName> {
    const area = await this.repo.area(id);
    if (!area) throw new BadRequestException('Unknown area');
    return area;
  }
}
