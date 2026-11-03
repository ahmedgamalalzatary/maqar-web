"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BellRing, TrendingDown, CalendarCheck, BadgeCheck, Sparkles, Users, BellOff } from "lucide-react";
import { useStore, type NotifKind } from "@/lib/store";
import { relTime, useLang, useT } from "@/lib/i18n";
import { Empty, PageHeader, cx } from "@/components/ui";

const ICON: Record<NotifKind, [typeof BellRing, string]> = {
  price: [TrendingDown, "bg-[#e0574b]/12 text-[#e0574b]"],
  reminder: [BellRing, "bg-accent-soft text-accent-ink"],
  booking: [CalendarCheck, "bg-success-soft text-success"],
  approval: [BadgeCheck, "bg-sage-soft text-sage-ink"],
  match: [Sparkles, "bg-accent-soft text-accent-ink"],
  lead: [Users, "bg-sage-soft text-sage-ink"],
};

export default function NotificationsPage() {
  const t = useT();
  const lang = useLang();
  const list = useStore((s) => s.notifications);
  const markAll = useStore((s) => s.markAllRead);
  const role = useStore((s) => s.role);

  useEffect(() => {
    const id = setTimeout(markAll, 1500);
    return () => clearTimeout(id);
  }, [markAll]);

  return (
    <div>
      <PageHeader back={role === "buyer"} title={t("التنبيهات", "Notifications")} />
      <div className="space-y-2 px-4">
        {list.map((n) => {
          const [Icon, cls] = ICON[n.kind];
          const body = (
            <>
              <span className={cx("grid size-11 shrink-0 place-items-center rounded-2xl", cls)}>
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold">{n.title[lang]}</span>
                  <span className="shrink-0 text-[11px] text-ink-3">{relTime(n.at, lang)}</span>
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{n.body[lang]}</span>
              </span>
              {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
            </>
          );
          const cl = cx("flex items-start gap-3 rounded-3xl p-3.5 transition", n.read ? "bg-surface ring-1 ring-line" : "bg-accent-soft ring-1 ring-accent/20");
          return n.href ? (
            <Link key={n.id} href={n.href} className={cl}>
              {body}
            </Link>
          ) : (
            <div key={n.id} className={cl}>
              {body}
            </div>
          );
        })}
        {list.length === 0 && <Empty icon={<BellOff className="size-7" />} title={t("مفيش تنبيهات", "No notifications")} body={t("هنا هتلاقي تذكير المعاينات ونزول الأسعار.", "Viewing reminders and price drops will show up here.")} />}
      </div>
    </div>
  );
}
