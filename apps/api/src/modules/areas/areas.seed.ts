import { sql } from 'drizzle-orm';
import type { Db } from '../../core/db/db.module.js';
import { areas } from './areas.schema.js';

// The demo's areas (apps/demo/src/lib/data.ts). Photos are copied to uploads/seed by the seed script.
export const SEED_AREAS = [
  { id: 'new-cairo', nameAr: 'التجمع الخامس', nameEn: 'New Cairo', cityAr: 'القاهرة', cityEn: 'Cairo', image: '/uploads/seed/p26.jpg' },
  { id: 'zayed', nameAr: 'الشيخ زايد', nameEn: 'Sheikh Zayed', cityAr: 'الجيزة', cityEn: 'Giza', image: '/uploads/seed/p2.jpg' },
  { id: 'capital', nameAr: 'العاصمة الإدارية', nameEn: 'New Capital', cityAr: 'القاهرة', cityEn: 'Cairo', image: '/uploads/seed/p21.jpg' },
  { id: 'north-coast', nameAr: 'الساحل الشمالي', nameEn: 'North Coast', cityAr: 'مطروح', cityEn: 'Matrouh', image: '/uploads/seed/p19.jpg' },
  { id: 'sokhna', nameAr: 'العين السخنة', nameEn: 'Ain Sokhna', cityAr: 'السويس', cityEn: 'Suez', image: '/uploads/seed/p18.jpg' },
  { id: 'october', nameAr: '٦ أكتوبر', nameEn: '6th of October', cityAr: 'الجيزة', cityEn: 'Giza', image: '/uploads/seed/p12.jpg' },
  { id: 'maadi', nameAr: 'المعادي', nameEn: 'Maadi', cityAr: 'القاهرة', cityEn: 'Cairo', image: '/uploads/seed/p11.jpg' },
  { id: 'alamein', nameAr: 'العلمين الجديدة', nameEn: 'New Alamein', cityAr: 'مطروح', cityEn: 'Matrouh', image: '/uploads/seed/p22.jpg' },
];

/** Adds the demo areas; existing ones are left as they are. Safe to run more than once. */
export async function seedAreas(db: Db): Promise<void> {
  await db
    .insert(areas)
    .values(SEED_AREAS)
    .onDuplicateKeyUpdate({ set: { id: sql`id` } });
}
