"use client";

import { type AdminClientDetail, CLIENT_STATUSES, type ClientStatus, fmtDate, fmtNum, LEAD_STAGE_LABEL, relTime } from "@maqar/shared";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { readId } from "@/lib/admin";
import { useLang, useT } from "@/lib/i18n";
import { passwordOk, useClient, useClients, useDeleteClient, useUpdateClient } from "@/lib/people";
import { useNotice } from "./shell";
import { Button, Card, Chip, Field, useErrorText } from "./ui";

type Filter = ClientStatus | "all";
const STATUS_LABEL = { active: { ar: "شغال", en: "Active" }, suspended: { ar: "موقوف", en: "Suspended" } } as const;
const VIEWING_STATUS = {
  confirmed: { ar: "مؤكدة", en: "Confirmed" },
  rescheduled: { ar: "اتغير ميعادها", en: "Rescheduled" },
  cancelled: { ar: "اتلغت", en: "Cancelled" },
  completed: { ar: "خلصت", en: "Completed" },
  pending: { ar: "مستنية التأكيد", en: "Awaiting confirmation" },
} as const;

/** `/clients/` (phase 22): every client account, newest first, with search and status. */
export function ClientsPage() {
  const t = useT();
  const lang = useLang();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const words = useDeferredValue(q);
  const clients = useClients({ status: filter === "all" ? undefined : filter, q: words, page });
  const counts = clients.data?.counts;
  const count = (s: Filter) => (counts ? (s === "all" ? counts.active + counts.suspended : counts[s]) : 0);
  const pages = clients.data ? Math.max(1, Math.ceil(clients.data.total / clients.data.limit)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{t("حسابات العملاء", "Client accounts")}</h1>
        <p className="text-sm text-ink-2">{t("كل حسابات العملاء، الأحدث الأول.", "Every client account, newest first.")}</p>
      </div>
      <label className="flex h-11 items-center gap-2 rounded-xl border border-line-2 bg-surface px-3">
        <Search className="size-4 text-ink-3" aria-hidden />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder={t("ابحث بالاسم أو الإيميل أو الموبايل", "Search by name, email or phone")}
          aria-label={t("ابحث بالاسم أو الإيميل أو الموبايل", "Search by name, email or phone")}
          className="flex-1 bg-transparent outline-none"
        />
      </label>
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {(["all", ...CLIENT_STATUSES] as Filter[]).map((s) => (
          <Chip
            key={s}
            selected={filter === s}
            onClick={() => {
              setFilter(s);
              setPage(1);
            }}
          >
            {`${s === "all" ? t("الكل", "All") : t(STATUS_LABEL[s])} | ${fmtNum(count(s), lang)}`}
          </Chip>
        ))}
      </div>
      {clients.isPending ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
      ) : clients.isError ? (
        <Card>{t("مقدرناش نجيب العملاء", "We couldn’t load the clients")}</Card>
      ) : !clients.data.items.length ? (
        <Card>{t("مفيش عملاء هنا", "No clients here")}</Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-2 text-ink-2">
              <tr>
                <th className="p-3 text-start font-medium">{t("العميل", "Client")}</th>
                <th className="p-3 text-start font-medium">{t("النشاط", "Activity")}</th>
                <th className="p-3 text-start font-medium">{t("آخر ظهور", "Last seen")}</th>
                <th className="p-3 text-start font-medium">{t("من", "Since")}</th>
              </tr>
            </thead>
            <tbody>
              {clients.data.items.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-surface-2/60">
                  <td className="p-3">
                    <Link href={`/client/?id=${c.id}`} className="font-medium text-accent-ink hover:underline">
                      {c.name}
                    </Link>
                    {c.suspendedAt ? <span className="ms-2 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">{t(STATUS_LABEL.suspended)}</span> : null}
                    <span className="block text-xs text-ink-2" dir="ltr">
                      {[c.email, c.phone].filter(Boolean).join(" | ")}
                    </span>
                  </td>
                  <td className="p-3 text-ink-2">
                    {t(`${fmtNum(c.saved, "ar")} محفوظ | ${fmtNum(c.viewings, "ar")} معاينة | ${fmtNum(c.chats, "ar")} شات`, `${c.saved} saved | ${c.viewings} viewings | ${c.chats} chats`)}
                  </td>
                  <td className="p-3 text-ink-2">{c.lastSeenAt ? relTime(new Date(c.lastSeenAt), lang) : "—"}</td>
                  <td className="p-3 text-ink-2">{fmtDate(c.createdAt.slice(0, 10), lang)}</td>
                </tr>
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

/** `/client/?id=21` (phase 22): one client's account, what they did, and the admin's actions. */
export function ClientPage() {
  const t = useT();
  const id = readId(useSearchParams().get("id"));
  const client = useClient(id);
  if (id === undefined) return <Card>{t("الرابط مش صحيح: مفيش رقم عميل.", "That link is not right: no client number.")}</Card>;
  if (client.isError) return <Card>{t("العميل ده مش موجود أو مقدرناش نجيبه.", "This client does not exist, or we couldn’t load it.")}</Card>;
  if (!client.data) return <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />;
  return <ClientBody c={client.data} />;
}

function ClientBody({ c }: { c: AdminClientDetail }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const notice = useNotice();
  const errorText = useErrorText();
  const update = useUpdateClient(c.id);
  const remove = useDeleteClient(c.id);
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const title = (h: { titleAr: string; titleEn: string }) => (lang === "ar" ? h.titleAr : h.titleEn);
  const agentName = (a: { nameAr: string; nameEn: string }) => (lang === "ar" ? a.nameAr : a.nameEn);

  const suspend = () => {
    if (!window.confirm(t("توقف الحساب؟ العميل هيتعمله خروج ومعايناته الجاية هتتلغي.", "Suspend the account? The client is signed out and their upcoming viewings are cancelled."))) return;
    update.mutate(
      { suspended: true },
      {
        onSuccess: (r) =>
          notice({
            text: r.cancelledViewings ? t(`الحساب اتوقف، واتلغت ${fmtNum(r.cancelledViewings, "ar")} معاينة`, `Account suspended; ${r.cancelledViewings} upcoming viewings cancelled`) : t("الحساب اتوقف", "Account suspended"),
            tone: "ok",
          }),
        onError: (e) => notice({ text: errorText(e), tone: "bad" }),
      },
    );
  };
  const del = () => {
    if (!window.confirm(t("تمسح الحساب؟ زي ما العميل يمسحه بنفسه، ومينفعش ترجعه.", "Delete the account? As if the client deleted it, and it cannot be undone."))) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        notice({ text: t("الحساب اتمسح", "Account deleted"), tone: "ok" });
        router.push("/clients/");
      },
      onError: (e) => notice({ text: errorText(e), tone: "bad" }),
    });
  };
  const savePassword = () => {
    setTried(true);
    if (!passwordOk(password)) return;
    update.mutate(
      { password },
      {
        onSuccess: () => {
          setPassword("");
          setTried(false);
          notice({ text: t("كلمة السر اتغيرت. ابعتها للعميل؛ اتعمله خروج من كل الأجهزة.", "Password changed. Pass it on; they were signed out everywhere."), tone: "ok" });
        },
        onError: (e) => notice({ text: errorText(e), tone: "bad" }),
      },
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <Card className="flex flex-col gap-3 self-start">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-xl font-semibold">{c.name}</h1>
          {c.suspendedAt ? <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">{t(STATUS_LABEL.suspended)}</span> : null}
        </div>
        <p className="text-sm" dir="ltr">
          {c.email}
        </p>
        {c.phone ? (
          <a href={`tel:${c.phone}`} className="w-fit text-sm text-accent-ink hover:underline" dir="ltr">
            {c.phone}
          </a>
        ) : null}
        <p className="text-xs text-ink-3">
          {t(`من ${fmtDate(c.createdAt.slice(0, 10), "ar")} | ${fmtNum(c.saved, "ar")} بيت محفوظ`, `Since ${fmtDate(c.createdAt.slice(0, 10), "en")} | ${c.saved} saved homes`)}
          {c.lastSeenAt ? ` | ${t("آخر ظهور", "last seen")} ${relTime(new Date(c.lastSeenAt), lang)}` : ""}
        </p>
        {c.suspendedAt ? (
          <Button loading={update.isPending} onClick={() => update.mutate({ suspended: false }, { onSuccess: () => notice({ text: t("الحساب رجع يشتغل", "Account restored"), tone: "ok" }) })}>
            {t("رجّع الحساب", "Restore the account")}
          </Button>
        ) : (
          <Button variant="secondary" loading={update.isPending} onClick={suspend}>
            {t("وقّف الحساب", "Suspend the account")}
          </Button>
        )}
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <Field
            label={t("كلمة سر جديدة", "A new password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            autoComplete="new-password"
            error={tried && !passwordOk(password) ? t("٨ حروف على الأقل، فيها حرف ورقم", "At least 8 characters, with a letter and a digit") : undefined}
          />
          <Button variant="secondary" loading={update.isPending} onClick={savePassword}>
            {t("احفظ كلمة السر", "Save the password")}
          </Button>
        </div>
        <Button variant="ghost" className="text-danger" loading={remove.isPending} onClick={del}>
          {t("امسح الحساب", "Delete the account")}
        </Button>
      </Card>
      <div className="flex flex-col gap-5">
        <Section title={t("المعاينات", "Viewings")} empty={t("مفيش معاينات.", "No viewings.")}>
          {c.recentViewings.map((v) => (
            <li key={v.id} className="py-2">
              <span className="block">{title(v.property)}</span>
              <span className="text-xs text-ink-2">{`${fmtDate(v.startsAt.slice(0, 10), lang, "weekday")} | ${agentName(v.agent)} | ${t(VIEWING_STATUS[v.status])}`}</span>
            </li>
          ))}
        </Section>
        <Section title={t("الشاتات", "Chats")} empty={t("مفيش شاتات.", "No chats.")}>
          {c.threads.map((th) => (
            <li key={th.id} className="py-2">
              <span className="block">{title(th.property)}</span>
              <span className="text-xs text-ink-2">{t(`${agentName(th.agent)} | ${fmtNum(th.messages, "ar")} رسالة`, `${agentName(th.agent)} | ${th.messages} messages`)}</span>
            </li>
          ))}
        </Section>
        <Section title={t("مع المسؤولين", "With advisors")} empty={t("مفيش.", "None.")}>
          {c.leadsList.map((l) => (
            <li key={l.id} className="py-2">
              <span className="block">{agentName(l.agent)}</span>
              <span className="text-xs text-ink-2">{`${t(LEAD_STAGE_LABEL[l.stage])}${l.property ? ` | ${title(l.property)}` : ""}`}</span>
            </li>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <Card className="flex flex-col gap-1">
      <h2 className="font-semibold">{title}</h2>
      {children.length ? <ul className="divide-y divide-line text-sm">{children}</ul> : <p className="text-sm text-ink-3">{empty}</p>}
    </Card>
  );
}
