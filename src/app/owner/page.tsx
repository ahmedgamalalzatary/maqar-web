"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Plus, Eye, Users, CalendarCheck, Heart, Clock, CheckCircle2, FileSearch, Rocket, ShieldCheck, Phone } from "lucide-react";
import { PROPERTIES, areaById, agentById } from "@/lib/data";
import { useStore, type OwnerListing } from "@/lib/store";
import { fmtMoney, fmtNum, relTime, useLang, useT } from "@/lib/i18n";
import { Avatar, Badge, Button, Card, Segmented, Stat, cx } from "@/components/ui";
import { Mark } from "@/components/Logo";

// A sample listing the demo owner already has live.
const DEMO = PROPERTIES.find((p) => p.id === "m113")!;
const DEMO_LISTING: OwnerListing = {
  id: DEMO.id,
  cat: DEMO.cat,
  type: DEMO.type,
  title: DEMO.title.ar,
  areaId: DEMO.areaId,
  price: DEMO.price,
  beds: DEMO.beds,
  baths: DEMO.baths,
  size: DEMO.size,
  finishing: DEMO.finishing,
  features: DEMO.features,
  images: DEMO.images,
  status: "approved",
  createdAt: Date.now() - 15 * 86_400_000,
  views: DEMO.views,
  interested: DEMO.interested,
  saves: 64,
};

const VIEWS_14 = [42, 58, 51, 77, 69, 88, 95, 71, 84, 110, 102, 126, 118, 141];

const INTERESTED = [
  { name: { ar: "أحمد س.", en: "Ahmed S." }, note: { ar: "حجز معاينة الخميس ٥ م", en: "Booked a viewing Thu 5 pm" }, at: Date.now() - 1.2 * 3600_000, hot: true },
  { name: { ar: "مي ع.", en: "Mai A." }, note: { ar: "شاف الجولة ٣٦٠° مرتين وحفظ الوحدة", en: "Watched the 360° tour twice and saved it" }, at: Date.now() - 5 * 3600_000, hot: true },
  { name: { ar: "حسام ك.", en: "Hossam K." }, note: { ar: "سأل عن خطة التقسيط", en: "Asked about the payment plan" }, at: Date.now() - 27 * 3600_000 },
  { name: { ar: "رنا م.", en: "Rana M." }, note: { ar: "فعّل تنبيه السعر", en: "Turned on a price alert" }, at: Date.now() - 50 * 3600_000 },
];

