import type { Metadata, Viewport } from "next";
import { Readex_Pro } from "next/font/google";
import { Shell } from "@/components/shell";
import "./globals.css";

const readex = Readex_Pro({ subsets: ["arabic", "latin"], variable: "--font-readex", display: "swap" });

export const metadata: Metadata = {
  title: "لوحة إدارة مقر | Maqar admin",
  description: "The Maqar team's dashboard: listings for owners, published to the app.",
  icons: { icon: "/admin/brand/icon.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f2e9" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" data-theme="light" className={readex.variable} suppressHydrationWarning>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
