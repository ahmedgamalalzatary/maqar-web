"use client";

import { type AdminAccount, relTime } from "@maqar/shared";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { passwordOk, useAdmins, useSaveAdmin } from "@/lib/people";
import { useNotice } from "./shell";
import { Button, Card, Field, useErrorText } from "./ui";

/** `/admins/` (phase 22): admin accounts. Add one, set a new password, suspend or restore. */
export function AdminsPage() {
  const t = useT();
  const admins = useAdmins();
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("حسابات الإدارة", "Admin accounts")}</h1>
          <p className="text-sm text-ink-2">{t("مينفعش توقف حسابك انت، فدايمًا فيه أدمن شغال.", "You cannot suspend your own account, so one admin always stays active.")}</p>
        </div>
        {admins.isPending ? (
          <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
        ) : admins.isError ? (
          <Card>{t("مقدرناش نجيب الحسابات", "We couldn’t load the accounts")}</Card>
        ) : (
          admins.data.map((a) => <AdminCard key={a.id} a={a} />)
        )}
      </div>
      <NewAdmin />
    </div>
  );
}

function AdminCard({ a }: { a: AdminAccount }) {
  const t = useT();
  const lang = useLang();
  const notice = useNotice();
  const errorText = useErrorText();
  const save = useSaveAdmin(a.id);
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const done = (text: string) => ({ onSuccess: () => notice({ text, tone: "ok" as const }), onError: (e: unknown) => notice({ text: errorText(e), tone: "bad" as const }) });
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 font-semibold">{a.you ? t(`${a.name} (انت)`, `${a.name} (you)`) : a.name}</h2>
        {a.suspendedAt ? <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">{t("موقوف", "Suspended")}</span> : null}
      </div>
      <p className="text-sm text-ink-2" dir="ltr">
        {[a.email, a.phone].filter(Boolean).join(" | ")}
      </p>
      <p className="text-xs text-ink-3">{a.lastSeenAt ? `${t("آخر ظهور", "Last seen")} ${relTime(new Date(a.lastSeenAt), lang)}` : t("لسه مدخلش", "Not signed in yet")}</p>
      {a.you ? null : (
        <div className="flex flex-wrap items-end gap-2">
          <Field
            className="min-w-56 flex-1"
            label={t("كلمة سر جديدة", "A new password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            autoComplete="new-password"
            error={tried && !passwordOk(password) ? t("٨ حروف على الأقل، فيها حرف ورقم", "At least 8 characters, with a letter and a digit") : undefined}
          />
          <Button
            variant="secondary"
            loading={save.isPending}
            onClick={() => {
              setTried(true);
              if (!passwordOk(password)) return;
              save.mutate({ password }, { ...done(t("كلمة السر اتغيرت", "Password changed")), onSettled: () => setPassword("") });
            }}
          >
            {t("احفظ", "Save")}
          </Button>
          {a.suspendedAt ? (
            <Button loading={save.isPending} onClick={() => save.mutate({ suspended: false }, done(t("الحساب رجع يشتغل", "Account restored")))}>
              {t("رجّعه", "Restore")}
            </Button>
          ) : (
            <Button
              variant="secondary"
              loading={save.isPending}
              onClick={() => {
                if (window.confirm(t("توقف الحساب ده؟ هيتعمله خروج على طول.", "Suspend this account? They are signed out at once."))) save.mutate({ suspended: true }, done(t("الحساب اتوقف", "Account suspended")));
              }}
            >
              {t("وقّفه", "Suspend")}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function NewAdmin() {
  const t = useT();
  const notice = useNotice();
  const errorText = useErrorText();
  const save = useSaveAdmin();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const bad = { name: tried && name.trim().length < 2, email: tried && !/^\S+@\S+\.\S+$/.test(email.trim()), password: tried && !passwordOk(password) };
  return (
    <Card className="flex flex-col gap-3 self-start">
      <h2 className="font-semibold">{t("أدمن جديد", "A new admin")}</h2>
      <Field label={t("الاسم", "Name")} value={name} onChange={(e) => setName(e.target.value)} error={bad.name ? t("اكتب الاسم", "Enter the name") : undefined} />
      <Field label={t("الإيميل", "Email")} type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} error={bad.email ? t("إيميل صحيح", "A valid email") : undefined} />
      <Field
        label={t("كلمة السر", "Password")}
        dir="ltr"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={bad.password ? t("٨ حروف على الأقل، فيها حرف ورقم", "At least 8 characters, with a letter and a digit") : undefined}
      />
      <Button
        loading={save.isPending}
        onClick={() => {
          setTried(true);
          if (name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email.trim()) || !passwordOk(password)) return;
          save.mutate(
            { name: name.trim(), email: email.trim(), password },
            {
              onSuccess: () => {
                notice({ text: t("الأدمن اتضاف. ابعتله الإيميل وكلمة السر.", "Admin added. Pass on the email and password."), tone: "ok" });
                setName("");
                setEmail("");
                setPassword("");
                setTried(false);
              },
              onError: (e) => notice({ text: e instanceof ApiError && e.status === 409 ? t("الإيميل ده عليه حساب", "That email already has an account") : errorText(e), tone: "bad" }),
            },
          );
        }}
      >
        {t("أضف", "Add")}
      </Button>
    </Card>
  );
}
