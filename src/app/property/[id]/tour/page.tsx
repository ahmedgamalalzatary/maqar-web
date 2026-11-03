"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Smartphone, Hand, Maximize, CalendarCheck, Compass, Loader2 } from "lucide-react";
import { ROOMS } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { useProperty } from "@/lib/logic";
import { haptic } from "@/lib/store";
import { PanoViewer, type Hotspot } from "@/components/PanoViewer";
import { BackButton, Button, IconButton, cx } from "@/components/ui";

export default function TourPage() {
  const { id } = useParams<{ id: string }>();
  const p = useProperty(id);
  const t = useT();
  const roomIds = useMemo(() => p?.tour ?? ["living", "master", "bath"], [p?.tour]);
  const [roomId, setRoomId] = useState(roomIds[0]);
  const [gyro, setGyro] = useState(false);
  const [hint, setHint] = useState(true);
  const [loading, setLoading] = useState(true);
  const [heading, setHeading] = useState(0);
  const room = ROOMS[roomId];

  const hotspots: Hotspot[] = useMemo(() => {
    const others = roomIds.filter((r) => r !== roomId);
    return others.map((r, k) => ({
      roomId: r,
      label: t(ROOMS[r].name),
      lon: 90 + 28 + k * (300 / Math.max(1, others.length)),
      lat: -6,
    }));
  }, [roomIds, roomId, t]);

  const go = (r: string) => {
    haptic(10);
    setRoomId(r);
    setHint(false);
  };

  const toggleGyro = async () => {
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (!gyro && typeof D?.requestPermission === "function") {
      try {
        if ((await D.requestPermission()) !== "granted") return;
      } catch {
        return;
      }
    }
    setGyro((g) => !g);
    setHint(false);
  };

  const fullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 mx-auto max-w-[440px] bg-navy text-cream" onPointerDown={() => hint && setHint(false)}>
      <PanoViewer room={room} hotspots={hotspots} onHotspot={go} gyro={gyro} onProgress={setLoading} onHeading={setHeading} />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-4 pb-10 pt-[calc(12px+env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-center gap-2">
          <BackButton glass fallback={`/property/${id}`} />
          <div className="min-w-0 flex-1 px-1">
            <div className="truncate text-[11px] text-white/70">{p ? t(p.compound) : ""}</div>
            <AnimatePresence mode="wait">
              <motion.div key={roomId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="truncate text-[16px] font-semibold text-white">
                {t(room.name)}
              </motion.div>
            </AnimatePresence>
          </div>
          <IconButton glass label={t("الجيروسكوب", "Gyroscope")} onClick={toggleGyro} className={cx(gyro && "!bg-gold !text-navy")}>
            <Smartphone className="size-[18px]" />
          </IconButton>
          <IconButton glass label={t("ملء الشاشة", "Fullscreen")} onClick={fullscreen}>
            <Maximize className="size-[18px]" />
          </IconButton>
        </div>
      </div>

      {/* Compass */}
      <div className="pointer-events-none absolute end-4 top-[calc(78px+env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-black/35 backdrop-blur-md">
        <Compass className="size-5 text-gold" style={{ transform: `rotate(${-heading}deg)` }} />
      </div>

      {loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="size-8 animate-spin text-gold" />
        </div>
      )}

      {/* Hint */}
      <AnimatePresence>
        {hint && !loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="pointer-events-none absolute inset-0 grid place-items-center"
          >
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-black/45 px-6 py-5 text-center backdrop-blur-md">
              <motion.span animate={{ x: [-18, 18, -18] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
                <Hand className="size-8 text-white" />
              </motion.span>
              <div className="text-[14px] font-medium text-white">{t("اسحب عشان تلف في الأوضة", "Drag to look around")}</div>
              <div className="text-[12px] text-white/70">{t("دوس على النقط البيضا عشان تنقل بين الغرف", "Tap the white dots to move between rooms")}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rooms + CTA */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent pb-[calc(14px+env(safe-area-inset-bottom))] pt-12">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
          {roomIds.map((r) => (
            <button
              key={r}
              onClick={() => go(r)}
              className={cx(
                "relative h-16 w-24 shrink-0 overflow-hidden rounded-2xl transition active:scale-95",
                r === roomId ? "ring-[2.5px] ring-gold" : "opacity-75 ring-1 ring-white/25",
              )}
            >
              <Image src={ROOMS[r].pano} alt="" fill sizes="96px" className="scale-150 object-cover" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-center text-[10.5px] font-medium text-white">{t(ROOMS[r].name)}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 px-4">
          <Button variant="gold" size="lg" full href={`/property/${id}/book`}>
            <CalendarCheck className="size-5" /> {t("عجبتك؟ احجز معاينة حقيقية", "Like it? Book a real viewing")}
          </Button>
        </div>
      </div>
    </div>
  );
}
