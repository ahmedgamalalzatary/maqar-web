"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { BellRing, TrendingDown, CheckCircle2 } from "lucide-react";
import { useStore, pushNotify } from "@/lib/store";
import { PROPERTIES } from "@/lib/data";
import { fmtTime } from "@/lib/i18n";
import { viewingDate } from "@/lib/logic";
import { TabBar } from "./TabBar";
import { Onboarding } from "./Onboarding";
import { Logo } from "./Logo";
import { CompareTray } from "./Compare";

const HIDE_TABS = [/^\/property\/[^/]+/, /^\/owner\/new/, /^\/agent\/lead\//, /^\/chat\/[^/]+/, /^\/agent\/chat\//];

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(
    (cb) => useStore.persist.onFinishHydration(cb),
    () => useStore.persist.hasHydrated(),
    () => false,
  );
  const [splashDone, setSplashDone] = useState(false);
  const lang = useStore((s) => s.lang);
  const theme = useStore((s) => s.theme);
  const onboarded = useStore((s) => s.onboarded);
  const path = usePathname();

  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = lang === "ar" ? "rtl" : "ltr";
    el.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#030f1b" : "#f6f2e9");
  }, [lang, theme]);

  useReminderEngine(hydrated);

  const ready = hydrated && splashDone;
  const showTabs = !HIDE_TABS.some((r) => r.test(path));

  return (
    <div className="app-frame">
      <AnimatePresence>{!ready && <Splash key="splash" />}</AnimatePresence>
      {ready && (
        <>
          <motion.main
            key={path}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className={showTabs ? "pb-tabbar" : ""}
          >
            {children}
          </motion.main>
          {showTabs && <CompareTray />}
          {showTabs && <TabBar />}
          <AnimatePresence>{!onboarded && <Onboarding />}</AnimatePresence>
          <Toaster />
        </>
      )}
    </div>
  );
}

function Splash() {
  return (
    <motion.div
      className="fixed inset-0 z-[90] mx-auto grid max-w-[440px] place-items-center bg-navy"
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, filter: "blur(6px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <Logo width={180} onDark />
      </motion.div>
    </motion.div>
  );
}

function Toaster() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  const router = useRouter();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] mx-auto flex max-w-[440px] flex-col gap-2 px-3 pt-[calc(10px+env(safe-area-inset-top))]">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = t.tone === "sage" ? CheckCircle2 : t.tone === "danger" ? TrendingDown : BellRing;
          return (
            <motion.button
              key={t.id}
              layout
              initial={{ opacity: 0, y: -30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 500, damping: 36 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              onDragEnd={(_, i) => i.offset.y < -30 && dismiss(t.id)}
              onClick={() => {
                dismiss(t.id);
                if (t.href) router.push(t.href);
              }}
              className="pointer-events-auto flex w-full items-start gap-3 rounded-3xl bg-ink/95 p-3.5 text-start text-bg shadow-float backdrop-blur-xl"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent/20 text-accent">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t.title}</span>
                {t.body && <span className="mt-0.5 block text-[13px] leading-snug opacity-75">{t.body}</span>}
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Checks booked viewings each 20 s and fires the reminders the client chose. */
function useReminderEngine(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const fired = new Set<string>(JSON.parse(safeGet("maqar-fired") ?? "[]"));
    const tick = () => {
      const { viewings, lang, notify } = useStore.getState();
      const now = Date.now();
      for (const v of viewings) {
        if (v.status !== "confirmed" && v.status !== "rescheduled") continue;
        const at = viewingDate(v.date, v.time).getTime();
        for (const r of v.reminders) {
          const lead = r === "1d" ? 86_400_000 : r === "2h" ? 7_200_000 : 1_800_000;
          const key = `${v.id}-${r}-${v.date}-${v.time}`;
          if (now >= at - lead && now < at && !fired.has(key)) {
            fired.add(key);
            const p = PROPERTIES.find((x) => x.id === v.propertyId);
            const title = { ar: "تذكير بموعد المعاينة", en: "Viewing reminder" };
            const body = {
              ar: `${p?.title.ar ?? ""} الساعة ${fmtTime(v.time, "ar")}`,
              en: `${p?.title.en ?? ""} at ${fmtTime(v.time, "en")}`,
            };
            notify({ kind: "reminder", title, body, href: "/viewings" });
            pushNotify(title[lang], body[lang], "/viewings");
          }
        }
      }
      safeSet("maqar-fired", JSON.stringify([...fired]));
    };
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, [enabled]);
}

function safeGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}
