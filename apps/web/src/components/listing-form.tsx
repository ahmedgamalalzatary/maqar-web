"use client";

import {
  type AdminListing,
  type Bi,
  CATEGORIES,
  CATEGORY_LABEL,
  emptyListingForm,
  FEATURE_LABEL,
  FEATURES,
  FINISHING_LABEL,
  FINISHINGS,
  fmtDuration,
  fmtMoney,
  fmtNum,
  hasPaymentPlan,
  LISTING_IMAGES_MAX,
  LISTING_STEPS,
  LISTING_VIDEOS_MAX,
  listingBodyOf,
  type ListingField,
  type ListingForm as FormState,
  listingFormErrors,
  listingFormOf,
  type ListingFormPhoto,
  type ListingFormRoom,
  type ListingFormVideo,
  listingStepErrors,
  PROPERTY_TYPE_LABEL,
  PROPERTY_TYPES,
  readWholeNumber,
  TOUR_ROOMS_MAX,
  VIDEO_TYPES,
  videoProblem,
} from "@maqar/shared";
import { Clapperboard, Film, ImagePlus, Loader2, MoveLeft, MoveRight, Play, Rotate3d, RotateCcw, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type Dispatch, useEffect, type SetStateAction, useRef, useState } from "react";
import { uploadPanorama, uploadPhoto, uploadVideo, useAction, useAreas, useListing, useSave, readId, videoDuration } from "@/lib/admin";
import { clearDraft, loadDraft, saveDraft } from "@/lib/draft";
import { mediaUrl } from "@/lib/client";
import { type T, useLang, useT } from "@/lib/i18n";
import { preparePanorama, shrinkPhoto } from "@/lib/photos";
import { useNotice } from "./shell";
import { Button, Card, Chip, ChipGroup, Field, TextArea, useErrorText } from "./ui";

const STEP_LABEL: Record<(typeof LISTING_STEPS)[number], Bi> = {
  type: { ar: "النوع", en: "Type" },
  location: { ar: "المكان", en: "Location" },
  details: { ar: "التفاصيل", en: "Details" },
  photos: { ar: "الصور", en: "Photos" },
  videos: { ar: "الفيديوهات", en: "Videos" },
  tour: { ar: "جولة ٣٦٠°", en: "360° tour" },
  review: { ar: "المراجعة", en: "Review" },
};

const ERROR: Partial<Record<ListingField, Bi>> = {
  type: { ar: "اختار نوع الوحدة", en: "Pick the unit type" },
  areaId: { ar: "اختار المنطقة", en: "Pick the area" },
  beds: { ar: "من ٠ لـ ٢٠", en: "0 to 20" },
  baths: { ar: "من ٠ لـ ٢٠", en: "0 to 20" },
  sizeM2: { ar: "المساحة بالمتر، من ١٠", en: "Size in m², 10 or more" },
  price: { ar: "اكتب السعر بالجنيه", en: "Enter the price in EGP" },
  finishing: { ar: "اختار التشطيب", en: "Pick the finishing" },
  downPct: { ar: "من ٠ لـ ١٠٠٪", en: "0 to 100%" },
  planYears: { ar: "من ١ لـ ٣٠ سنة", en: "1 to 30 years" },
  ownerPhone: { ar: "رقم موبايل بالأرقام، مثلًا ٠١٠١٢٣٤٥٦٧٨", en: "A phone number in digits, e.g. 01012345678" },
  photos: { ar: "ضيف صورة واحدة على الأقل، واستنى لحد ما الصور تترفع", en: "Add at least one photo, and wait for the uploads" },
  videos: { ar: "استنى لحد ما الفيديوهات تترفع، أو امسح اللي ماترفعش", en: "Wait for the videos to upload, or remove the ones that failed" },
  tour: { ar: "كل غرفة محتاجة اسمها بالعربي والإنجليزي، واستنى لحد ما الصور تترفع", en: "Each room needs its Arabic and English name, and wait for the uploads" },
};

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, i) => thisYear + i);
const yearText = (y: number, t: T) => t(fmtNum(y, "ar", 0).replace(/٬/g, ""), String(y));

let photoKey = 0;

/** `/listing/edit/?id=7`: the same form, filled in from the saved listing. */
export function EditListing() {
  const id = readId(useSearchParams().get("id"));
  const listing = useListing(id);
  const t = useT();
  if (id === undefined)
    return (
      <Card>
        {t("الرابط مش صحيح: مفيش رقم عقار.", "That link is not right: no listing number.")}{" "}
        <Link href="/listings/" className="text-accent-ink hover:underline">
          {t("كل العقارات", "All listings")}
        </Link>
      </Card>
    );
  if (listing.isError) return <Card>{t("مقدرناش نجيب العقار", "We couldn’t load the listing")}</Card>;
  if (!listing.data) return <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />;
  return <ListingForm key={id} saved={listing.data} />;
}

