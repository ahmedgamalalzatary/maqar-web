"use client";

import { LEAD_STAGE_COLOUR, LEAD_STAGE_LABEL, relTime } from "@maqar/shared";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { useAgents, useAssignLead, useLeads } from "@/lib/admin";
import { useLang, useT } from "@/lib/i18n";
import { useNotice } from "./shell";
import { Card, useErrorText } from "./ui";

/** `/leads/` (phase 18): every agent's leads; any lead can move to another active agent. */
export function LeadsPage() {
  const t = useT();
  const lang = useLang();
  const notice = useNotice();
  const errorText = useErrorText();
  const [agentId, setAgentId] = useState<number | undefined>();
  const leads = useLeads(agentId);
  const agents = useAgents();
  const assign = useAssignLead();
  const name = (a: { nameAr: string; nameEn: string }) => (lang === "ar" ? a.nameAr : a.nameEn);

  const move = (id: number, to: number) =>
    assign.mutate(
      { id, agentId: to },
      {
        onSuccess: (l) => notice({ text: t(`العميل اتنقل لـ ${l.agent.nameAr}، ووصله إشعار`, `Moved to ${l.agent.nameEn}, who got a notification`), tone: "ok" }),
        onError: (e) =>
          notice({ text: e instanceof ApiError && e.status === 409 ? t("العميل ده عنده ملف مع المسؤول ده بالفعل", "This client already has a lead with that agent") : errorText(e), tone: "bad" }),
      },
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{t("العملاء", "Leads")}</h1>
          <p className="text-sm text-ink-2">{t("الشات والمعاينات بيفضلوا مع مسؤول العقار لما تنقل عميل.", "Chats and viewings stay with the home’s advisor when a lead moves.")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-2">{t("المسؤول", "Agent")}</span>
          <select value={agentId ?? ""} onChange={(e) => setAgentId(e.target.value ? Number(e.target.value) : undefined)} className="h-10 rounded-xl border border-line-2 bg-surface px-3">
            <option value="">{t("الكل", "All")}</option>
            {(agents.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {name(a)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {leads.isPending ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
      ) : leads.isError ? (
        <Card>{t("مقدرناش نجيب العملاء", "We couldn’t load the leads")}</Card>
      ) : !leads.data.length ? (
        <Card>{t("مفيش عملاء هنا", "No leads here")}</Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-2 text-ink-2">
              <tr>
                <th className="p-3 text-start font-medium">{t("العميل", "Client")}</th>
                <th className="p-3 text-start font-medium">{t("المرحلة", "Stage")}</th>
                <th className="p-3 text-start font-medium">{t("العقار", "Home")}</th>
                <th className="p-3 text-start font-medium">{t("آخر نشاط", "Last activity")}</th>
                <th className="p-3 text-start font-medium">{t("المسؤول", "Agent")}</th>
              </tr>
            </thead>
            <tbody>
              {leads.data.map((l) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="p-3">
                    <span className="block font-medium">{l.name || t("عميل اتمسح حسابه", "Deleted account")}</span>
                    {l.phone ? (
                      <span className="block text-xs text-ink-2" dir="ltr">
                        {l.phone}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: LEAD_STAGE_COLOUR[l.stage], background: `${LEAD_STAGE_COLOUR[l.stage]}22` }}>
                      {t(LEAD_STAGE_LABEL[l.stage])}
                    </span>
                  </td>
                  <td className="p-3 text-ink-2">{l.property ? (lang === "ar" ? l.property.titleAr : l.property.titleEn) : "—"}</td>
                  <td className="p-3 text-ink-2">{relTime(new Date(l.lastActivityAt), lang)}</td>
                  <td className="p-3">
                    <select
                      aria-label={t(`مسؤول ${l.name}`, `${l.name}’s agent`)}
                      value={l.agent.id}
                      disabled={assign.isPending}
                      onChange={(e) => move(l.id, Number(e.target.value))}
                      className="h-9 rounded-lg border border-line-2 bg-surface px-2"
                    >
                      {!(agents.data ?? []).some((a) => a.id === l.agent.id) ? <option value={l.agent.id}>{name(l.agent)}</option> : null}
                      {(agents.data ?? []).map((a) => (
                        <option key={a.id} value={a.id}>
                          {name(a)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
