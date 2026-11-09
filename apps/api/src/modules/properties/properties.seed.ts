import type { Category, Feature, Finishing, PropertyType } from '@maqar/shared';
import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../../core/db/db.module.js';
import { users } from '../users/users.schema.js';
import { properties, propertyFeatures, propertyImages } from './properties.schema.js';

type SeedProperty = {
  category: Category;
  type: PropertyType;
  titleAr: string;
  titleEn: string;
  areaId: string;
  compoundAr: string;
  compoundEn: string;
  developerAr?: string;
  developerEn?: string;
  price: number;
  oldPrice?: number;
  beds: number;
  baths: number;
  sizeM2: number;
  floor?: number;
  finishing: Finishing;
  deliveryYear?: number;
  featured: boolean;
  maintenanceFee?: number;
  planDownPct?: number;
  planYears?: number;
  views: number;
  /** Days since it was published. */
  listedDays: number;
  agentEmail: string;
  features: Feature[];
  /** File names in uploads/seed; the first is the cover. */
  images: string[];
  descAr: string;
  descEn: string;
};

// The demo's 16 listings (apps/demo/src/lib/data.ts). Names of compounds and developers are fictional.
export const SEED_PROPERTIES: SeedProperty[] = [
  {
    category: 'sale',
    type: 'villa',
    titleAr: 'فيلا مستقلة بحمام سباحة خاص',
    titleEn: 'Standalone villa with private pool',
    areaId: 'new-cairo',
    compoundAr: 'كمبوند سيدار هيلز',
    compoundEn: 'Cedar Hills',
    price: 24500000,
    oldPrice: 26000000,
    beds: 5,
    baths: 5,
    sizeM2: 420,
    finishing: 'full',
    featured: true,
    maintenanceFee: 8,
    planDownPct: 20,
    planYears: 5,
    views: 2140,
    listedDays: 3,
    agentEmail: 'omar@maqar.app',
    features: ['pool', 'garden', 'parking', 'security', 'smart', 'clubhouse'],
    images: ['p1.jpg', 'p3.jpg', 'p17.jpg', 'p14.jpg', 'p29.jpg'],
    descAr: 'فيلا بتصميم معاصر على زاوية، حديقة ٣٠٠ م² وحمام سباحة خاص، تشطيب كامل بأجهزة سمارت هوم، على بعد ٥ دقائق من شارع التسعين.',
    descEn: 'A contemporary corner villa with a 300 m² garden and private pool, fully finished with smart-home controls, five minutes from 90th Street.',
  },
  {
    category: 'sale',
    type: 'apartment',
    titleAr: 'شقة ٣ غرف بإطلالة على اللاندسكيب',
    titleEn: '3-bed apartment overlooking landscape',
    areaId: 'zayed',
    compoundAr: 'الواحة ريزيدنس',
    compoundEn: 'Al Waha Residence',
    price: 7850000,
    beds: 3,
    baths: 2,
    sizeM2: 175,
    floor: 3,
    finishing: 'full',
    featured: true,
    maintenanceFee: 8,
    planDownPct: 25,
    planYears: 4,
    views: 1320,
    listedDays: 6,
    agentEmail: 'omar@maqar.app',
    features: ['garden', 'parking', 'elevator', 'security', 'gym'],
    images: ['p11.jpg', 'p13.jpg', 'p28.jpg', 'p15.jpg', 'p12.jpg'],
    descAr: 'شقة واسعة في الدور الثالث بإطلالة مباشرة على اللاندسكيب، ريسبشن ٣ قطع، مطبخ مفتوح، وأمن ٢٤ ساعة.',
    descEn: 'A wide third-floor apartment with a direct landscape view, three-piece reception, open kitchen and 24/7 security.',
  },
  {
    category: 'project',
    type: 'apartment',
    titleAr: 'شقق بمقدم ١٠٪ وتقسيط ٨ سنوات',
    titleEn: 'Apartments, 10% down over 8 years',
    areaId: 'capital',
    compoundAr: 'أبراج لؤلؤة النيل',
    compoundEn: 'Nile Pearl Towers',
    developerAr: 'مطوّر: أركان للتطوير',
    developerEn: 'Developer: Arkan Development',
    price: 5400000,
    beds: 2,
    baths: 2,
    sizeM2: 128,
    floor: 9,
    finishing: 'semi',
    deliveryYear: 2028,
    featured: true,
    maintenanceFee: 7,
    planDownPct: 10,
    planYears: 8,
    views: 3870,
    listedDays: 1,
    agentEmail: 'mariam@maqar.app',
    features: ['elevator', 'parking', 'security', 'gym', 'clubhouse', 'smart'],
    images: ['p21.jpg', 'p12.jpg', 'p10.jpg', 'p14.jpg'],
    descAr: 'مشروع سكني في قلب الحي المالي بالعاصمة الإدارية، استلام ٢٠٢٨، نصف تشطيب، وخطة سداد مرنة حتى ٨ سنوات.',
    descEn: 'A residential tower in the New Capital financial district, handover 2028, semi-finished, with flexible plans up to 8 years.',
  },
  {
    category: 'sale',
    type: 'chalet',
    titleAr: 'شاليه صف أول على البحر',
    titleEn: 'First-row sea-view chalet',
    areaId: 'north-coast',
    compoundAr: 'أزور باي',
    compoundEn: 'Azure Bay',
    price: 11200000,
    oldPrice: 12100000,
    beds: 3,
    baths: 2,
    sizeM2: 140,
    finishing: 'furnished',
    featured: true,
    maintenanceFee: 10,
    planDownPct: 15,
    planYears: 6,
    views: 4210,
    listedDays: 2,
    agentEmail: 'youssef@maqar.app',
    features: ['sea', 'pool', 'parking', 'security', 'clubhouse'],
    images: ['p19.jpg', 'p20.jpg', 'p16.jpg', 'p27.jpg'],
    descAr: 'شاليه مفروش بالكامل على الصف الأول مباشرة، تراس ٤٠ م² بإطلالة بانورامية على البحر، ويصلح للاستثمار بالإيجار الصيفي.',
    descEn: 'A fully furnished first-row chalet with a 40 m² terrace and panoramic sea view, a strong pick for summer-rental income.',
  },
  {
    category: 'rent',
    type: 'apartment',
    titleAr: 'شقة مفروشة للإيجار قريبة من الجامعة الأمريكية',
    titleEn: 'Furnished flat near the AUC',
    areaId: 'new-cairo',
    compoundAr: 'بالم كريست',
    compoundEn: 'Palm Crest',
    price: 45000,
    beds: 2,
    baths: 2,
    sizeM2: 140,
    floor: 2,
    finishing: 'furnished',
    featured: false,
    views: 880,
    listedDays: 4,
    agentEmail: 'salma@maqar.app',
    features: ['parking', 'elevator', 'security', 'gym'],
    images: ['p9.jpg', 'p10.jpg', 'p28.jpg', 'p30.jpg'],
    descAr: 'شقة مفروشة بالكامل بأجهزة جديدة، تكييفات في كل الغرف، عقد سنوي قابل للتجديد.',
    descEn: 'Fully furnished with new appliances, air conditioning in every room, and a renewable one-year lease.',
  },
  {
    category: 'stay',
    type: 'villa',
    titleAr: 'فيلا للإقامة القصيرة بحمام سباحة',
    titleEn: 'Holiday villa with pool',
    areaId: 'sokhna',
    compoundAr: 'لا ماريه',
    compoundEn: 'La Marée',
    price: 9500,
    beds: 4,
    baths: 3,
    sizeM2: 260,
    finishing: 'furnished',
    featured: true,
    views: 1960,
    listedDays: 5,
    agentEmail: 'youssef@maqar.app',
    features: ['pool', 'sea', 'garden', 'parking', 'security'],
    images: ['p18.jpg', 'p5.jpg', 'p17.jpg', 'p20.jpg'],
    descAr: 'فيلا مجهزة للعائلات، ساعة واحدة من القاهرة، حمام سباحة خاص وشاطئ رملي على بعد دقيقتين.',
    descEn: 'A family-ready villa one hour from Cairo, with a private pool and a sandy beach two minutes away.',
  },
  {
    category: 'sale',
    type: 'twinhouse',
    titleAr: 'توين هاوس بحديقة خاصة',
    titleEn: 'Twin house with private garden',
    areaId: 'zayed',
    compoundAr: 'جرين بارك',
    compoundEn: 'Green Park',
    price: 16900000,
    beds: 4,
    baths: 4,
    sizeM2: 310,
    finishing: 'semi',
    featured: false,
    maintenanceFee: 8,
    planDownPct: 30,
    planYears: 3,
    views: 1105,
    listedDays: 9,
    agentEmail: 'omar@maqar.app',
    features: ['garden', 'parking', 'security', 'clubhouse', 'roof'],
    images: ['p2.jpg', 'p26.jpg', 'p3.jpg', 'p15.jpg'],
    descAr: 'توين هاوس على حديقة مركزية، نصف تشطيب مع إمكانية التشطيب حسب ذوقك، ورووف خاص.',
    descEn: 'A twin house on the central park, semi-finished so you can finish it your way, with a private roof.',
  },
  {
    category: 'project',
    type: 'townhouse',
    titleAr: 'تاون هاوس في مشروع جديد',
    titleEn: 'Townhouses in a new launch',
    areaId: 'october',
    compoundAr: 'ريفيرا جاردنز',
    compoundEn: 'Riviera Gardens',
    developerAr: 'مطوّر: دار المدائن',
    developerEn: 'Developer: Dar Al Madaen',
    price: 9900000,
    beds: 3,
    baths: 3,
    sizeM2: 220,
    finishing: 'core',
    deliveryYear: 2029,
    featured: false,
    maintenanceFee: 7,
    planDownPct: 5,
    planYears: 10,
    views: 2290,
    listedDays: 2,
    agentEmail: 'mariam@maqar.app',
    features: ['garden', 'parking', 'security', 'clubhouse', 'gym'],
    images: ['p31.jpg', 'p4.jpg', 'p13.jpg'],
    descAr: 'إطلاق جديد بمقدم ٥٪ فقط وتقسيط حتى ١٠ سنوات، تاون هاوس بحديقة أمامية وخلفية.',
    descEn: 'A new launch from just 5% down with payments over up to 10 years; townhouses with front and back gardens.',
  },
  {
    category: 'sale',
    type: 'penthouse',
    titleAr: 'بنتهاوس بتراس واسع',
    titleEn: 'Penthouse with a wide terrace',
    areaId: 'maadi',
    compoundAr: 'دجلة فيوز',
    compoundEn: 'Degla Views',
    price: 13400000,
    oldPrice: 14200000,
    beds: 3,
    baths: 3,
    sizeM2: 230,
    floor: 8,
    finishing: 'full',
    featured: false,
    views: 1450,
    listedDays: 12,
    agentEmail: 'omar@maqar.app',
    features: ['roof', 'elevator', 'parking', 'security'],
    images: ['p27.jpg', 'p3.jpg', 'p16.jpg', 'p30.jpg'],
    descAr: 'بنتهاوس بتراس ٩٠ م² في قلب المعادي الهادئة، تشطيب فاخر وإطلالة مفتوحة على المدينة.',
    descEn: 'A penthouse with a 90 m² terrace in quiet Maadi, luxury finishing and an open city view.',
  },
  {
    category: 'stay',
    type: 'chalet',
    titleAr: 'شاليه بإطلالة على اللاجون',
    titleEn: 'Lagoon-view chalet',
    areaId: 'north-coast',
    compoundAr: 'أزور باي',
    compoundEn: 'Azure Bay',
    price: 6200,
    beds: 2,
    baths: 2,
    sizeM2: 110,
    finishing: 'furnished',
    featured: false,
    views: 2780,
    listedDays: 1,
    agentEmail: 'youssef@maqar.app',
    features: ['sea', 'pool', 'security'],
    images: ['p20.jpg', 'p19.jpg', 'p28.jpg'],
    descAr: 'شاليه بإطلالة على اللاجون، مناسب للأزواج والعائلات الصغيرة، الحد الأدنى ليلتين.',
    descEn: 'A lagoon-view chalet for couples and small families, two-night minimum.',
  },
  {
    category: 'rent',
    type: 'villa',
    titleAr: 'فيلا للإيجار بحديقة كبيرة',
    titleEn: 'Villa for rent with large garden',
    areaId: 'zayed',
    compoundAr: 'الواحة ريزيدنس',
    compoundEn: 'Al Waha Residence',
    price: 140000,
    beds: 5,
    baths: 4,
    sizeM2: 450,
    finishing: 'full',
    featured: false,
    views: 640,
    listedDays: 7,
    agentEmail: 'salma@maqar.app',
    features: ['garden', 'pool', 'parking', 'security', 'smart'],
    images: ['p7.jpg', 'p11.jpg', 'p17.jpg', 'p14.jpg'],
    descAr: 'فيلا للإيجار طويل المدة، مناسبة للعائلات والسفارات، حديقة ٤٠٠ م².',
    descEn: 'A long-term rental villa suited to families and embassies, with a 400 m² garden.',
  },
  {
    category: 'project',
    type: 'chalet',
    titleAr: 'شاليهات العلمين بالتقسيط',
    titleEn: 'New Alamein chalets on installments',
    areaId: 'alamein',
    compoundAr: 'مرسى الشمس',
    compoundEn: 'Marsa El Shams',
    developerAr: 'مطوّر: ساحل للتطوير',
    developerEn: 'Developer: Sahel Developments',
    price: 8300000,
    beds: 2,
    baths: 2,
    sizeM2: 120,
    finishing: 'full',
    deliveryYear: 2027,
    featured: false,
    maintenanceFee: 10,
    planDownPct: 10,
    planYears: 7,
    views: 3120,
    listedDays: 3,
    agentEmail: 'youssef@maqar.app',
    features: ['sea', 'pool', 'security', 'clubhouse'],
    images: ['p22.jpg', 'p20.jpg', 'p16.jpg'],
    descAr: 'شاليهات تشطيب كامل على بعد ٣٠٠ متر من البحر في العلمين الجديدة، استلام صيف ٢٠٢٧.',
    descEn: 'Fully finished chalets 300 m from the sea in New Alamein, handover summer 2027.',
  },
  {
    category: 'sale',
    type: 'duplex',
    titleAr: 'دوبلكس بحديقة في التجمع',
    titleEn: 'Garden duplex in New Cairo',
    areaId: 'new-cairo',
    compoundAr: 'بالم كريست',
    compoundEn: 'Palm Crest',
    price: 10750000,
    beds: 4,
    baths: 3,
    sizeM2: 260,
    finishing: 'full',
    featured: false,
    maintenanceFee: 8,
    planDownPct: 20,
    planYears: 5,
    views: 990,
    listedDays: 15,
    agentEmail: 'mariam@maqar.app',
    features: ['garden', 'parking', 'security', 'gym', 'elevator'],
    images: ['p6.jpg', 'p13.jpg', 'p17.jpg', 'p29.jpg'],
    descAr: 'دوبلكس أرضي بحديقة ١٢٠ م²، ٤ غرف منها ماستر، وقريب من المحور.',
    descEn: 'A ground-floor duplex with a 120 m² garden, four bedrooms including a master suite, close to the main axis.',
  },
  {
    category: 'rent',
    type: 'studio',
    titleAr: 'ستوديو مفروش للشباب',
    titleEn: 'Furnished studio',
    areaId: 'maadi',
    compoundAr: 'دجلة فيوز',
    compoundEn: 'Degla Views',
    price: 18000,
    beds: 1,
    baths: 1,
    sizeM2: 65,
    floor: 4,
    finishing: 'furnished',
    featured: false,
    views: 410,
    listedDays: 2,
    agentEmail: 'salma@maqar.app',
    features: ['elevator', 'security'],
    images: ['p13.jpg', 'p28.jpg', 'p15.jpg'],
    descAr: 'ستوديو مفروش بالكامل قرب كورنيش المعادي، الفواتير مشمولة.',
    descEn: 'A fully furnished studio near the Maadi Corniche, bills included.',
  },
  {
    category: 'sale',
    type: 'villa',
    titleAr: 'فيلا على البحيرة الصناعية',
    titleEn: 'Lagoon-front villa',
    areaId: 'sokhna',
    compoundAr: 'لا ماريه',
    compoundEn: 'La Marée',
    price: 19800000,
    beds: 4,
    baths: 4,
    sizeM2: 340,
    finishing: 'full',
    featured: false,
    maintenanceFee: 9,
    planDownPct: 25,
    planYears: 4,
    views: 1680,
    listedDays: 8,
    agentEmail: 'youssef@maqar.app',
    features: ['sea', 'pool', 'garden', 'parking', 'security'],
    images: ['p8.jpg', 'p5.jpg', 'p3.jpg', 'p16.jpg'],
    descAr: 'فيلا على اللاجون مباشرة بممر خاص للشاطئ، تشطيب كامل وجاهزة للسكن.',
    descEn: 'A villa directly on the lagoon with a private beach path, fully finished and ready to move in.',
  },
  {
    category: 'project',
    type: 'apartment',
    titleAr: 'شقق ذكية بالعاصمة',
    titleEn: 'Smart apartments, New Capital',
    areaId: 'capital',
    compoundAr: 'سكاي لاين',
    compoundEn: 'Skyline District',
    developerAr: 'مطوّر: أركان للتطوير',
    developerEn: 'Developer: Arkan Development',
    price: 3950000,
    beds: 1,
    baths: 1,
    sizeM2: 85,
    floor: 12,
    finishing: 'full',
    deliveryYear: 2027,
    featured: false,
    maintenanceFee: 7,
    planDownPct: 10,
    planYears: 6,
    views: 2010,
    listedDays: 4,
    agentEmail: 'mariam@maqar.app',
    features: ['smart', 'elevator', 'parking', 'gym', 'security'],
    images: ['p32.jpg', 'p21.jpg', 'p10.jpg'],
    descAr: 'شقق غرفة واحدة بتشطيب كامل ونظام سمارت هوم، مثالية كأول بيت أو للاستثمار.',
    descEn: 'One-bedroom units, fully finished with smart-home systems; ideal as a first home or an investment.',
  },
];

