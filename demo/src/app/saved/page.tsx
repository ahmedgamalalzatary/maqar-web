"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Heart, BellRing, TrendingDown } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtMoney, fmtNum, fmtPct, useLang, useT } from "@/lib/i18n";
import { useProperties } from "@/lib/logic";
import { followPrice } from "@/lib/demo";
import { PropertyCard, PropertyRow, dropPct } from "@/components/PropertyCard";
import { Button, Empty, PageHeader, Segmented, Toggle } from "@/components/ui";

export default function SavedPage() {
  const t = useT();
  const lang = useLang();
  const favs = useStore((s) => s.favorites);
  const alerts = useStore((s) => s.alerts);
  const all = useProperties();
  const [tab, setTab] = useState<"saved" | "alerts">("saved");

  const saved = favs.map((id) => all.find((p) => p.id === id)).filter(Boolean) as typeof all;
  const followed = all.filter((p) => alerts.includes(p.id) || dropPct(p) > 0).filter((p) => p.cat !== "stay");

  return (
    <div>
      <PageHeader back={false} title={t("المحفوظة", "Saved")} subtitle={t("وحداتك وتنبيهات الأسعار", "Your homes and price alerts")} />
      <div className="px-4">
        <Segmented
          id="stab"
          value={tab}
          onChange={setTab}
          options={[
            { value: "saved", label: <><Heart className="size-4" /> {t(`المفضلة (${fmtNum(saved.length, "ar")})`, `Saved (${saved.length})`)}</> },
            { value: "alerts", label: <><BellRing className="size-4" /> {t("تنبيهات السعر", "Price alerts")}</> },
          ]}
        />
      </div>

      {tab === "saved" ? (
        <div className="mt-4 space-y-6 px-4">
          <AnimatePresence mode="popLayout">
            {saved.map((p) => (
              <motion.div key={p.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                <PropertyCard p={p} wide />
              </motion.div>
            ))}
          </AnimatePresence>
          {saved.length === 0 && (
            <Empty
              icon={<Heart className="size-7" />}
              title={t("لسه محفظتش حاجة", "Nothing saved yet")}
              body={t("دوس على القلب في أي وحدة عشان ترجعلها بسهولة وتتابع سعرها.", "Tap the heart on any home to come back to it and follow its price.")}
              action={<Button href="/explore">{t("استكشف", "Explore")}</Button>}
            />
          )}
        </div>
      ) : (
        <div className="mt-4 px-4">
          <div className="mb-4 flex items-start gap-3 rounded-3xl bg-navy p-4 text-cream ring-1 ring-white/10">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gold/20 text-gold">
              <TrendingDown className="size-5" />
            </span>
            <p className="text-[13px] leading-relaxed text-cream/80">
              {t("فعّل التنبيه على أي وحدة، وأول ما السعر ينزل هيوصلك إشعار فوراً.", "Turn on an alert for any home, and the moment its price drops you get a notification.")}
            </p>
          </div>
          <div className="space-y-2.5">
            {followed.map((p) => (
              <PropertyRow
                key={p.id}
                p={p}
                sub={
                  dropPct(p) > 0 && (
                    <span className="tabular mt-0.5 flex items-center gap-1.5 text-[11.5px]">
                      <span className="text-ink-3 line-through">{fmtMoney(p.oldPrice!, lang)}</span>
                      <span className="font-semibold text-[#e0574b]">{fmtPct(-dropPct(p), lang)}</span>
                    </span>
                  )
                }
                right={
                  <span onClick={(e) => e.preventDefault()} className="me-1">
                    <Toggle on={alerts.includes(p.id)} onChange={() => followPrice(p)} label={t("تنبيه السعر", "Price alert")} />
                  </span>
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
