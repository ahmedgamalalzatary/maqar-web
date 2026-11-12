import { type AdminArea, areaSlug, fmtNum } from '@maqar/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, ImagePlus, MapPin, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAvoiding } from '@/components/keyboard-avoiding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { ApiError, mediaUrl } from '@/core/api/api';
import { useDir, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { preparePhotos } from '@/features/chat/photos';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { uploadPhotoRequest } from '../api/admin.api';
import { useAdminAreas, useDeleteArea, useSaveArea } from '../hooks/use-admin';

/** `/admin/areas` (phase 18; under More from phase 22): the areas clients browse by. */
export function AreasScreen() {
  const t = useT();
  const dir = useDir();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const areas = useAdminAreas();
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      data={areas.data ?? []}
      keyExtractor={(a) => a.id}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={lang === 'ar' ? item.nameAr : item.nameEn}
          onPress={() => router.push(`/admin/area/${item.id}`)}
          style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={[styles.thumb, { backgroundColor: colors.surface2 }]}>
            <Image source={{ uri: mediaUrl(item.image)! }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </View>
          <View style={styles.flex}>
            <Txt weight="medium">{lang === 'ar' ? item.nameAr : item.nameEn}</Txt>
            <Txt size={12} color="ink2">
              {`${lang === 'ar' ? item.cityAr : item.cityEn} | ${t(`${fmtNum(item.listings, 'ar')} عقار`, `${item.listings} listings`)}`}
            </Txt>
          </View>
        </Pressable>
      )}
      ListHeaderComponent={
        <View style={styles.header}>
          <IconButton label={t('رجوع', 'Back')} icon={dir === 'rtl' ? <ArrowRight size={20} color={colors.ink} /> : <ArrowLeft size={20} color={colors.ink} />} onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin/more'))} />
          <Txt accessibilityRole="header" size={24} weight="semibold" style={styles.flex}>
            {t('المناطق', 'Areas')}
          </Txt>
          <IconButton icon={<Plus size={20} color={colors.ink} />} label={t('أضف منطقة', 'Add an area')} onPress={() => router.push('/admin/area/new')} />
        </View>
      }
      ListEmptyComponent={
        areas.isPending ? (
          <CardSkeleton />
        ) : areas.isError ? (
          <ListingsError onRetry={() => void areas.refetch()} />
        ) : (
          <View style={styles.empty}>
            <MapPin size={32} color={colors.ink3} strokeWidth={1.6} />
            <Txt weight="medium">{t('لسه مفيش مناطق', 'No areas yet')}</Txt>
          </View>
        )
      }
      refreshControl={<RefreshControl refreshing={areas.isRefetching} onRefresh={() => void areas.refetch()} tintColor={colors.accent} />}
    />
  );
}

type Draft = { nameAr: string; nameEn: string; cityAr: string; cityEn: string; image: string | null };

/** `/admin/area/new` and `/admin/area/:id`: names, city and a photo. An area no listing uses can be deleted. */
export function AreaFormScreen({ id }: { id?: string }) {
  const areas = useAdminAreas();
  const { colors } = useTheme();
  const t = useT();
  if (id && !areas.data) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.bg }]}>
        {areas.isError ? <Txt>{t('مقدرناش نجيب المنطقة', 'We couldn’t load the area')}</Txt> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }
  const saved = id ? areas.data?.find((a) => a.id === id) : undefined;
  if (id && !saved) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.bg }]}>
        <Txt>{t('المنطقة دي مش موجودة.', 'This area does not exist.')}</Txt>
      </View>
    );
  }
  return <AreaForm key={id ?? 'new'} saved={saved} />;
}