const DAY = 24 * 60 * 60 * 1000;

/** Rough centre of each demo area. Seed listings get a small offset so pins do not overlap. */
const AREA_CENTRE: Record<string, [number, number]> = {
  'new-cairo': [30.0074, 31.4913],
  zayed: [30.0444, 30.976],
  capital: [30.0197, 31.7631],
  'north-coast': [30.95, 28.9],
  sokhna: [29.6, 32.32],
  october: [29.96, 30.92],
  maadi: [29.9602, 31.2569],
  alamein: [30.818, 28.955],
};

function seedLocation(areaId: string, index: number) {
  const [lat, lng] = AREA_CENTRE[areaId] ?? [30.0444, 31.2357];
  return { lat: Number((lat + (index % 4) * 0.004).toFixed(6)), lng: Number((lng + ((index * 7) % 5) * 0.004).toFixed(6)) };
}

/**
 * Adds the demo listings, all approved, with their photos and amenities. A listing whose
 * English title already exists is skipped, so this is safe to run more than once.
 * Needs the demo agents (seedDemoAccounts) and areas (seedAreas) first.
 */
export async function seedProperties(db: Db, now = Date.now()): Promise<void> {
  const emails = [...new Set(SEED_PROPERTIES.map((p) => p.agentEmail))];
  const agentRows = await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.email, emails));
  const agentId = new Map(agentRows.map((r) => [r.email, r.id]));

  for (const [index, { agentEmail, listedDays, features, images, ...p }] of SEED_PROPERTIES.entries()) {
    const agent = agentId.get(agentEmail);
    if (!agent) throw new Error(`Seed agent ${agentEmail} is missing: run seedDemoAccounts first`);
    const location = seedLocation(p.areaId, index);
    const [exists] = await db
      .select({ id: properties.id, lat: properties.lat })
      .from(properties)
      .where(eq(properties.titleEn, p.titleEn));
    if (exists) {
      // Listings seeded before they had a location get one.
      if (exists.lat === null) await db.update(properties).set(location).where(eq(properties.id, exists.id));
      continue;
    }

    await db.transaction(async (tx) => {
      const [{ id }] = await tx
        .insert(properties)
        .values({ ...p, ...location, agentId: agent, status: 'approved', publishedAt: new Date(now - listedDays * DAY) })
        .$returningId();
      await tx.insert(propertyFeatures).values(features.map((feature) => ({ propertyId: id, feature })));
      await tx
        .insert(propertyImages)
        .values(images.map((file, sort) => ({ propertyId: id, url: `/uploads/seed/${file}`, sort })));
    });
  }
}
