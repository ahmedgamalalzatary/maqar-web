"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Building2, CalendarCheck, LogOut, MapPin, Moon, PlusSquare, ShieldUser, Sun, UserCog, Users, UsersRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, type FormEvent, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
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
      <Header name={session.user.name} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </>
  );
}

function Header({ name }: { name: string }) {
  const t = useT();
  const lang = useLang();
  const path = usePathname();
  const dark = useDark();
  const toggleTheme = () => setDark(!dark);
  const nav = [
    { href: "/", label: t("العقارات", "Listings"), icon: Building2, on: path === "/" || path.startsWith("/listing") },
    { href: "/new/", label: t("أضف عقار", "Add a listing"), icon: PlusSquare, on: path.startsWith("/new") },
    { href: "/agents/", label: t("المسؤولين", "Agents"), icon: UserCog, on: path.startsWith("/agent") },
    { href: "/leads/", label: t("العملاء", "Leads"), icon: Users, on: path.startsWith("/leads") },
    { href: "/clients/", label: t("حسابات العملاء", "Clients"), icon: UsersRound, on: path.startsWith("/client") },
    { href: "/viewings/", label: t("المعاينات", "Viewings"), icon: CalendarCheck, on: path.startsWith("/viewings") },
    { href: "/areas/", label: t("المناطق", "Areas"), icon: MapPin, on: path.startsWith("/areas") },
    { href: "/admins/", label: t("الإدارة", "Admins"), icon: ShieldUser, on: path.startsWith("/admins") },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={t("مقر، لوحة الإدارة", "Maqar admin")}>
          <Image src="/admin/brand/icon.svg" alt="" width={32} height={32} />
          <span className="hidden text-sm font-semibold sm:inline">{t("لوحة الإدارة", "Admin")}</span>
        </Link>
        <nav className="flex flex-1 items-center gap-1">
          {nav.map(({ href, label, icon: Icon, on }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              aria-current={on ? "page" : undefined}
              className={`inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium ${on ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2"}`}
            >
              <Icon className="size-4" aria-hidden />
              <span className="hidden xl:inline">{label}</span>
            </Link>
          ))}
        </nav>
        <button type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="min-h-10 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-surface-2">
          {lang === "ar" ? "English" : "العربية"}
        </button>
        <button type="button" onClick={toggleTheme} aria-label={t("الوضع الداكن", "Dark mode")} aria-pressed={dark} className="grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-surface-2">
          {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
        </button>
        <span className="hidden text-sm text-ink-2 md:inline">{name}</span>
        <button type="button" onClick={() => void api.signOut()} aria-label={t("خروج", "Sign out")} className="grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-surface-2">
          <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
        </button>
      </div>
    </header>
  );
}

function SignIn() {
  const t = useT();
  const lang = useLang();
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
            ? t("اللوحة دي لفريق مقر بس", "This dashboard is for the Maqar team only")
            : status === 429
              ? t("محاولات كتير، استنى دقيقة", "Too many tries, wait a minute")
              : t("مفيش اتصال بالسيرفر، حاول تاني", "Can’t reach the server, try again"),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="grid min-h-dvh place-items-center bg-navy px-4">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-surface p-6 shadow-float">
        <Image src="/admin/brand/logo-gold.png" alt={t("مقر", "Maqar")} width={140} height={56} className="mx-auto h-14 w-auto" priority />
        <h1 className="text-center text-lg font-semibold">{t("لوحة إدارة مقر", "Maqar admin")}</h1>
        <Field label={t("الإيميل", "Email")} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        <Field label={t("كلمة السر", "Password")} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
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
