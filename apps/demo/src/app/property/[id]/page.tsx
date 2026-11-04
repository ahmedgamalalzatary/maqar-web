"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { motion } from "motion/react";
import {
  BedDouble,
  Bath,
  Maximize2,
  Layers,
  Rotate3d,
  Share2,
  BellRing,
  Bell,
  Eye,
  Users,
  Star,
  MessageCircle,
  Phone,
  MapPin,
  CalendarCheck,
  Waves,
  Trees,
  Car,
  ArrowUpDown,
  ShieldCheck,
  Dumbbell,
  Building,
  Cpu,
  Sun,
  Clock,
  BadgeCheck,
  TrendingDown,
  Minus,
  Plus,
} from "lucide-react";
import { agentById, areaById, CAT_LABEL, FEATURE_LABEL, FINISH_LABEL, TYPE_LABEL, ROOMS, type Feature } from "@/lib/data";
import { useStore, pushNotify } from "@/lib/store";
import { fmtMoney, fmtNum, useLang, useT } from "@/lib/i18n";
import { useProperties, useProperty } from "@/lib/logic";
import { followPrice } from "@/lib/demo";
import { BackButton, Badge, Button, Card, IconButton, Sheet, Avatar, cx } from "@/components/ui";
import { FavButton, PropertyCard, dropPct, priceSuffix } from "@/components/PropertyCard";
import { InstallmentCalculator } from "@/components/InstallmentCalculator";
import { CompareButton } from "@/components/Compare";

const FEATURE_ICON: Record<Feature, typeof Waves> = {
  pool: Waves,
  garden: Trees,
  sea: Waves,
  parking: Car,
  elevator: ArrowUpDown,
  security: ShieldCheck,
  gym: Dumbbell,
  clubhouse: Building,
  smart: Cpu,
  roof: Sun,
};

const COORDS: Record<string, [number, number]> = {
  "new-cairo": [30.0074, 31.4913],
  zayed: [30.0444, 30.9806],
  capital: [30.0197, 31.76],
  "north-coast": [30.97, 28.73],
  sokhna: [29.6, 32.33],
  october: [29.97, 30.94],
  maadi: [29.96, 31.25],
  alamein: [30.83, 28.95],
};

