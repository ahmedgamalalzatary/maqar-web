"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Building2, CalendarCheck, FileBarChart, KeyRound, Languages, LayoutDashboard, LogOut, MapPin, Menu as MenuIcon, MessagesSquare, Moon, Settings, ShieldUser, Sun, UserCog, Users, UsersRound, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { passwordOk, readResetCode, RESET_CODE_MINUTES } from "@mqr/shared";
import { createContext, type FormEvent, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { api, useSession } from "@/lib/client";
import { setLang, useLang, useT } from "@/lib/i18n";
import { setDark, useDark } from "@/lib/theme";
import { Button, Field } from "./ui";

type Notice = { text: string; tone: "ok" | "bad" };
const NoticeContext = createContext<(n: Notice) => void>(() => undefined);
/** Shows a short message at the bottom of the page. */
export const useNotice = () => useContext(NoticeContext);

export function Shell({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }));
  const [notice, setNotice] = useState<Notice | null>(null);
  const show = useCallback((n: Notice) => setNotice(n), []);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(id);
  }, [notice]);
  useDark();

  return (
    <QueryClientProvider client={client}>
      <NoticeContext.Provider value={show}>
        <Gate>{children}</Gate>
        {notice ? (
          <div role="status" className={`fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-xl px-4 py-3 text-center text-sm font-medium shadow-float ${notice.tone === "ok" ? "bg-navy text-cream" : "bg-danger text-white"}`}>
            {notice.text}
          </div>
        ) : null}
      </NoticeContext.Provider>
    </QueryClientProvider>
  );
}

/** The dashboard is for admins only: anyone else gets the sign-in form. */
function Gate({ children }: { children: ReactNode }) {
  const session = useSession();
  useLang();
  if (session === undefined) return null;
  if (!session) return <SignIn />;
  return (
    <>
      <Menu name={session.user.name} />
      {/* The menu is a column beside the page from 1024 px; under that it is a drawer over it. */}
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:ps-[calc(15rem+1.5rem)] lg:max-w-[calc(72rem+15rem)] print:p-0">{children}</main>
    </>
  );
}

/**
 * The menu (2026-11-13): a side column with every page named, instead of a row of icons. On a
 * phone it is a drawer opened from the top bar; it closes on a choice, on Escape and on a tap outside.
 * While it is open, focus is inside it and the page behind is inert, so the keyboard cannot reach
 * what is covered; closing gives focus back to the menu button.
 */
