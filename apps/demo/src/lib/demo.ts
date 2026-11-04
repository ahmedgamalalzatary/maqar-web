"use client";

import { useStore, pushNotify } from "./store";
import { fmtMoney } from "./i18n";
import type { Property } from "./data";

/**
 * Front-end demo of "Price drop alerts": once a client follows a listing,
 * we simulate the owner cutting the price a few seconds later.
 */
export function followPrice(p: Property) {
  const s = useStore.getState();
  const on = s.toggleAlert(p.id);
  if (!on) return false;
  if (s.priceOverrides[p.id]) return true;
  setTimeout(() => {
    const st = useStore.getState();
    if (!st.alerts.includes(p.id)) return;
    const pct = 5;
    st.dropPrice(p.id, p.price, pct);
    const newPrice = useStore.getState().priceOverrides[p.id].price;
    const title = { ar: `السعر نزل ${pct}٪`, en: `Price dropped ${pct}%` };
    const body = {
      ar: `${p.title.ar} أصبح ${fmtMoney(newPrice, "ar")} بدل ${fmtMoney(p.price, "ar")}`,
      en: `${p.title.en} is now ${fmtMoney(newPrice, "en")} (was ${fmtMoney(p.price, "en")})`,
    };
    st.notify({ kind: "price", title, body, href: `/property/${p.id}` });
    pushNotify(title[st.lang], body[st.lang], `/property/${p.id}`, "danger");
  }, 8000);
  return true;
}

/** Simulates Maqar's review team approving an owner's listing. */
export function scheduleApproval(id: string, title: string) {
  setTimeout(() => {
    const st = useStore.getState();
    const l = st.ownerListings.find((x) => x.id === id);
    if (!l || l.status !== "pending") return;
    st.updateOwnerListing(id, { status: "approved", views: 14, interested: 1, saves: 3 });
    const t = { ar: "تمت الموافقة على عقارك", en: "Your listing is approved" };
    const b = { ar: `«${title}» منشور الآن على مقر ويظهر للعملاء.`, en: `“${title}” is now live on Maqar.` };
    st.notify({ kind: "approval", title: t, body: b, href: "/owner" });
    pushNotify(t[st.lang], b[st.lang], "/owner", "sage");
  }, 12000);
}

export async function askNotificationPermission() {
  try {
    if (typeof Notification === "undefined") return "unsupported";
    if (Notification.permission === "default") return await Notification.requestPermission();
    return Notification.permission;
  } catch {
    return "unsupported";
  }
}
