import type { Metadata, Viewport } from "next";
import { Readex_Pro } from "next/font/google";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { Logo } from "@/components/Logo";
import "./globals.css";

const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  variable: "--font-readex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "مقر MAQAR — لكل طموح مقر",
  description: "Find, tour in 360°, and book a viewing for your next home in Egypt.",
  appleWebApp: { capable: true, title: "Maqar", statusBarStyle: "black-translucent" },
  icons: { icon: "/brand/icon.svg", apple: "/brand/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f2e9",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" data-theme="light" className={readex.variable} suppressHydrationWarning>
      <body>
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[90] mx-auto grid max-w-[440px] place-items-center bg-navy">
              <Logo width={180} onDark />
            </div>
          }
        >
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
