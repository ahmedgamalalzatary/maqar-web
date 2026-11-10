import {
  type AdminListing,
  type Bi,
  CATEGORIES,
  CATEGORY_LABEL,
  FEATURE_LABEL,
  FEATURES,
  FINISHING_LABEL,
  FINISHINGS,
  fmtMoney,
  fmtNum,
  emptyListingForm,
  hasPaymentPlan,
  LISTING_IMAGES_MAX,
  LISTING_STEPS,
  type ListingField,
  type ListingForm,
  type ListingFormPhoto,
  type ListingStep,
  listingBodyOf,
  listingFormErrors,
  listingFormOf,
  listingStepErrors,
  readWholeNumber,
  PROPERTY_TYPE_LABEL,
  PROPERTY_TYPES,
} from '@maqar/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, ImagePlus, RotateCcw, Star, Trash2 } from 'lucide-react-native';
import { type ComponentRef, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { ApiError, mediaUrl } from '@/core/api/api';
import { useDir, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { type PhotoPart, preparePhotos } from '@/features/chat/photos';
import { ToggleChip } from '@/features/listings/components/chips';
import { useAreas } from '@/features/listings/hooks/use-listings';
import { uploadPhotoRequest } from '../api/admin.api';
import { useAdminListing, usePublishListing, useSaveListing } from '../hooks/use-admin';

const STEP_LABEL: Record<ListingStep, Bi> = {
  type: { ar: 'النوع', en: 'Type' },
  location: { ar: 'المكان', en: 'Location' },
  details: { ar: 'التفاصيل', en: 'Details' },
  photos: { ar: 'الصور', en: 'Photos' },
  review: { ar: 'المراجعة', en: 'Review' },
};

/** What each field's error says. */
const ERROR: Partial<Record<ListingField, Bi>> = {
  type: { ar: 'اختار نوع الوحدة', en: 'Pick the unit type' },
  areaId: { ar: 'اختار المنطقة', en: 'Pick the area' },
  beds: { ar: 'من ٠ لـ ٢٠', en: '0 to 20' },
  baths: { ar: 'من ٠ لـ ٢٠', en: '0 to 20' },
  sizeM2: { ar: 'المساحة بالمتر، من ١٠', en: 'Size in m², 10 or more' },
  price: { ar: 'اكتب السعر بالجنيه', en: 'Enter the price in EGP' },
  finishing: { ar: 'اختار التشطيب', en: 'Pick the finishing' },
  downPct: { ar: 'من ٠ لـ ١٠٠٪', en: '0 to 100%' },
  planYears: { ar: 'من ١ لـ ٣٠ سنة', en: '1 to 30 years' },
  ownerPhone: { ar: 'رقم موبايل بالأرقام، مثلًا ٠١٠١٢٣٤٥٦٧٨', en: 'A phone number in digits, e.g. 01012345678' },
  photos: { ar: 'ضيف صورة واحدة على الأقل، واستنى لحد ما الصور تترفع', en: 'Add at least one photo, and wait for the uploads' },
};

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, i) => thisYear + i);

let photoKey = 0;

/** `/admin/new` and `/admin/listing/:id/edit`: the listing form in five steps (contract §9.2). */
export function ListingFormScreen({ id }: { id?: number }) {
  const t = useT();
  const listing = useAdminListing(id);
  const { colors } = useTheme();
  if (id !== undefined && listing.isError) {
    const gone = listing.error instanceof ApiError && listing.error.status === 404;
    return (
      <View style={[styles.fill, styles.center, styles.failed, { backgroundColor: colors.bg }]}>
        <Txt align="center">{gone ? t('العقار ده مش موجود.', 'This listing does not exist.') : t('مقدرناش نجيب العقار', 'We couldn’t load the listing')}</Txt>
        {gone ? null : <Button label={t('حاول تاني', 'Try again')} variant="secondary" onPress={() => void listing.refetch()} />}
      </View>
    );
  }
  if (id !== undefined && !listing.data) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return <Form key={id ?? 'new'} saved={listing.data} />;
}

