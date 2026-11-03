"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Flame, Search } from "lucide-react";
import { PROPERTIES } from "@/lib/data";
import { fmtMoney, fmtNum, relTime, useLang, useT } from "@/lib/i18n";
import { STAGES, useLeads } from "@/lib/agent";
import type { LeadStage } from "@/lib/store";
import { Avatar, Chip, PageHeader } from "@/components/ui";

export default function LeadsPage() {
  return (
    <Suspense>
      <Leads />
    </Suspense>
  );
}

function Leads() {
  const t = useT();
  const lang = useLang();
  const sp = useSearchParams();
  const leads = useLeads();
  const [stage, setStage] = useState<LeadStage | "all">((sp.get("stage") as LeadStage) ?? "all");
  const [q, setQ] = useState("");
  const list = leads
    .filter((l) => stage === "all" || l.stage === stage)
    .filter((l) => !q || (l.name.ar + l.name.en).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.lastAt - a.lastAt);

  return (
    <div>
      <PageHeader back={false} title={t("عملائي", "My leads")} subtitle={t(`${fmtNum(leads.length, "ar")} عميل مخصصين ليك`, `${leads.length} clients assigned to you`)} />
      <div className="px-4">
        <label className="flex h-11 items-center gap-2 rounded-2xl bg-surface px-3.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-accent">
          <Search className="size-4 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث باسم العميل", "Search by client name")} className="flex-1 bg-transparent text-[14px] outline-none" />
        </label>
      </div>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
        <Chip active={stage === "all"} onClick={() => setStage("all")}>
          {t("الكل", "All")} · {fmtNum(leads.length, lang)}
        </Chip>
        {STAGES.map((s) => (
          <Chip key={s.k} active={stage === s.k} onClick={() => setStage(s.k)}>
            <span className="size-2 rounded-full" style={{ background: s.tone }} /> {t(s.label)} · {fmtNum(leads.filter((l) => l.stage === s.k).length, lang)}
          </Chip>
        ))}
      </div>
      <div className="mt-4 space-y-2 px-4">
        <AnimatePresence mode="popLayout">
          {list.map((l) => {
            const p = PROPERTIES.find((x) => x.id === l.propertyId)!;
            const st = STAGES.find((s) => s.k === l.stage)!;
            return (
              <motion.div key={l.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Link href={`/agent/lead/${l.id}`} className="flex items-center gap-3 rounded-3xl bg-surface p-3 ring-1 ring-line active:scale-[0.99]">
                  <Avatar name={l.name.en} tone={st.tone} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[14px] font-semibold">
                      <span className="truncate">{t(l.name)}</span> {l.hot && <Flame className="size-4 shrink-0 text-[#e0574b]" />}
                    </div>
                    <div className="truncate text-[12px] text-ink-2">{t(p.title)}</div>
                    <div className="tabular mt-0.5 text-[11.5px] text-ink-3">
                      {t("ميزانية", "Budget")} {fmtMoney(l.budget, lang)} · {relTime(l.lastAt, lang)}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium text-white" style={{ background: st.tone }}>
                    {t(st.label)}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
