"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { UserRound, Store, Briefcase, Languages, Moon, Bell, Sparkles, RotateCcw, Calculator, ChevronLeft, Check, ShieldCheck } from "lucide-react";
import { useStore, pushNotify, type Role } from "@/lib/store";
import { fmtMoney, useLang, useT } from "@/lib/i18n";
import { askNotificationPermission } from "@/lib/demo";
import { useChat } from "@/lib/chat";
import { Button, Card, PageHeader, Sheet, Toggle, cx } from "@/components/ui";
import { Logo } from "@/components/Logo";
import Link from "next/link";

export default function ProfilePage() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const s = useStore();
  const [resetOpen, setResetOpen] = useState(false);
  const [perm, setPerm] = useState<string>(() => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));
  const pushOn = s.pushEnabled && perm === "granted";

  const roles: { k: Role; icon: typeof UserRound; title: string; body: string; home: string }[] = [
    { k: "buyer", icon: UserRound, title: t("عميل", "Client"), body: t("دوّر، احجز معاينة، تابع الأسعار", "Search, book viewings, follow prices"), home: "/" },
    { k: "owner", icon: Store, title: t("مالك عقار", "Owner"), body: t("اعرض عقارك وتابع المهتمين", "List your property, track interest"), home: "/owner" },
    { k: "agent", icon: Briefcase, title: t("مسؤول مبيعات", "Sales agent"), body: t("عملائك ومعايناتك وحالة كل عميل", "Your leads, viewings and pipeline"), home: "/agent" },
  ];

  return (
    <div>
      <PageHeader back={false} title={t("حسابي", "My account")} />
      <div className="px-4">
        <Card className="flex items-center gap-4 p-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-navy text-[20px] font-semibold text-gold">{(s.name || "M").slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-semibold">{s.name || t("ضيف مقر", "Maqar guest")}</div>
            <div className="text-[12.5px] text-ink-2">
              {t("ميزانيتك:", "Budget:")} <span className="tabular">{fmtMoney(s.prefs.budgetMax, lang)}</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success">
            <ShieldCheck className="size-3.5" /> {t("موثّق", "Verified")}
          </span>
        </Card>

        <h2 className="mb-3 mt-7 text-[15px] font-semibold">{t("جرّب التطبيق بدور", "Try the app as")}</h2>
        <div className="space-y-2">
          {roles.map((r) => {
            const on = s.role === r.k;
            return (
              <button
                key={r.k}
                onClick={() => {
                  s.set({ role: r.k });
                  router.push(r.home);
                }}
                className={cx("relative flex w-full items-center gap-3.5 rounded-3xl p-3.5 text-start transition active:scale-[0.99]", on ? "bg-ink text-bg" : "bg-surface ring-1 ring-line")}
              >
                <span className={cx("grid size-11 shrink-0 place-items-center rounded-2xl", on ? "bg-accent text-navy" : "bg-accent-soft text-accent-ink")}>
                  <r.icon className="size-5" />
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] font-semibold">{r.title}</span>
                  <span className={cx("block text-[12px]", on ? "opacity-70" : "text-ink-2")}>{r.body}</span>
                </span>
                {on && (
                  <motion.span layoutId="role-check" className="grid size-7 place-items-center rounded-full bg-accent text-navy">
                    <Check className="size-4" strokeWidth={3} />
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>

        <h2 className="mb-3 mt-7 text-[15px] font-semibold">{t("الإعدادات", "Settings")}</h2>
        <Card className="divide-y divide-line">
          <Row icon={Languages} label={t("اللغة", "Language")}>
            <div className="flex rounded-xl bg-surface-2 p-0.5 text-[12px] font-medium">
              {(["ar", "en"] as const).map((l) => (
                <button key={l} onClick={() => s.set({ lang: l })} className={cx("h-8 rounded-[10px] px-3", s.lang === l ? "bg-surface shadow-card" : "text-ink-2")}>
                  {l === "ar" ? "العربية" : "English"}
                </button>
              ))}
            </div>
          </Row>
          <Row icon={Moon} label={t("الوضع الداكن", "Dark mode")}>
            <Toggle on={s.theme === "dark"} onChange={(v) => s.set({ theme: v ? "dark" : "light" })} label="Dark mode" />
          </Row>
          <Row
            icon={Bell}
            label={t("إشعارات الموبايل", "Phone notifications")}
            sub={
              perm === "denied"
                ? t("مقفولة من إعدادات المتصفح", "Blocked in browser settings")
                : perm === "unsupported"
                  ? t("المتصفح ده مش بيدعمها", "Not supported in this browser")
                  : pushOn
                    ? t("مفعّلة", "On")
                    : t("مقفولة", "Off")
            }
          >
            <Toggle
              on={pushOn}
              onChange={async (v) => {
                if (!v) {
                  s.set({ pushEnabled: false });
                  pushNotify(t("اتقفلت إشعارات الموبايل", "Phone notifications off"), t("هتفضل توصلك التنبيهات جوه التطبيق.", "You’ll still see alerts inside the app."), undefined, "sage");
                  return;
                }
                const r = await askNotificationPermission();
                setPerm(r);
                if (r === "granted") {
                  s.set({ pushEnabled: true });
                  pushNotify(t("الإشعارات شغالة", "Notifications are on"), t("هيوصلك تذكير المعاينات ونزول الأسعار.", "You’ll get viewing reminders and price drops."), undefined, "sage");
                } else if (r === "denied") {
                  pushNotify(t("المتصفح مانع الإشعارات", "Notifications are blocked"), t("اسمح بيها من إعدادات الموقع في المتصفح وجرّب تاني.", "Allow them in the browser’s site settings, then try again."), undefined, "danger");
                }
              }}
              label="Notifications"
            />
          </Row>
          <LinkRow icon={Sparkles} label={t("عدّل تفضيلاتك", "Edit your preferences")} onClick={() => s.set({ onboarded: false })} />
          <LinkRow icon={Calculator} label={t("حاسبة التقسيط", "Installment calculator")} href="/calculator" />
          <LinkRow icon={RotateCcw} label={t("إعادة ضبط الديمو", "Reset demo")} onClick={() => setResetOpen(true)} />
        </Card>

        <div className="mt-10 flex flex-col items-center gap-2 pb-4 text-center">
          <Logo width={96} />
          <p className="text-[11px] text-ink-3">{t("نسخة تجريبية | كل البيانات للعرض فقط", "Demo build | all data is sample data")}</p>
        </div>
      </div>

      <Sheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={t("إعادة ضبط الديمو؟", "Reset the demo?")}
        footer={
          <Button
            full
            variant="danger"
            onClick={() => {
              s.resetDemo();
              useChat.getState().reset();
              setResetOpen(false);
              router.push("/");
            }}
          >
            {t("امسح وابدأ من جديد", "Clear and start over")}
          </Button>
        }
      >
        <p className="pb-2 text-[14px] text-ink-2">{t("هيتمسح كل المعاينات والمفضلة والإعلانات اللي ضفتها.", "All viewings, saved homes and listings you added will be cleared.")}</p>
      </Sheet>
    </div>
  );
}

function Row({ icon: Icon, label, sub, children }: { icon: typeof Bell; label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      <Icon className="size-5 text-ink-2" />
      <span className="flex-1">
        <span className="block text-[14px]">{label}</span>
        {sub && <span className="block text-[11.5px] text-ink-3">{sub}</span>}
      </span>
      {children}
    </div>
  );
}

function LinkRow({ icon: Icon, label, href, onClick }: { icon: typeof Bell; label: string; href?: string; onClick?: () => void }) {
  const inner = (
    <>
      <Icon className="size-5 text-ink-2" />
      <span className="flex-1 text-start text-[14px]">{label}</span>
      <ChevronLeft className="size-4 text-ink-3 ltr:rotate-180" />
    </>
  );
  const cls = "flex h-14 w-full items-center gap-3 px-4 active:bg-surface-2";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
