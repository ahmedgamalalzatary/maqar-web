import type { PropertyDetail } from '@maqar/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { DeviceMotion } from 'expo-sensors';
import { ArrowLeft, ArrowRight, Compass, Hand, Smartphone } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { useDir, useLang, useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { useProperty } from '@/features/property/hooks/use-property';
import { PanoView } from '../components/pano-view';
import { hotspotLayout } from '../pano-math';

/** `/property/:id/tour` (contract §8.6): the full-screen 360° tour, one room at a time. */
export function TourScreen({ id }: { id: number }) {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const property = useProperty(id);
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/property/${id}`));
  const rooms = property.data?.tourRooms ?? [];

  if (property.isPending) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.navy }]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  if (property.isError || !rooms.length) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.navy, padding: 24 }]}>
        <Txt align="center" style={{ color: colors.cream }}>
          {property.isError ? t('مش قادرين نفتح الجولة دلوقتي.', 'We couldn’t open the tour right now.') : t('الوحدة دي مالهاش جولة ٣٦٠°.', 'This home has no 360° tour.')}
        </Txt>
        <Button label={t('رجوع', 'Back')} variant="secondary" onPress={back} style={styles.backBtn} />
      </View>
    );
  }
  return <Tour p={property.data} onBack={back} />;
}

function Tour({ p, onBack }: { p: PropertyDetail; onBack: () => void }) {
  const t = useT();
  const lang = useLang();
  const dir = useDir();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const rooms = p.tourRooms;
  const [roomId, setRoomId] = useState(rooms[0]!.id);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Bumped to re-mount the viewer for a retry.
  const [tryNo, setTryNo] = useState(0);
  const [hint, setHint] = useState(true);
  const [heading, setHeading] = useState(0);
  const [gyro, setGyro] = useState(false);
  const [canGyro, setCanGyro] = useState(false);
  const room = rooms.find((r) => r.id === roomId) ?? rooms[0]!;
  const name = (r: { nameAr: string; nameEn: string }) => (lang === 'ar' ? r.nameAr : r.nameEn);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  useEffect(() => {
    let live = true;
    DeviceMotion.isAvailableAsync()
      .then((ok) => live && setCanGyro(ok))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const hotspots = hotspotLayout(
    rooms.map((r) => r.id),
    room.id,
  ).map((h) => {
    const target = rooms.find((r) => r.id === h.room)!;
    const label = name(target);
    return { key: String(h.room), label, a11yLabel: t(`انتقل إلى ${label}`, `Go to ${label}`), lon: h.lon, lat: h.lat };
  });

  const go = (id: number) => {
    setRoomId(id);
    setFailed(false);
    setHint(false);
  };

  const toggleGyro = async () => {
    if (!gyro) {
      const { granted } = await DeviceMotion.requestPermissionsAsync().catch(() => ({ granted: false }));
      if (!granted) return;
    }
    setGyro((g) => !g);
    setHint(false);
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.navy }]}>
      <PanoView
        key={`${room.id}-${tryNo}`}
        uri={mediaUrl(room.pano) ?? ''}
        hotspots={hotspots}
        onHotspot={(key) => go(Number(key))}
        gyro={gyro}
        onLoading={setLoading}
        onError={() => {
          setFailed(true);
          setLoading(false);
        }}
        onHeading={setHeading}
        onTouch={() => setHint(false)}
      />

      {failed ? (
        <View style={styles.failed} pointerEvents="box-none">
          <View style={[styles.failedCard, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
            <Txt align="center" style={styles.white}>
              {t('مقدرناش نفتح صورة الغرفة دي.', 'We couldn’t load this room’s picture.')}
            </Txt>
            <View style={styles.failedRow}>
              <Button label={t('حاول تاني', 'Try again')} onPress={() => { setFailed(false); setLoading(true); setTryNo((n) => n + 1); }} />
              <Button label={t('الغرفة اللي فاتت', 'Previous room')} variant="secondary" onPress={() => go(roomId === rooms[0]!.id ? rooms[rooms.length - 1]!.id : rooms[rooms.findIndex((r) => r.id === room.id) - 1]!.id)} />
            </View>
          </View>
        </View>
      ) : null}

      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={[styles.top, { paddingTop: insets.top + 12 }]}
        pointerEvents="box-none"
      >
        <Glass label={t('رجوع', 'Back')} onPress={onBack}>
          <BackIcon size={20} color="#fff" />
        </Glass>
        <View style={styles.titles} pointerEvents="none">
          <Txt size={11} numberOfLines={1} style={styles.dim}>
            {lang === 'ar' ? p.compoundAr : p.compoundEn}
          </Txt>
          <Txt size={16} weight="semibold" numberOfLines={1} style={styles.white} accessibilityRole="header">
            {name(room)}
          </Txt>
        </View>
        {canGyro ? (
          <Glass label={t('الجيروسكوب', 'Gyroscope')} onPress={toggleGyro} on={gyro}>
            <Smartphone size={18} color={gyro ? colors.navy : '#fff'} />
          </Glass>
        ) : null}
      </LinearGradient>

      <View style={[styles.compass, { top: insets.top + 72 }]} pointerEvents="none">
        <Compass size={20} color={colors.gold} style={{ transform: [{ rotate: `${-heading}deg` }] }} />
      </View>

      {loading ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : hint ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <View style={styles.hint}>
            <Hand size={32} color="#fff" />
            <Txt size={14} weight="medium" align="center" style={styles.white}>
              {t('اسحب عشان تلف في الأوضة', 'Drag to look around')}
            </Txt>
            {rooms.length > 1 ? (
              <Txt size={12} align="center" style={styles.dim}>
                {t('دوس على النقط البيضا عشان تنقل بين الغرف', 'Tap the white dots to move between rooms')}
              </Txt>
            ) : null}
          </View>
        </View>
      ) : null}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.75)']}
        style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}
        pointerEvents="box-none"
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rooms}>
          {rooms.map((r) => {
            const on = r.id === room.id;
            // The full panoramas are heavy: a room's thumb loads only when the tour is on it or
            // next to it, instead of every room's file at once.
            const near = Math.abs(rooms.findIndex((x) => x.id === r.id) - rooms.findIndex((x) => x.id === room.id)) <= 1;
            const uri = near ? mediaUrl(r.pano) : null;
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={name(r)}
                accessibilityState={{ selected: on }}
                onPress={() => go(r.id)}
                style={({ pressed }) => [
                  styles.room,
                  { borderColor: on ? colors.gold : 'rgba(255,255,255,0.25)', borderWidth: on ? 2.5 : 1, opacity: on ? 1 : pressed ? 0.6 : 0.75 },
                ]}
              >
                {uri ? <Image source={{ uri }} style={styles.thumb} contentFit="cover" /> : null}
                <View style={styles.roomName}>
                  <Txt size={10.5} weight="medium" align="center" numberOfLines={1} style={styles.white}>
                    {name(r)}
                  </Txt>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

/** A round see-through button over the panorama; gold while `on`. */
function Glass({ label, onPress, on, children }: { label: string; onPress: () => void; on?: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={on === undefined ? undefined : { selected: on }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.glass, { backgroundColor: on ? colors.gold : 'rgba(0,0,0,0.35)', opacity: pressed ? 0.7 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  backBtn: { paddingHorizontal: 32 },
  white: { color: '#fff' },
  dim: { color: 'rgba(255,255,255,0.7)' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 40 },
  titles: { flex: 1, paddingHorizontal: 4 },
  glass: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  compass: {
    position: 'absolute',
    end: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { alignItems: 'center', gap: 10, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 24, paddingVertical: 20, maxWidth: 300 },
  failed: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
  failedCard: { borderRadius: 24, padding: 20, gap: 14, alignItems: 'center' },
  failedRow: { flexDirection: 'row', gap: 10 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 48 },
  rooms: { gap: 8, paddingHorizontal: 16 },
  room: { width: 96, height: 64, borderRadius: 16, overflow: 'hidden' },
  thumb: { position: 'absolute', top: -16, left: -24, width: 144, height: 96 },
  roomName: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, paddingVertical: 3 },
});
