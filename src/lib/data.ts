// All data here is demo data. Names of agents, compounds and developers are fictional.

export type Bi = { ar: string; en: string };
export type Category = "sale" | "rent" | "stay" | "project";
export type PropType =
  | "apartment"
  | "villa"
  | "twinhouse"
  | "townhouse"
  | "chalet"
  | "penthouse"
  | "duplex"
  | "studio";
export type Finishing = "full" | "semi" | "core" | "furnished";
export type Feature =
  | "pool"
  | "garden"
  | "sea"
  | "parking"
  | "elevator"
  | "security"
  | "gym"
  | "clubhouse"
  | "smart"
  | "roof";

export type Area = { id: string; name: Bi; city: Bi; img: string };
export type Agent = {
  id: string;
  name: Bi;
  role: Bi;
  rating: number;
  deals: number;
  years: number;
  langs: Bi;
  replyMins: number;
  phone: string;
  tone: string;
};
export type Room = { id: string; name: Bi; pano: string };

export type Property = {
  id: string;
  cat: Category;
  type: PropType;
  title: Bi;
  areaId: string;
  compound: Bi;
  developer?: Bi;
  price: number; // EGP. rent = per month, stay = per night
  oldPrice?: number;
  beds: number;
  baths: number;
  size: number;
  floor?: number;
  finishing: Finishing;
  delivery: "ready" | number;
  images: string[];
  tour?: string[];
  agentId: string;
  views: number;
  interested: number;
  featured?: boolean;
  features: Feature[];
  plan?: { downPct: number; years: number };
  listedDays: number;
  desc: Bi;
  maintenance?: number;
  ownerId?: string;
};

export const AREAS: Area[] = [
  { id: "new-cairo", name: { ar: "التجمع الخامس", en: "New Cairo" }, city: { ar: "القاهرة", en: "Cairo" }, img: "/img/p26.jpg" },
  { id: "zayed", name: { ar: "الشيخ زايد", en: "Sheikh Zayed" }, city: { ar: "الجيزة", en: "Giza" }, img: "/img/p2.jpg" },
  { id: "capital", name: { ar: "العاصمة الإدارية", en: "New Capital" }, city: { ar: "القاهرة", en: "Cairo" }, img: "/img/p21.jpg" },
  { id: "north-coast", name: { ar: "الساحل الشمالي", en: "North Coast" }, city: { ar: "مطروح", en: "Matrouh" }, img: "/img/p19.jpg" },
  { id: "sokhna", name: { ar: "العين السخنة", en: "Ain Sokhna" }, city: { ar: "السويس", en: "Suez" }, img: "/img/p18.jpg" },
  { id: "october", name: { ar: "٦ أكتوبر", en: "6th of October" }, city: { ar: "الجيزة", en: "Giza" }, img: "/img/p12.jpg" },
  { id: "maadi", name: { ar: "المعادي", en: "Maadi" }, city: { ar: "القاهرة", en: "Cairo" }, img: "/img/p11.jpg" },
  { id: "alamein", name: { ar: "العلمين الجديدة", en: "New Alamein" }, city: { ar: "مطروح", en: "Matrouh" }, img: "/img/p22.jpg" },
];

export const AGENTS: Agent[] = [
  { id: "a1", name: { ar: "عمر حسن", en: "Omar Hassan" }, role: { ar: "مستشار مبيعات أول", en: "Senior sales advisor" }, rating: 4.9, deals: 184, years: 7, langs: { ar: "العربية، الإنجليزية", en: "Arabic, English" }, replyMins: 4, phone: "+20 100 000 0001", tone: "#b38959" },
  { id: "a2", name: { ar: "مريم عادل", en: "Mariam Adel" }, role: { ar: "مستشارة مشروعات جديدة", en: "New projects advisor" }, rating: 4.8, deals: 132, years: 5, langs: { ar: "العربية، الإنجليزية، الفرنسية", en: "Arabic, English, French" }, replyMins: 6, phone: "+20 100 000 0002", tone: "#61766d" },
  { id: "a3", name: { ar: "يوسف كمال", en: "Youssef Kamal" }, role: { ar: "مستشار الساحل والسخنة", en: "Coastal homes advisor" }, rating: 4.9, deals: 97, years: 4, langs: { ar: "العربية، الإنجليزية", en: "Arabic, English" }, replyMins: 3, phone: "+20 100 000 0003", tone: "#3d5a80" },
  { id: "a4", name: { ar: "سلمى فاروق", en: "Salma Farouk" }, role: { ar: "مستشارة إيجارات", en: "Rentals advisor" }, rating: 4.7, deals: 210, years: 6, langs: { ar: "العربية، الإنجليزية", en: "Arabic, English" }, replyMins: 5, phone: "+20 100 000 0004", tone: "#8c5e58" },
];

