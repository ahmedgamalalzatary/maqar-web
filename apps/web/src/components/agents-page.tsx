"use client";

import { type AdminAgentDetail, fmtDate, fmtNum, weekdayName } from "@maqar/shared";
import { ArrowLeft, ArrowRight, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { useAgent, useAllAgents, useRemoveDayOff, useSaveAgent, readId } from "@/lib/admin";
import { useLang, useT } from "@/lib/i18n";
import { useNotice } from "./shell";
import { Button, Card, useErrorText } from "./ui";
import { DaysOffForm, DEFAULT_WEEK, HoursEditor, WEEK_ORDER } from "./week-editor";

const linkButton = "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium";

/** `/agents/` (phase 18): every agent; pick several to set their hours or days off at once. */
export function AgentsPage() {
  const t = useT();
  const lang = useLang();
  const agents = useAllAgents();
  const [picked, setPicked] = useState<number[]>([]);
  const [panel, setPanel] = useState<"hours" | "off" | null>(null);
  const list = agents.data ?? [];
  const toggle = (id: number) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const done = () => {
    setPanel(null);
    setPicked([]);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{t("المسؤولين", "Agents")}</h1>
          {agents.data ? <p className="text-sm text-ink-2">{t(`${fmtNum(list.filter((a) => a.active).length, "ar")} شغالين`, `${list.filter((a) => a.active).length} active`)}</p> : null}
        </div>
        <Link href="/agent/new/" className={`${linkButton} bg-accent text-navy hover:bg-accent/90`}>
          <Plus className="size-4" aria-hidden />
          {t("أضف مسؤول", "Add an agent")}
        </Link>
      </div>

      {picked.length ? (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm font-medium">{t(`${fmtNum(picked.length, "ar")} مختارين`, `${picked.length} picked`)}</p>
            <Button variant={panel === "hours" ? "primary" : "secondary"} onClick={() => setPanel(panel === "hours" ? null : "hours")}>
              {t("المواعيد", "Hours")}
            </Button>
            <Button variant={panel === "off" ? "primary" : "secondary"} onClick={() => setPanel(panel === "off" ? null : "off")}>
              {t("إجازة", "Day off")}
            </Button>
            <Button variant="ghost" onClick={() => setPicked([])}>
              {t("إلغاء", "Clear")}
            </Button>
          </div>
          {panel === "hours" ? <HoursEditor agentIds={picked} start={DEFAULT_WEEK} onDone={done} /> : null}
          {panel === "off" ? <DaysOffForm agentIds={picked} onDone={done} /> : null}
        </Card>
      ) : (
        <p className="text-sm text-ink-3">{t("علّم على كذا مسؤول علشان تغيّر مواعيدهم أو تديهم إجازة مرة واحدة.", "Tick several agents to change their hours or give them days off at once.")}</p>
      )}

      {agents.isPending ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
      ) : agents.isError ? (
        <Card>{t("مقدرناش نجيب المسؤولين", "We couldn’t load the agents")}</Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-ink-2">
              <tr>
                <th className="w-10 p-3">
                  <span className="sr-only">{t("اختار", "Pick")}</span>
                </th>
                <th className="p-3 text-start font-medium">{t("المسؤول", "Agent")}</th>
                <th className="hidden p-3 text-start font-medium md:table-cell">{t("التواصل", "Contact")}</th>
                <th className="p-3 text-start font-medium">{t("منشور", "Live")}</th>
                <th className="hidden p-3 text-start font-medium sm:table-cell">{t("عملاء مفتوحين", "Open leads")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const name = lang === "ar" ? a.nameAr : a.nameEn;
                return (
                  <tr key={a.id} className={`border-t border-line ${a.active ? "" : "opacity-60"}`}>
                    <td className="p-3">
                      <input type="checkbox" aria-label={name} checked={picked.includes(a.id)} onChange={() => toggle(a.id)} className="size-4 accent-[var(--accent)]" />
                    </td>
                    <td className="p-3">
                      <Link href={`/agent/?id=${a.id}`} className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: a.colour }}>
                          {name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
                        </span>
                        <span>
                          <span className="block font-medium hover:underline">{name}</span>
                          <span className="block text-xs text-ink-2">{a.active ? (lang === "ar" ? a.roleTitleAr : a.roleTitleEn) : t("موقوف", "Turned off")}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden p-3 text-ink-2 md:table-cell" dir="ltr">
                      {a.email}
                      <br />
                      {a.phone}
                    </td>
                    <td className="p-3 tabular">{fmtNum(a.live, lang)}</td>
                    <td className="hidden p-3 tabular sm:table-cell">{fmtNum(a.openLeads, lang)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** `/agent/?id=3`: the profile, whether they are on, the week and the days off. */
export function AgentPage() {
  const t = useT();
  const lang = useLang();
  const id = readId(useSearchParams().get("id"));
  const agent = useAgent(id);
  const Back = lang === "ar" ? ArrowRight : ArrowLeft;
  return (
    <div className="flex flex-col gap-5">
      <Link href="/agents/" className="inline-flex w-fit items-center gap-2 text-sm text-ink-2 hover:text-ink">
        <Back className="size-4" aria-hidden />
        {t("كل المسؤولين", "All agents")}
      </Link>
      {id === undefined ? (
        <Card>{t("الرابط مش صحيح: مفيش رقم مسؤول.", "That link is not right: no agent number.")}</Card>
      ) : agent.isPending ? (
        <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
      ) : agent.isError ? (
        <Card>{agent.error instanceof ApiError && agent.error.status === 404 ? t("المسؤول ده مش موجود.", "This agent does not exist.") : t("مقدرناش نجيب المسؤول", "We couldn’t load the agent")}</Card>
      ) : (
        <AgentBody a={agent.data} />
      )}
    </div>
  );
}

function AgentBody({ a }: { a: AdminAgentDetail }) {
  const t = useT();
  const lang = useLang();
  const notice = useNotice();
  const errorText = useErrorText();
  const save = useSaveAgent(a.id);
  const removeDay = useRemoveDayOff(a.id);
  const [editingHours, setEditingHours] = useState(false);
  const name = lang === "ar" ? a.nameAr : a.nameEn;
  const byDay = new Map(a.hours.map((h) => [h.weekday, h]));
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

  const setActive = (active: boolean) => {
    if (!active && !window.confirm(t("توقف المسؤول؟ هيتعمله خروج ومش هيقدر يدخل.", "Turn the agent off? They are signed out and cannot sign in."))) return;
    save.mutate(
      { active },
      {
        onSuccess: () => notice({ text: active ? t("المسؤول رجع يشتغل", "The agent is on again") : t("المسؤول اتوقف واتعمله خروج", "The agent is turned off and signed out"), tone: "ok" }),
        onError: (e) =>
          notice({ text: e instanceof ApiError && e.status === 409 ? t("انقل عقاراته المنشورة لمسؤول تاني الأول", "Move their live listings to someone else first") : errorText(e), tone: "bad" }),
      },
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <Card className="flex flex-col gap-3 self-start">
        <div className="flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-full text-lg font-semibold text-white" style={{ background: a.colour }}>
            {name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
          </span>
          <div>
            <h1 className="text-xl font-semibold">{name}</h1>
            <p className="text-sm text-ink-2">{lang === "ar" ? a.roleTitleAr : a.roleTitleEn}</p>
          </div>
        </div>
        <p className="text-sm" dir="ltr">
          {a.email}
        </p>
        <a href={`tel:${a.phone}`} className="inline-flex w-fit items-center gap-2 text-sm text-accent-ink hover:underline" dir="ltr">
          <Phone className="size-4" aria-hidden />
          {a.phone}
        </a>
        <p className="text-xs text-ink-3">
          {t(
            `${fmtNum(a.live, "ar")} عقار منشور | ${fmtNum(a.openLeads, "ar")} عميل مفتوح | الهدف ${fmtNum(a.monthlyTarget, "ar")} في الشهر`,
            `${a.live} live | ${a.openLeads} open leads | target ${a.monthlyTarget} a month`,
          )}
        </p>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm">
          <span>{t("شغال (يقدر يدخل ويتحطله عقارات)", "On (can sign in and get listings)")}</span>
          <input type="checkbox" role="switch" checked={a.active} disabled={save.isPending} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-[var(--accent)]" />
        </label>
        <Link href={`/agent/edit/?id=${a.id}`} className={`${linkButton} justify-center border border-line-2 bg-surface hover:bg-surface-2`}>
          <Pencil className="size-4" aria-hidden />
          {t("عدّل البيانات", "Edit details")}
        </Link>
      </Card>

      <div className="flex flex-col gap-5">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2 className="flex-1 text-lg font-semibold">{t("مواعيد الشغل", "Working hours")}</h2>
            <Button variant="ghost" onClick={() => setEditingHours(!editingHours)}>
              {editingHours ? t("إلغاء", "Cancel") : t("غيّر", "Change")}
            </Button>
          </div>
          {a.defaultHours ? <p className="text-xs text-ink-3">{t("المواعيد الافتراضية: كل يوم ١٠ لـ ٨، والجمعة من ٢.", "The default week: every day 10 to 8, Friday from 2.")}</p> : null}
          {editingHours ? (
            <HoursEditor agentIds={[a.id]} start={a.hours} onDone={() => setEditingHours(false)} />
          ) : (
            <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
              {WEEK_ORDER.map((d) => {
                const h = byDay.get(d);
                return (
                  <div key={d} className="contents">
                    <dt className="text-ink-2">{weekdayName(d, lang)}</dt>
                    <dd className={`tabular ${h ? "" : "text-ink-3"}`}>{h ? `${hh(h.from)} – ${hh(h.to)}` : t("إجازة", "Day off")}</dd>
                  </div>
                );
              })}
            </dl>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("الإجازات الجاية", "Coming days off")}</h2>
          {a.daysOff.length ? (
            <ul className="divide-y divide-line">
              {a.daysOff.map((d) => (
                <li key={d.date} className="flex items-center gap-3 py-2">
                  <span className="flex-1 text-sm">
                    {fmtDate(d.date, lang, "weekday")}
                    {d.reason ? <span className="text-ink-3"> | {d.reason}</span> : null}
                  </span>
                  <button
                    type="button"
                    aria-label={t(`شيل إجازة ${fmtDate(d.date, "ar", "weekday")}`, `Remove the day off on ${fmtDate(d.date, "en", "weekday")}`)}
                    onClick={() => removeDay.mutate(d.date, { onError: (e) => notice({ text: errorText(e), tone: "bad" }) })}
                    className="grid size-9 place-items-center rounded-lg text-danger hover:bg-danger-soft"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">{t("مفيش إجازات جاية.", "No days off coming up.")}</p>
          )}
          <DaysOffForm agentIds={[a.id]} />
        </Card>
      </div>
    </div>
  );
}