function Form({ saved }: { saved?: AdminListing }) {
  const t = useT();
  const dir = useDir();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<ListingForm>(() => (saved ? listingFormOf(saved) : emptyListingForm()));
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const save = useSaveListing(saved?.id);
  const publish = usePublishListing();
  const [publishing, setPublishing] = useState(false);
  const set = <K extends ListingField>(k: K, v: ListingForm[K]) => setS((cur) => ({ ...cur, [k]: v }));

  const current = LISTING_STEPS[step]!;
  const errors = showErrors ? (current === 'review' ? listingFormErrors(s) : listingStepErrors(current, s)) : [];
  const err = (f: ListingField) => (errors.includes(f) && ERROR[f] ? t(ERROR[f]) : undefined);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/admin'));

  const go = (to: number) => {
    setStep(to);
    setShowErrors(false);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const next = () => {
    if (listingStepErrors(current, s).length) return setShowErrors(true);
    go(step + 1);
  };

  const failed = (e: unknown) =>
    toast.show({
      title: e instanceof ApiError && e.status === 0 ? t('مفيش إنترنت، حاول تاني', 'No connection, try again') : t('مقدرناش نحفظ العقار، راجع البيانات', 'We couldn’t save the listing; check the details'),
      tone: 'danger',
    });
  const submit = async (andPublish: boolean) => {
    if (listingFormErrors(s).length) return setShowErrors(true);
    setPublishing(andPublish);
    let l: AdminListing;
    try {
      l = await save.mutateAsync(listingBodyOf(s));
    } catch (e) {
      setPublishing(false);
      return failed(e);
    }
    // The listing is saved now. A failed publish leaves a draft: open it rather than stay on a
    // new form, which would save the same listing again.
    let published = andPublish;
    if (andPublish) published = await publish.mutateAsync(l.id).then(() => true, () => false);
    setPublishing(false);
    if (andPublish && !published) toast.show({ title: t('اتحفظ كمسودة بس متنشرش، جرّب تنشره من صفحته', 'Saved as a draft but not published: try publishing from its page'), tone: 'danger' });
    else toast.show({ title: andPublish ? t('العقار اتنشر', 'Published') : saved ? t('التعديلات اتحفظت', 'Changes saved') : t('العقار اتحفظ كمسودة', 'Saved as a draft'), tone: 'sage' });
    if (saved) leave();
    else {
      setS(emptyListingForm());
      go(0);
      router.push(`/admin/listing/${l.id}`);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.top, { paddingTop: insets.top + 8, borderBottomColor: colors.line }]}>
        {saved ? <IconButton label={t('رجوع', 'Back')} icon={<BackIcon size={20} color={colors.ink} />} onPress={leave} /> : null}
        <View style={styles.flex}>
          <Txt accessibilityRole="header" size={18} weight="semibold">
            {saved ? t('عدّل العقار', 'Edit listing') : t('أضف عقار', 'Add a listing')}
          </Txt>
          <Txt size={12} color="ink2">
            {t(`الخطوة ${fmtNum(step + 1, 'ar')} من ${fmtNum(LISTING_STEPS.length, 'ar')}: ${STEP_LABEL[current].ar}`, `Step ${step + 1} of ${LISTING_STEPS.length}: ${STEP_LABEL[current].en}`)}
          </Txt>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
        <View style={[styles.bar, { backgroundColor: colors.accent, width: `${((step + 1) / LISTING_STEPS.length) * 100}%` }]} />
      </View>

      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {current === 'type' ? <TypeStep s={s} set={set} err={err} /> : null}
        {current === 'location' ? <LocationStep s={s} set={set} err={err} /> : null}
        {current === 'details' ? <DetailsStep s={s} set={set} err={err} /> : null}
        {current === 'photos' ? <PhotosStep s={s} setS={setS} err={err} /> : null}
        {current === 'review' ? <ReviewStep s={s} errors={errors} onEdit={go} /> : null}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 10, borderTopColor: colors.line, backgroundColor: colors.surface }]}>
        {step > 0 ? <Button label={t('السابق', 'Back')} variant="secondary" onPress={() => go(step - 1)} style={styles.flex} /> : null}
        {current !== 'review' ? (
          <Button label={t('التالي', 'Next')} onPress={next} style={styles.flex} />
        ) : saved ? (
          <Button label={t('احفظ التعديلات', 'Save changes')} loading={save.isPending} onPress={() => void submit(false)} style={styles.flex} />
        ) : (
          <>
            <Button label={t('احفظ مسودة', 'Save draft')} variant="secondary" loading={save.isPending && !publishing} disabled={save.isPending} onPress={() => void submit(false)} style={styles.flex} />
            <Button label={t('احفظ وانشر', 'Save and publish')} loading={publishing} disabled={save.isPending} onPress={() => void submit(true)} style={styles.flex} />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

type StepProps = { s: ListingForm; set: <K extends ListingField>(k: K, v: ListingForm[K]) => void; err: (f: ListingField) => string | undefined };

function Group({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Txt size={13} weight="medium" color="ink2">
        {label}
      </Txt>
      <View style={styles.wrap}>{children}</View>
      {error ? (
        <Txt size={12} color="danger">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

function TypeStep({ s, set, err }: StepProps) {
  const t = useT();
  return (
    <>
      <Group label={t('بيع ولا إيجار؟', 'For sale or to rent?')}>
        {CATEGORIES.map((c) => (
          <ToggleChip key={c} role="radio" label={t(CATEGORY_LABEL[c])} selected={s.category === c} onPress={() => set('category', c)} />
        ))}
      </Group>
      <Group label={t('نوع الوحدة', 'Unit type')} error={err('type')}>
        {PROPERTY_TYPES.map((p) => (
          <ToggleChip key={p} role="radio" label={t(PROPERTY_TYPE_LABEL[p])} selected={s.type === p} onPress={() => set('type', p)} />
        ))}
      </Group>
    </>
  );
}

function LocationStep({ s, set, err }: StepProps) {
  const t = useT();
  const lang = useLang();
  const areas = useAreas();
  return (
    <>
      <Group label={t('المنطقة', 'Area')} error={err('areaId')}>
        {areas.isPending ? <ActivityIndicator /> : null}
        {(areas.data ?? []).map((a) => (
          <ToggleChip key={a.id} role="radio" label={lang === 'ar' ? a.nameAr : a.nameEn} selected={s.areaId === a.id} onPress={() => set('areaId', a.id)} />
        ))}
      </Group>
      <TextField label={t('الكمبوند (عربي)', 'Compound (Arabic)')} value={s.compoundAr} onChangeText={(v) => set('compoundAr', v)} />
      <TextField label={t('الكمبوند (إنجليزي)', 'Compound (English)')} value={s.compoundEn} onChangeText={(v) => set('compoundEn', v)} />
      <Txt size={12} color="ink3">
        {t('العنوان اختياري: لو سبته فاضي هيبقى "النوع، الغرف | المنطقة".', 'The title is optional: left empty it becomes "type, beds | area".')}
      </Txt>
      <TextField label={t('العنوان (عربي)', 'Title (Arabic)')} value={s.titleAr} onChangeText={(v) => set('titleAr', v)} maxLength={200} />
      <TextField label={t('العنوان (إنجليزي)', 'Title (English)')} value={s.titleEn} onChangeText={(v) => set('titleEn', v)} maxLength={200} />
      <View style={styles.group}>
        <Txt size={13} weight="medium" color="ink2">
          {t('المالك (محدش بيشوفه غير فريق مقر)', 'Owner (only the Maqar team sees this)')}
        </Txt>
        <TextField label={t('اسم المالك', 'Owner’s name')} value={s.ownerName} onChangeText={(v) => set('ownerName', v)} maxLength={120} />
        <TextField label={t('موبايل المالك', 'Owner’s phone')} value={s.ownerPhone} onChangeText={(v) => set('ownerPhone', v)} keyboardType="phone-pad" maxLength={24} error={err('ownerPhone')} />
      </View>
    </>
  );
}

function DetailsStep({ s, set, err }: StepProps) {
  const t = useT();
  const priceLabel = s.category === 'rent' ? t('الإيجار في الشهر (جنيه)', 'Rent per month (EGP)') : s.category === 'stay' ? t('السعر في الليلة (جنيه)', 'Price per night (EGP)') : t('السعر (جنيه)', 'Price (EGP)');
  const toggleFeature = (f: (typeof FEATURES)[number]) => set('features', s.features.includes(f) ? s.features.filter((x) => x !== f) : [...s.features, f]);
  return (
    <>
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField label={t('الغرف', 'Bedrooms')} value={s.beds} onChangeText={(v) => set('beds', v)} keyboardType="number-pad" error={err('beds')} />
        </View>
        <View style={styles.flex}>
          <TextField label={t('الحمامات', 'Bathrooms')} value={s.baths} onChangeText={(v) => set('baths', v)} keyboardType="number-pad" error={err('baths')} />
        </View>
      </View>
      <TextField label={t('المساحة (م²)', 'Size (m²)')} value={s.sizeM2} onChangeText={(v) => set('sizeM2', v)} keyboardType="number-pad" error={err('sizeM2')} />
      <TextField label={priceLabel} value={s.price} onChangeText={(v) => set('price', v)} keyboardType="number-pad" error={err('price')} />
      <Group label={t('التشطيب', 'Finishing')} error={err('finishing')}>
        {FINISHINGS.map((f) => (
          <ToggleChip key={f} role="radio" label={t(FINISHING_LABEL[f])} selected={s.finishing === f} onPress={() => set('finishing', f)} />
        ))}
      </Group>
      <Group label={t('التسليم', 'Handover')}>
        <ToggleChip role="radio" label={t('استلام فوري', 'Ready now')} selected={s.delivery === 'ready'} onPress={() => set('delivery', 'ready')} />
        {YEARS.map((y) => (
          <ToggleChip key={y} role="radio" label={fmtNum(y, 'ar', 0).replace(/٬/g, '')} text={t(fmtNum(y, 'ar', 0).replace(/٬/g, ''), String(y))} selected={s.delivery === y} onPress={() => set('delivery', y)} />
        ))}
      </Group>
      <Group label={t('المميزات', 'Amenities')}>
        {FEATURES.map((f) => (
          <ToggleChip key={f} label={t(FEATURE_LABEL[f])} selected={s.features.includes(f)} onPress={() => toggleFeature(f)} />
        ))}
      </Group>
      {hasPaymentPlan(s.category) ? (
        <View style={styles.group}>
          <Txt size={13} weight="medium" color="ink2">
            {t('خطة السداد (اختياري)', 'Payment plan (optional)')}
          </Txt>
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField label={t('المقدم ٪', 'Down payment %')} value={s.downPct} onChangeText={(v) => set('downPct', v)} keyboardType="number-pad" error={err('downPct')} />
            </View>
            <View style={styles.flex}>
              <TextField label={t('السنين', 'Years')} value={s.planYears} onChangeText={(v) => set('planYears', v)} keyboardType="number-pad" error={err('planYears')} />
            </View>
          </View>
        </View>
      ) : null}
      <TextField label={t('الوصف (عربي)', 'Description (Arabic)')} value={s.descAr} onChangeText={(v) => set('descAr', v)} multiline maxLength={5000} />
      <TextField label={t('الوصف (إنجليزي)', 'Description (English)')} value={s.descEn} onChangeText={(v) => set('descEn', v)} multiline maxLength={5000} />
    </>
  );
}

/** Photos are resized on the phone and uploaded one by one as soon as they are picked. */
function PhotosStep({ s, setS, err }: { s: ListingForm; setS: React.Dispatch<React.SetStateAction<ListingForm>>; err: StepProps['err'] }) {
  const t = useT();
  const { colors } = useTheme();
  const room = LISTING_IMAGES_MAX - s.photos.length;
  const patch = (key: string, p: Partial<ListingFormPhoto>) => setS((cur) => ({ ...cur, photos: cur.photos.map((x) => (x.key === key ? { ...x, ...p } : x)) }));

  const upload = async (key: string, part: PhotoPart) => {
    patch(key, { failed: false });
    try {
      const { url } = await uploadPhotoRequest(part);
      patch(key, { url });
    } catch {
      patch(key, { failed: true });
    }
  };
  const [parts, setParts] = useState<Record<string, PhotoPart>>({});

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 1 });
    if (res.canceled || !res.assets.length) return;
    const assets = res.assets.slice(0, room);
    const prepared = await preparePhotos(assets).catch(() => null);
    if (!prepared) return toast.show({ title: t('مقدرناش نجهز الصور', 'We couldn’t prepare the photos'), tone: 'danger' });
    const added = assets.map((a) => ({ key: `p${++photoKey}`, local: a.uri }));
    setS((cur) => ({ ...cur, photos: [...cur.photos, ...added] }));
    for (const [i, photo] of added.entries()) {
      setParts((cur) => ({ ...cur, [photo.key]: prepared[i]! }));
      await upload(photo.key, prepared[i]!);
    }
  };
  const remove = (key: string) => setS((cur) => ({ ...cur, photos: cur.photos.filter((p) => p.key !== key) }));
  const makeCover = (key: string) => setS((cur) => ({ ...cur, photos: [...cur.photos.filter((p) => p.key === key), ...cur.photos.filter((p) => p.key !== key)] }));

  return (
    <>
      <Txt size={13} color="ink2">
        {t('أول صورة هي الغلاف. الصور بتتصغر على الموبايل قبل ما تترفع.', 'The first photo is the cover. Photos are made smaller on the phone before they upload.')}
      </Txt>
      {room > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('ضيف صور', 'Add photos')}
          onPress={() => void pick()}
          style={({ pressed }) => [styles.add, { borderColor: colors.accent, backgroundColor: colors.accentSoft, opacity: pressed ? 0.8 : 1 }]}
        >
          <ImagePlus size={22} color={colors.accentInk} />
          <Txt weight="medium" style={{ color: colors.accentInk }}>
            {t(`ضيف صور (لحد ${fmtNum(room, 'ar')})`, `Add photos (up to ${room})`)}
          </Txt>
        </Pressable>
      ) : null}
      {err('photos') ? (
        <Txt size={12} color="danger">
          {err('photos')}
        </Txt>
      ) : null}
      <View style={styles.grid}>
        {s.photos.map((p, i) => {
          const uri = p.url ? mediaUrl(p.url)! : p.local!;
          const part = parts[p.key];
          return (
            <View key={p.key} testID="form-photo" style={[styles.tile, { backgroundColor: colors.surface2, borderColor: i === 0 ? colors.accent : colors.line }]}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {!p.url ? (
                <View style={[StyleSheet.absoluteFill, styles.veil]}>
                  {p.failed ? (
                    part ? (
                      <IconButton label={t('حاول ترفعها تاني', 'Retry the upload')} icon={<RotateCcw size={18} color={colors.ink} />} onPress={() => void upload(p.key, part)} />
                    ) : null
                  ) : (
                    <ActivityIndicator color="#fff" />
                  )}
                </View>
              ) : null}
              {i === 0 ? (
                <View style={[styles.coverTag, { backgroundColor: colors.accent }]}>
                  <Txt size={11} weight="semibold" style={{ color: colors.navy }}>
                    {t('الغلاف', 'Cover')}
                  </Txt>
                </View>
              ) : null}
              <View style={styles.tileActions}>
                {i > 0 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t(`خلّي الصورة ${fmtNum(i + 1, 'ar')} الغلاف`, `Make photo ${i + 1} the cover`)} onPress={() => makeCover(p.key)} style={[styles.mini, { backgroundColor: colors.surface }]}>
                    <Star size={14} color={colors.ink} />
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" accessibilityLabel={t(`امسح الصورة ${fmtNum(i + 1, 'ar')}`, `Remove photo ${i + 1}`)} onPress={() => remove(p.key)} style={[styles.mini, { backgroundColor: colors.surface }]}>
                  <Trash2 size={14} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
}

function ReviewStep({ s, errors, onEdit }: { s: ListingForm; errors: ListingField[]; onEdit: (step: number) => void }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const areas = useAreas();
  const area = areas.data?.find((a) => a.id === s.areaId);
  const price = readWholeNumber(s.price);
  const rows: [number, string, string][] = [
    [0, t('النوع', 'Type'), `${t(CATEGORY_LABEL[s.category])} | ${s.type ? t(PROPERTY_TYPE_LABEL[s.type]) : '—'}`],
    [1, t('المكان', 'Location'), `${area ? (lang === 'ar' ? area.nameAr : area.nameEn) : '—'}${(lang === 'ar' ? s.compoundAr : s.compoundEn) ? ` | ${lang === 'ar' ? s.compoundAr : s.compoundEn}` : ''}`],
    [1, t('العنوان', 'Title'), (lang === 'ar' ? s.titleAr : s.titleEn) || t('العنوان الافتراضي', 'The default title')],
    [1, t('المالك', 'Owner'), [s.ownerName, s.ownerPhone].filter(Boolean).join(' | ') || '—'],
    [2, t('السعر', 'Price'), price ? fmtMoney(price, lang, false) : '—'],
    [2, t('التفاصيل', 'Details'), t(`${s.beds || '—'} غرف | ${s.baths || '—'} حمام | ${s.sizeM2 || '—'} م²`, `${s.beds || '—'} beds | ${s.baths || '—'} baths | ${s.sizeM2 || '—'} m²`)],
    [2, t('التشطيب', 'Finishing'), s.finishing ? t(FINISHING_LABEL[s.finishing]) : '—'],
    [2, t('المميزات', 'Amenities'), s.features.map((f) => t(FEATURE_LABEL[f])).join('، ') || '—'],
    [3, t('الصور', 'Photos'), t(`${fmtNum(s.photos.filter((p) => p.url).length, 'ar')} صورة`, `${s.photos.filter((p) => p.url).length} photos`)],
  ];
  return (
    <>
      <Txt size={13} color="ink2">
        {t('راجع البيانات. العقار بيظهر للعملاء في استكشف لما تنشره بس.', 'Check the details. Clients see the listing in Explore only once you publish it.')}
      </Txt>
      {errors.length ? (
        <View style={[styles.alert, { backgroundColor: colors.dangerSoft }]}>
          <Txt size={13} color="danger">
            {t('في بيانات ناقصة. دوس على السطر علشان تكمّلها.', 'Some details are missing. Tap a line to fill it in.')}
          </Txt>
        </View>
      ) : null}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {rows.map(([to, label, value]) => (
          <Pressable key={label} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={() => onEdit(to)} style={styles.reviewRow}>
            <Txt size={12} color="ink3" style={styles.reviewLabel}>
              {label}
            </Txt>
            <Txt size={14} style={styles.flex}>
              {value}
            </Txt>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  failed: { padding: 24, gap: 12 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  track: { height: 3 },
  bar: { height: 3 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  group: { gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  bottom: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', aspectRatio: 4 / 3, borderRadius: radius.md, overflow: 'hidden', borderWidth: 2 },
  veil: { backgroundColor: 'rgba(4, 21, 37, 0.45)', alignItems: 'center', justifyContent: 'center' },
  coverTag: { position: 'absolute', top: 6, start: 6, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  tileActions: { position: 'absolute', bottom: 6, end: 6, flexDirection: 'row', gap: 6 },
  mini: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  alert: { borderRadius: radius.md, padding: 12 },
  card: { borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 4 },
  reviewRow: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  reviewLabel: { width: 84 },
});
