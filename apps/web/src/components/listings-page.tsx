"use client";

import { type AdminListingItem, fmtMoney, fmtNum, PROPERTY_STATUS_LABEL, PROPERTY_STATUSES, type PropertyStatus } from "@maqar/shared";
import { Building2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { useListings } from "@/lib/admin";
import { mediaUrl } from "@/lib/client";
import { useLang, useT } from "@/lib/i18n";
import { Button, StatusBadge } from "./ui";

type Filter = PropertyStatus | "all";

/** Per month for rent, per night for stays. */
export const priceSuffix = (category: AdminListingItem["category"], t: ReturnType<typeof useT>) =>
  category === "rent" ? t("/ شهر", "/ mo") : category === "stay" ? t("/ ليلة", "/ night") : "";

/** Every listing in every status, with search and status filters (phase 17). */
export function ListingsPage() {
  const t = useT();
  const lang = useLang();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const words = useDeferredValue(q);
  const listings = useListings({ status: filter === "all" ? undefined : filter, q: words, page });
  const data = listings.data;
  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;
  const count = (s: Filter) => (data ? (s === "all" ? total : data.counts[s]) : 0);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{t("العقارات", "Listings")}</h1>
          {data ? (
            <p className="text-sm text-ink-2">
              {t(`${fmtNum(total, "ar")} عقار، ${fmtNum(data.counts.approved, "ar")} منشور في التطبيق`, `${total} listings, ${data.counts.approved} live in the app`)}
            </p>
          ) : null}
        </div>
        <Link href="/listing/new/" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-navy hover:bg-accent/90">
          <Plus className="size-4" aria-hidden />
          {t("أضف عقار", "Add a listing")}
        </Link>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-line-2 bg-surface px-3 focus-within:border-accent">
          <Search className="size-4 text-ink-3" aria-hidden />
          <span className="sr-only">{t("ابحث", "Search")}</span>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={t("ابحث بالعنوان أو الكمبوند أو المالك أو رقمه", "Search by title, compound, owner or phone")}
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
          />
        </label>
        <div role="radiogroup" aria-label={t("الحالة", "Status")} className="flex flex-wrap gap-2">
          {(["all", ...PROPERTY_STATUSES] as Filter[]).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={filter === s}
              onClick={() => {
                setFilter(s);
                setPage(1);
              }}
              className={`min-h-10 rounded-full border px-3.5 text-sm font-medium ${filter === s ? "border-ink bg-ink text-bg" : "border-line-2 bg-surface hover:bg-surface-2"}`}
            >
              {s === "all" ? t("الكل", "All") : t(PROPERTY_STATUS_LABEL[s])} <span className="tabular opacity-70">{fmtNum(count(s), lang)}</span>
            </button>
          ))}
        </div>
      </div>

      {listings.isPending ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : listings.isError ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="mb-3">{t("مقدرناش نجيب العقارات", "We couldn’t load the listings")}</p>
          <Button variant="secondary" onClick={() => void listings.refetch()}>
            {t("حاول تاني", "Try again")}
          </Button>
        </div>
      ) : !data?.items.length ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-12 text-center">
          <Building2 className="size-8 text-ink-3" aria-hidden />
          <p className="font-medium">{total ? t("مفيش عقارات هنا", "No listings here") : t("لسه مفيش عقارات", "No listings yet")}</p>
          <p className="text-sm text-ink-2">{total ? t("جرّب حالة تانية أو امسح البحث.", "Try another status or clear the search.") : t("ابدأ بأول عقار.", "Start with the first one.")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="hidden bg-surface-2 text-ink-2 md:table-header-group">
              <tr className="text-start">
                <th className="p-3 text-start font-medium">{t("العقار", "Listing")}</th>
                <th className="p-3 text-start font-medium">{t("السعر", "Price")}</th>
                <th className="p-3 text-start font-medium">{t("المالك", "Owner")}</th>
                <th className="p-3 text-start font-medium">{t("المسؤول", "Advisor")}</th>
                <th className="p-3 text-start font-medium">{t("الحالة", "Status")}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((l) => (
                <Row key={l.id} l={l} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t("السابق", "Previous")}
          </Button>
          <span className="text-sm text-ink-2 tabular">{t(`صفحة ${fmtNum(page, "ar")} من ${fmtNum(pages, "ar")}`, `Page ${page} of ${pages}`)}</span>
          <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            {t("التالي", "Next")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Row({ l }: { l: AdminListingItem }) {
  const t = useT();
  const lang = useLang();
  const title = lang === "ar" ? l.titleAr : l.titleEn;
  const cover = mediaUrl(l.cover);
  const href = `/listing/?id=${l.id}`;
  return (
    <tr className="flex flex-col gap-1 border-t border-line p-3 first:border-t-0 hover:bg-surface-2/60 md:table-row md:p-0">
      <td className="md:p-3">
        <Link href={href} className="flex items-center gap-3">
          <span className="relative block size-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- photos come from the API host */}
            {cover ? <img src={cover} alt="" className="size-full object-cover" loading="lazy" /> : null}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{title}</span>
            <span className="block truncate text-xs text-ink-2">
              {lang === "ar" ? l.area.nameAr : l.area.nameEn}
              {(lang === "ar" ? l.compoundAr : l.compoundEn) ? ` | ${lang === "ar" ? l.compoundAr : l.compoundEn}` : ""}
            </span>
          </span>
        </Link>
      </td>
      <td className="tabular md:p-3">
        {fmtMoney(l.price, lang)} <span className="text-xs text-ink-3">{priceSuffix(l.category, t)}</span>
      </td>
      <td className="text-ink-2 md:p-3">{l.ownerName ?? "—"}</td>
      <td className="text-ink-2 md:p-3">{l.agent ? (lang === "ar" ? l.agent.nameAr : l.agent.nameEn) : t("لسه", "Not yet")}</td>
      <td className="md:p-3">
        <StatusBadge status={l.status} />
      </td>
    </tr>
  );
}
