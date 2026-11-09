import type { Category, Feature, Finishing, LeadStage, PropertyType, Role } from './enums.js';

/** Text in both languages (contract §7). */
export type Bi = { ar: string; en: string };

export const ROLE_LABEL: Record<Role, Bi> = {
  client: { ar: 'عميل', en: 'Client' },
  agent: { ar: 'مسؤول مبيعات', en: 'Sales agent' },
  admin: { ar: 'فريق مقر', en: 'Maqar admin' },
};

export const CATEGORY_LABEL: Record<Category, Bi> = {
  sale: { ar: 'للبيع', en: 'Buy' },
  rent: { ar: 'للإيجار', en: 'Rent' },
  stay: { ar: 'إقامة قصيرة', en: 'Stays' },
  project: { ar: 'مشروعات جديدة', en: 'New projects' },
};

export const PROPERTY_TYPE_LABEL: Record<PropertyType, Bi> = {
  apartment: { ar: 'شقة', en: 'Apartment' },
  villa: { ar: 'فيلا', en: 'Villa' },
  twinhouse: { ar: 'توين هاوس', en: 'Twin house' },
  townhouse: { ar: 'تاون هاوس', en: 'Townhouse' },
  chalet: { ar: 'شاليه', en: 'Chalet' },
  penthouse: { ar: 'بنتهاوس', en: 'Penthouse' },
  duplex: { ar: 'دوبلكس', en: 'Duplex' },
  studio: { ar: 'ستوديو', en: 'Studio' },
};

export const FINISHING_LABEL: Record<Finishing, Bi> = {
  full: { ar: 'تشطيب كامل', en: 'Fully finished' },
  semi: { ar: 'نصف تشطيب', en: 'Semi-finished' },
  core: { ar: 'على الطوب', en: 'Core & shell' },
  furnished: { ar: 'مفروش', en: 'Furnished' },
};

export const FEATURE_LABEL: Record<Feature, Bi> = {
  pool: { ar: 'حمام سباحة', en: 'Pool' },
  garden: { ar: 'حديقة', en: 'Garden' },
  sea: { ar: 'إطلالة بحر', en: 'Sea view' },
  parking: { ar: 'جراج', en: 'Parking' },
  elevator: { ar: 'أسانسير', en: 'Elevator' },
  security: { ar: 'أمن ٢٤ ساعة', en: '24/7 security' },
  gym: { ar: 'جيم', en: 'Gym' },
  clubhouse: { ar: 'كلوب هاوس', en: 'Clubhouse' },
  smart: { ar: 'سمارت هوم', en: 'Smart home' },
  roof: { ar: 'رووف', en: 'Roof' },
};

export const LEAD_STAGE_LABEL: Record<LeadStage, Bi> = {
  new: { ar: 'جديد', en: 'New' },
  contacted: { ar: 'تم التواصل', en: 'Contacted' },
  viewing: { ar: 'معاينة', en: 'Viewing' },
  negotiation: { ar: 'تفاوض', en: 'Negotiation' },
  won: { ar: 'تم البيع', en: 'Won' },
  lost: { ar: 'مغلق', en: 'Lost' },
};
