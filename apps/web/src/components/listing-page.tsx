"use client";

import { type AdminListing, CATEGORY_LABEL, canMoveTo, closedStatusFor, FEATURE_LABEL, FINISHING_LABEL, fmtDate, fmtMoney, fmtNum, PROPERTY_TYPE_LABEL } from "@maqar/shared";
import { ArrowLeft, ArrowRight, Check, Pencil, Phone } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { type Action, useAction, useAgents, useListing, usePatchListing, readId } from "@/lib/admin";
import { mediaUrl } from "@/lib/client";
import { useLang, useT } from "@/lib/i18n";
import { ListingInsights } from "./listing-insights";
import { priceSuffix } from "./listings-page";
import { useNotice } from "./shell";
import { Button, Card, StatusBadge, useErrorText } from "./ui";

/** `/listing/?id=7`: one listing with its owner and advisor, and what can be done with it. */
export function ListingPage() {
  const t = useT();
  const lang = useLang();
  const id = readId(useSearchParams().get("id"));
  const listing = useListing(id);
  const Back = lang === "ar" ? ArrowRight : ArrowLeft;
  return (
    <div className="flex flex-col gap-5">
      <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-ink-2 hover:text-ink">
        <Back className="size-4" aria-hidden />
        {t("كل العقارات", "All listings")}
      </Link>
      {id === undefined ? (
        <Card>{t("الرابط مش صحيح: مفيش رقم عقار.", "That link is not right: no listing number.")}</Card>
      ) : listing.isPending ? (
        <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
      ) : listing.isError ? (
        <Card>
          <p>{listing.error instanceof ApiError && listing.error.status === 404 ? t("العقار ده مش موجود.", "This listing does not exist.") : t("مقدرناش نجيب العقار", "We couldn’t load the listing")}</p>
        </Card>
      ) : (
        <Body l={listing.data} />
      )}
    </div>
  );
}

