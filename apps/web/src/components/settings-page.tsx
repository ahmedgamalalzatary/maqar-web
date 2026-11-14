"use client";

import {
  type AppSettings,
  CALCULATOR_BOUNDS,
  calculatorProblem,
  HOME_SECTION_LABEL,
  type HomeSection,
  readWholeNumber,
  SPLASH_TEXT_MAX,
  SPLASH_VIDEO_MAX_SECONDS,
  type SplashKind,
  VIDEO_TYPES,
} from "@maqar/shared";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Video } from "lucide-react";
import { useRef, useState } from "react";
import { uploadPhoto, uploadVideo, useSaveSettings, useSettings, videoDuration } from "@/lib/admin";
import { mediaUrl } from "@/lib/client";
import { useLang, useT } from "@/lib/i18n";
import { shrinkPhoto } from "@/lib/photos";
import { useNotice } from "./shell";
import { Button, Card, Chip, Field, useErrorText } from "./ui";

/** `/settings/` (phase 29): what the client app shows when it opens, the calculator's limits and the Home order. */
export function SettingsPage() {
  const t = useT();
  const settings = useSettings();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{t("إعدادات التطبيق", "App settings")}</h1>
        <p className="text-sm text-ink-2">{t("اللي بتغيره هنا بيظهر في تطبيق العملاء من غير تحديث للتطبيق.", "What you change here shows in the client app without an app update.")}</p>
      </div>
      {settings.isPending ? (
        <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
      ) : settings.isError ? (
        <Card className="flex flex-wrap items-center gap-3">
          <span className="flex-1">{t("مقدرناش نجيب الإعدادات", "We couldn’t load the settings")}</span>
          <Button variant="secondary" onClick={() => void settings.refetch()}>
            {t("حاول تاني", "Try again")}
          </Button>
        </Card>
      ) : (
        <>
          <Splash saved={settings.data} />
          <Calculator saved={settings.data} />
          <HomeOrder saved={settings.data} />
        </>
      )}
    </div>
  );
}

function useSave() {
  const t = useT();
  const notice = useNotice();
  const errorText = useErrorText();
  const save = useSaveSettings();
  return {
    busy: save.isPending,
    run: (body: Parameters<typeof save.mutate>[0]) =>
      save.mutate(body, {
        onSuccess: () => notice({ text: t("اتحفظ، وهيظهر في التطبيق مع أول فتح", "Saved: the app shows it the next time it opens"), tone: "ok" }),
        onError: (e) => notice({ text: errorText(e), tone: "bad" }),
      }),
  };
}