export default function OwnerPortal() {
  const t = useT();
  const lang = useLang();
  const name = useStore((s) => s.name);
  const mine = useStore((s) => s.ownerListings);
  const [range, setRange] = useState<"7" | "14">("14");
  const listings = useMemo(() => [...mine, DEMO_LISTING], [mine]);
  const live = listings.filter((l) => l.status === "approved");
  const totals = live.reduce((a, l) => ({ views: a.views + l.views, interested: a.interested + l.interested, saves: a.saves + l.saves }), { views: 0, interested: 0, saves: 0 });
  const series = range === "7" ? VIEWS_14.slice(-7) : VIEWS_14;
  const max = Math.max(...series);
  const agent = agentById("a2");

  return (
    <div className="pt-[calc(14px+env(safe-area-inset-top))]">
      <div className="flex items-center gap-3 px-4">
        <span className="grid size-11 place-items-center rounded-2xl bg-navy">
          <Mark size={24} cream="#fbf6e9" />
        </span>
        <div className="flex-1">
          <div className="text-[12px] text-ink-2">{t("بوابة الملاك", "Owner portal")}</div>
          <div className="text-[18px] font-semibold">{name ? t(`أهلاً ${name}`, `Hi ${name}`) : t("عقاراتك", "Your properties")}</div>
        </div>
        <Button size="sm" variant="gold" href="/owner/new">
          <Plus className="size-4" /> {t("أضف", "Add")}
        </Button>
      </div>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-2 px-4">
        <Stat label={t("المشاهدات", "Views")} value={<span className="flex items-center gap-1.5"><Eye className="size-4 text-accent" />{fmtNum(totals.views, lang)}</span>} sub={t("+١٨٪ عن الأسبوع اللي فات", "+18% vs last week")} />
        <Stat label={t("عملاء مهتمين", "Interested clients")} value={<span className="flex items-center gap-1.5"><Users className="size-4 text-accent" />{fmtNum(totals.interested, lang)}</span>} sub={t("٤ جداد النهارده", "4 new today")} />
        <Stat label={t("معاينات محجوزة", "Viewings booked")} value={<span className="flex items-center gap-1.5"><CalendarCheck className="size-4 text-accent" />{fmtNum(6, lang)}</span>} sub={t("٢ الأسبوع ده", "2 this week")} />
        <Stat label={t("حفظوا الوحدة", "Saves")} value={<span className="flex items-center gap-1.5"><Heart className="size-4 text-accent" />{fmtNum(totals.saves, lang)}</span>} />
      </div>

      {/* Chart */}
      <Card className="mx-4 mt-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-semibold">{t("المشاهدات اليومية", "Daily views")}</div>
            <div className="text-[11.5px] text-ink-3">{t("كل وحداتك المنشورة", "All your live listings")}</div>
          </div>
          <Segmented id="range" value={range} onChange={setRange} className="w-32" options={[{ value: "7", label: t("٧ أيام", "7d") }, { value: "14", label: t("١٤ يوم", "14d") }]} />
        </div>
        <div className="mt-4 flex h-28 items-end gap-1.5" dir="ltr">
          {series.map((v, i) => (
            <div key={`${range}-${i}`} className="group relative flex h-full flex-1 items-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(v / max) * 100}%` }}
                transition={{ delay: i * 0.025, type: "spring", stiffness: 200, damping: 24 }}
                className={cx("w-full rounded-t-md", i === series.length - 1 ? "bg-accent" : "bg-accent/35")}
              />
              <span className="tabular pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-ink-2 opacity-0 transition group-hover:opacity-100">{v}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Listings */}
      <h2 className="mb-3 mt-7 px-4 text-[17px] font-semibold">{t("عقاراتي", "My listings")}</h2>
      <div className="space-y-3 px-4">
        {listings.map((l) => (
          <ListingCard key={l.id} l={l} />
        ))}
      </div>

      {/* Interested */}
      <h2 className="mb-1 mt-7 px-4 text-[17px] font-semibold">{t("المهتمين بعقارك", "Who’s interested")}</h2>
      <p className="mb-3 px-4 text-[12px] text-ink-2">{t("بنحمي خصوصيتك: مسؤول المبيعات بيتابع مع كل عميل ويبلغك بالجديد.", "Your privacy is protected: your sales advisor follows up with each client and keeps you posted.")}</p>
      <div className="space-y-2 px-4">
        {INTERESTED.map((c, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line">
            <Avatar name={c.name.en} tone={["#b38959", "#61766d", "#3d5a80", "#8c5e58"][i]} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[14px] font-semibold">
                {t(c.name)} {c.hot && <Badge tone="danger" className="!py-0.5">{t("مهتم جداً", "Hot")}</Badge>}
              </div>
              <div className="truncate text-[12px] text-ink-2">{t(c.note)}</div>
            </div>
            <span className="shrink-0 text-[11px] text-ink-3">{relTime(c.at, lang)}</span>
          </div>
        ))}
      </div>

      <Card className="mx-4 mt-4 flex items-center gap-3 p-3.5">
        <Avatar name={agent.name.en} tone={agent.tone} size={44} />
        <div className="flex-1">
          <div className="text-[11px] text-ink-3">{t("مسؤول حسابك في مقر", "Your Maqar account manager")}</div>
          <div className="text-[14px] font-semibold">{t(agent.name)}</div>
        </div>
        <Button size="sm" variant="soft">
          <Phone className="size-4" /> {t("اتصل", "Call")}
        </Button>
      </Card>
      <div className="h-6" />
    </div>
  );
}

function ListingCard({ l }: { l: OwnerListing }) {
  const t = useT();
  const lang = useLang();
  const steps = [
    { icon: FileSearch, label: t("اتبعت", "Submitted") },
    { icon: ShieldCheck, label: t("مراجعة الفريق", "Team review") },
    { icon: Rocket, label: t("منشور", "Live") },
  ];
  const at = l.status === "approved" ? 3 : 1;
  return (
    <div className="overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
      <div className="flex gap-3 p-3">
        <span className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
          {l.images[0] && <Image src={l.images[0]} alt="" fill sizes="80px" className="object-cover" unoptimized={l.images[0].startsWith("data:")} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="truncate text-[14px] font-semibold">{l.title}</div>
            {l.status === "approved" ? (
              <Badge tone="success">
                <CheckCircle2 className="size-3" /> {t("منشور", "Live")}
              </Badge>
            ) : (
              <Badge tone="gold">
                <Clock className="size-3" /> {t("قيد المراجعة", "In review")}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 text-[12px] text-ink-2">{t(areaById(l.areaId).name)}</div>
          <div className="tabular mt-1 text-[14px] font-semibold">{fmtMoney(l.price, lang)}</div>
        </div>
      </div>
      {l.status === "approved" ? (
        <div className="tabular grid grid-cols-3 border-t border-line text-center">
          {[
            [Eye, l.views, t("مشاهدة", "views")],
            [Users, l.interested, t("مهتم", "interested")],
            [Heart, l.saves, t("حفظ", "saves")],
          ].map(([I, v, lab], i) => {
            const Icon = I as typeof Eye;
            return (
              <div key={i} className={cx("py-2.5", i < 2 && "border-e border-line")}>
                <div className="flex items-center justify-center gap-1 text-[14px] font-semibold">
                  <Icon className="size-3.5 text-accent" /> {fmtNum(v as number, lang)}
                </div>
                <div className="text-[10.5px] text-ink-3">{lab as string}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border-t border-line p-3">
          <div className="flex items-center">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-1 items-center last:flex-none">
                <span className={cx("grid size-8 place-items-center rounded-full", i < at ? "bg-accent text-navy" : i === at ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-ink-3")}>
                  {i === at ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}><s.icon className="size-4" /></motion.span> : <s.icon className="size-4" />}
                </span>
                {i < steps.length - 1 && <span className={cx("mx-1 h-0.5 flex-1 rounded", i < at ? "bg-accent" : "bg-surface-3")} />}
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10.5px] text-ink-3">
            {steps.map((s, i) => (
              <span key={i}>{s.label}</span>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-ink-2">{t("فريقنا بيراجع البيانات والصور. هيوصلك إشعار أول ما يتنشر.", "Our team is checking the details and photos. You’ll be notified when it goes live.")}</p>
        </div>
      )}
      {l.status === "approved" && (
        <Link href={`/property/${l.id}`} className="block border-t border-line py-2.5 text-center text-[12.5px] font-medium text-accent-ink">
          {t("شوف الإعلان زي ما العميل شايفه", "See the listing as clients see it")}
        </Link>
      )}
    </div>
  );
}
