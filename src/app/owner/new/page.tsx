"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, Check, ImagePlus, Minus, Plus, ShieldCheck, X } from "lucide-react";
import { AREAS, FEATURE_LABEL, FINISH_LABEL, TYPE_LABEL, type Category, type Feature, type Finishing, type PropType } from "@/lib/data";
import { useStore, uid, pushNotify } from "@/lib/store";
import { fmtMoney, fmtNum, useLang, useT } from "@/lib/i18n";
import { scheduleApproval } from "@/lib/demo";
import { Button, Chip, PageHeader, cx } from "@/components/ui";

const SAMPLE = ["/img/p6.jpg", "/img/p13.jpg", "/img/p17.jpg", "/img/p14.jpg", "/img/p29.jpg", "/img/p3.jpg", "/img/p26.jpg", "/img/p30.jpg"];

async function toDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}

function Stepper({ v, set, min = 0, max = 10 }: { v: number; set: (n: number) => void; min?: number; max?: number }) {
  const lang = useLang();
  return (
    <span className="flex items-center gap-3">
      <button aria-label="-" onClick={() => set(Math.max(min, v - 1))} className="grid size-9 place-items-center rounded-full bg-surface-2 active:scale-90">
        <Minus className="size-4" />
      </button>
      <span className="tabular w-5 text-center text-[16px] font-semibold">{fmtNum(v, lang)}</span>
      <button aria-label="+" onClick={() => set(Math.min(max, v + 1))} className="grid size-9 place-items-center rounded-full bg-surface-2 active:scale-90">
        <Plus className="size-4" />
      </button>
    </span>
  );
}