export default function PropertyPage() {
  const { id } = useParams<{ id: string }>();
  const p = useProperty(id);
  const all = useProperties();
  const t = useT();
  const lang = useLang();
  const alertOn = useStore((s) => s.alerts.includes(id));
  const [slide, setSlide] = useState(0);
  const [stayOpen, setStayOpen] = useState(false);
  const [nights, setNights] = useState(2);
  const [descOpen, setDescOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  if (!p) {
    return (
      <div className="p-6">
        <BackButton />
        <p className="mt-10 text-center text-ink-2">{t("الوحدة دي مش متاحة دلوقتي.", "This home is no longer available.")}</p>
      </div>
    );
  }

  const area = areaById(p.areaId);
  const agent = agentById(p.agentId);
  const drop = dropPct(p);
  const similar = all.filter((x) => x.id !== p.id && (x.areaId === p.areaId || x.cat === p.cat)).slice(0, 5);
  const [lat, lng] = COORDS[p.areaId] ?? [30.04, 31.23];
  const isStay = p.cat === "stay";

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: t(p.title), url });
      else {
        await navigator.clipboard.writeText(url);
        pushNotify(t("تم نسخ الرابط", "Link copied"), t("ابعته لأي حد عايز يشوف الوحدة.", "Send it to anyone who should see this home."), undefined, "sage");
      }
    } catch {}
  };

  const onAlert = () => {
    const on = followPrice(p);
    pushNotify(
      on ? t("هنبلغك لو السعر نزل", "We’ll tell you if the price drops") : t("تم إيقاف تنبيه السعر", "Price alert off"),
      on ? t("(ديمو) هتوصلك إشعار تجريبي خلال ثوانٍ.", "(Demo) a sample alert arrives in a few seconds.") : undefined,
      undefined,
      "sage",
    );
  };

  return (
    <div className="pb-[calc(110px+env(safe-area-inset-bottom))]">
      {/* Gallery */}
      <div className="relative">
        <div
          ref={scroller}
          className="no-scrollbar flex aspect-[4/3.6] snap-x snap-mandatory overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            setSlide(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
          }}
        >
          {p.images.map((src, i) => (
            <div key={src + i} className="relative h-full w-full shrink-0 snap-center">
              <Image src={src} alt="" fill priority={i === 0} sizes="440px" className="object-cover" />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50" />
        <div className="absolute inset-x-4 top-[calc(12px+env(safe-area-inset-top))] flex items-center gap-2">
          <BackButton glass fallback="/explore" />
          <div className="flex-1" />
          <IconButton glass label={t("مشاركة", "Share")} onClick={share}>
            <Share2 className="size-[18px]" />
          </IconButton>
          <CompareButton id={p.id} />
          <FavButton id={p.id} />
        </div>
        <div className="absolute inset-x-4 bottom-10 flex items-end justify-between">
          {p.tour ? (
            <Link
              href={`/property/${p.id}/tour`}
              className="flex h-11 items-center gap-2 rounded-full bg-white/95 pe-4 ps-1.5 text-[13px] font-semibold text-navy shadow-float active:scale-95"
            >
              <span className="grid size-8 place-items-center rounded-full bg-navy text-gold">
                <Rotate3d className="size-[18px]" />
              </span>
              {t("جولة ٣٦٠°", "360° tour")}
            </Link>
          ) : (
            <span />
          )}
          <Badge tone="glass" className="tabular">
            {fmtNum(slide + 1, lang)} / {fmtNum(p.images.length, lang)}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="relative -mt-6 rounded-t-[30px] bg-bg px-4 pt-5">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="ink">{t(CAT_LABEL[p.cat])}</Badge>
          <Badge>{t(TYPE_LABEL[p.type])}</Badge>
          <Badge tone="sage">{p.delivery === "ready" ? t("استلام فوري", "Ready to move") : t(`استلام ${fmtNum(p.delivery, "ar", { useGrouping: false })}`, `Delivery ${p.delivery}`)}</Badge>
          {p.ownerId && (
            <Badge tone="success">
              <BadgeCheck className="size-3" /> {t("مالك موثّق", "Verified owner")}
            </Badge>
          )}
        </div>
        <h1 className="mt-3 text-[22px] font-semibold leading-snug">{t(p.title)}</h1>
        <div className="mt-1.5 flex items-center gap-1 text-[13px] text-ink-2">
          <MapPin className="size-4" /> {t(p.compound)} | {t(area.name)}، {t(area.city)}
        </div>
        {p.developer && <div className="mt-1 text-[12px] text-ink-3">{t(p.developer)}</div>}

        {/* Price + alert */}
        <div className="mt-4 flex items-center gap-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
          <div className="min-w-0 flex-1">
            <div className="tabular text-[24px] font-semibold leading-none">
              {fmtMoney(p.price, lang, false)}
              <span className="text-[13px] font-normal text-ink-3"> {priceSuffix(p, t)}</span>
            </div>
            {p.oldPrice ? (
              <div className="mt-1.5 flex items-center gap-2 text-[12px]">
                <span className="tabular text-ink-3 line-through">{fmtMoney(p.oldPrice, lang, false)}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-[#e0574b]">
                  <TrendingDown className="size-3.5" /> {t(`نزل ${fmtNum(drop, "ar")}٪`, `${drop}% lower`)}
                </span>
              </div>
            ) : (
              <div className="mt-1.5 text-[12px] text-ink-3">{t(`${fmtMoney(Math.round(p.price / p.size), "ar", false)} للمتر`, `${fmtMoney(Math.round(p.price / p.size), "en", false)} per m²`)}</div>
            )}
          </div>
          {!isStay && (
            <button
              onClick={onAlert}
              aria-pressed={alertOn}
              className={cx(
                "flex h-11 items-center gap-1.5 rounded-2xl px-3 text-[12px] font-semibold transition active:scale-95",
                alertOn ? "bg-accent text-navy" : "bg-accent-soft text-accent-ink",
              )}
            >
              <motion.span key={String(alertOn)} initial={{ rotate: alertOn ? -25 : 0 }} animate={{ rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 8 }}>
                {alertOn ? <BellRing className="size-4" /> : <Bell className="size-4" />}
              </motion.span>
              {alertOn ? t("متابع السعر", "Following") : t("نبهني لو نزل", "Alert on drop")}
            </button>
          )}
        </div>

        {/* Specs */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { icon: BedDouble, v: fmtNum(p.beds, lang), l: t("غرف", "Beds") },
            { icon: Bath, v: fmtNum(p.baths, lang), l: t("حمام", "Baths") },
            { icon: Maximize2, v: fmtNum(p.size, lang), l: t("م²", "m²") },
            { icon: Layers, v: p.floor !== undefined ? fmtNum(p.floor, lang) : "—", l: t("الدور", "Floor") },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center rounded-2xl bg-surface py-3 ring-1 ring-line">
              <s.icon className="size-5 text-accent" />
              <span className="tabular mt-1.5 text-[15px] font-semibold">{s.v}</span>
              <span className="text-[11px] text-ink-3">{s.l}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-4 px-1 text-[12px] text-ink-2">
          <span className="tabular inline-flex items-center gap-1">
            <Eye className="size-3.5" /> {t(`${fmtNum(p.views, "ar")} مشاهدة`, `${p.views.toLocaleString()} views`)}
          </span>
          <span className="tabular inline-flex items-center gap-1">
            <Users className="size-3.5" /> {t(`${fmtNum(p.interested, "ar")} مهتم`, `${p.interested} interested`)}
          </span>
          <span className="ms-auto">{t(FINISH_LABEL[p.finishing])}</span>
        </div>

        {/* Virtual tour */}
        {p.tour && (
          <Link href={`/property/${p.id}/tour`} className="relative mt-6 block h-40 overflow-hidden rounded-3xl active:scale-[0.99]">
            <Image src={ROOMS[p.tour[0]].pano} alt="" fill sizes="440px" className="scale-125 object-cover" />
            <span className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/50 to-transparent rtl:bg-gradient-to-l" />
            <span className="absolute inset-y-0 start-0 flex flex-col justify-center gap-1 p-5 text-cream">
              <span className="flex items-center gap-2 text-[12px] font-medium text-gold">
                <Rotate3d className="size-4" /> {t("جولة افتراضية", "Virtual tour")}
              </span>
              <span className="text-[18px] font-semibold">{t("ادخل الوحدة من موبايلك", "Step inside from your phone")}</span>
              <span className="text-[12px] text-cream/70">
                {t(`${fmtNum(p.tour.length, "ar")} غرف | اسحب أو حرّك الموبايل`, `${p.tour.length} rooms | drag or move your phone`)}
              </span>
            </span>
          </Link>
        )}

        {/* Agent */}
        <Card className="mt-6 p-4">
          <div className="text-[12px] font-medium text-ink-3">{t("مسؤول المبيعات للوحدة دي", "Your sales advisor for this home")}</div>
          <div className="mt-3 flex items-center gap-3">
            <Avatar name={agent.name.en} tone={agent.tone} size={52} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[15px] font-semibold">
                {t(agent.name)} <BadgeCheck className="size-4 text-accent" />
              </div>
              <div className="text-[12px] text-ink-2">{t(agent.role)}</div>
              <div className="tabular mt-1 flex items-center gap-3 text-[11.5px] text-ink-2">
                <span className="inline-flex items-center gap-0.5">
                  <Star className="size-3.5 fill-accent text-accent" /> {fmtNum(agent.rating, lang)}
                </span>
                <span>{t(`${fmtNum(agent.deals, "ar")} صفقة`, `${agent.deals} deals`)}</span>
                <span className="inline-flex items-center gap-0.5">
                  <Clock className="size-3" /> {t(`يرد خلال ${fmtNum(agent.replyMins, "ar")} د`, `replies in ${agent.replyMins}m`)}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button href={`/chat/${p.id}`}>
              <MessageCircle className="size-4" /> {t("شات مباشر", "Live chat")}
            </Button>
            <Button variant="soft" onClick={() => pushNotify(t("(ديمو) اتصال", "(Demo) Calling"), agent.phone, undefined, "sage")}>
              <Phone className="size-4" /> {t("اتصال", "Call")}
            </Button>
          </div>
        </Card>

        {/* Installments */}
        {(p.cat === "sale" || p.cat === "project") && (
          <section id="installments" className="mt-8 scroll-mt-24">
            <h2 className="mb-1 text-[17px] font-semibold">{t("احسب قسطك", "Your installment")}</h2>
            <p className="mb-4 text-[12.5px] text-ink-2">
              {p.plan
                ? t(`خطة الوحدة: مقدم ${fmtNum(p.plan.downPct, "ar")}٪ على ${fmtNum(p.plan.years, "ar")} سنين. غيّرها براحتك.`, `This home’s plan: ${p.plan.downPct}% down over ${p.plan.years} years. Adjust freely.`)
                : t("جرّب مقدم ومدة تناسبك.", "Try a down payment and period that suit you.")}
            </p>
            <InstallmentCalculator price={p.price} defaultDown={p.plan?.downPct ?? 20} defaultYears={p.plan?.years ?? 5} compact />
          </section>
        )}

        {/* Description */}
        <section className="mt-8">
          <h2 className="mb-2 text-[17px] font-semibold">{t("عن الوحدة", "About this home")}</h2>
          <p className={cx("text-[14px] leading-7 text-ink-2", !descOpen && "line-clamp-3")}>{t(p.desc)}</p>
          <button onClick={() => setDescOpen((v) => !v)} className="mt-1 text-[13px] font-medium text-accent-ink">
            {descOpen ? t("أقل", "Less") : t("اقرأ أكتر", "Read more")}
          </button>
          {p.maintenance && (
            <div className="mt-2 text-[12.5px] text-ink-3">{t(`مصاريف الصيانة: ${fmtNum(p.maintenance, "ar")}٪ من سعر الوحدة`, `Maintenance: ${p.maintenance}% of unit price`)}</div>
          )}
        </section>

        {/* Amenities */}
        <section className="mt-7">
          <h2 className="mb-3 text-[17px] font-semibold">{t("المميزات", "Amenities")}</h2>
          <div className="grid grid-cols-2 gap-2">
            {p.features.map((f) => {
              const Icon = FEATURE_ICON[f];
              return (
                <div key={f} className="flex items-center gap-2.5 rounded-2xl bg-surface px-3 py-3 ring-1 ring-line">
                  <span className="grid size-8 place-items-center rounded-xl bg-sage-soft text-sage-ink">
                    <Icon className="size-4" />
                  </span>
                  <span className="text-[13px] font-medium">{t(FEATURE_LABEL[f])}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Map */}
        <section className="mt-7">
          <h2 className="mb-3 text-[17px] font-semibold">{t("الموقع", "Location")}</h2>
          <div className="relative h-44 overflow-hidden rounded-3xl ring-1 ring-line">
            <iframe
              title="map"
              loading="lazy"
              className="pointer-events-none h-full w-full grayscale-[35%]"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.03}%2C${lat - 0.02}%2C${lng + 0.03}%2C${lat + 0.02}&layer=mapnik&marker=${lat}%2C${lng}`}
            />
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-3 end-3 rounded-full bg-surface px-3.5 py-2 text-[12px] font-semibold shadow-card ring-1 ring-line"
            >
              {t("افتح الخريطة", "Open in Maps")}
            </a>
          </div>
        </section>

        {/* Similar */}
        {similar.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-[17px] font-semibold">{t("وحدات مشابهة", "Similar homes")}</h2>
            <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4">
              {similar.map((s) => (
                <div key={s.id} className="w-[70%] shrink-0 snap-start">
                  <PropertyCard p={s} wide />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[440px] border-t border-line bg-surface/92 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <div className="tabular truncate text-[16px] font-semibold">
              {fmtMoney(p.price, lang)} <span className="text-[11px] font-normal text-ink-3">{priceSuffix(p, t)}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-success">
              <span className="size-1.5 animate-pulse rounded-full bg-success" /> {t("مواعيد متاحة النهارده", "Slots available today")}
            </div>
          </div>
          {isStay ? (
            <Button variant="gold" size="lg" className="flex-1" onClick={() => setStayOpen(true)}>
              <CalendarCheck className="size-5" /> {t("احجز إقامتك", "Book your stay")}
            </Button>
          ) : (
            <Button variant="gold" size="lg" className="flex-1" href={`/property/${p.id}/book`}>
              <CalendarCheck className="size-5" /> {t("احجز معاينة", "Book a viewing")}
            </Button>
          )}
        </div>
      </div>

      <Sheet
        open={stayOpen}
        onClose={() => setStayOpen(false)}
        title={t("حجز إقامة", "Book a stay")}
        footer={
          <Button
            full
            size="lg"
            variant="gold"
            onClick={() => {
              setStayOpen(false);
              pushNotify(t("تم إرسال طلب الحجز", "Stay request sent"), t(`${agent.name.ar} هيأكد معاك خلال دقايق.`, `${agent.name.en} will confirm within minutes.`), undefined, "sage");
            }}
          >
            {t(`أكّد | ${fmtMoney(p.price * nights, "ar", false)}`, `Confirm | ${fmtMoney(p.price * nights, "en", false)}`)}
          </Button>
        }
      >
        <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-4">
          <span className="text-[14px] font-medium">{t("عدد الليالي", "Nights")}</span>
          <span className="flex items-center gap-4">
            <IconButton label="-" onClick={() => setNights((n) => Math.max(2, n - 1))}>
              <Minus className="size-4" />
            </IconButton>
            <span className="tabular w-6 text-center text-lg font-semibold">{fmtNum(nights, lang)}</span>
            <IconButton label="+" onClick={() => setNights((n) => Math.min(30, n + 1))}>
              <Plus className="size-4" />
            </IconButton>
          </span>
        </div>
        <p className="mt-3 text-[12.5px] text-ink-2">{t("الحد الأدنى ليلتين. الإلغاء مجاني قبل ٧٢ ساعة.", "Two-night minimum. Free cancellation up to 72 hours before.")}</p>
      </Sheet>
    </div>
  );
}
