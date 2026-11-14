import {
  type AppSettings,
  CALCULATOR_BOUNDS,
  calculatorProblem,
  fmtNum,
  HOME_SECTION_LABEL,
  type HomeSection,
  localDigits,
  readWholeNumber,
  SPLASH_TEXT_MAX,
  SPLASH_VIDEO_MAX_SECONDS,
  type SplashKind,
  VIDEO_TYPES,
} from '@maqar/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ArrowDown, ArrowUp, ImagePlus, Video } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { KeyboardAvoiding } from '@/components/keyboard-avoiding';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { ApiError, mediaUrl } from '@/core/api/api';
import { useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { preparePhotos } from '@/features/chat/photos';
import { ListingsError } from '@/features/listings/components/list-states';
import { uploadPhotoRequest, uploadVideoRequest } from '../api/admin.api';
import { useAppSettings, useSaveAppSettings } from '../hooks/use-admin';
import { BackBar } from './clients-screen';

/** `/admin/settings` (phase 29): the opening screen, the calculator's limits and the Home order. */
export function AppSettingsScreen() {
  const t = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useAppSettings();
  return (
    <KeyboardAvoiding style={[styles.fill, { backgroundColor: colors.bg }]}>
      <BackBar fallback="/admin/more" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Txt accessibilityRole="header" size={22} weight="semibold">
            {t('إعدادات التطبيق', 'App settings')}
          </Txt>
          <Txt size={13} color="ink2">
            {t('اللي بتغيره هنا بيظهر في تطبيق العملاء من غير تحديث للتطبيق.', 'What you change here shows in the client app without an app update.')}
          </Txt>
        </View>
        {settings.isPending ? (
          <ActivityIndicator color={colors.accent} style={styles.loading} />
        ) : settings.isError ? (
          <ListingsError onRetry={() => void settings.refetch()} />
        ) : (
          // Each part starts again from what the server holds whenever that changes (a save, or a
          // refetch with another admin's change), so a draft never sends values the server dropped,
          // such as a video it deleted.
          <>
            <Splash key={JSON.stringify(settings.data.splash)} saved={settings.data} />
            <Calculator key={JSON.stringify(settings.data.calculator)} saved={settings.data} />
            <HomeOrder key={JSON.stringify(settings.data.home)} saved={settings.data} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoiding>
  );
}

function useSave() {
  const t = useT();
  const save = useSaveAppSettings();
  return {
    busy: save.isPending,
    run: (body: Parameters<typeof save.mutate>[0]) =>
      save.mutate(body, {
        onSuccess: () => toast.show({ title: t('اتحفظ، وهيظهر في التطبيق مع أول فتح', 'Saved: the app shows it the next time it opens'), tone: 'sage' }),
        onError: (e) => toast.show({ title: e instanceof ApiError && e.status === 400 ? e.message : t('مقدرناش نحفظ، حاول تاني', 'We couldn’t save, try again'), tone: 'danger' }),
      }),
  };
}

function Block({ title, about, children }: { title: string; about: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.head}>
        <Txt accessibilityRole="header" size={16} weight="semibold">
          {title}
        </Txt>
        <Txt size={12.5} color="ink2">
          {about}
        </Txt>
      </View>
      {children}
    </View>
  );
}

const typeOfVideo = (a: ImagePicker.ImagePickerAsset) => a.mimeType || (/\.mov$/i.test(a.uri) ? 'video/quicktime' : 'video/mp4');

/** The opening screen: the logo only, a picture, or a video of at most 3 seconds; with a line of text. */
function Splash({ saved }: { saved: AppSettings }) {
  const t = useT();
  const { colors } = useTheme();
  const save = useSave();
  const [kind, setKind] = useState<SplashKind>(saved.splash.kind);
  // Each kind keeps its own file, so switching back and forth loses nothing.
  const [image, setImage] = useState(saved.splash.kind === 'image' ? saved.splash.media : null);
  const [video, setVideo] = useState(saved.splash.kind === 'video' ? { url: saved.splash.media!, poster: saved.splash.poster } : null);
  const [textAr, setTextAr] = useState(saved.splash.textAr);
  const [textEn, setTextEn] = useState(saved.splash.textEn);
  const [uploading, setUploading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const media = kind === 'image' ? image : kind === 'video' ? (video?.url ?? null) : null;
  const missing = kind !== 'none' && !media;
  const tooLong = () => toast.show({ title: t('الفيديو لازم يكون ٣ ثواني أو أقل', 'The video must be 3 seconds or shorter'), tone: 'danger' });

  const pick = async () => {
    if (kind === 'image') {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (res.canceled || !res.assets.length) return;
      setUploading(true);
      try {
        const [part] = await preparePhotos(res.assets.slice(0, 1));
        setImage((await uploadPhotoRequest(part!)).url);
      } catch {
        toast.show({ title: t('مقدرناش نرفع الملف', 'We couldn’t upload the file'), tone: 'danger' });
      } finally {
        setUploading(false);
      }
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      // iPhones film HEVC; this hands over H.264, which the server keeps as it is.
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    const a = res.canceled ? undefined : res.assets[0];
    if (!a) return;
    if (!(VIDEO_TYPES as readonly string[]).includes(typeOfVideo(a))) return toast.show({ title: t('الفيديو لازم يكون MP4 أو MOV', 'The video must be an MP4 or MOV'), tone: 'danger' });
    if (a.duration && Math.round(a.duration / 1000) > SPLASH_VIDEO_MAX_SECONDS) return tooLong();
    setUploading(true);
    try {
      const v = await uploadVideoRequest(a.uri, typeOfVideo(a), undefined, true);
      setVideo({ url: v.url, poster: v.poster });
    } catch (e) {
      if (e instanceof ApiError && /3 seconds/.test(e.message)) tooLong();
      else toast.show({ title: t('مقدرناش نرفع الملف', 'We couldn’t upload the file'), tone: 'danger' });
    } finally {
      setUploading(false);
    }
  };
  const submit = () => {
    if (missing) return setShowErrors(true);
    save.run({ splash: { kind, media, textAr: textAr.trim(), textEn: textEn.trim() } });
  };

  const kinds: { value: SplashKind; label: string }[] = [
    { value: 'none', label: t('اللوجو بس', 'The logo only') },
    { value: 'image', label: t('صورة', 'A picture') },
    { value: 'video', label: t('فيديو (٣ ثواني)', 'A video (3 seconds)') },
  ];
  const preview = kind === 'image' ? image : kind === 'video' ? (video?.poster ?? null) : null;
  return (
    <Block title={t('شاشة الفتح', 'The opening screen')} about={t('أول حاجة العميل بيشوفها لما يفتح التطبيق، بعد اللوجو.', 'The first thing a client sees when the app opens, after the logo.')}>
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {kinds.map((k) => (
          <Pressable
            key={k.value}
            accessibilityRole="radio"
            accessibilityLabel={k.label}
            accessibilityState={{ checked: kind === k.value }}
            onPress={() => setKind(k.value)}
            style={[styles.chip, { backgroundColor: kind === k.value ? colors.ink : colors.surface, borderColor: colors.line2 }]}
          >
            <Txt size={13} weight="medium" style={{ color: kind === k.value ? colors.bg : colors.ink }}>
              {k.label}
            </Txt>
          </Pressable>
        ))}
      </View>
      {kind !== 'none' ? (
        <View style={styles.mediaRow}>
          <View style={[styles.preview, { backgroundColor: colors.navy }]}>
            {preview ? <Image source={{ uri: mediaUrl(preview)! }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            {uploading ? <ActivityIndicator color={colors.cream} /> : null}
          </View>
          <View style={styles.mediaSide}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={media ? t('غيّر الملف', 'Change the file') : kind === 'image' ? t('ارفع صورة', 'Upload a picture') : t('ارفع فيديو', 'Upload a video')}
              disabled={uploading}
              onPress={() => void pick()}
              style={[styles.upload, { borderColor: colors.line2, backgroundColor: colors.surface2 }]}
            >
              {kind === 'image' ? <ImagePlus size={18} color={colors.ink} /> : <Video size={18} color={colors.ink} />}
              <Txt size={13} weight="medium">
                {media ? t('غيّر الملف', 'Change the file') : kind === 'image' ? t('ارفع صورة', 'Upload a picture') : t('ارفع فيديو', 'Upload a video')}
              </Txt>
            </Pressable>
            <Txt size={12} color="ink3">
              {kind === 'image'
                ? t('صورة بالطول بتبان أحسن. بتفضل ظاهرة ثانيتين.', 'An upright picture looks best. It stays up for 2 seconds.')
                : t('MP4 أو MOV، ٣ ثواني أو أقل، من غير صوت.', 'MP4 or MOV, 3 seconds or shorter, played without sound.')}
            </Txt>
            {showErrors && missing ? (
              <Txt size={12} color="danger">
                {kind === 'image' ? t('ارفع الصورة الأول', 'Upload the picture first') : t('ارفع الفيديو الأول', 'Upload the video first')}
              </Txt>
            ) : null}
          </View>
        </View>
      ) : null}
      <TextField label={t('النص (عربي، اختياري)', 'Text (Arabic, optional)')} value={textAr} onChangeText={setTextAr} maxLength={SPLASH_TEXT_MAX} />
      <TextField label={t('النص (إنجليزي، اختياري)', 'Text (English, optional)')} value={textEn} onChangeText={setTextEn} maxLength={SPLASH_TEXT_MAX} />
      <Button label={t('احفظ شاشة الفتح', 'Save the opening screen')} loading={save.busy} disabled={uploading} onPress={submit} />
    </Block>
  );
}

/** The calculator: the least down payment and the years a client can type. */
function Calculator({ saved }: { saved: AppSettings }) {
  const t = useT();
  const lang = useLang();
  const save = useSave();
  const [down, setDown] = useState(localDigits(String(saved.calculator.minDownPct), lang));
  const [minYears, setMinYears] = useState(localDigits(String(saved.calculator.minYears), lang));
  const [maxYears, setMaxYears] = useState(localDigits(String(saved.calculator.maxYears), lang));
  const [showErrors, setShowErrors] = useState(false);
  const value = { minDownPct: readWholeNumber(down) ?? -1, minYears: readWholeNumber(minYears) ?? 0, maxYears: readWholeNumber(maxYears) ?? 0 };
  const problem = calculatorProblem(value);
  const submit = () => {
    if (problem) return setShowErrors(true);
    save.run({ calculator: value });
  };
  return (
    <Block
      title={t('حاسبة التقسيط', 'The installment calculator')}
      about={t('أقل مقدم وأقل وأكتر سنين العميل يقدر يختارهم. العقار اللي له خطة تقسيط خاصة بيتحسب بخطته.', 'The least down payment and the fewest and most years a client can pick. A listing with its own payment plan keeps its plan.')}
    >
      {/* Any whole percent, typed (owner, 2026-11-14): 11, 12, 9… */}
      <TextField label={t('أقل مقدم (٪)', 'Least down payment (%)')} value={down} onChangeText={setDown} keyboardType="number-pad" maxLength={2} />
      {showErrors && problem === 'down' ? (
        <Txt size={12} color="danger">
          {t(`أقل مقدم من ٠ لـ ${fmtNum(CALCULATOR_BOUNDS.downMax, 'ar')}٪.`, `The least down payment is 0 to ${CALCULATOR_BOUNDS.downMax}%.`)}
        </Txt>
      ) : null}
      <TextField label={t('أقل سنين', 'Fewest years')} value={minYears} onChangeText={setMinYears} keyboardType="number-pad" maxLength={2} />
      <TextField label={t('أكتر سنين', 'Most years')} value={maxYears} onChangeText={setMaxYears} keyboardType="number-pad" maxLength={2} />
      {showErrors && problem === 'years' ? (
        <Txt size={12} color="danger">
          {t('السنين من ١ لـ ٣٠، والأقل ميزيدش عن الأكتر.', 'Years go from 1 to 30, and the fewest cannot be more than the most.')}
        </Txt>
      ) : null}
      <Button label={t('احفظ الحاسبة', 'Save the calculator')} loading={save.busy} onPress={submit} />
    </Block>
  );
}

/** The order of the Home sections: move one up or down, then save. */
function HomeOrder({ saved }: { saved: AppSettings }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const save = useSave();
  const [order, setOrder] = useState<HomeSection[]>(saved.home.sections);
  const move = (i: number, by: -1 | 1) =>
    setOrder((cur) => {
      const next = [...cur];
      [next[i], next[i + by]] = [next[i + by]!, next[i]!];
      return next;
    });
  return (
    <Block
      title={t('ترتيب الصفحة الرئيسية', 'The order of the Home page')}
      about={t('العنوان وخانة البحث ثابتين فوق. القسم اللي مفيهوش حاجة للعميل مش بيظهر.', 'The headline and the search box stay on top. A section with nothing for the client does not show.')}
    >
      {order.map((s, i) => {
        const name = HOME_SECTION_LABEL[s];
        return (
          <View key={s} style={[styles.orderRow, { borderColor: colors.line }]}>
            <Txt size={12} color="ink3" style={styles.orderNo}>
              {fmtNum(i + 1, lang)}
            </Txt>
            <Txt size={13} weight="medium" style={styles.flex}>
              {t(name)}
            </Txt>
            <Pressable accessibilityRole="button" accessibilityLabel={t(`طلّع «${name.ar}» لفوق`, `Move “${name.en}” up`)} disabled={i === 0} onPress={() => move(i, -1)} hitSlop={4} style={[styles.orderBtn, { opacity: i === 0 ? 0.3 : 1 }]}>
              <ArrowUp size={18} color={colors.ink} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(`نزّل «${name.ar}» لتحت`, `Move “${name.en}” down`)}
              disabled={i === order.length - 1}
              onPress={() => move(i, 1)}
              hitSlop={4}
              style={[styles.orderBtn, { opacity: i === order.length - 1 ? 0.3 : 1 }]}
            >
              <ArrowDown size={18} color={colors.ink} />
            </Pressable>
          </View>
        );
      })}
      <Button label={t('احفظ الترتيب', 'Save the order')} loading={save.busy} onPress={() => save.run({ home: { sections: order } })} />
    </Block>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14 },
  head: { gap: 4 },
  loading: { marginTop: 40 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
  mediaRow: { flexDirection: 'row', gap: 12 },
  preview: { width: 90, aspectRatio: 9 / 16, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  mediaSide: { flex: 1, gap: 8 },
  upload: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 12 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 10 },
  orderNo: { width: 20 },
  orderBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
