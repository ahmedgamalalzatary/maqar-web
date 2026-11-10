import { Injectable } from '@nestjs/common';
import type { AdminArea } from '@maqar/shared';
import { asc, eq, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { properties } from '../properties/properties.schema.js';
import { type AreaRow, areas } from './areas.schema.js';

@Injectable()
export class AreasRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  findAll(): Promise<AreaRow[]> {
    return this.db.select().from(areas).orderBy(asc(areas.nameEn));
  }

  async find(id: string): Promise<AreaRow | undefined> {
    const [row] = await this.db.select().from(areas).where(eq(areas.id, id));
    return row;
  }

  /** Every area with its listings in any status (an area in use cannot be deleted). */
  async findAllWithCounts(): Promise<AdminArea[]> {
    // The outer column is written with its table: on one table Drizzle leaves names bare, and a
    // bare `id` inside the subquery would be the listing's own id.
    const listings = sql<number>`(select count(*) from ${properties} where ${properties.areaId} = ${sql.raw('`areas`.`id`')})`;
    const rows = await this.db.select({ a: areas, listings }).from(areas).orderBy(asc(areas.nameEn));
    return rows.map((r) => ({ ...r.a, listings: Number(r.listings) }));
  }

  async create(row: AreaRow): Promise<void> {
    await this.db.insert(areas).values(row);
  }

  async update(id: string, set: Partial<Omit<AreaRow, 'id'>>): Promise<void> {
    if (Object.keys(set).length) await this.db.update(areas).set(set).where(eq(areas.id, id));
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(areas).where(eq(areas.id, id));
  }
}
