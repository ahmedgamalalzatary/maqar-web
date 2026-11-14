"use client";

import { type AdminAgentDetail, type AgentBody, PROPERTY_STATUS_LABEL, readPhone, readWholeNumber } from "@maqar/shared";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAgent, useAgentListingOptions, useAllAgents, useSaveAgent, readId } from "@/lib/admin";
import { useLang, useT } from "@/lib/i18n";
import { useNotice } from "./shell";
import { Button, Card, Field } from "./ui";
import Link from "next/link";

const COLOURS = ["#b38959", "#61766d", "#3d5a80", "#8c5e58", "#6b5b95", "#2f6f6a"];
type Key = "nameAr" | "nameEn" | "email" | "password" | "phone" | "roleTitleAr" | "roleTitleEn" | "languagesAr" | "languagesEn" | "monthlyTarget";

/** `/agent/edit/?id=3`. */
export function EditAgent() {
  const t = useT();
  const id = readId(useSearchParams().get("id"));
  const agent = useAgent(id);
  if (id === undefined)
    return (
      <Card>
        {t("الرابط مش صحيح: مفيش رقم مسؤول.", "That link is not right: no agent number.")}{" "}
        <Link href="/agents/" className="text-accent-ink hover:underline">
          {t("كل المسؤولين", "All agents")}
        </Link>
      </Card>
    );
  if (agent.isError) return <Card>{t("مقدرناش نجيب المسؤول", "We couldn’t load the agent")}</Card>;
  if (!agent.data) return <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />;
  return <AgentForm key={id} saved={agent.data} />;
}