export const ROOMS: Record<string, Room> = {
  living: { id: "living", name: { ar: "المعيشة", en: "Living room" }, pano: "/pano/lebombo.jpg" },
  open: { id: "open", name: { ar: "المطبخ والسفرة", en: "Kitchen & dining" }, pano: "/pano/kiara_interior.jpg" },
  master: { id: "master", name: { ar: "غرفة النوم الرئيسية", en: "Master bedroom" }, pano: "/pano/hotel_room.jpg" },
  bath: { id: "bath", name: { ar: "الحمام", en: "Bathroom" }, pano: "/pano/modern_bathroom.jpg" },
  study: { id: "study", name: { ar: "غرفة المكتب", en: "Study" }, pano: "/pano/photo_studio_loft_hall.jpg" },
  empty: { id: "empty", name: { ar: "الغرفة الثانية", en: "Second bedroom" }, pano: "/pano/small_empty_room_1.jpg" },
};

const FULL_TOUR = ["living", "open", "master", "bath", "study"];

export const PROPERTIES: Property[] = [
  {
    id: "m101", cat: "sale", type: "villa", featured: true,
    title: { ar: "فيلا مستقلة بحمام سباحة خاص", en: "Standalone villa with private pool" },
    areaId: "new-cairo", compound: { ar: "كمبوند سيدار هيلز", en: "Cedar Hills" },
    price: 24_500_000, oldPrice: 26_000_000, beds: 5, baths: 5, size: 420, finishing: "full", delivery: "ready",
    images: ["/img/p1.jpg", "/img/p3.jpg", "/img/p17.jpg", "/img/p14.jpg", "/img/p29.jpg"], tour: FULL_TOUR,
    agentId: "a1", views: 2140, interested: 38, features: ["pool", "garden", "parking", "security", "smart", "clubhouse"],
    plan: { downPct: 20, years: 5 }, listedDays: 3, maintenance: 8,
    desc: { ar: "فيلا بتصميم معاصر على زاوية، حديقة ٣٠٠ م² وحمام سباحة خاص، تشطيب كامل بأجهزة سمارت هوم، على بعد ٥ دقائق من شارع التسعين.", en: "A contemporary corner villa with a 300 m² garden and private pool, fully finished with smart-home controls, five minutes from 90th Street." },
  },
  {
    id: "m102", cat: "sale", type: "apartment", featured: true,
    title: { ar: "شقة ٣ غرف بإطلالة على اللاندسكيب", en: "3-bed apartment overlooking landscape" },
    areaId: "zayed", compound: { ar: "الواحة ريزيدنس", en: "Al Waha Residence" },
    price: 7_850_000, beds: 3, baths: 2, size: 175, floor: 3, finishing: "full", delivery: "ready",
    images: ["/img/p11.jpg", "/img/p13.jpg", "/img/p28.jpg", "/img/p15.jpg", "/img/p12.jpg"], tour: ["living", "open", "master", "bath"],
    agentId: "a1", views: 1320, interested: 24, features: ["garden", "parking", "elevator", "security", "gym"],
    plan: { downPct: 25, years: 4 }, listedDays: 6, maintenance: 8,
    desc: { ar: "شقة واسعة في الدور الثالث بإطلالة مباشرة على اللاندسكيب، ريسبشن ٣ قطع، مطبخ مفتوح، وأمن ٢٤ ساعة.", en: "A wide third-floor apartment with a direct landscape view, three-piece reception, open kitchen and 24/7 security." },
  },
  {
    id: "m103", cat: "project", type: "apartment", featured: true,
    title: { ar: "شقق بمقدم ١٠٪ وتقسيط ٨ سنوات", en: "Apartments, 10% down over 8 years" },
    areaId: "capital", compound: { ar: "أبراج لؤلؤة النيل", en: "Nile Pearl Towers" }, developer: { ar: "مطوّر: أركان للتطوير", en: "Developer: Arkan Development" },
    price: 5_400_000, beds: 2, baths: 2, size: 128, floor: 9, finishing: "semi", delivery: 2028,
    images: ["/img/p21.jpg", "/img/p12.jpg", "/img/p10.jpg", "/img/p14.jpg"], tour: ["living", "empty", "bath"],
    agentId: "a2", views: 3870, interested: 112, features: ["elevator", "parking", "security", "gym", "clubhouse", "smart"],
    plan: { downPct: 10, years: 8 }, listedDays: 1, maintenance: 7,
    desc: { ar: "مشروع سكني في قلب الحي المالي بالعاصمة الإدارية، استلام ٢٠٢٨، نصف تشطيب، وخطة سداد مرنة حتى ٨ سنوات.", en: "A residential tower in the New Capital financial district, handover 2028, semi-finished, with flexible plans up to 8 years." },
  },
  {
    id: "m104", cat: "sale", type: "chalet", featured: true,
    title: { ar: "شاليه صف أول على البحر", en: "First-row sea-view chalet" },
    areaId: "north-coast", compound: { ar: "أزور باي", en: "Azure Bay" },
    price: 11_200_000, oldPrice: 12_100_000, beds: 3, baths: 2, size: 140, finishing: "furnished", delivery: "ready",
    images: ["/img/p19.jpg", "/img/p20.jpg", "/img/p16.jpg", "/img/p27.jpg"], tour: ["living", "master", "bath"],
    agentId: "a3", views: 4210, interested: 76, features: ["sea", "pool", "parking", "security", "clubhouse"],
    plan: { downPct: 15, years: 6 }, listedDays: 2, maintenance: 10,
    desc: { ar: "شاليه مفروش بالكامل على الصف الأول مباشرة، تراس ٤٠ م² بإطلالة بانورامية على البحر، ويصلح للاستثمار بالإيجار الصيفي.", en: "A fully furnished first-row chalet with a 40 m² terrace and panoramic sea view, a strong pick for summer-rental income." },
  },
  {
    id: "m105", cat: "rent", type: "apartment",
    title: { ar: "شقة مفروشة للإيجار قريبة من الجامعة الأمريكية", en: "Furnished flat near the AUC" },
    areaId: "new-cairo", compound: { ar: "بالم كريست", en: "Palm Crest" },
    price: 45_000, beds: 2, baths: 2, size: 140, floor: 2, finishing: "furnished", delivery: "ready",
    images: ["/img/p9.jpg", "/img/p10.jpg", "/img/p28.jpg", "/img/p30.jpg"], tour: ["living", "open", "master"],
    agentId: "a4", views: 880, interested: 19, features: ["parking", "elevator", "security", "gym"],
    listedDays: 4,
    desc: { ar: "شقة مفروشة بالكامل بأجهزة جديدة، تكييفات في كل الغرف، عقد سنوي قابل للتجديد.", en: "Fully furnished with new appliances, air conditioning in every room, and a renewable one-year lease." },
  },
  {
    id: "m106", cat: "stay", type: "villa", featured: true,
    title: { ar: "فيلا للإقامة القصيرة بحمام سباحة", en: "Holiday villa with pool" },
    areaId: "sokhna", compound: { ar: "لا ماريه", en: "La Marée" },
    price: 9_500, beds: 4, baths: 3, size: 260, finishing: "furnished", delivery: "ready",
    images: ["/img/p18.jpg", "/img/p5.jpg", "/img/p17.jpg", "/img/p20.jpg"], tour: ["living", "master", "bath"],
    agentId: "a3", views: 1960, interested: 41, features: ["pool", "sea", "garden", "parking", "security"],
    listedDays: 5,
    desc: { ar: "فيلا مجهزة للعائلات، ساعة واحدة من القاهرة، حمام سباحة خاص وشاطئ رملي على بعد دقيقتين.", en: "A family-ready villa one hour from Cairo, with a private pool and a sandy beach two minutes away." },
  },
  {
    id: "m107", cat: "sale", type: "twinhouse",
    title: { ar: "توين هاوس بحديقة خاصة", en: "Twin house with private garden" },
    areaId: "zayed", compound: { ar: "جرين بارك", en: "Green Park" },
    price: 16_900_000, beds: 4, baths: 4, size: 310, finishing: "semi", delivery: "ready",
    images: ["/img/p2.jpg", "/img/p26.jpg", "/img/p3.jpg", "/img/p15.jpg"], tour: FULL_TOUR,
    agentId: "a1", views: 1105, interested: 17, features: ["garden", "parking", "security", "clubhouse", "roof"],
    plan: { downPct: 30, years: 3 }, listedDays: 9, maintenance: 8,
    desc: { ar: "توين هاوس على حديقة مركزية، نصف تشطيب مع إمكانية التشطيب حسب ذوقك، ورووف خاص.", en: "A twin house on the central park, semi-finished so you can finish it your way, with a private roof." },
  },
  {
    id: "m108", cat: "project", type: "townhouse",
    title: { ar: "تاون هاوس في مشروع جديد", en: "Townhouses in a new launch" },
    areaId: "october", compound: { ar: "ريفيرا جاردنز", en: "Riviera Gardens" }, developer: { ar: "مطوّر: دار المدائن", en: "Developer: Dar Al Madaen" },
    price: 9_900_000, beds: 3, baths: 3, size: 220, finishing: "core", delivery: 2029,
    images: ["/img/p31.jpg", "/img/p4.jpg", "/img/p13.jpg"],
    agentId: "a2", views: 2290, interested: 64, features: ["garden", "parking", "security", "clubhouse", "gym"],
    plan: { downPct: 5, years: 10 }, listedDays: 2, maintenance: 7,
    desc: { ar: "إطلاق جديد بمقدم ٥٪ فقط وتقسيط حتى ١٠ سنوات، تاون هاوس بحديقة أمامية وخلفية.", en: "A new launch from just 5% down with payments over up to 10 years; townhouses with front and back gardens." },
  },
  {
    id: "m109", cat: "sale", type: "penthouse",
    title: { ar: "بنتهاوس بتراس واسع", en: "Penthouse with a wide terrace" },
    areaId: "maadi", compound: { ar: "دجلة فيوز", en: "Degla Views" },
    price: 13_400_000, oldPrice: 14_200_000, beds: 3, baths: 3, size: 230, floor: 8, finishing: "full", delivery: "ready",
    images: ["/img/p27.jpg", "/img/p3.jpg", "/img/p16.jpg", "/img/p30.jpg"], tour: ["living", "open", "master", "bath"],
    agentId: "a1", views: 1450, interested: 29, features: ["roof", "elevator", "parking", "security"],
    listedDays: 12,
    desc: { ar: "بنتهاوس بتراس ٩٠ م² في قلب المعادي الهادئة، تشطيب فاخر وإطلالة مفتوحة على المدينة.", en: "A penthouse with a 90 m² terrace in quiet Maadi, luxury finishing and an open city view." },
  },
  {
    id: "m110", cat: "stay", type: "chalet",
    title: { ar: "شاليه بإطلالة على اللاجون", en: "Lagoon-view chalet" },
    areaId: "north-coast", compound: { ar: "أزور باي", en: "Azure Bay" },
    price: 6_200, beds: 2, baths: 2, size: 110, finishing: "furnished", delivery: "ready",
    images: ["/img/p20.jpg", "/img/p19.jpg", "/img/p28.jpg"], tour: ["living", "master"],
    agentId: "a3", views: 2780, interested: 52, features: ["sea", "pool", "security"],
    listedDays: 1,
    desc: { ar: "شاليه بإطلالة على اللاجون، مناسب للأزواج والعائلات الصغيرة، الحد الأدنى ليلتين.", en: "A lagoon-view chalet for couples and small families, two-night minimum." },
  },
  {
    id: "m111", cat: "rent", type: "villa",
    title: { ar: "فيلا للإيجار بحديقة كبيرة", en: "Villa for rent with large garden" },
    areaId: "zayed", compound: { ar: "الواحة ريزيدنس", en: "Al Waha Residence" },
    price: 140_000, beds: 5, baths: 4, size: 450, finishing: "full", delivery: "ready",
    images: ["/img/p7.jpg", "/img/p11.jpg", "/img/p17.jpg", "/img/p14.jpg"], tour: FULL_TOUR,
    agentId: "a4", views: 640, interested: 11, features: ["garden", "pool", "parking", "security", "smart"],
    listedDays: 7,
    desc: { ar: "فيلا للإيجار طويل المدة، مناسبة للعائلات والسفارات، حديقة ٤٠٠ م².", en: "A long-term rental villa suited to families and embassies, with a 400 m² garden." },
  },
  {
    id: "m112", cat: "project", type: "chalet",
    title: { ar: "شاليهات العلمين بالتقسيط", en: "New Alamein chalets on installments" },
    areaId: "alamein", compound: { ar: "مرسى الشمس", en: "Marsa El Shams" }, developer: { ar: "مطوّر: ساحل للتطوير", en: "Developer: Sahel Developments" },
    price: 8_300_000, beds: 2, baths: 2, size: 120, finishing: "full", delivery: 2027,
    images: ["/img/p22.jpg", "/img/p20.jpg", "/img/p16.jpg"], tour: ["living", "master", "bath"],
    agentId: "a3", views: 3120, interested: 88, features: ["sea", "pool", "security", "clubhouse"],
    plan: { downPct: 10, years: 7 }, listedDays: 3, maintenance: 10,
    desc: { ar: "شاليهات تشطيب كامل على بعد ٣٠٠ متر من البحر في العلمين الجديدة، استلام صيف ٢٠٢٧.", en: "Fully finished chalets 300 m from the sea in New Alamein, handover summer 2027." },
  },
  {
    id: "m113", cat: "sale", type: "duplex",
    title: { ar: "دوبلكس بحديقة في التجمع", en: "Garden duplex in New Cairo" },
    areaId: "new-cairo", compound: { ar: "بالم كريست", en: "Palm Crest" },
    price: 10_750_000, beds: 4, baths: 3, size: 260, finishing: "full", delivery: "ready",
    images: ["/img/p6.jpg", "/img/p13.jpg", "/img/p17.jpg", "/img/p29.jpg"], tour: FULL_TOUR,
    agentId: "a2", views: 990, interested: 21, features: ["garden", "parking", "security", "gym", "elevator"],
    plan: { downPct: 20, years: 5 }, listedDays: 15, maintenance: 8,
    desc: { ar: "دوبلكس أرضي بحديقة ١٢٠ م²، ٤ غرف منها ماستر، وقريب من المحور.", en: "A ground-floor duplex with a 120 m² garden, four bedrooms including a master suite, close to the main axis." },
  },
  {
    id: "m114", cat: "rent", type: "studio",
    title: { ar: "ستوديو مفروش للشباب", en: "Furnished studio" },
    areaId: "maadi", compound: { ar: "دجلة فيوز", en: "Degla Views" },
    price: 18_000, beds: 1, baths: 1, size: 65, floor: 4, finishing: "furnished", delivery: "ready",
    images: ["/img/p13.jpg", "/img/p28.jpg", "/img/p15.jpg"],
    agentId: "a4", views: 410, interested: 9, features: ["elevator", "security"],
    listedDays: 2,
    desc: { ar: "ستوديو مفروش بالكامل قرب كورنيش المعادي، الفواتير مشمولة.", en: "A fully furnished studio near the Maadi Corniche, bills included." },
  },
  {
    id: "m115", cat: "sale", type: "villa",
    title: { ar: "فيلا على البحيرة الصناعية", en: "Lagoon-front villa" },
    areaId: "sokhna", compound: { ar: "لا ماريه", en: "La Marée" },
    price: 19_800_000, beds: 4, baths: 4, size: 340, finishing: "full", delivery: "ready",
    images: ["/img/p8.jpg", "/img/p5.jpg", "/img/p3.jpg", "/img/p16.jpg"], tour: FULL_TOUR,
    agentId: "a3", views: 1680, interested: 33, features: ["sea", "pool", "garden", "parking", "security"],
    plan: { downPct: 25, years: 4 }, listedDays: 8, maintenance: 9,
    desc: { ar: "فيلا على اللاجون مباشرة بممر خاص للشاطئ، تشطيب كامل وجاهزة للسكن.", en: "A villa directly on the lagoon with a private beach path, fully finished and ready to move in." },
  },
  {
    id: "m116", cat: "project", type: "apartment",
    title: { ar: "شقق ذكية بالعاصمة", en: "Smart apartments, New Capital" },
    areaId: "capital", compound: { ar: "سكاي لاين", en: "Skyline District" }, developer: { ar: "مطوّر: أركان للتطوير", en: "Developer: Arkan Development" },
    price: 3_950_000, beds: 1, baths: 1, size: 85, floor: 12, finishing: "full", delivery: 2027,
    images: ["/img/p32.jpg", "/img/p21.jpg", "/img/p10.jpg"],
    agentId: "a2", views: 2010, interested: 57, features: ["smart", "elevator", "parking", "gym", "security"],
    plan: { downPct: 10, years: 6 }, listedDays: 4, maintenance: 7,
    desc: { ar: "شقق غرفة واحدة بتشطيب كامل ونظام سمارت هوم، مثالية كأول بيت أو للاستثمار.", en: "One-bedroom units, fully finished with smart-home systems; ideal as a first home or an investment." },
  },
];