/** The opening screen: the logo only, a picture, or a video of at most 3 seconds; with a line of text. */
function Splash({ saved }: { saved: AppSettings }) {
  const t = useT();
  const notice = useNotice();
  const save = useSave();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<SplashKind>(saved.splash.kind);
  // Each kind keeps its own file, so switching back and forth loses nothing.
  const [image, setImage] = useState(saved.splash.kind === "image" ? saved.splash.media : null);
  const [video, setVideo] = useState(saved.splash.kind === "video" ? { url: saved.splash.media!, poster: saved.splash.poster } : null);
  const [textAr, setTextAr] = useState(saved.splash.textAr);
  const [textEn, setTextEn] = useState(saved.splash.textEn);
  const [uploading, setUploading] = useState(false);
  const media = kind === "image" ? image : kind === "video" ? (video?.url ?? null) : null;
  const missing = kind !== "none" && !media;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      if (kind === "image") {
        setImage((await uploadPhoto(await shrinkPhoto(file))).url);
      } else {
        if (!(VIDEO_TYPES as readonly string[]).includes(file.type)) return notice({ text: t("الفيديو لازم يكون MP4 أو MOV", "The video must be an MP4 or MOV"), tone: "bad" });
        const seconds = await videoDuration(file);
        if (seconds !== undefined && Math.round(seconds) > SPLASH_VIDEO_MAX_SECONDS)
          return notice({ text: t("الفيديو لازم يكون ٣ ثواني أو أقل", "The video must be 3 seconds or shorter"), tone: "bad" });
        const v = await uploadVideo(file, undefined, true);
        setVideo({ url: v.url, poster: v.poster });
      }
    } catch (e) {
      const message = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
      notice({ text: /3 seconds/.test(message) ? t("الفيديو لازم يكون ٣ ثواني أو أقل", "The video must be 3 seconds or shorter") : t("مقدرناش نرفع الملف", "We couldn’t upload the file"), tone: "bad" });
    } finally {
      setUploading(false);
    }
  };

  const kinds: { value: SplashKind; label: string }[] = [
    { value: "none", label: t("اللوجو بس", "The logo only") },
    { value: "image", label: t("صورة", "A picture") },
    { value: "video", label: t("فيديو (٣ ثواني)", "A video (3 seconds)") },
  ];
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold">{t("شاشة الفتح", "The opening screen")}</h2>
        <p className="text-sm text-ink-2">{t("أول حاجة العميل بيشوفها لما يفتح التطبيق، بعد اللوجو.", "The first thing a client sees when the app opens, after the logo.")}</p>
      </div>
      <div role="radiogroup" aria-label={t("نوع شاشة الفتح", "Kind of opening screen")} className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <Chip key={k.value} selected={kind === k.value} onClick={() => setKind(k.value)}>
            {k.label}
          </Chip>
        ))}
      </div>
      {kind !== "none" ? (
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <input ref={input} type="file" accept={kind === "image" ? "image/*" : VIDEO_TYPES.join(",")} hidden onChange={(e) => void pick(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
          <div className="relative mx-auto grid aspect-[9/16] w-full max-w-[180px] place-items-center overflow-hidden rounded-xl border border-line bg-navy">
            {kind === "image" && image ? (
              // eslint-disable-next-line @next/next/no-img-element -- photos come from the API host
              <img src={mediaUrl(image)} alt="" className="absolute inset-0 size-full object-cover" />
            ) : kind === "video" && video ? (
              <video key={video.url} src={mediaUrl(video.url)} poster={mediaUrl(video.poster)} muted loop autoPlay playsInline className="absolute inset-0 size-full object-cover" />
            ) : null}
            {uploading ? <Loader2 className="relative size-6 animate-spin text-cream" aria-label={t("بترفع", "Uploading")} /> : null}
            {textAr || textEn ? <p className="absolute inset-x-2 bottom-4 text-center text-sm font-semibold text-cream [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]">{t(textAr || textEn, textEn || textAr)}</p> : null}
          </div>
          <div className="flex flex-col items-start gap-2">
            <Button variant="secondary" onClick={() => input.current?.click()} disabled={uploading}>
              {kind === "image" ? <ImagePlus className="size-4" aria-hidden /> : <Video className="size-4" aria-hidden />}
              {media ? t("غيّر الملف", "Change the file") : kind === "image" ? t("ارفع صورة", "Upload a picture") : t("ارفع فيديو", "Upload a video")}
            </Button>
            <p className="text-sm text-ink-3">
              {kind === "image"
                ? t("صورة بالطول (زي شاشة الموبايل) بتبان أحسن. بتفضل ظاهرة ثانيتين.", "An upright picture (like a phone screen) looks best. It stays up for 2 seconds.")
                : t("MP4 أو MOV، ٣ ثواني أو أقل، من غير صوت. يفضل بالطول.", "MP4 or MOV, 3 seconds or shorter, played without sound. Upright is best.")}
            </p>
            {missing ? <p className="text-sm text-danger">{kind === "image" ? t("ارفع الصورة الأول", "Upload the picture first") : t("ارفع الفيديو الأول", "Upload the video first")}</p> : null}
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("النص (عربي، اختياري)", "Text (Arabic, optional)")} value={textAr} onChange={(e) => setTextAr(e.target.value)} maxLength={SPLASH_TEXT_MAX} dir="rtl" />
        <Field label={t("النص (إنجليزي، اختياري)", "Text (English, optional)")} value={textEn} onChange={(e) => setTextEn(e.target.value)} maxLength={SPLASH_TEXT_MAX} dir="ltr" />
      </div>
      <div>
        <Button variant="gold" loading={save.busy} disabled={uploading || missing} onClick={() => save.run({ splash: { kind, media, textAr: textAr.trim(), textEn: textEn.trim() } })}>
          {t("احفظ شاشة الفتح", "Save the opening screen")}
        </Button>
      </div>
    </Card>
  );
}

/** The calculator: the least down payment and the years a client can type. */
function Calculator({ saved }: { saved: AppSettings }) {
  const t = useT();
  const save = useSave();
  const [down, setDown] = useState(String(saved.calculator.minDownPct));
  const [minYears, setMinYears] = useState(String(saved.calculator.minYears));
  const [maxYears, setMaxYears] = useState(String(saved.calculator.maxYears));
  const value = { minDownPct: readWholeNumber(down) ?? -1, minYears: readWholeNumber(minYears) ?? 0, maxYears: readWholeNumber(maxYears) ?? 0 };
  const problem = calculatorProblem(value);
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold">{t("حاسبة التقسيط", "The installment calculator")}</h2>
        <p className="text-sm text-ink-2">
          {t("أقل مقدم وأقل وأكتر سنين العميل يقدر يختارهم. العقار اللي له خطة تقسيط خاصة بيتحسب بخطته.", "The least down payment and the fewest and most years a client can pick. A listing with its own payment plan keeps its plan.")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Any whole percent, typed (owner, 2026-11-14): 11, 12, 9… */}
        <Field label={t("أقل مقدم (٪)", "Least down payment (%)")} value={down} onChange={(e) => setDown(e.target.value)} inputMode="numeric" dir="ltr" maxLength={2} />
        <Field label={t("أقل سنين", "Fewest years")} value={minYears} onChange={(e) => setMinYears(e.target.value)} inputMode="numeric" dir="ltr" maxLength={2} />
        <Field label={t("أكتر سنين", "Most years")} value={maxYears} onChange={(e) => setMaxYears(e.target.value)} inputMode="numeric" dir="ltr" maxLength={2} />
      </div>
      {problem === "down" ? <p className="text-sm text-danger">{t(`أقل مقدم من ٠ لـ ${CALCULATOR_BOUNDS.downMax}٪.`, `The least down payment is 0 to ${CALCULATOR_BOUNDS.downMax}%.`)}</p> : null}
      {problem === "years" ? <p className="text-sm text-danger">{t("السنين من ١ لـ ٣٠، والأقل ميزيدش عن الأكتر.", "Years go from 1 to 30, and the fewest cannot be more than the most.")}</p> : null}
      <div>
        <Button variant="gold" loading={save.busy} disabled={!!problem} onClick={() => save.run({ calculator: value })}>
          {t("احفظ الحاسبة", "Save the calculator")}
        </Button>
      </div>
    </Card>
  );
}