function Body({ l }: { l: AdminListing }) {
  const t = useT();
  const lang = useLang();
  const notice = useNotice();
  const errorText = useErrorText();
  const action = useAction();
  const patch = usePatchListing(l.id);
  const [picking, setPicking] = useState(false);
  const [moving, setMoving] = useState(false);
  const closed = closedStatusFor(l.category);
  const title = lang === "ar" ? l.titleAr : l.titleEn;

  const run = (a: Action, done: string) =>
    action.mutate(a, { onSuccess: () => notice({ text: done, tone: "ok" }), onError: (e) => notice({ text: errorText(e), tone: "bad" }) });

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {l.images.map((url, i) => (
            <div key={url} className={`relative overflow-hidden rounded-xl bg-surface-2 ${i === 0 ? "col-span-2 row-span-2 aspect-[4/3]" : "aspect-[4/3]"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- photos come from the API host */}
              <img src={mediaUrl(url)} alt="" className="size-full object-cover" />
              {i === 0 ? <span className="absolute start-2 top-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-navy">{t("الغلاف", "Cover")}</span> : null}
            </div>
          ))}
        </div>
        <Card className="flex flex-col gap-2">
          <StatusBadge status={l.status} />
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-ink-2">
            {`${t(CATEGORY_LABEL[l.category])} | ${t(PROPERTY_TYPE_LABEL[l.type])} | ${lang === "ar" ? l.area.nameAr : l.area.nameEn}`}
            {(lang === "ar" ? l.compoundAr : l.compoundEn) ? ` | ${lang === "ar" ? l.compoundAr : l.compoundEn}` : ""}
          </p>
          <p className="text-2xl font-semibold tabular">
            {fmtMoney(l.price, lang, false)} <span className="text-sm font-normal text-ink-3">{priceSuffix(l.category, t)}</span>
            {l.oldPrice ? <span className="ms-2 text-sm font-normal text-ink-3 line-through">{fmtMoney(l.oldPrice, lang, false)}</span> : null}
          </p>
          <p className="text-sm text-ink-2">
            {[
              l.beds ? t(`${fmtNum(l.beds, "ar")} غرف`, `${l.beds} beds`) : null,
              t(`${fmtNum(l.baths, "ar")} حمام`, `${l.baths} baths`),
              t(`${fmtNum(l.sizeM2, "ar")} م²`, `${l.sizeM2} m²`),
              t(FINISHING_LABEL[l.finishing]),
              l.delivery === "ready" ? t("استلام فوري", "Ready now") : t(`تسليم ${fmtNum(l.delivery, "ar", 0).replace(/٬/g, "")}`, `Handover ${l.delivery}`),
              l.plan ? t(`مقدم ${fmtNum(l.plan.downPct, "ar")}٪ على ${fmtNum(l.plan.years, "ar")} سنين`, `${l.plan.downPct}% down over ${l.plan.years} years`) : null,
            ]
              .filter(Boolean)
              .join(" | ")}
          </p>
          {l.features.length ? <p className="text-sm">{l.features.map((f) => t(FEATURE_LABEL[f])).join("، ")}</p> : null}
          {(lang === "ar" ? l.descAr : l.descEn) ? <p className="whitespace-pre-line text-sm leading-7 text-ink-2">{lang === "ar" ? l.descAr : l.descEn}</p> : null}
        </Card>
        {l.status === "draft" ? null : <ListingInsights l={l} />}
      </div>

      <aside className="flex flex-col gap-5">
        <Card className="flex flex-col gap-3">
          <h2 className="text-xs font-medium text-ink-3">{t("المالك (لفريق مقر بس)", "Owner (Maqar team only)")}</h2>
          <p className="font-medium">{l.ownerName ?? t("مش متسجل", "Not recorded")}</p>
          {l.ownerPhone ? (
            <a href={`tel:${l.ownerPhone}`} className="inline-flex w-fit items-center gap-2 text-sm text-accent-ink hover:underline" dir="ltr">
              <Phone className="size-4" aria-hidden />
              {l.ownerPhone}
            </a>
          ) : null}
          <hr className="border-line" />
          <h2 className="text-xs font-medium text-ink-3">{t("مسؤول المبيعات", "Sales advisor")}</h2>
          <div className="flex items-center gap-2">
            <p className="flex-1 font-medium">{l.agent ? (lang === "ar" ? l.agent.nameAr : l.agent.nameEn) : t("هيتحدد لما تنشر العقار", "Picked when you publish")}</p>
            {l.agent ? (
              <Button variant="ghost" onClick={() => setMoving(!moving)} aria-expanded={moving}>
                {t("غيّر", "Change")}
              </Button>
            ) : null}
          </div>
          {moving ? (
            <AdvisorPicker
              auto={false}
              current={l.agent?.id}
              onPick={(agentId) => {
                setMoving(false);
                if (agentId && agentId !== l.agent?.id)
                  patch.mutate(
                    { agentId },
                    {
                      onSuccess: () => notice({ text: t("المسؤول اتغيّر. الشاتات القديمة بتفضل مع المسؤول القديم.", "Advisor changed. Earlier chats stay with the earlier advisor."), tone: "ok" }),
                      onError: (e) => notice({ text: errorText(e), tone: "bad" }),
                    },
                  );
              }}
            />
          ) : null}
          <p className="text-xs text-ink-3">
            {l.publishedAt
              ? t(`اتنشر ${fmtDate(l.publishedAt, "ar")} | ${fmtNum(l.views, "ar")} مشاهدة`, `Published ${fmtDate(l.publishedAt, "en")} | ${l.views} views`)
              : t(`اتضاف ${fmtDate(l.createdAt, "ar")}`, `Added ${fmtDate(l.createdAt, "en")}`)}
          </p>
        </Card>

        <Card className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-3 text-sm font-medium">
            <span>{t("مميز في الرئيسية", "Featured on Home")}</span>
            <input
              type="checkbox"
              role="switch"
              checked={l.featured}
              disabled={patch.isPending}
              onChange={(e) =>
                patch.mutate(
                  { featured: e.target.checked },
                  {
                    onSuccess: (x) => notice({ text: x.featured ? t("العقار بقى مميز في الرئيسية", "Featured on Home") : t("العقار اتشال من المميزة", "No longer featured"), tone: "ok" }),
                    onError: (err) => notice({ text: errorText(err), tone: "bad" }),
                  },
                )
              }
              className="size-5 accent-[var(--accent)]"
            />
          </label>
          <p className="text-xs text-ink-3">{t("العقارات المميزة بتظهر أول حاجة في الرئيسية لما تكون منشورة.", "Featured listings show first on Home while they are live.")}</p>
        </Card>

        <Card className="flex flex-col gap-2.5">
          {canMoveTo(l.status, "approved") ? (
            <Button variant="gold" loading={action.isPending && action.variables?.kind === "publish"} onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
              {l.status === "draft" ? t("انشر العقار", "Publish") : t("انشره تاني", "Publish again")}
            </Button>
          ) : null}
          {picking ? (
            <AdvisorPicker
              auto
              current={l.agent?.id}
              onPick={(agentId) => {
                setPicking(false);
                run({ kind: "publish", id: l.id, agentId }, t("العقار اتنشر وبقى ظاهر في التطبيق", "Published: it now shows in the app"));
              }}
            />
          ) : null}
          <Link href={`/listing/edit/?id=${l.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line-2 bg-surface px-4 text-sm font-medium hover:bg-surface-2">
            <Pencil className="size-4" aria-hidden />
            {t("عدّل البيانات", "Edit details")}
          </Link>
          {canMoveTo(l.status, "unpublished") ? (
            <Button variant="secondary" disabled={action.isPending} onClick={() => run({ kind: "unpublish", id: l.id }, t("العقار اتشال من التطبيق", "Unpublished: it left the app"))}>
              {t("أوقف النشر", "Unpublish")}
            </Button>
          ) : null}
          {canMoveTo(l.status, closed) ? (
            <Button
              variant="danger"
              disabled={action.isPending}
              onClick={() => {
                if (window.confirm(closed === "sold" ? t("تعلّم العقار إنه اتباع؟ هيتشال من التطبيق.", "Mark as sold? It leaves the app.") : t("تعلّم العقار إنه اتأجر؟ هيتشال من التطبيق.", "Mark as rented? It leaves the app.")))
                  run({ kind: "close", id: l.id }, closed === "sold" ? t("العقار اتعلّم إنه اتباع", "Marked as sold") : t("العقار اتعلّم إنه اتأجر", "Marked as rented"));
              }}
            >
              {closed === "sold" ? t("اتباع", "Mark as sold") : t("اتأجر", "Mark as rented")}
            </Button>
          ) : null}
        </Card>
      </aside>
    </div>
  );
}

/** Who the published listing goes to: the least busy advisor (or the one it had), or one the admin picks. */
function AdvisorPicker({ auto, current, onPick }: { auto: boolean; current?: number; onPick: (agentId?: number) => void }) {
  const t = useT();
  const lang = useLang();
  const agents = useAgents();
  const row = (key: string, label: string, sub: string, onClick: () => void, on = false) => (
    <button key={key} type="button" onClick={onClick} className={`flex items-center gap-3 rounded-xl border p-3 text-start hover:bg-surface-2 ${on ? "border-accent" : "border-line-2"}`}>
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-ink-2">{sub}</span>
      </span>
      {on ? <Check className="size-4 text-accent-ink" aria-hidden /> : null}
    </button>
  );
  return (
    <div role="group" aria-label={t("مين مسؤول المبيعات؟", "Who is the sales advisor?")} className="flex flex-col gap-2">
      <p className="text-sm font-medium">{t("مين مسؤول المبيعات؟", "Who is the sales advisor?")}</p>
      {auto ? row("auto", t("اختار تلقائي", "Pick for me"), current ? t("نفس المسؤول، أو اللي عنده أقل عقارات", "The same advisor, or the least busy") : t("اللي عنده أقل عدد عقارات منشورة", "The one with the fewest live listings"), () => onPick(undefined)) : null}
      {agents.isPending ? <p className="text-xs text-ink-3">{t("بنجيب المسؤولين…", "Loading advisors…")}</p> : null}
      {(agents.data ?? []).map((a) =>
        row(String(a.id), lang === "ar" ? a.nameAr : a.nameEn, t(`${fmtNum(a.live, "ar")} عقار منشور`, `${a.live} live listings`), () => onPick(a.id), a.id === current),
      )}
    </div>
  );
}