function Menu({ name }: { name: string }) {
  const t = useT();
  const lang = useLang();
  const path = usePathname();
  const dark = useDark();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    // The page behind the drawer does not scroll, and the keyboard cannot reach it.
    document.body.style.overflow = "hidden";
    const behind = [bar.current, document.querySelector("main")].filter((el): el is HTMLElement => !!el);
    for (const el of behind) el.inert = true;
    closer.current?.focus();
    const button = opener.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      for (const el of behind) el.inert = false;
      button?.focus();
    };
  }, [open]);

  const nav = [
    { href: "/", label: t("نظرة عامة", "Overview"), icon: LayoutDashboard, on: path === "/" },
    { href: "/listings/", label: t("العقارات", "Listings"), icon: Building2, on: path.startsWith("/listing") },
    { href: "/agents/", label: t("المسؤولين", "Agents"), icon: UserCog, on: path.startsWith("/agent") },
    { href: "/leads/", label: t("العملاء", "Leads"), icon: Users, on: path.startsWith("/leads") },
    { href: "/clients/", label: t("حسابات العملاء", "Client accounts"), icon: UsersRound, on: path.startsWith("/client") },
    { href: "/viewings/", label: t("المعاينات", "Viewings"), icon: CalendarCheck, on: path.startsWith("/viewings") },
    { href: "/chats/", label: t("الشاتات", "Chats"), icon: MessagesSquare, on: path.startsWith("/chat") },
    { href: "/reports/", label: t("التقارير", "Reports"), icon: FileBarChart, on: path.startsWith("/report") },
    { href: "/areas/", label: t("المناطق", "Areas"), icon: MapPin, on: path.startsWith("/areas") },
    { href: "/admins/", label: t("الإدارة", "Admins"), icon: ShieldUser, on: path.startsWith("/admins") },
    { href: "/settings/", label: t("إعدادات التطبيق", "App settings"), icon: Settings, on: path.startsWith("/settings") },
  ];
  const current = nav.find((n) => n.on);
  const tool = "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-surface-2";

  return (
    <>
      {/* The logo and page name on one side, the menu button on the other (owner, 2026-11-14). */}
      <header ref={bar} className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/90 ps-4 pe-2 backdrop-blur lg:hidden print:hidden">
        <Image src="/admin/brand/icon.svg" alt="" width={28} height={28} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{current?.label ?? t("لوحة الإدارة", "Admin")}</span>
        <button ref={opener} type="button" onClick={() => setOpen(true)} aria-label={t("افتح القائمة", "Open the menu")} aria-expanded={open} aria-controls="menu" className="grid size-11 place-items-center rounded-lg text-ink hover:bg-surface-2">
          <MenuIcon className="size-5" aria-hidden />
        </button>
      </header>
      {/* The backdrop closes on a tap; the keyboard uses Escape or the close button, so it is not a tab stop. */}
      {open ? <button type="button" tabIndex={-1} aria-label={t("اقفل القائمة", "Close the menu")} onClick={close} className="fixed inset-0 z-40 bg-navy/50 lg:hidden" /> : null}
      <aside
        id="menu"
        aria-label={t("القائمة", "Menu")}
        className={`fixed inset-y-0 start-0 z-50 flex w-60 max-w-[85vw] flex-col border-e border-line bg-surface transition-transform duration-200 print:hidden lg:z-30 ${
          open ? "translate-x-0 shadow-float" : "max-lg:invisible max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 px-4">
          <Link href="/" onClick={close} className="flex min-w-0 flex-1 items-center gap-2" aria-label={t("مقر، لوحة الإدارة", "MQR admin")}>
            <Image src="/admin/brand/icon.svg" alt="" width={32} height={32} />
            <span className="truncate text-sm font-semibold">{t("لوحة الإدارة", "Admin")}</span>
          </Link>
          <button ref={closer} type="button" onClick={close} aria-label={t("اقفل القائمة", "Close the menu")} className="grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 lg:hidden">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
          {nav.map(({ href, label, icon: Icon, on }) => (
            <Link
              key={href}
              href={href}
              onClick={close}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium ${on ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 flex-col gap-0.5 border-t border-line p-2">
          <p className="truncate px-3 py-1 text-xs text-ink-3">{name}</p>
          {/* Phase 31: the admin's own password. */}
          <Link href="/password/" onClick={close} aria-current={path.startsWith("/password") ? "page" : undefined} className={tool}>
            <KeyRound className="size-[18px] shrink-0" aria-hidden />
            {t("غيّر كلمة السر", "Change password")}
          </Link>
          <button type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")} className={tool}>
            <Languages className="size-[18px] shrink-0" aria-hidden />
            {lang === "ar" ? "English" : "العربية"}
          </button>
          <button type="button" onClick={() => setDark(!dark)} aria-pressed={dark} className={tool}>
            {dark ? <Sun className="size-[18px] shrink-0" aria-hidden /> : <Moon className="size-[18px] shrink-0" aria-hidden />}
            {dark ? t("الوضع الفاتح", "Light mode") : t("الوضع الداكن", "Dark mode")}
          </button>
          <button type="button" onClick={() => void api.signOut()} className={tool}>
            <LogOut className="size-[18px] shrink-0 rtl:-scale-x-100" aria-hidden />
            {t("خروج", "Sign out")}
          </button>
        </div>
      </aside>
    </>
  );
}

function SignIn() {
  const t = useT();
  const lang = useLang();
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api.signIn(email.trim(), password);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : -1;
      setError(
        status === 401
          ? t("الإيميل أو كلمة السر غلط", "Wrong email or password")
          : status === 403
            ? t("اللوحة دي لفريق مقر بس", "This dashboard is for the MQR team only")
            : status === 429
              ? t("محاولات كتير، استنى دقيقة", "Too many tries, wait a minute")
              : t("مفيش اتصال بالسيرفر، حاول تاني", "Can’t reach the server, try again"),
      );
    } finally {
      setBusy(false);
    }
  };
  if (forgot) return <ForgotPassword email={email} onBack={() => setForgot(false)} />;
  return (
    <main className="grid min-h-dvh place-items-center bg-navy px-4">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-surface p-6 shadow-float">
        <Image src="/admin/brand/logo-gold.png" alt={t("مقر", "MQR")} width={140} height={56} className="mx-auto h-14 w-auto" priority />
        <h1 className="text-center text-lg font-semibold">{t("لوحة إدارة مقر", "MQR admin")}</h1>
        <Field label={t("الإيميل", "Email")} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        <Field label={t("كلمة السر", "Password")} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        <button type="button" onClick={() => setForgot(true)} className="-mt-2 self-end text-sm text-accent-ink underline-offset-4 hover:underline">
          {t("نسيت كلمة السر؟", "Forgot your password?")}
        </button>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="gold" loading={busy}>
          {t("دخول", "Sign in")}
        </Button>
        <button type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="text-sm text-ink-2 underline-offset-4 hover:underline">
          {lang === "ar" ? "English" : "العربية"}
        </button>
      </form>
    </main>
  );
}

/**
 * Phase 31 (2026-11-15): a forgotten password. The email gets a six-digit code; the code and a new
 * password sign the admin in. The answer never says whether the email has an account.
 */
function ForgotPassword({ email: typed, onBack }: { email: string; onBack: () => void }) {
  const t = useT();
  const [email, setEmail] = useState(typed.trim());
  const [sentTo, setSentTo] = useState<string>();
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const failure = (err: unknown) => {
    const status = err instanceof ApiError ? err.status : -1;
    return status === 400
      ? t("الكود غلط أو وقته خلص. اطلب كود جديد لو محتاج.", "The code is wrong or has expired. Ask for a new one if you need to.")
      : status === 403
        ? t("كلمة السر اتغيرت، بس اللوحة دي لفريق مقر بس", "Your password was changed, but this dashboard is for the MQR team only")
        : status === 429
          ? t("محاولات كتير، استنى دقيقة", "Too many tries, wait a minute")
          : t("مفيش اتصال بالسيرفر، حاول تاني", "Can’t reach the server, try again");
  };
  const ask = async (to: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await api.forgotPassword(to);
      setSentTo(to);
    } catch (err) {
      setError(failure(err));
    } finally {
      setBusy(false);
    }
  };
  const askSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (/^\S+@\S+\.\S+$/.test(email.trim())) void ask(email.trim());
  };
  const reset = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    const c = readResetCode(code);
    if (!sentTo || !c || !passwordOk(next) || again !== next) return;
    setBusy(true);
    setError(undefined);
    try {
      await api.resetPassword(sentTo, c, next);
    } catch (err) {
      setError(failure(err));
      setBusy(false);
    }
  };

  const card = "flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-surface p-6 shadow-float";
  const alert = error ? (
    <p role="alert" className="text-sm text-danger">
      {error}
    </p>
  ) : null;
  const back = (
    <button type="button" onClick={onBack} className="text-sm text-ink-2 underline-offset-4 hover:underline">
      {t("رجوع لتسجيل الدخول", "Back to sign in")}
    </button>
  );
  return (
    <main className="grid min-h-dvh place-items-center bg-navy px-4">
      {!sentTo ? (
        <form onSubmit={askSubmit} className={card} noValidate>
          <h1 className="text-center text-lg font-semibold">{t("نسيت كلمة السر", "Forgot password")}</h1>
          <p className="text-sm text-ink-2">{t("اكتب إيميل حسابك، وهنبعتلك كود تعمل بيه كلمة سر جديدة.", "Type your account’s email and we’ll send you a code to set a new password.")}</p>
          <Field label={t("الإيميل", "Email")} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          {alert}
          <Button type="submit" variant="gold" loading={busy}>
            {t("ابعتلي الكود", "Send me the code")}
          </Button>
          {back}
        </form>
      ) : (
        <form onSubmit={reset} className={card} noValidate>
          <h1 className="text-center text-lg font-semibold">{t("كلمة سر جديدة", "New password")}</h1>
          <p className="text-sm text-ink-2">
            {t(
              `لو الإيميل ${sentTo} عليه حساب، هيوصله كود من ٦ أرقام شغال ${RESET_CODE_MINUTES} دقيقة. بص في الـ Spam لو مش لاقيه.`,
              `If ${sentTo} has an account, it gets a 6-digit code that works for ${RESET_CODE_MINUTES} minutes. Check spam if you can’t find it.`,
            )}
          </p>
          <Field label={t("الكود", "Code")} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} error={tried && !readResetCode(code) ? t("الكود ٦ أرقام", "The code is 6 digits") : undefined} dir="ltr" />
          <Field label={t("كلمة السر الجديدة", "New password")} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={(tried || next) && !passwordOk(next) ? t("٨ حروف على الأقل، فيها حرف ورقم", "At least 8 characters, with a letter and a digit") : undefined} dir="ltr" />
          <Field label={t("اكتب كلمة السر الجديدة تاني", "Type the new password again")} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} error={(tried || again) && again !== next ? t("الكلمتين مش زي بعض", "The two don’t match") : undefined} dir="ltr" />
          {alert}
          <Button type="submit" variant="gold" loading={busy}>
            {t("غيّر كلمة السر", "Change password")}
          </Button>
          <button type="button" disabled={busy} onClick={() => void ask(sentTo)} className="text-sm text-accent-ink underline-offset-4 hover:underline">
            {t("ابعت الكود تاني", "Send the code again")}
          </button>
          {back}
        </form>
      )}
    </main>
  );
}
