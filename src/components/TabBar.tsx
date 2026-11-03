"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  Home,
  Search,
  CalendarCheck,
  Heart,
  UserRound,
  LayoutDashboard,
  PlusSquare,
  Bell,
  Users,
  Sun,
} from "lucide-react";
import { useStore, haptic } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cx } from "./ui";

export function TabBar() {
  const storeRole = useStore((s) => s.role);
  const unread = useStore((s) => s.notifications.filter((n) => !n.read).length);
  const upcoming = useStore((s) => s.viewings.filter((v) => v.status === "confirmed" || v.status === "rescheduled").length);
  const path = usePathname();
  // Opening a role's area directly (e.g. a shared /agent link) shows that role's tabs.
  const role = path.startsWith("/owner") ? "owner" : path.startsWith("/agent") ? "agent" : storeRole;
  const t = useT();

  const tabs =
    role === "owner"
      ? [
          { href: "/owner", icon: LayoutDashboard, label: t("لوحتي", "Portal") },
          { href: "/owner/new", icon: PlusSquare, label: t("أضف عقار", "Add") },
          { href: "/notifications", icon: Bell, label: t("التنبيهات", "Alerts"), badge: unread },
          { href: "/profile", icon: UserRound, label: t("حسابي", "Me") },
        ]
      : role === "agent"
        ? [
            { href: "/agent", icon: Sun, label: t("اليوم", "Today") },
            { href: "/agent/leads", icon: Users, label: t("العملاء", "Leads") },
            { href: "/notifications", icon: Bell, label: t("التنبيهات", "Alerts"), badge: unread },
            { href: "/profile", icon: UserRound, label: t("حسابي", "Me") },
          ]
        : [
            { href: "/", icon: Home, label: t("الرئيسية", "Home") },
            { href: "/explore", icon: Search, label: t("استكشف", "Explore") },
            { href: "/viewings", icon: CalendarCheck, label: t("معايناتي", "Viewings"), badge: upcoming },
            { href: "/saved", icon: Heart, label: t("المحفوظة", "Saved") },
            { href: "/profile", icon: UserRound, label: t("حسابي", "Me") },
          ];

  const isActive = (href: string) =>
    href === "/" ? path === "/" : href === "/owner" || href === "/agent" ? path === href : path.startsWith(href);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[440px] px-3 pb-[calc(10px+env(safe-area-inset-bottom))]">
      <div className="flex items-stretch rounded-[26px] bg-surface/90 p-1.5 shadow-float ring-1 ring-line backdrop-blur-xl">
        {tabs.map(({ href, icon: Icon, label, badge }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => haptic(5)}
              className="relative flex h-[54px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px]"
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-[20px] bg-ink"
                  transition={{ type: "spring", stiffness: 520, damping: 40 }}
                />
              )}
              <span className="relative">
                <Icon className={cx("size-[21px] transition-colors", active ? "text-bg" : "text-ink-2")} strokeWidth={active ? 2.2 : 1.8} />
                {!!badge && (
                  <span className="absolute -end-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-navy">
                    {badge}
                  </span>
                )}
              </span>
              <span className={cx("relative text-[10.5px] font-medium transition-colors", active ? "text-bg" : "text-ink-3")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
