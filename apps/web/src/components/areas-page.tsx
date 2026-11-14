"use client";

import { type AdminArea, areaSlug, fmtNum } from "@maqar/shared";
import { ImagePlus, Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { uploadPhoto, useAdminAreas, useDeleteArea, useSaveArea } from "@/lib/admin";
import { mediaUrl } from "@/lib/client";
import { useLang, useT } from "@/lib/i18n";
import { shrinkPhoto } from "@/lib/photos";
import { useNotice } from "./shell";
import { Button, Card, Field, useErrorText } from "./ui";

/** `/areas/` (phase 18): the areas clients browse by. An area no listing uses can be deleted. */
export function AreasPage() {
  const t = useT();
  const lang = useLang();
  const notice = useNotice();
  const errorText = useErrorText();
  const areas = useAdminAreas();
  const remove = useDeleteArea();
  const [editing, setEditing] = useState<AdminArea | "new" | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="flex-1 text-2xl font-semibold">{t("المناطق", "Areas")}</h1>
        <Button variant="gold" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden />
          {t("أضف منطقة", "Add an area")}
        </Button>
      </div>
      {editing ? <AreaForm key={editing === "new" ? "new" : editing.id} saved={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} /> : null}
      {areas.isPending ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
      ) : areas.isError ? (
        <Card>{t("مقدرناش نجيب المناطق", "We couldn’t load the areas")}</Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {areas.data.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
              {a.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- photos come from the API host
                <img src={mediaUrl(a.image)} alt="" className="h-32 w-full object-cover" loading="lazy" />
              ) : (
                <div className="grid h-32 place-items-center bg-surface-2 text-ink-3">
                  <MapPin className="size-7" aria-hidden />
                </div>
              )}
              <div className="flex items-center gap-2 p-3">
                <div className="flex-1">
                  <p className="font-medium">{lang === "ar" ? a.nameAr : a.nameEn}</p>
                  <p className="text-xs text-ink-2">{`${lang === "ar" ? a.cityAr : a.cityEn} | ${t(`${fmtNum(a.listings, "ar")} عقار`, `${a.listings} listings`)}`}</p>
                </div>
                <button type="button" aria-label={t(`عدّل ${a.nameAr}`, `Edit ${a.nameEn}`)} onClick={() => setEditing(a)} className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2">
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={t(`امسح ${a.nameAr}`, `Delete ${a.nameEn}`)}
                  title={a.listings ? t("فيها عقارات، مينفعش تتمسح", "Listings use it: it can’t be deleted") : undefined}
                  disabled={a.listings > 0 || remove.isPending}
                  onClick={() => {
                    if (window.confirm(t("تمسح المنطقة؟ العملاء مش هيشوفوها تاني.", "Delete the area? Clients will not see it any more.")))
                      remove.mutate(a.id, { onSuccess: () => notice({ text: t("المنطقة اتمسحت", "Area deleted"), tone: "ok" }), onError: (e) => notice({ text: errorText(e), tone: "bad" }) });
                  }}
                  className="grid size-9 place-items-center rounded-lg text-danger hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AreaForm({ saved, onDone }: { saved?: AdminArea; onDone: () => void }) {
  const t = useT();
  const notice = useNotice();
  const save = useSaveArea(saved?.id);
  const input = useRef<HTMLInputElement>(null);
  const [d, setD] = useState({ nameAr: saved?.nameAr ?? "", nameEn: saved?.nameEn ?? "", cityAr: saved?.cityAr ?? "", cityEn: saved?.cityEn ?? "", image: saved?.image ?? "" });
  const [uploading, setUploading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const set = (k: keyof typeof d, v: string) => setD((cur) => ({ ...cur, [k]: v }));
  const short = (v: string) => v.trim().length < 2;
  const bad = short(d.nameAr) || short(d.nameEn) || short(d.cityAr) || short(d.cityEn) || (!saved && areaSlug(d.nameEn).length < 2);
  const err = (v: string) => (showErrors && short(v) ? t("اكتب حرفين على الأقل", "At least 2 characters") : undefined);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      set("image", (await uploadPhoto(await shrinkPhoto(file))).url);
    } catch {
      notice({ text: t("مقدرناش نرفع الصورة", "We couldn’t upload the photo"), tone: "bad" });
    } finally {
      setUploading(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (bad) return setShowErrors(true);
    save.mutate(
      { nameAr: d.nameAr.trim(), nameEn: d.nameEn.trim(), cityAr: d.cityAr.trim(), cityEn: d.cityEn.trim(), image: d.image || null },
      {
        onSuccess: () => {
          notice({ text: saved ? t("المنطقة اتحفظت", "Area saved") : t("المنطقة اتضافت وبقت ظاهرة للعملاء", "Area added: clients see it now"), tone: "ok" });
          onDone();
        },
        onError: (e) =>
          notice({ text: e instanceof ApiError && e.status === 409 ? t("فيه منطقة بنفس الاسم الإنجليزي", "An area with that English name exists") : t("مقدرناش نحفظ، راجع البيانات", "We couldn’t save; check the details"), tone: "bad" }),
      },
    );
  };
  return (
    <Card>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="relative grid h-40 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-accent bg-accent-soft text-accent-ink"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- photos come from the API host */}
          {d.image ? <img src={mediaUrl(d.image)} alt="" className="absolute inset-0 size-full object-cover" /> : null}
          {uploading ? (
            <Loader2 className="size-6 animate-spin" aria-label={t("بترفع", "Uploading")} />
          ) : (
            <span className="relative flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1 text-sm font-medium">
              <ImagePlus className="size-4" aria-hidden />
              {d.image ? t("غيّر الصورة", "Change the photo") : t("ضيف صورة (اختياري)", "Add a photo (optional)")}
            </span>
          )}
        </button>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("الاسم (عربي)", "Name (Arabic)")} value={d.nameAr} onChange={(e) => set("nameAr", e.target.value)} error={err(d.nameAr)} dir="rtl" />
          <Field
            label={t("الاسم (إنجليزي)", "Name (English)")}
            value={d.nameEn}
            onChange={(e) => set("nameEn", e.target.value)}
            error={err(d.nameEn)}
            hint={saved ? undefined : d.nameEn ? `id: ${areaSlug(d.nameEn) || "—"}` : undefined}
            dir="ltr"
          />
          <Field label={t("المدينة (عربي)", "City (Arabic)")} value={d.cityAr} onChange={(e) => set("cityAr", e.target.value)} error={err(d.cityAr)} dir="rtl" />
          <Field label={t("المدينة (إنجليزي)", "City (English)")} value={d.cityEn} onChange={(e) => set("cityEn", e.target.value)} error={err(d.cityEn)} dir="ltr" />
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit" variant="gold" loading={save.isPending} disabled={uploading}>
              {saved ? t("احفظ", "Save") : t("أضف المنطقة", "Add the area")}
            </Button>
            <Button variant="ghost" onClick={onDone}>
              {t("إلغاء", "Cancel")}
            </Button>
            {d.image ? (
              <Button variant="ghost" onClick={() => set("image", "")} disabled={uploading}>
                {t("شيل الصورة", "Remove the photo")}
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </Card>
  );
}
