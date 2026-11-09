import { Injectable } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { type AreaRow, areas } from './areas.schema.js';

@Injectable()
export class AreasRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  findAll(): Promise<AreaRow[]> {
    return this.db.select().from(areas).orderBy(asc(areas.nameEn));
  }
}