/** `/agent/new/` and editing: the agent's account and profile. A new agent gets a starting password. */
export function AgentForm({ saved }: { saved?: AdminAgentDetail }) {
  const t = useT();
  const router = useRouter();
  const notice = useNotice();
  const save = useSaveAgent(saved?.id);
  const [d, setD] = useState<Record<Key, string> & { colour: string }>({
    nameAr: saved?.nameAr ?? "",
    nameEn: saved?.nameEn ?? "",
    email: saved?.email ?? "",
    password: "",
    phone: saved?.phone ?? "",
    roleTitleAr: saved?.roleTitleAr ?? "مستشار مبيعات",
    roleTitleEn: saved?.roleTitleEn ?? "Sales advisor",
    languagesAr: saved?.languagesAr ?? "العربية، الإنجليزية",
    languagesEn: saved?.languagesEn ?? "Arabic, English",
    monthlyTarget: String(saved?.monthlyTarget ?? 6),
    colour: saved?.colour ?? COLOURS[0]!,
  });
  const [showErrors, setShowErrors] = useState(false);
  // Listings to give this agent on save (phase 29); the ones they already have stay ticked.
  const [picked, setPicked] = useState<number[]>([]);
  const set = (k: Key, v: string) => setD((cur) => ({ ...cur, [k]: v }));

  const problems: Key[] = [];
  // The same bounds the API's DTO enforces, so local validation never passes what the server refuses.
  for (const k of ["nameAr", "nameEn", "roleTitleAr", "roleTitleEn", "languagesAr", "languagesEn"] as const) {
    if (d[k].trim().length < 2 || d[k].trim().length > 100) problems.push(k);
  }
  if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) problems.push("email");
  if ((!saved || d.password) && (d.password.length < 8 || !/[A-Za-z]/.test(d.password) || !/\d/.test(d.password))) problems.push("password");
  if (!readPhone(d.phone)) problems.push("phone");
  const target = readWholeNumber(d.monthlyTarget);
  if (target === undefined || target > 1000) problems.push("monthlyTarget");
  const err = (k: Key, msg: string) => (showErrors && problems.includes(k) ? msg : undefined);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (problems.length) return setShowErrors(true);
    const body: Partial<AgentBody> = {
      nameAr: d.nameAr.trim(),
      nameEn: d.nameEn.trim(),
      email: d.email.trim().toLowerCase(),
      phone: readPhone(d.phone)!,
      roleTitleAr: d.roleTitleAr.trim(),
      roleTitleEn: d.roleTitleEn.trim(),
      languagesAr: d.languagesAr.trim(),
      languagesEn: d.languagesEn.trim(),
      monthlyTarget: readWholeNumber(d.monthlyTarget)!,
      colour: d.colour,
      ...(d.password ? { password: d.password } : {}),
      ...(picked.length ? { listingIds: picked } : {}),
    };
    save.mutate(body, {
      onSuccess: (a) => {
        notice({ text: saved ? t("البيانات اتحفظت", "Saved") : t("المسؤول اتضاف، ابعتله الإيميل وكلمة السر", "Agent added: send them the email and password"), tone: "ok" });
        router.push(`/agent/?id=${a.id}`);
      },
      onError: (e) =>
        notice({ text: e instanceof ApiError && e.status === 409 ? t("الإيميل ده عليه حساب", "That email already has an account") : t("مقدرناش نحفظ، راجع البيانات", "We couldn’t save; check the details"), tone: "bad" }),
    });
  };

  const field = (k: Key, label: string, msg: string, extra: Record<string, unknown> = {}) => (
    <Field label={label} value={d[k]} onChange={(e) => set(k, e.target.value)} error={err(k, msg)} {...extra} />
  );
  return (
    <form onSubmit={submit} className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="text-2xl font-semibold">{saved ? t("عدّل المسؤول", "Edit agent") : t("مسؤول جديد", "New agent")}</h1>
      <Card className="grid gap-4 sm:grid-cols-2">
        {field("nameAr", t("الاسم (عربي)", "Name (Arabic)"), t("اكتب الاسم", "Enter the name"), { dir: "rtl" })}
        {field("nameEn", t("الاسم (إنجليزي)", "Name (English)"), t("اكتب الاسم", "Enter the name"), { dir: "ltr" })}
        {field("email", t("الإيميل (للدخول)", "Email (to sign in)"), t("إيميل مش صح", "Not an email"), { type: "email", dir: "ltr", autoComplete: "off" })}
        {field(
          "password",
          saved ? t("كلمة سر جديدة (اختياري)", "New password (optional)") : t("كلمة سر البداية", "Starting password"),
          t("٨ حروف على الأقل، فيها حرف ورقم", "At least 8 characters, with a letter and a digit"),
          { dir: "ltr", autoComplete: "new-password", hint: saved ? t("كلمة السر الجديدة بتعمل خروج للمسؤول من كل الأجهزة.", "A new password signs the agent out everywhere.") : undefined },
        )}
        {field("phone", t("الموبايل", "Phone"), t("رقم موبايل بالأرقام", "A phone number in digits"), { type: "tel", dir: "ltr" })}
        {field("monthlyTarget", t("الهدف في الشهر (صفقات)", "Monthly target (deals)"), t("رقم", "A number"), { inputMode: "numeric", dir: "ltr" })}
        {field("roleTitleAr", t("المسمى (عربي)", "Title (Arabic)"), t("اكتب المسمى", "Enter the title"), { dir: "rtl" })}
        {field("roleTitleEn", t("المسمى (إنجليزي)", "Title (English)"), t("اكتب المسمى", "Enter the title"), { dir: "ltr" })}
        {field("languagesAr", t("اللغات (عربي)", "Languages (Arabic)"), t("اكتب اللغات", "Enter the languages"), { dir: "rtl" })}
        {field("languagesEn", t("اللغات (إنجليزي)", "Languages (English)"), t("اكتب اللغات", "Enter the languages"), { dir: "ltr" })}
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium text-ink-2">{t("اللون", "Colour")}</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {COLOURS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={d.colour === c}
                aria-label={c}
                onClick={() => setD((cur) => ({ ...cur, colour: c }))}
                className={`size-10 rounded-full border-4 ${d.colour === c ? "border-ink" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
      </Card>
      <ListingsPicker agentId={saved?.id} off={saved ? !saved.active : false} picked={picked} onChange={setPicked} />
      <div className="flex justify-between gap-3">
        <Button variant="secondary" onClick={() => router.back()}>
          {t("إلغاء", "Cancel")}
        </Button>
        <Button type="submit" variant="gold" loading={save.isPending}>
          {saved ? t("احفظ", "Save") : t("أضف المسؤول", "Add the agent")}
        </Button>
      </div>
    </form>
  );
}

/**
 * The listings this agent is the advisor of (phase 29): tick more to give them on save. A listing
 * always has an advisor, so one is taken away by giving it to someone else.
 */
function ListingsPicker({ agentId, off, picked, onChange }: { agentId?: number; off: boolean; picked: number[]; onChange: (ids: number[]) => void }) {
  const t = useT();
  const lang = useLang();
  const options = useAgentListingOptions();
  const agents = useAllAgents();
  const [q, setQ] = useState("");
  const nameOf = (id: number | null) => {
    const a = agents.data?.find((x) => x.id === id);
    return a ? (lang === "ar" ? a.nameAr : a.nameEn) : t("من غير مسؤول", "No advisor");
  };
  const words = q.trim().toLowerCase();
  const all = options.data ?? [];
  const shown = words ? all.filter((o) => `${o.titleAr} ${o.titleEn}`.toLowerCase().includes(words)) : all;
  const mine = all.filter((o) => agentId !== undefined && o.agentId === agentId).length;
  const toggle = (id: number) => onChange(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">
          {t("العقارات اللي معاه", "Their listings")} <span className="text-sm font-normal text-ink-3">({mine + picked.length})</span>
        </h2>
        <p className="text-sm text-ink-2">
          {off
            ? t("المسؤول موقوف: شغّله الأول عشان تديله عقارات.", "This agent is turned off: turn them on before giving them listings.")
            : t("علّم على العقارات اللي عايز تديها له. عشان تشيل عقار منه، اديه لمسؤول تاني.", "Tick the listings to give them. To take one away, give it to another agent.")}
        </p>
      </div>
      <label className="flex h-11 items-center gap-2 rounded-xl border border-line-2 bg-surface px-3">
        <Search className="size-4 text-ink-3" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث باسم العقار", "Search by listing title")} aria-label={t("ابحث باسم العقار", "Search by listing title")} className="min-w-0 flex-1 bg-transparent outline-none" />
      </label>
      {options.isPending ? (
        <div className="h-32 animate-pulse rounded-xl bg-surface-2" />
      ) : options.isError ? (
        <p className="text-sm text-danger">{t("مقدرناش نجيب العقارات", "We couldn’t load the listings")}</p>
      ) : !shown.length ? (
        <p className="text-sm text-ink-3">{t("مفيش عقارات هنا", "No listings here")}</p>
      ) : (
        <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {shown.map((o) => {
            const theirs = agentId !== undefined && o.agentId === agentId;
            return (
              <li key={o.id}>
                <label className={`flex min-h-12 items-center gap-3 px-3 py-2 text-sm ${theirs || off ? "" : "cursor-pointer hover:bg-surface-2/60"}`}>
                  <input type="checkbox" className="size-4 shrink-0 accent-[var(--accent)]" checked={theirs || picked.includes(o.id)} disabled={theirs || off} onChange={() => toggle(o.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{lang === "ar" ? o.titleAr : o.titleEn}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {t(PROPERTY_STATUS_LABEL[o.status])} | {theirs ? t("معاه", "Theirs") : t(`مع ${nameOf(o.agentId)}`, `With ${nameOf(o.agentId)}`)}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
