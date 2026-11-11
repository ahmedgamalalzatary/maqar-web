"use client";

import { PROPERTY_STATUS_LABEL, type PropertyStatus } from "@maqar/shared";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { useT } from "@/lib/i18n";

const VARIANT = {
  primary: "bg-navy text-cream hover:bg-navy/90 dark:bg-accent dark:text-navy",
  gold: "bg-accent text-navy hover:bg-accent/90",
  secondary: "border border-line-2 bg-surface text-ink hover:bg-surface-2",
  danger: "border border-danger/40 bg-danger-soft text-danger hover:bg-danger/15",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
} as const;

export function Button({
  variant = "primary",
  loading,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANT; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${className}`}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

type FieldProps = { label: string; error?: string; hint?: string };

export function Field({ label, error, hint, className = "", ...input }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      <input
        id={id}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
        className={`h-11 rounded-xl border bg-surface px-3 text-[15px] text-ink outline-none placeholder:text-ink-3 focus:border-accent ${error ? "border-danger" : "border-line-2"}`}
      />
      {error || hint ? (
        <p id={`${id}-note`} className={`text-xs ${error ? "text-danger" : "text-ink-3"}`}>
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextArea({ label, className = "", ...input }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      <textarea id={id} rows={4} {...input} className="rounded-xl border border-line-2 bg-surface p-3 text-[15px] text-ink outline-none focus:border-accent" />
    </div>
  );
}

/** One of a set (role radio) or an on/off choice (role checkbox). */
export function Chip({ selected, onClick, role = "radio", children }: { selected: boolean; onClick: () => void; role?: "radio" | "checkbox"; children: ReactNode }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={`min-h-10 rounded-full border px-4 text-sm font-medium transition ${selected ? "border-ink bg-ink text-bg" : "border-line-2 bg-surface text-ink hover:bg-surface-2"}`}
    >
      {children}
    </button>
  );
}

export function ChipGroup({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-ink-2">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </fieldset>
  );
}

const TONE: Record<PropertyStatus, string> = {
  approved: "bg-success-soft text-success",
  unpublished: "bg-accent-soft text-accent-ink",
  sold: "bg-sage-soft text-sage-ink",
  rented: "bg-sage-soft text-sage-ink",
  draft: "bg-surface-2 text-ink-2",
};

export function StatusBadge({ status }: { status: PropertyStatus }) {
  const t = useT();
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[status]}`}>{t(PROPERTY_STATUS_LABEL[status])}</span>;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-2xl border border-line bg-surface p-5 shadow-card ${className}`}>{children}</section>;
}

/**
 * What a failed request means, in the admin's language: the server's own reason when it has one,
 * else a fair guess from the status — never a blame on valid input for a server failure.
 */
export function useErrorText() {
  const t = useT();
  return (e: unknown) => {
    const status = e && typeof e === "object" && "status" in e ? Number((e as { status: unknown }).status) : NaN;
    const message = e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string" ? (e as { message: string }).message : "";
    if (status === 0) return t("مفيش اتصال بالسيرفر، حاول تاني", "Can’t reach the server, try again");
    if (message && status !== 401 && status !== 403) return message;
    if (status === 401 || status === 403) return t("الجلسة خلصت أو ماعندكش صلاحية", "Your session ended or you don’t have permission");
    if (status === 404) return t("مش موجود أو اتحذف", "It’s gone or was deleted");
    if (status === 409) return t("في تعارض مع تغيير حصل للتو، حدّث الصفحة", "It conflicts with a change made just now — refresh the page");
    if (status === 429) return t("محاولات كتير، استنى شوية وجرب تاني", "Too many attempts, wait a moment and try again");
    return t("حصلت مشكلة، حاول تاني", "Something went wrong, try again");
  };
}
