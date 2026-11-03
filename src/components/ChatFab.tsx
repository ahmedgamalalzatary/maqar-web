"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle } from "lucide-react";
import { useStore, haptic } from "@/lib/store";
import { useChat, unreadFor } from "@/lib/chat";
import { fmtNum, useLang, useT } from "@/lib/i18n";

/** Floating chat button above the tab bar (client role). */
export function ChatFab() {
  const t = useT();
  const lang = useLang();
  const path = usePathname();
  const role = useStore((s) => s.role);
  const comparing = useStore((s) => s.compare.length > 0);
  const unread = useChat((s) => unreadFor(s.threads, "client"));
  const show = role === "buyer" && !path.startsWith("/chat") && !path.startsWith("/owner") && !path.startsWith("/agent");
  // Sit above the compare tray when it is showing.
  const lift = comparing && path !== "/compare" ? 72 : 0;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, y: -lift }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: "spring", stiffness: 460, damping: 30 }}
          className="pointer-events-none fixed inset-x-0 bottom-[calc(92px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[440px] justify-start px-4"
        >
          <Link
            href="/chat"
            onClick={() => haptic(8)}
            aria-label={t("المحادثات", "Messages")}
            className="pointer-events-auto relative grid size-14 place-items-center rounded-full bg-accent text-navy shadow-float ring-4 ring-bg transition active:scale-90"
          >
            {unread > 0 && <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />}
            <MessageCircle className="relative size-6" strokeWidth={2.2} />
            {unread > 0 && (
              <span className="tabular absolute -end-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-navy px-1.5 text-[11px] font-semibold text-cream ring-2 ring-bg">
                {fmtNum(unread, lang)}
              </span>
            )}
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
