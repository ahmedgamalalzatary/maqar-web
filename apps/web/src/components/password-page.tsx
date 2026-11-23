"use client";

import { passwordOk } from "@mqr/shared";
import { type FormEvent, useState } from "react";
import { ApiError } from "@/lib/api";
import { api } from "@/lib/client";
import { useT } from "@/lib/i18n";
import { useNotice } from "./shell";
import { Button, Card, Field, useErrorText } from "./ui";

/**
 * `/password/` (phase 31, 2026-11-15): the admin sets a new password. This tab stays signed in with
 * the new session; every other device and tab is signed out.
 */
export function PasswordPage() {
  const t = useT();
  const notice = useNotice();
  const errorText = useErrorText();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const weak = (tried || next !== "") && !passwordOk(next);
  const mismatch = (tried || again !== "") && again !== next;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!current || !passwordOk(next) || again !== next) return;
    setBusy(true);
    setError(undefined);
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setAgain("");
      setTried(false);
      notice({ text: t("كلمة السر اتغيرت، وخرجنا من الأجهزة التانية", "Password changed; other devices were signed out"), tone: "ok" });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : -1;
      setError(
        status === 403
          ? t("كلمة السر الحالية غلط", "The current password is wrong")
          : status === 400
            ? t("كلمة السر الجديدة لازم تكون مختلفة عن الحالية", "The new password must be different from the current one")
            : errorText(err),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <h1 className="text-2xl font-semibold">{t("غيّر كلمة السر", "Change password")}</h1>
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label={t("كلمة السر الحالية", "Current password")} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={tried && !current ? t("اكتب كلمة السر الحالية", "Type the current password") : undefined} dir="ltr" />
          <Field label={t("كلمة السر الجديدة", "New password")} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={weak ? t("٨ حروف على الأقل، فيها حرف ورقم", "At least 8 characters, with a letter and a digit") : undefined} dir="ltr" />
          <Field label={t("اكتب كلمة السر الجديدة تاني", "Type the new password again")} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} error={mismatch ? t("الكلمتين مش زي بعض", "The two don’t match") : undefined} dir="ltr" />
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={busy}>
            {t("غيّر كلمة السر", "Change password")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