/** `/new/` and editing: the listing form in steps (contract §9.2). */
export function ListingForm({ saved }: { saved?: AdminListing }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const notice = useNotice();
  const errorText = useErrorText();
  const [s, setS] = useState<FormState>(() => {
    if (saved) return listingFormOf(saved);
    const draft = loadDraft<FormState>("listing:new");
    return draft && Object.keys(draft).length ? { ...emptyListingForm(), ...draft } : emptyListingForm();
  });
  // The photos' bytes for upload and retry, kept here rather than in the Photos step: moving
  // between steps unmounts the step, and a failed upload's retry must survive that.
  const [blobs, setBlobs] = useState<Record<string, Blob>>({});
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const save = useSave(saved?.id);
  const action = useAction();
  const [publishing, setPublishing] = useState(false);
  const set = <K extends ListingField>(k: K, v: FormState[K]) => setS((cur) => ({ ...cur, [k]: v }));

  // A recoverable draft: auto-saved as the admin types, restored on return, dropped on save.
  const draftKey = `listing:${saved?.id ?? "new"}`;
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current && loadDraft<FormState>(draftKey)) notice({ text: t("رجّعنا المسودة اللي كنت بتكتبها", "Restored the draft you were writing"), tone: "ok" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);
  useEffect(() => {
    dirty.current = true;
    const id = setTimeout(() => saveDraft(draftKey, s), 600);
    return () => clearTimeout(id);
  }, [s, draftKey]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  const current = LISTING_STEPS[step]!;
  const errors = showErrors ? (current === "review" ? listingFormErrors(s) : listingStepErrors(current, s)) : [];
  const err = (f: ListingField) => (errors.includes(f) && ERROR[f] ? t(ERROR[f]) : undefined);

  const go = (to: number) => {
    setStep(to);
    setShowErrors(false);
    window.scrollTo({ top: 0 });
  };
  const next = () => (listingStepErrors(current, s).length ? setShowErrors(true) : go(step + 1));

  const submit = async (andPublish: boolean) => {
    if (listingFormErrors(s).length) return setShowErrors(true);
    setPublishing(andPublish);
    let l: AdminListing;
    try {
      l = await save.mutateAsync(listingBodyOf(s));
    } catch (e) {
      setPublishing(false);
      return notice({ text: errorText(e), tone: "bad" });
    }
    // The listing is saved now. A failed publish leaves a draft: open it rather than stay on the
    // new form, which would save the same listing again.
    dirty.current = false;
    clearDraft(draftKey);
    const published = andPublish ? await action.mutateAsync({ kind: "publish", id: l.id }).then(() => true, () => false) : false;
    setPublishing(false);
    if (andPublish && !published) notice({ text: t("اتحفظ كمسودة بس متنشرش، جرّب تنشره من صفحته", "Saved as a draft but not published: try publishing from its page"), tone: "bad" });
    else notice({ text: published ? t("العقار اتنشر وبقى ظاهر في التطبيق", "Published: it now shows in the app") : saved ? t("التعديلات اتحفظت", "Changes saved") : t("العقار اتحفظ كمسودة", "Saved as a draft"), tone: "ok" });
    router.push(`/listing/?id=${l.id}`);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{saved ? t("عدّل العقار", "Edit listing") : t("أضف عقار", "Add a listing")}</h1>
        <p className="text-sm text-ink-2">{t("العقار بيظهر للعملاء في التطبيق لما تنشره بس.", "Clients see the listing in the app only once you publish it.")}</p>
      </div>

      <ol className="grid grid-cols-4 gap-2 sm:grid-cols-7" aria-label={t("خطوات الإضافة", "Steps")}>
        {LISTING_STEPS.map((k, i) => (
          <li key={k}>
            <button
              type="button"
              onClick={() => (i < step || saved ? go(i) : undefined)}
              aria-current={i === step ? "step" : undefined}
              className={`flex w-full flex-col gap-1.5 text-start ${i < step || saved ? "cursor-pointer" : "cursor-default"}`}
            >
              <span className={`h-1 rounded-full ${i <= step ? "bg-accent" : "bg-surface-3"}`} />
              <span className={`text-xs ${i === step ? "font-semibold text-ink" : "text-ink-3"}`}>
                {fmtNum(i + 1, lang)}. {t(STEP_LABEL[k])}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <Card className="flex flex-col gap-6">
        {current === "type" ? <TypeStep s={s} set={set} err={err} /> : null}
        {current === "location" ? <LocationStep s={s} set={set} err={err} /> : null}
        {current === "details" ? <DetailsStep s={s} set={set} err={err} /> : null}
        {current === "photos" ? <PhotosStep s={s} setS={setS} blobs={blobs} setBlobs={setBlobs} err={err} /> : null}
        {current === "videos" ? <VideosStep s={s} setS={setS} blobs={blobs} setBlobs={setBlobs} err={err} /> : null}
        {current === "tour" ? <TourStep s={s} setS={setS} blobs={blobs} setBlobs={setBlobs} err={err} /> : null}
        {current === "review" ? <ReviewStep s={s} errors={errors} onEdit={go} /> : null}
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="secondary" onClick={() => (step > 0 ? go(step - 1) : router.back())}>
          {step > 0 ? t("السابق", "Back") : t("إلغاء", "Cancel")}
        </Button>
        <div className="flex flex-wrap gap-3">
          {current !== "review" ? (
            <Button onClick={next}>{t("التالي", "Next")}</Button>
          ) : saved ? (
            <Button loading={save.isPending} onClick={() => void submit(false)}>
              {t("احفظ التعديلات", "Save changes")}
            </Button>
          ) : (
            <>
              <Button variant="secondary" loading={save.isPending && !publishing} disabled={save.isPending} onClick={() => void submit(false)}>
                {t("احفظ مسودة", "Save draft")}
              </Button>
              <Button variant="gold" loading={publishing} disabled={save.isPending} onClick={() => void submit(true)}>
                {t("احفظ وانشر", "Save and publish")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type StepProps = { s: FormState; set: <K extends ListingField>(k: K, v: FormState[K]) => void; err: (f: ListingField) => string | undefined };

function TypeStep({ s, set, err }: StepProps) {
  const t = useT();
  return (
    <>
      <ChipGroup label={t("بيع ولا إيجار؟", "For sale or to rent?")}>
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={s.category === c} onClick={() => set("category", c)}>
            {t(CATEGORY_LABEL[c])}
          </Chip>
        ))}
      </ChipGroup>
      <ChipGroup label={t("نوع الوحدة", "Unit type")} error={err("type")}>
        {PROPERTY_TYPES.map((p) => (
          <Chip key={p} selected={s.type === p} onClick={() => set("type", p)}>
            {t(PROPERTY_TYPE_LABEL[p])}
          </Chip>
        ))}
      </ChipGroup>
    </>
  );
}

function LocationStep({ s, set, err }: StepProps) {
  const t = useT();
  const lang = useLang();
  const areas = useAreas();
  return (
    <>
      <ChipGroup label={t("المنطقة", "Area")} error={err("areaId")}>
        {areas.isPending ? <Loader2 className="size-5 animate-spin text-ink-3" aria-label={t("بنحمّل", "Loading")} /> : null}
        {(areas.data ?? []).map((a) => (
          <Chip key={a.id} selected={s.areaId === a.id} onClick={() => set("areaId", a.id)}>
            {lang === "ar" ? a.nameAr : a.nameEn}
          </Chip>
        ))}
      </ChipGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("الكمبوند (عربي)", "Compound (Arabic)")} value={s.compoundAr} onChange={(e) => set("compoundAr", e.target.value)} dir="rtl" maxLength={150} />
        <Field label={t("الكمبوند (إنجليزي)", "Compound (English)")} value={s.compoundEn} onChange={(e) => set("compoundEn", e.target.value)} dir="ltr" maxLength={150} />
        <Field label={t("المطور (عربي)", "Developer (Arabic)")} value={s.developerAr} onChange={(e) => set("developerAr", e.target.value)} dir="rtl" maxLength={150} />
        <Field label={t("المطور (إنجليزي)", "Developer (English)")} value={s.developerEn} onChange={(e) => set("developerEn", e.target.value)} dir="ltr" maxLength={150} />
        <Field label={t("الدور", "Floor")} value={s.floor} onChange={(e) => set("floor", e.target.value)} inputMode="numeric" />
        <Field label={t("مصروف الصيانة (بالسنة)", "Maintenance fee (a year)")} value={s.maintenanceFee} onChange={(e) => set("maintenanceFee", e.target.value)} inputMode="numeric" />
        <Field
          label={t("العنوان (عربي)", "Title (Arabic)")}
          hint={t("اختياري: لو فاضي هيبقى «النوع والغرف | المنطقة»", "Optional: empty becomes “type, beds | area”")}
          value={s.titleAr}
          onChange={(e) => set("titleAr", e.target.value)}
          dir="rtl"
          maxLength={200}
        />
        <Field label={t("العنوان (إنجليزي)", "Title (English)")} value={s.titleEn} onChange={(e) => set("titleEn", e.target.value)} dir="ltr" maxLength={200} />
      </div>
      <fieldset className="flex flex-col gap-4 rounded-xl border border-line p-4">
        <legend className="px-1 text-sm font-medium text-ink-2">{t("المالك (محدش بيشوفه غير فريق مقر)", "Owner (only the Maqar team sees this)")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("اسم المالك", "Owner’s name")} value={s.ownerName} onChange={(e) => set("ownerName", e.target.value)} maxLength={120} />
          <Field label={t("موبايل المالك", "Owner’s phone")} type="tel" value={s.ownerPhone} onChange={(e) => set("ownerPhone", e.target.value)} dir="ltr" maxLength={24} error={err("ownerPhone")} />
        </div>
      </fieldset>
    </>
  );
}

function DetailsStep({ s, set, err }: StepProps) {
  const t = useT();
  const priceLabel = s.category === "rent" ? t("الإيجار في الشهر (جنيه)", "Rent per month (EGP)") : s.category === "stay" ? t("السعر في الليلة (جنيه)", "Price per night (EGP)") : t("السعر (جنيه)", "Price (EGP)");
  const num = { inputMode: "numeric" as const, dir: "ltr" as const };
  const toggle = (f: (typeof FEATURES)[number]) => set("features", s.features.includes(f) ? s.features.filter((x) => x !== f) : [...s.features, f]);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("الغرف", "Bedrooms")} value={s.beds} onChange={(e) => set("beds", e.target.value)} error={err("beds")} {...num} />
        <Field label={t("الحمامات", "Bathrooms")} value={s.baths} onChange={(e) => set("baths", e.target.value)} error={err("baths")} {...num} />
        <Field label={t("المساحة (م²)", "Size (m²)")} value={s.sizeM2} onChange={(e) => set("sizeM2", e.target.value)} error={err("sizeM2")} {...num} />
      </div>
      <Field label={priceLabel} value={s.price} onChange={(e) => set("price", e.target.value)} error={err("price")} {...num} />
      <ChipGroup label={t("التشطيب", "Finishing")} error={err("finishing")}>
        {FINISHINGS.map((f) => (
          <Chip key={f} selected={s.finishing === f} onClick={() => set("finishing", f)}>
            {t(FINISHING_LABEL[f])}
          </Chip>
        ))}
      </ChipGroup>
      <ChipGroup label={t("التسليم", "Handover")}>
        <Chip selected={s.delivery === "ready"} onClick={() => set("delivery", "ready")}>
          {t("استلام فوري", "Ready now")}
        </Chip>
        {YEARS.map((y) => (
          <Chip key={y} selected={s.delivery === y} onClick={() => set("delivery", y)}>
            {yearText(y, t)}
          </Chip>
        ))}
      </ChipGroup>
      <ChipGroup label={t("المميزات", "Amenities")}>
        {FEATURES.map((f) => (
          <Chip key={f} role="checkbox" selected={s.features.includes(f)} onClick={() => toggle(f)}>
            {t(FEATURE_LABEL[f])}
          </Chip>
        ))}
      </ChipGroup>
      {hasPaymentPlan(s.category) ? (
        <fieldset className="flex flex-col gap-4 rounded-xl border border-line p-4">
          <legend className="px-1 text-sm font-medium text-ink-2">{t("خطة السداد (اختياري)", "Payment plan (optional)")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("المقدم ٪", "Down payment %")} value={s.downPct} onChange={(e) => set("downPct", e.target.value)} error={err("downPct")} {...num} />
            <Field label={t("السنين", "Years")} value={s.planYears} onChange={(e) => set("planYears", e.target.value)} error={err("planYears")} {...num} />
          </div>
        </fieldset>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextArea label={t("الوصف (عربي)", "Description (Arabic)")} value={s.descAr} onChange={(e) => set("descAr", e.target.value)} dir="rtl" maxLength={5000} />
        <TextArea label={t("الوصف (إنجليزي)", "Description (English)")} value={s.descEn} onChange={(e) => set("descEn", e.target.value)} dir="ltr" maxLength={5000} />
      </div>
    </>
  );
}

/** Photos are made smaller in the browser and uploaded one by one as soon as they are picked. */
function PhotosStep({
  s,
  setS,
  blobs,
  setBlobs,
  err,
}: {
  s: FormState;
  setS: Dispatch<SetStateAction<FormState>>;
  blobs: Record<string, Blob>;
  setBlobs: Dispatch<SetStateAction<Record<string, Blob>>>;
  err: StepProps["err"];
}) {
  const t = useT();
  const lang = useLang();
  const input = useRef<HTMLInputElement>(null);
  const room = LISTING_IMAGES_MAX - s.photos.length;
  const patch = (key: string, p: Partial<ListingFormPhoto>) => setS((cur) => ({ ...cur, photos: cur.photos.map((x) => (x.key === key ? { ...x, ...p } : x)) }));

  const upload = async (key: string, blob: Blob) => {
    patch(key, { failed: false });
    try {
      patch(key, { url: (await uploadPhoto(blob)).url });
    } catch {
      patch(key, { failed: true });
    }
  };
  const add = async (files: FileList | null) => {
    const picked = Array.from(files ?? [])
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, room);
    const added = picked.map((f) => ({ key: `w${++photoKey}`, local: URL.createObjectURL(f) }));
    setS((cur) => ({ ...cur, photos: [...cur.photos, ...added] }));
    for (const [i, photo] of added.entries()) {
      let blob: Blob;
      try {
        blob = await shrinkPhoto(picked[i]!);
      } catch {
        // The browser could not prepare the image: say so instead of spinning for ever.
        patch(photo.key, { failed: true });
        continue;
      }
      setBlobs((cur) => ({ ...cur, [photo.key]: blob }));
      await upload(photo.key, blob);
    }
  };
  const move = (from: number, to: number) =>
    setS((cur) => {
      const photos = [...cur.photos];
      const [p] = photos.splice(from, 1);
      photos.splice(to, 0, p!);
      return { ...cur, photos };
    });
  const remove = (key: string) => {
    setS((cur) => ({ ...cur, photos: cur.photos.filter((p) => p.key !== key) }));
    setBlobs((cur) => {
      if (!(key in cur)) return cur;
      const next = { ...cur };
      delete next[key];
      return next;
    });
  };
  const Earlier = lang === "ar" ? MoveRight : MoveLeft;
  const Later = lang === "ar" ? MoveLeft : MoveRight;

  return (
    <>
      <p className="text-sm text-ink-2">{t("أول صورة هي الغلاف. الصور بتتصغر قبل ما تترفع.", "The first photo is the cover. Photos are made smaller before they upload.")}</p>
      {room > 0 ? (
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden onChange={(e) => void add(e.target.files).finally(() => (e.target.value = ""))} />
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void add(e.dataTransfer.files);
            }}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent bg-accent-soft text-accent-ink hover:bg-accent/20"
          >
            <ImagePlus className="size-6" aria-hidden />
            <span className="font-medium">{t(`ضيف صور أو اسحبها هنا (لحد ${fmtNum(room, "ar")})`, `Add photos or drop them here (up to ${room})`)}</span>
          </button>
        </>
      ) : null}
      {err("photos") ? <p className="text-sm text-danger">{err("photos")}</p> : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {s.photos.map((p, i) => (
          <li key={p.key} className={`relative aspect-[4/3] overflow-hidden rounded-xl border-2 bg-surface-2 ${i === 0 ? "border-accent" : "border-transparent"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local previews and photos on the API host */}
            <img src={p.url ? mediaUrl(p.url) : p.local} alt={t(`صورة ${fmtNum(i + 1, "ar")}`, `Photo ${i + 1}`)} className="size-full object-cover" />
            {!p.url ? (
              <div className="absolute inset-0 grid place-items-center bg-navy/50">
                {p.failed && blobs[p.key] ? (
                  <Button variant="secondary" onClick={() => void upload(p.key, blobs[p.key]!)}>
                    <RotateCcw className="size-4" aria-hidden />
                    {t("حاول تاني", "Retry")}
                  </Button>
                ) : (
                  <Loader2 className="size-6 animate-spin text-white" aria-label={t("بترفع", "Uploading")} />
                )}
              </div>
            ) : null}
            {i === 0 ? <span className="absolute start-2 top-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-navy">{t("الغلاف", "Cover")}</span> : null}
            <div className="absolute bottom-2 end-2 flex gap-1.5">
              {i > 0 ? (
                <IconAction label={t(`خلّي الصورة ${fmtNum(i + 1, "ar")} الغلاف`, `Make photo ${i + 1} the cover`)} onClick={() => move(i, 0)}>
                  <Star className="size-4" aria-hidden />
                </IconAction>
              ) : null}
              {i > 0 ? (
                <IconAction label={t("قدّمها", "Move earlier")} onClick={() => move(i, i - 1)}>
                  <Earlier className="size-4" aria-hidden />
                </IconAction>
              ) : null}
              {i < s.photos.length - 1 ? (
                <IconAction label={t("أخّرها", "Move later")} onClick={() => move(i, i + 1)}>
                  <Later className="size-4" aria-hidden />
                </IconAction>
              ) : null}
              <IconAction label={t(`امسح الصورة ${fmtNum(i + 1, "ar")}`, `Remove photo ${i + 1}`)} onClick={() => remove(p.key)} danger>
                <Trash2 className="size-4" aria-hidden />
              </IconAction>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The 360° tour (phase 21): one panorama per room, both names, in the order the tour opens them. Optional. */
/**
 * Listing videos (phase 26): MP4 or MOV files, each sent with a progress bar and then converted on
 * the server, which can take a few minutes. Optional; the app shows them after the photos.
 */
function VideosStep({
  s,
  setS,
  blobs,
  setBlobs,
  err,
}: {
  s: FormState;
  setS: Dispatch<SetStateAction<FormState>>;
  blobs: Record<string, Blob>;
  setBlobs: Dispatch<SetStateAction<Record<string, Blob>>>;
  err: StepProps["err"];
}) {
  const t = useT();
  const lang = useLang();
  const notice = useNotice();
  const errorText = useErrorText();
  const input = useRef<HTMLInputElement>(null);
  const [sent, setSent] = useState<Record<string, number>>({});
  const room = LISTING_VIDEOS_MAX - s.videos.length;
  const patch = (key: string, p: Partial<ListingFormVideo>) => setS((cur) => ({ ...cur, videos: cur.videos.map((x) => (x.key === key ? { ...x, ...p } : x)) }));

  const upload = async (key: string, file: File) => {
    patch(key, { failed: false });
    setSent((cur) => ({ ...cur, [key]: 0 }));
    try {
      const v = await uploadVideo(file, (f) => setSent((cur) => ({ ...cur, [key]: f })));
      patch(key, { url: v.url, poster: v.poster, durationS: v.durationS });
    } catch (e) {
      patch(key, { failed: true });
      notice({ text: errorText(e), tone: "bad" });
    }
  };
  const add = async (files: FileList | null | undefined) => {
    const picked = Array.from(files ?? []).slice(0, room);
    const ok: { file: File; durationS?: number }[] = [];
    for (const file of picked) {
      const durationS = await videoDuration(file);
      const problem = videoProblem({ type: file.type, bytes: file.size, durationS });
      if (!problem) ok.push({ file, durationS });
      else
        notice({
          text: {
            long: t(`${file.name}: الفيديو أطول من ٣ دقايق`, `${file.name}: longer than 3 minutes`),
            size: t(`${file.name}: الفيديو أكبر من ١٥٠ ميجا`, `${file.name}: over 150 MB`),
            type: t(`${file.name}: الفيديو لازم يكون MP4 أو MOV`, `${file.name}: a video must be an MP4 or MOV`),
          }[problem],
          tone: "bad",
        });
    }
    if (!ok.length) return;
    const added: ListingFormVideo[] = ok.map(({ file, durationS }) => ({ key: `v${++photoKey}`, local: file.name, durationS: durationS ? Math.round(durationS) : undefined }));
    setS((cur) => ({ ...cur, videos: [...cur.videos, ...added] }));
    setBlobs((cur) => ({ ...cur, ...Object.fromEntries(added.map((v, i) => [v.key, ok[i]!.file])) }));
    // One at a time: the server converts them one at a time anyway.
    for (const [i, v] of added.entries()) await upload(v.key, ok[i]!.file);
  };
  const move = (from: number, to: number) =>
    setS((cur) => {
      const videos = [...cur.videos];
      const [v] = videos.splice(from, 1);
      videos.splice(to, 0, v!);
      return { ...cur, videos };
    });
  const remove = (key: string) => {
    setS((cur) => ({ ...cur, videos: cur.videos.filter((v) => v.key !== key) }));
    setBlobs((cur) => {
      if (!(key in cur)) return cur;
      const next = { ...cur };
      delete next[key];
      return next;
    });
  };
  const Earlier = lang === "ar" ? MoveRight : MoveLeft;
  const Later = lang === "ar" ? MoveLeft : MoveRight;

  return (
    <>
      <p className="text-sm text-ink-2">
        {t(
          "اختياري. لحد ٥ فيديوهات MP4 أو MOV، كل واحد لحد ٣ دقايق و١٥٠ ميجا. بتظهر في التطبيق بعد الصور. الفيديو بيتجهز على السيرفر بعد ما يترفع، وده ممكن ياخد كام دقيقة.",
          "Optional. Up to 5 MP4 or MOV videos, each up to 3 minutes and 150 MB. The app shows them after the photos. Each is prepared on the server after it uploads, which can take a few minutes.",
        )}
      </p>
      {room > 0 ? (
        <>
          <input ref={input} type="file" accept={VIDEO_TYPES.join(",")} multiple hidden onChange={(e) => void add(e.target.files).finally(() => (e.target.value = ""))} />
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void add(e.dataTransfer.files);
            }}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent bg-accent-soft text-accent-ink hover:bg-accent/20"
          >
            <Clapperboard className="size-6" aria-hidden />
            <span className="font-medium">{t(`ضيف فيديوهات أو اسحبها هنا (لحد ${fmtNum(room, "ar")})`, `Add videos or drop them here (up to ${room})`)}</span>
          </button>
        </>
      ) : null}
      {err("videos") ? <p className="text-sm text-danger">{err("videos")}</p> : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {s.videos.map((v, i) => {
          const progress = sent[v.key];
          const n = i + 1;
          return (
            <li key={v.key} className="relative aspect-video overflow-hidden rounded-xl bg-navy" data-testid="form-video">
              {v.poster ? (
                // eslint-disable-next-line @next/next/no-img-element -- posters on the API host
                <img src={mediaUrl(v.poster)} alt={t(`الفيديو ${fmtNum(n, "ar")}`, `Video ${n}`)} className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center">
                  <Film className="size-7 text-white/60" aria-hidden />
                </div>
              )}
              {v.url ? (
                <a
                  href={mediaUrl(v.url)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t(`شغّل الفيديو ${fmtNum(n, "ar")}`, `Play video ${n}`)}
                  className="absolute inset-0 grid place-items-center"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-black/45">
                    <Play className="size-4 fill-white text-white" aria-hidden />
                  </span>
                </a>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-navy/60 px-4 text-white">
                  {v.failed && blobs[v.key] ? (
                    <Button variant="secondary" onClick={() => void upload(v.key, blobs[v.key] as File)}>
                      <RotateCcw className="size-4" aria-hidden />
                      {t("حاول تاني", "Retry")}
                    </Button>
                  ) : v.failed ? (
                    <span className="text-center text-xs">{t("ماترفعش، امسحه وضيفه تاني", "Not uploaded: remove it and add it again")}</span>
                  ) : progress !== undefined && progress < 1 ? (
                    <>
                      <span className="text-xs font-medium">{t(`بيترفع ${fmtNum(Math.round(progress * 100), "ar")}٪`, `Uploading ${Math.round(progress * 100)}%`)}</span>
                      <span
                        role="progressbar"
                        aria-valuenow={Math.round(progress * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={t(`رفع الفيديو ${fmtNum(n, "ar")}`, `Video ${n} upload`)}
                        className="block h-1.5 w-full overflow-hidden rounded-full bg-white/25"
                      >
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
                      </span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="size-6 animate-spin" aria-hidden />
                      <span className="text-xs font-medium">{t("بيتجهز…", "Preparing…")}</span>
                    </>
                  )}
                </div>
              )}
              {v.durationS ? <span className="absolute start-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white tabular">{fmtDuration(v.durationS, lang)}</span> : null}
              <div className="absolute bottom-2 end-2 flex gap-1.5">
                {i > 0 ? (
                  <IconAction label={t(`قدّم الفيديو ${fmtNum(n, "ar")}`, `Move video ${n} earlier`)} onClick={() => move(i, i - 1)}>
                    <Earlier className="size-4" aria-hidden />
                  </IconAction>
                ) : null}
                {i < s.videos.length - 1 ? (
                  <IconAction label={t(`أخّر الفيديو ${fmtNum(n, "ar")}`, `Move video ${n} later`)} onClick={() => move(i, i + 1)}>
                    <Later className="size-4" aria-hidden />
                  </IconAction>
                ) : null}
                <IconAction label={t(`امسح الفيديو ${fmtNum(n, "ar")}`, `Remove video ${n}`)} onClick={() => remove(v.key)} danger>
                  <Trash2 className="size-4" aria-hidden />
                </IconAction>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function TourStep({
  s,
  setS,
  blobs,
  setBlobs,
  err,
}: {
  s: FormState;
  setS: Dispatch<SetStateAction<FormState>>;
  blobs: Record<string, Blob>;
  setBlobs: Dispatch<SetStateAction<Record<string, Blob>>>;
  err: StepProps["err"];
}) {
  const t = useT();
  const lang = useLang();
  const notice = useNotice();
  const input = useRef<HTMLInputElement>(null);
  const patch = (key: string, p: Partial<ListingFormRoom>) => setS((cur) => ({ ...cur, tour: cur.tour.map((x) => (x.key === key ? { ...x, ...p } : x)) }));

  const upload = async (key: string, blob: Blob) => {
    patch(key, { failed: false });
    try {
      patch(key, { url: (await uploadPanorama(blob)).url });
    } catch {
      patch(key, { failed: true });
    }
  };
  const add = async (file: File | undefined) => {
    if (!file) return;
    const prepared = await preparePanorama(file);
    if (typeof prepared === "string") {
      const text = {
        ratio: t("الصورة دي مش ٣٦٠°: لازم عرضها ضعف طولها (٢:١)", "That is not a 360° photo: it must be twice as wide as it is high (2:1)"),
        small: t("الصورة صغيرة: لازم ٤٠٩٦×٢٠٤٨ على الأقل", "That photo is too small: it must be at least 4096×2048"),
        unreadable: t("المتصفح مقدرش يفتح الصورة دي، جرّب JPEG", "The browser could not open that photo; try a JPEG"),
      }[prepared];
      return notice({ text, tone: "bad" });
    }
    const room: ListingFormRoom = { key: `t${++photoKey}`, local: URL.createObjectURL(prepared), nameAr: "", nameEn: "" };
    setS((cur) => ({ ...cur, tour: [...cur.tour, room] }));
    setBlobs((cur) => ({ ...cur, [room.key]: prepared }));
    await upload(room.key, prepared);
  };
  const move = (from: number, to: number) =>
    setS((cur) => {
      const tour = [...cur.tour];
      const [r] = tour.splice(from, 1);
      tour.splice(to, 0, r!);
      return { ...cur, tour };
    });
  const remove = (key: string) => {
    setS((cur) => ({ ...cur, tour: cur.tour.filter((r) => r.key !== key) }));
    setBlobs((cur) => {
      if (!(key in cur)) return cur;
      const next = { ...cur };
      delete next[key];
      return next;
    });
  };
  const Earlier = lang === "ar" ? MoveRight : MoveLeft;
  const Later = lang === "ar" ? MoveLeft : MoveRight;

  return (
    <>
      <p className="text-sm text-ink-2">
        {t(
          "اختياري. صورة ٣٦٠° لكل غرفة (عرضها ضعف طولها، ٤٠٩٦×٢٠٤٨ على الأقل). الجولة بتفتح على أول غرفة.",
          "Optional. One 360° photo per room (twice as wide as high, at least 4096×2048). The tour opens on the first room.",
        )}
      </p>
      {s.tour.length < TOUR_ROOMS_MAX ? (
        <>
          <input ref={input} type="file" accept="image/jpeg" hidden onChange={(e) => void add(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void add(e.dataTransfer.files[0]);
            }}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent bg-accent-soft text-accent-ink hover:bg-accent/20"
          >
            <Rotate3d className="size-6" aria-hidden />
            <span className="font-medium">{t(`ضيف غرفة أو اسحب صورتها هنا (لحد ${fmtNum(TOUR_ROOMS_MAX, "ar")})`, `Add a room or drop its photo here (up to ${TOUR_ROOMS_MAX})`)}</span>
          </button>
        </>
      ) : null}
      {err("tour") ? <p className="text-sm text-danger">{err("tour")}</p> : null}
      <ul className="flex flex-col gap-4">
        {s.tour.map((r, i) => (
          <li key={r.key} className="grid gap-3 rounded-2xl border border-line p-3 sm:grid-cols-[280px_1fr]">
            <div className="relative aspect-[2/1] overflow-hidden rounded-xl bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- local previews and panoramas on the API host */}
              <img src={r.url ? mediaUrl(r.url) : r.local} alt={t(`الغرفة ${fmtNum(i + 1, "ar")}`, `Room ${i + 1}`)} className="size-full object-cover" />
              {!r.url ? (
                <div className="absolute inset-0 grid place-items-center bg-navy/50">
                  {r.failed && blobs[r.key] ? (
                    <Button variant="secondary" onClick={() => void upload(r.key, blobs[r.key]!)}>
                      <RotateCcw className="size-4" aria-hidden />
                      {t("حاول تاني", "Retry")}
                    </Button>
                  ) : (
                    <Loader2 className="size-6 animate-spin text-white" aria-label={t("بترفع", "Uploading")} />
                  )}
                </div>
              ) : null}
              <div className="absolute bottom-2 end-2 flex gap-1.5">
                {i > 0 ? (
                  <IconAction label={t(`قدّم الغرفة ${fmtNum(i + 1, "ar")}`, `Move room ${i + 1} earlier`)} onClick={() => move(i, i - 1)}>
                    <Earlier className="size-4" aria-hidden />
                  </IconAction>
                ) : null}
                {i < s.tour.length - 1 ? (
                  <IconAction label={t(`أخّر الغرفة ${fmtNum(i + 1, "ar")}`, `Move room ${i + 1} later`)} onClick={() => move(i, i + 1)}>
                    <Later className="size-4" aria-hidden />
                  </IconAction>
                ) : null}
                <IconAction label={t(`امسح الغرفة ${fmtNum(i + 1, "ar")}`, `Remove room ${i + 1}`)} onClick={() => remove(r.key)} danger>
                  <Trash2 className="size-4" aria-hidden />
                </IconAction>
              </div>
            </div>
            <div className="grid content-start gap-3">
              <Field label={t(`اسم الغرفة ${fmtNum(i + 1, "ar")} (عربي)`, `Room ${i + 1} name (Arabic)`)} value={r.nameAr} maxLength={80} onChange={(e) => patch(r.key, { nameAr: e.target.value })} />
              <Field label={t(`اسم الغرفة ${fmtNum(i + 1, "ar")} (إنجليزي)`, `Room ${i + 1} name (English)`)} value={r.nameEn} maxLength={80} dir="ltr" onChange={(e) => patch(r.key, { nameEn: e.target.value })} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function IconAction({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`grid size-8 place-items-center rounded-full bg-surface shadow-card hover:bg-surface-2 ${danger ? "text-danger" : "text-ink"}`}>
      {children}
    </button>
  );
}

function ReviewStep({ s, errors, onEdit }: { s: FormState; errors: ListingField[]; onEdit: (step: number) => void }) {
  const t = useT();
  const lang = useLang();
  const areas = useAreas();
  const area = areas.data?.find((a) => a.id === s.areaId);
  const price = readWholeNumber(s.price);
  const uploaded = s.photos.filter((p) => p.url).length;
  const compound = lang === "ar" ? s.compoundAr : s.compoundEn;
  const rows: [number, string, string][] = [
    [0, t("النوع", "Type"), `${t(CATEGORY_LABEL[s.category])} | ${s.type ? t(PROPERTY_TYPE_LABEL[s.type]) : "—"}`],
    [1, t("المكان", "Location"), `${area ? (lang === "ar" ? area.nameAr : area.nameEn) : "—"}${compound ? ` | ${compound}` : ""}`],
    [1, t("العنوان", "Title"), (lang === "ar" ? s.titleAr : s.titleEn) || t("العنوان الافتراضي", "The default title")],
    [1, t("المالك", "Owner"), [s.ownerName, s.ownerPhone].filter(Boolean).join(" | ") || "—"],
    [2, t("السعر", "Price"), price ? fmtMoney(price, lang, false) : "—"],
    [2, t("التفاصيل", "Details"), t(`${s.beds || "—"} غرف | ${s.baths || "—"} حمام | ${s.sizeM2 || "—"} م²`, `${s.beds || "—"} beds | ${s.baths || "—"} baths | ${s.sizeM2 || "—"} m²`)],
    [2, t("التشطيب", "Finishing"), s.finishing ? t(FINISHING_LABEL[s.finishing]) : "—"],
    [2, t("المميزات", "Amenities"), s.features.map((f) => t(FEATURE_LABEL[f])).join("، ") || "—"],
    [3, t("الصور", "Photos"), t(`${fmtNum(uploaded, "ar")} صورة`, `${uploaded} photos`)],
    [4, t("الفيديوهات", "Videos"), s.videos.length ? t(`${fmtNum(s.videos.length, "ar")} فيديو`, `${s.videos.length} ${s.videos.length === 1 ? "video" : "videos"}`) : t("مفيش", "None")],
    [5, t("جولة ٣٦٠°", "360° tour"), s.tour.length ? t(`${fmtNum(s.tour.length, "ar")} غرفة`, `${s.tour.length} ${s.tour.length === 1 ? "room" : "rooms"}`) : t("مفيش", "None")],
  ];
  return (
    <>
      {errors.length ? <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{t("في بيانات ناقصة. دوس على السطر علشان تكمّلها.", "Some details are missing. Click a line to fill it in.")}</p> : null}
      <dl className="divide-y divide-line">
        {rows.map(([to, label, value]) => (
          <button key={label} type="button" onClick={() => onEdit(to)} className="grid w-full grid-cols-[110px_1fr] gap-3 py-3 text-start hover:bg-surface-2/60">
            <dt className="text-sm text-ink-3">{label}</dt>
            <dd className="text-sm">{value}</dd>
          </button>
        ))}
      </dl>
    </>
  );
}
