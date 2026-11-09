import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type PriceChangeResponse, type PropertyCard, priceDropText } from '@maqar/shared';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PropertiesService } from '../properties/properties.service.js';
import { PricesRepository } from './prices.repository.js';

/** Price drop alerts (contract §8.9): following a home's price, and telling followers when it falls. */
@Injectable()
export class PricesService {
  constructor(
    private readonly repo: PricesRepository,
    private readonly properties: PropertiesService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Homes that stop being approved leave the list, and come back if they are approved again. */
  async followed(userId: number): Promise<PropertyCard[]> {
    return this.properties.approvedCards(await this.repo.followedIds(userId));
  }

  async follow(userId: number, propertyId: number): Promise<void> {
    // bookingTarget is approved-only (404 otherwise). Stays are priced per night, so they have no drops to follow.
    const home = await this.properties.bookingTarget(propertyId);
    if (home.category === 'stay') throw new BadRequestException('Stays have no price alerts');
    await this.repo.follow(userId, propertyId);
  }

  unfollow(userId: number, propertyId: number): Promise<void> {
    return this.repo.unfollow(userId, propertyId);
  }

  /**
   * The one way a listing's price changes (admins now; the admin tools in Phase 17 use it too).
   * Every change goes to the price history. A drop on a live listing notifies every follower.
   */
  async changePrice(propertyId: number, price: number, by: number): Promise<PriceChangeResponse> {
    const change = await this.repo.changePrice(propertyId, price, by);
    if (!change) throw new NotFoundException('Listing not found');
    if (change.dropped && change.status === 'approved') {
      const text = priceDropText(change, change.was, change.price, change.dropPct);
      const followers = await this.repo.followers(propertyId);
      await Promise.all(followers.map((id) => this.notifications.notify(id, { kind: 'price', ...text, href: `/property/${propertyId}` })));
    }
    return { price: change.price, oldPrice: change.oldPrice };
  }
}