export default function NewListing() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const add = useStore((s) => s.addOwnerListing);
  const notify = useStore((s) => s.notify);
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [cat, setCat] = useState<Category>("sale");
  const [type, setType] = useState<PropType>("apartment");
  const [areaId, setAreaId] = useState("new-cairo");
  const [title, setTitle] = useState("");
  const [beds, setBeds] = useState(3);
  const [baths, setBaths] = useState(2);
  const [size, setSize] = useState(160);
  const [price, setPrice] = useState(cat === "rent" ? 40_000 : 7_500_000);
  const [finishing, setFinishing] = useState<Finishing>("full");
  const [features, setFeatures] = useState<Feature[]>(["parking", "security"]);
  const [images, setImages] = useState<string[]>([]);

  const steps = [t("النوع", "Type"), t("المكان", "Location"), t("التفاصيل", "Details"), t("الصور", "Photos"), t("مراجعة", "Review")];
  const canNext = [true, true, price > 0 && size > 0, images.length >= 1, true][step];
  const autoTitle = title.trim() || `${t(TYPE_LABEL[type])} ${fmtNum(beds, lang)} ${t("غرف", "beds")} · ${t(AREAS.find((a) => a.id === areaId)!.name)}`;

  const submit = () => {
    const id = `o-${uid()}`;
    add({ id, cat, type, title: autoTitle, areaId, price, beds, baths, size, finishing, features, images, status: "pending", createdAt: Date.now(), views: 0, interested: 0, saves: 0 });
    notify({ kind: "approval", title: { ar: "استلمنا عقارك", en: "We received your listing" }, body: { ar: "فريق مقر بيراجعه دلوقتي.", en: "The Maqar team is reviewing it now." }, href: "/owner" });
    pushNotify(t("استلمنا عقارك", "Listing submitted"), t("(ديمو) الموافقة هتوصل خلال ثوانٍ.", "(Demo) approval arrives in a few seconds."), "/owner", "sage");
    scheduleApproval(id, autoTitle);
    router.push("/owner");
  };

  return (
    <div className="pb-[calc(100px+env(safe-area-inset-bottom))]">
      <PageHeader title={t("أضف عقارك", "List your property")} subtitle={`${fmtNum(step + 1, lang)} / ${fmtNum(steps.length, lang)} · ${steps[step]}`} fallback="/owner" />
      <div className="flex gap-1.5 px-4">
        {steps.map((_, i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
            <motion.div className="h-full bg-accent" initial={false} animate={{ width: i <= step ? "100%" : "0%" }} />
          </div>
        ))}
      </div>

      <div className="px-4 pt-6">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }}>
            {step === 0 && (
              <>
                <h2 className="text-[20px] font-semibold">{t("عايز تبيع ولا تأجر؟", "Selling or renting?")}</h2>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {(["sale", "rent"] as Category[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setCat(c);
                        setPrice(c === "rent" ? 40_000 : 7_500_000);
                      }}
                      className={cx("h-16 rounded-2xl text-[15px] font-semibold transition active:scale-95", cat === c ? "bg-ink text-bg" : "bg-surface ring-1 ring-line")}
                    >
                      {c === "sale" ? t("بيع", "Sell") : t("إيجار", "Rent out")}
                    </button>
                  ))}
                </div>
                <h3 className="mb-3 mt-7 text-[15px] font-semibold">{t("نوع الوحدة", "Unit type")}</h3>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(TYPE_LABEL) as PropType[]).map((k) => (
                    <Chip key={k} active={type === k} onClick={() => setType(k)}>
                      {t(TYPE_LABEL[k])}
                    </Chip>
                  ))}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2 className="text-[20px] font-semibold">{t("العقار فين؟", "Where is it?")}</h2>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {AREAS.map((a) => (
                    <button key={a.id} onClick={() => setAreaId(a.id)} className={cx("flex items-center gap-2.5 rounded-2xl bg-surface p-2 text-start transition active:scale-95", areaId === a.id ? "ring-2 ring-accent" : "ring-1 ring-line")}>
                      <span className="relative size-10 shrink-0 overflow-hidden rounded-xl">
                        <Image src={a.img} alt="" fill sizes="40px" className="object-cover" />
                      </span>
                      <span className="truncate text-[13px] font-medium">{t(a.name)}</span>
                    </button>
                  ))}
                </div>
                <label className="mt-6 block text-[13px] font-medium text-ink-2">{t("عنوان الإعلان (اختياري)", "Listing title (optional)")}</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={autoTitle}
                  className="mt-2 h-13 w-full rounded-2xl bg-surface px-4 py-3.5 text-[14px] ring-1 ring-line outline-none focus:ring-2 focus:ring-accent"
                />
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-[20px] font-semibold">{t("تفاصيل الوحدة", "Unit details")}</h2>
                <div className="mt-4 divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
                  <div className="flex items-center justify-between p-4">
                    <span className="text-[14px]">{t("غرف النوم", "Bedrooms")}</span>
                    <Stepper v={beds} set={setBeds} min={0} max={8} />
                  </div>
                  <div className="flex items-center justify-between p-4">
                    <span className="text-[14px]">{t("الحمامات", "Bathrooms")}</span>
                    <Stepper v={baths} set={setBaths} min={1} max={8} />
                  </div>
                  <label className="flex items-center justify-between p-4">
                    <span className="text-[14px]">{t("المساحة (م²)", "Area (m²)")}</span>
                    <input type="number" inputMode="numeric" value={size} onChange={(e) => setSize(Number(e.target.value))} className="tabular w-24 rounded-xl bg-surface-2 px-3 py-2 text-center text-[15px] font-semibold outline-none focus:ring-2 focus:ring-accent" />
                  </label>
                  <label className="flex items-center justify-between p-4">
                    <span className="text-[14px]">{cat === "rent" ? t("الإيجار الشهري", "Monthly rent") : t("السعر المطلوب", "Asking price")}</span>
                    <input type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="tabular w-36 rounded-xl bg-surface-2 px-3 py-2 text-center text-[15px] font-semibold outline-none focus:ring-2 focus:ring-accent" />
                  </label>
                </div>
                <div className="mt-1.5 px-1 text-[12px] text-ink-3">{fmtMoney(price, lang, false)}</div>
                <h3 className="mb-3 mt-6 text-[15px] font-semibold">{t("التشطيب", "Finishing")}</h3>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(FINISH_LABEL) as Finishing[]).map((k) => (
                    <Chip key={k} active={finishing === k} onClick={() => setFinishing(k)}>
                      {t(FINISH_LABEL[k])}
                    </Chip>
                  ))}
                </div>
                <h3 className="mb-3 mt-6 text-[15px] font-semibold">{t("المميزات", "Amenities")}</h3>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(FEATURE_LABEL) as Feature[]).map((k) => (
                    <Chip key={k} active={features.includes(k)} onClick={() => setFeatures((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]))}>
                      {features.includes(k) && <Check className="size-3.5" />} {t(FEATURE_LABEL[k])}
                    </Chip>
                  ))}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="text-[20px] font-semibold">{t("صور العقار", "Photos")}</h2>
                <p className="mt-1 text-[13px] text-ink-2">{t("الصور الواضحة بتجيب مشاهدات أكتر ٣ مرات.", "Clear photos get three times more views.")}</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []).slice(0, 6);
                    const urls = await Promise.all(files.map(toDataUrl));
                    setImages((im) => [...im, ...urls].slice(0, 8));
                  }}
                />
                <button onClick={() => fileRef.current?.click()} className="mt-4 flex h-28 w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line-2 bg-surface text-ink-2 active:scale-[0.99]">
                  <Camera className="size-7 text-accent" />
                  <span className="text-[13px] font-medium">{t("ارفع من موبايلك", "Upload from your phone")}</span>
                </button>
                {images.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {images.map((src, i) => (
                      <div key={src.slice(-24) + i} className="relative aspect-square overflow-hidden rounded-2xl">
                        <Image src={src} alt="" fill sizes="140px" className="object-cover" unoptimized={src.startsWith("data:")} />
                        {i === 0 && <span className="absolute start-1.5 top-1.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">{t("الغلاف", "Cover")}</span>}
                        <button aria-label="Remove" onClick={() => setImages((im) => im.filter((_, j) => j !== i))} className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/55 text-white">
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-6 text-[13px] font-medium text-ink-2">{t("أو اختار صور تجريبية للديمو", "Or pick sample photos for the demo")}</div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {SAMPLE.map((src) => {
                    const on = images.includes(src);
                    return (
                      <button key={src} onClick={() => setImages((im) => (on ? im.filter((x) => x !== src) : [...im, src].slice(0, 8)))} className={cx("relative aspect-square overflow-hidden rounded-xl transition active:scale-95", on && "ring-[3px] ring-accent")}>
                        <Image src={src} alt="" fill sizes="100px" className="object-cover" />
                        {on && (
                          <span className="absolute inset-0 grid place-items-center bg-navy/40">
                            <Check className="size-6 text-white" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <h2 className="text-[20px] font-semibold">{t("راجع قبل ما تبعت", "Review before sending")}</h2>
                <div className="mt-4 overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
                  <div className="relative aspect-[16/10]">
                    {images[0] ? <Image src={images[0]} alt="" fill sizes="440px" className="object-cover" unoptimized={images[0].startsWith("data:")} /> : <div className="grid h-full place-items-center bg-surface-2"><ImagePlus className="size-8 text-ink-3" /></div>}
                  </div>
                  <div className="p-4">
                    <div className="tabular text-[20px] font-semibold">{fmtMoney(price, lang, false)}</div>
                    <div className="mt-0.5 text-[14px]">{autoTitle}</div>
                    <div className="tabular mt-2 text-[12.5px] text-ink-2">
                      {fmtNum(beds, lang)} {t("غرف", "beds")} · {fmtNum(baths, lang)} {t("حمام", "baths")} · {fmtNum(size, lang)} {t("م²", "m²")} · {t(FINISH_LABEL[finishing])}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-3 rounded-2xl bg-sage-soft p-4 text-[13px] leading-relaxed text-sage-ink">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0" />
                  {t("فريق مقر بيراجع كل إعلان قبل نشره عشان العملاء يثقوا فيه. عادة بناخد أقل من ٢٤ ساعة.", "The Maqar team reviews every listing before it goes live so clients can trust it. It usually takes under 24 hours.")}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[440px] gap-2 border-t border-line bg-surface/92 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        {step > 0 && (
          <Button variant="soft" size="lg" onClick={() => setStep((s) => s - 1)}>
            {t("رجوع", "Back")}
          </Button>
        )}
        <Button variant={step === 4 ? "gold" : "primary"} size="lg" full disabled={!canNext} onClick={() => (step === 4 ? submit() : setStep((s) => s + 1))}>
          {step === 4 ? t("ابعت للمراجعة", "Submit for review") : step === 3 && images.length === 0 ? t("ضيف صورة واحدة على الأقل", "Add at least one photo") : t("التالي", "Next")}
        </Button>
      </div>
    </div>
  );
}