function AreaForm({ saved }: { saved?: AdminArea }) {
  const t = useT();
  const dir = useDir();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<Draft>({ nameAr: saved?.nameAr ?? '', nameEn: saved?.nameEn ?? '', cityAr: saved?.cityAr ?? '', cityEn: saved?.cityEn ?? '', image: saved?.image ?? null });
  const [showErrors, setShowErrors] = useState(false);
  const [uploading, setUploading] = useState(false);
  const save = useSaveArea(saved?.id);
  const remove = useDeleteArea();
  const set = (k: keyof Draft, v: string) => setD((cur) => ({ ...cur, [k]: v }));
  const short = (v: string) => v.trim().length < 2;
  const bad = short(d.nameAr) || short(d.nameEn) || short(d.cityAr) || short(d.cityEn) || !d.image || (!saved && areaSlug(d.nameEn).length < 2);
  const err = (v: string) => (showErrors && short(v) ? t('اكتب حرفين على الأقل', 'At least 2 characters') : undefined);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/admin/areas'));

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets.length) return;
    setUploading(true);
    try {
      const [part] = await preparePhotos(res.assets.slice(0, 1));
      const { url } = await uploadPhotoRequest(part!);
      setD((cur) => ({ ...cur, image: url }));
    } catch {
      toast.show({ title: t('مقدرناش نرفع الصورة', 'We couldn’t upload the photo'), tone: 'danger' });
    } finally {
      setUploading(false);
    }
  };
  const submit = () => {
    if (bad) return setShowErrors(true);
    save.mutate(
      { nameAr: d.nameAr.trim(), nameEn: d.nameEn.trim(), cityAr: d.cityAr.trim(), cityEn: d.cityEn.trim(), image: d.image! },
      {
        onSuccess: () => {
          toast.show({ title: saved ? t('المنطقة اتحفظت', 'Area saved') : t('المنطقة اتضافت وبقت ظاهرة للعملاء', 'Area added: clients see it now'), tone: 'sage' });
          back();
        },
        onError: (e) =>
          toast.show({
            title: e instanceof ApiError && e.status === 409 ? t('فيه منطقة بنفس الاسم الإنجليزي', 'An area with that English name exists') : t('مقدرناش نحفظ، راجع البيانات', 'We couldn’t save; check the details'),
            tone: 'danger',
          }),
      },
    );
  };
  const confirmDelete = () =>
    Alert.alert(t('تمسح المنطقة؟', 'Delete the area?'), t('العملاء مش هيشوفوها تاني.', 'Clients will not see it any more.'), [
      { text: t('لأ', 'No'), style: 'cancel' },
      {
        text: t('امسح', 'Delete'),
        style: 'destructive',
        onPress: () =>
          remove.mutate(saved!.id, {
            onSuccess: () => {
              toast.show({ title: t('المنطقة اتمسحت', 'Area deleted'), tone: 'sage' });
              back();
            },
            onError: () => toast.show({ title: t('حصلت مشكلة، حاول تاني', 'Something went wrong, try again'), tone: 'danger' }),
          }),
      },
    ]);

  return (
    <KeyboardAvoiding style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + 8, borderBottomColor: colors.line }]}>
        <IconButton label={t('رجوع', 'Back')} icon={<BackIcon size={20} color={colors.ink} />} onPress={back} />
        <Txt accessibilityRole="header" size={18} weight="semibold" style={styles.flex}>
          {saved ? t('عدّل المنطقة', 'Edit area') : t('منطقة جديدة', 'New area')}
        </Txt>
      </View>
      <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={d.image ? t('غيّر الصورة', 'Change the photo') : t('ضيف صورة', 'Add a photo')}
          onPress={() => void pick()}
          style={[styles.photo, { backgroundColor: colors.accentSoft, borderColor: showErrors && !d.image ? colors.danger : colors.accent }]}
        >
          {d.image ? <Image source={{ uri: mediaUrl(d.image)! }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          {uploading ? (
            <ActivityIndicator color={colors.accent} />
          ) : !d.image ? (
            <>
              <ImagePlus size={22} color={colors.accentInk} />
              <Txt weight="medium" style={{ color: colors.accentInk }}>
                {t('ضيف صورة', 'Add a photo')}
              </Txt>
            </>
          ) : null}
        </Pressable>
        <TextField label={t('الاسم (عربي)', 'Name (Arabic)')} value={d.nameAr} onChangeText={(v) => set('nameAr', v)} error={err(d.nameAr)} />
        <TextField label={t('الاسم (إنجليزي)', 'Name (English)')} value={d.nameEn} onChangeText={(v) => set('nameEn', v)} error={err(d.nameEn)} />
        <TextField label={t('المدينة (عربي)', 'City (Arabic)')} value={d.cityAr} onChangeText={(v) => set('cityAr', v)} error={err(d.cityAr)} />
        <TextField label={t('المدينة (إنجليزي)', 'City (English)')} value={d.cityEn} onChangeText={(v) => set('cityEn', v)} error={err(d.cityEn)} />
        <Button label={saved ? t('احفظ', 'Save') : t('أضف المنطقة', 'Add the area')} loading={save.isPending} disabled={uploading} onPress={submit} />
        {saved ? (
          saved.listings ? (
            <Txt size={12} color="ink3" align="center">
              {t(`مينفعش تتمسح: فيها ${fmtNum(saved.listings, 'ar')} عقار.`, `It can’t be deleted: ${saved.listings} listings use it.`)}
            </Txt>
          ) : (
            <Button label={t('امسح المنطقة', 'Delete the area')} variant="danger" loading={remove.isPending} onPress={confirmDelete} />
          )
        ) : null}
      </ScrollView>
    </KeyboardAvoiding>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  gap: { height: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.lg, borderWidth: 1 },
  thumb: { width: 64, height: 64, borderRadius: radius.md, overflow: 'hidden' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  form: { padding: 16, gap: 14 },
  photo: { height: 170, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