/** The order of the Home sections: move one up or down, then save. */
function HomeOrder({ saved }: { saved: AppSettings }) {
  const t = useT();
  const lang = useLang();
  const save = useSave();
  const [order, setOrder] = useState<HomeSection[]>(saved.home.sections);
  const move = (i: number, by: -1 | 1) =>
    setOrder((cur) => {
      const next = [...cur];
      [next[i], next[i + by]] = [next[i + by]!, next[i]!];
      return next;
    });
  const changed = order.join() !== saved.home.sections.join();
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold">{t("ترتيب الصفحة الرئيسية", "The order of the Home page")}</h2>
        <p className="text-sm text-ink-2">
          {t("العنوان وخانة البحث ثابتين فوق. القسم اللي مفيهوش حاجة للعميل مش بيظهر.", "The headline and the search box stay on top. A section with nothing for the client does not show.")}
        </p>
      </div>
      <ol className="flex flex-col gap-2">
        {order.map((s, i) => (
          <li key={s} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5">
            <span className="w-6 text-sm text-ink-3 tabular">{new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en").format(i + 1)}</span>
            <span className="min-w-0 flex-1 text-sm font-medium">{t(HOME_SECTION_LABEL[s])}</span>
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t(`طلّع ${HOME_SECTION_LABEL[s].ar} لفوق`, `Move ${HOME_SECTION_LABEL[s].en} up`)} className="grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-30">
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              disabled={i === order.length - 1}
              onClick={() => move(i, 1)}
              aria-label={t(`نزّل ${HOME_SECTION_LABEL[s].ar} لتحت`, `Move ${HOME_SECTION_LABEL[s].en} down`)}
              className="grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-30"
            >
              <ArrowDown className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      <div>
        <Button variant="gold" loading={save.busy} disabled={!changed} onClick={() => save.run({ home: { sections: order } })}>
          {t("احفظ الترتيب", "Save the order")}
        </Button>
      </div>
    </Card>
  );
}
