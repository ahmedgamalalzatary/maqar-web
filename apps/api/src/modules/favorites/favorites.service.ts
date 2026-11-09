import { Injectable } from '@nestjs/common';
import type { PropertyCard } from '@maqar/shared';
import { PropertiesService } from '../properties/properties.service.js';
import { FavoritesRepository } from './favorites.repository.js';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly repo: FavoritesRepository,
    private readonly properties: PropertiesService,
  ) {}

  /** Homes that stop being approved leave the list, and come back if they are approved again. */
  async list(userId: number): Promise<PropertyCard[]> {
    return this.properties.approvedCards(await this.repo.findIds(userId));
  }

  async save(userId: number, propertyId: number): Promise<void> {
    await this.properties.assertApproved(propertyId);
    await this.repo.add(userId, propertyId);
  }

  remove(userId: number, propertyId: number): Promise<void> {
    return this.repo.remove(userId, propertyId);
  }
}