export const TYPE_LABEL: Record<PropType, Bi> = {
  apartment: { ar: "شقة", en: "Apartment" },
  villa: { ar: "فيلا", en: "Villa" },
  twinhouse: { ar: "توين هاوس", en: "Twin house" },
  townhouse: { ar: "تاون هاوس", en: "Townhouse" },
  chalet: { ar: "شاليه", en: "Chalet" },
  penthouse: { ar: "بنتهاوس", en: "Penthouse" },
  duplex: { ar: "دوبلكس", en: "Duplex" },
  studio: { ar: "ستوديو", en: "Studio" },
};

export const CAT_LABEL: Record<Category, Bi> = {
  sale: { ar: "للبيع", en: "Buy" },
  rent: { ar: "للإيجار", en: "Rent" },
  stay: { ar: "إقامة قصيرة", en: "Stays" },
  project: { ar: "مشروعات جديدة", en: "New projects" },
};

export const FINISH_LABEL: Record<Finishing, Bi> = {
  full: { ar: "تشطيب كامل", en: "Fully finished" },
  semi: { ar: "نصف تشطيب", en: "Semi-finished" },
  core: { ar: "على الطوب", en: "Core & shell" },
  furnished: { ar: "مفروش", en: "Furnished" },
};

export const FEATURE_LABEL: Record<Feature, Bi> = {
  pool: { ar: "حمام سباحة", en: "Pool" },
  garden: { ar: "حديقة", en: "Garden" },
  sea: { ar: "إطلالة بحر", en: "Sea view" },
  parking: { ar: "جراج", en: "Parking" },
  elevator: { ar: "أسانسير", en: "Elevator" },
  security: { ar: "أمن ٢٤ ساعة", en: "24/7 security" },
  gym: { ar: "جيم", en: "Gym" },
  clubhouse: { ar: "كلوب هاوس", en: "Clubhouse" },
  smart: { ar: "سمارت هوم", en: "Smart home" },
  roof: { ar: "رووف", en: "Roof" },
};

export const areaById = (id: string) => AREAS.find((a) => a.id === id)!;
export const agentById = (id: string) => AGENTS.find((a) => a.id === id)!;
