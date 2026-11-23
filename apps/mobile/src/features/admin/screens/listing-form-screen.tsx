import {
  type AdminListing,
  type Bi,
  CATEGORIES,
  CATEGORY_LABEL,
  FEATURE_LABEL,
  FEATURES,
  FINISHING_LABEL,
  FINISHINGS,
  fmtDuration,
  fmtMoney,
  fmtNum,
  joinParts,
  emptyListingForm,
  hasPaymentPlan,
  LISTING_IMAGES_MAX,
  LISTING_STEPS,
  LISTING_VIDEOS_MAX,
  type ListingField,
  type ListingForm,
  type ListingFormPhoto,
  type ListingFormRoom,
  type ListingFormVideo,
  type ListingStep,
  listingBodyOf,
  listingFormErrors,
  listingFormOf,
  listingStepErrors,
  readWholeNumber,
  panoramaProblem,
  PROPERTY_TYPE_LABEL,
  PROPERTY_TYPES,
  TOUR_ROOMS_MAX,
  videoProblem,
  pickField,
} from '@maqar/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Clapperboard, Film, ImagePlus, Play, Rotate3d, RotateCcw, Star, Trash2 } from 'lucide-react-native';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAvoiding } from '@/components/keyboard-avoiding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { ApiError, mediaUrl } from '@/core/api/api';
import { m, useDir, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { type PhotoPart, preparePhotos } from '@/features/chat/photos';
import * as SecureStore from 'expo-secure-store';
import { ToggleChip } from '@/features/listings/components/chips';
import { useAreas } from '@/features/listings/hooks/use-listings';
import { uploadPanoramaRequest, uploadPhotoRequest, uploadVideoRequest } from '../api/admin.api';
import { preparePanorama } from '../panorama';
import { useAdminListing, usePublishListing, useSaveListing } from '../hooks/use-admin';

const STEP_LABEL: Record<ListingStep, Bi> = {
  type: m.common.type,
  location: m.admin.location,
  details: m.admin.details,
  photos: m.admin.photos,
  videos: m.admin.videos,
  tour: m.common.n360Tour,
  review: m.admin.review,
};

/** What each field's error says. */
const ERROR: Partial<Record<ListingField, Bi>> = {
  type: m.admin.pickTheUnitType,
  areaId: m.admin.pickTheArea,
  beds: m.admin.range0To20,
  baths: m.admin.range0To20,
  sizeM2: m.admin.sizeAtLeast10,
  price: m.admin.enterThePriceInEgp,
  finishing: m.admin.pickTheFinishing,
  downPct: m.admin.range0To100Pct,
  planYears: m.admin.range1To30Years,
  ownerPhone: m.admin.phoneInDigits,
  photos: m.admin.addAtLeastOnePhoto,
  videos: m.admin.waitForTheVideosTo,
  tour: m.admin.eachRoomNeedsItsArabic,
};

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, i) => thisYear + i);

let photoKey = 0;

/** Each picked video's file type, by its form key, for a retry. */
const videoTypes = new Map<string, string>();
const typeOfVideo = (a: ImagePicker.ImagePickerAsset) => a.mimeType || (/\.mov$/i.test(a.uri) ? 'video/quicktime' : 'video/mp4');

/** `/admin/new` and `/admin/listing/:id/edit`: the listing form in steps (contract §9.2). */
export function ListingFormScreen({ id }: { id?: number }) {
  const t = useT();
  const listing = useAdminListing(id);
  const { colors } = useTheme();
  if (id !== undefined && listing.isError) {
    const gone = listing.error instanceof ApiError && listing.error.status === 404;
    return (
      <View style={[styles.fill, styles.center, styles.failed, { backgroundColor: colors.bg }]}>
        <Txt align="center">{gone ? t(m.common.thisListingDoesNotExist) : t(m.admin.weCouldntLoadTheListing)}</Txt>
        {gone ? null : <Button label={t(m.common.tryAgain)} variant="secondary" onPress={() => void listing.refetch()} />}
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
  // The photos' bytes for upload and retry, kept here rather than in the Photos step: moving
  // between steps unmounts the step, and a failed upload's retry must survive that.
  const [parts, setParts] = useState<Record<string, PhotoPart>>({});
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const save = useSaveListing(saved?.id);
  const publish = usePublishListing();
  const [publishing, setPublishing] = useState(false);
  const set = <K extends ListingField>(k: K, v: ListingForm[K]) => setS((cur) => ({ ...cur, [k]: v }));

  // A recoverable draft in the phone's secure storage: saved as the admin types, restored when
  // the form opens again (an app kill or a session expiry mid-listing no longer loses the work),
  // dropped once the listing is saved for real. New listings only; an existing one is on the server.
  const draftKey = saved ? null : 'listing:new';
  useEffect(() => {
    if (!draftKey) return;
    SecureStore.getItemAsync(`maqar-draft-${draftKey}`)
      .then((raw) => {
        const draft = raw ? (JSON.parse(raw) as ListingForm) : null;
        if (draft && Object.keys(draft).length) setS((cur) => ({ ...cur, ...draft }));
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);
  useEffect(() => {
    if (!draftKey) return;
    const id = setTimeout(() => {
      void SecureStore.setItemAsync(`maqar-draft-${draftKey}`, JSON.stringify(s)).catch(() => undefined);
    }, 600);
    return () => clearTimeout(id);
  }, [s, draftKey]);

  const current = LISTING_STEPS[step]!;
  const errors = showErrors ? (current === 'review' ? listingFormErrors(s) : listingStepErrors(current, s)) : [];
  const err = (f: ListingField) => (errors.includes(f) && ERROR[f] ? t(ERROR[f]) : undefined);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/admin/listings'));

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
      title: e instanceof ApiError && e.status === 0 ? t(m.common.noConnectionTryAgain) : t(m.admin.weCouldntSaveTheListing),
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
    if (draftKey) void SecureStore.deleteItemAsync(`maqar-draft-${draftKey}`).catch(() => undefined);
    let published = andPublish;
    if (andPublish) published = await publish.mutateAsync(l.id).then(() => true, () => false);
    setPublishing(false);
    if (andPublish && !published) toast.show({ title: t(m.admin.savedAsADraftBut), tone: 'danger' });
    else toast.show({ title: andPublish ? t(m.admin.published) : saved ? t(m.admin.changesSaved) : t(m.admin.savedAsADraft), tone: 'sage' });
    if (saved) leave();
    else router.replace(`/admin/listing/${l.id}`);
  };

  return (
    <KeyboardAvoiding style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + 8, borderBottomColor: colors.line }]}>
        <IconButton label={t(m.common.back)} icon={<BackIcon size={20} color={colors.ink} />} onPress={leave} />
        <View style={styles.flex}>
          <Txt accessibilityRole="header" size={18} weight="semibold">
            {saved ? t(m.admin.editListing) : t(m.common.addAListing)}
          </Txt>
          <Txt size={12} color="ink2">
            {t(m.admin.stepOf(step + 1, LISTING_STEPS.length, STEP_LABEL[current]))}
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
        {current === 'photos' ? <PhotosStep s={s} setS={setS} parts={parts} setParts={setParts} err={err} /> : null}
        {current === 'videos' ? <VideosStep s={s} setS={setS} err={err} /> : null}
        {current === 'tour' ? <TourStep s={s} setS={setS} parts={parts} setParts={setParts} err={err} /> : null}
        {current === 'review' ? <ReviewStep s={s} errors={errors} onEdit={go} /> : null}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 10, borderTopColor: colors.line, backgroundColor: colors.surface }]}>
        {step > 0 ? <Button label={t(m.admin.back)} variant="secondary" onPress={() => go(step - 1)} style={styles.flex} /> : null}
        {current !== 'review' ? (
          <Button label={t(m.common.next)} onPress={next} style={styles.flex} />
        ) : saved ? (
          <Button label={t(m.admin.saveChanges)} loading={save.isPending} onPress={() => void submit(false)} style={styles.flex} />
        ) : (
          <>
            <Button label={t(m.admin.saveDraft)} variant="secondary" loading={save.isPending && !publishing} disabled={save.isPending} onPress={() => void submit(false)} style={styles.flex} />
            <Button label={t(m.admin.saveAndPublish)} loading={publishing} disabled={save.isPending} onPress={() => void submit(true)} style={styles.flex} />
          </>
        )}
      </View>
    </KeyboardAvoiding>
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
      <Group label={t(m.admin.forSaleOrToRent)}>
        {CATEGORIES.map((c) => (
          <ToggleChip key={c} role="radio" label={t(CATEGORY_LABEL[c])} selected={s.category === c} onPress={() => set('category', c)} />
        ))}
      </Group>
      <Group label={t(m.common.unitType)} error={err('type')}>
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
      <Group label={t(m.common.area)} error={err('areaId')}>
        {areas.isPending ? <ActivityIndicator /> : null}
        {(areas.data ?? []).map((a) => (
          <ToggleChip key={a.id} role="radio" label={pickField(a, 'name', lang)} selected={s.areaId === a.id} onPress={() => set('areaId', a.id)} />
        ))}
      </Group>
      <TextField label={t(m.admin.compoundArabic)} value={s.compoundAr} onChangeText={(v) => set('compoundAr', v)} />
      <TextField label={t(m.admin.compoundEnglish)} value={s.compoundEn} onChangeText={(v) => set('compoundEn', v)} />
      <TextField label={t(m.admin.developerArabicOptional)} value={s.developerAr} onChangeText={(v) => set('developerAr', v)} />
      <TextField label={t(m.admin.developerEnglishOptional)} value={s.developerEn} onChangeText={(v) => set('developerEn', v)} />
      <TextField label={t(m.common.floor)} value={s.floor} onChangeText={(v) => set('floor', v)} keyboardType="number-pad" />
      <TextField label={t(m.admin.maintenanceFeeAYear)} value={s.maintenanceFee} onChangeText={(v) => set('maintenanceFee', v)} keyboardType="number-pad" />
      <Txt size={12} color="ink3">
        {t(m.admin.theTitleIsOptionalLeft)}
      </Txt>
      <TextField label={t(m.admin.titleArabic2)} value={s.titleAr} onChangeText={(v) => set('titleAr', v)} maxLength={200} />
      <TextField label={t(m.admin.titleEnglish2)} value={s.titleEn} onChangeText={(v) => set('titleEn', v)} maxLength={200} />
      <View style={styles.group}>
        <Txt size={13} weight="medium" color="ink2">
          {t(m.admin.ownerOnlyTheMaqarTeam)}
        </Txt>
        <TextField label={t(m.admin.ownersName)} value={s.ownerName} onChangeText={(v) => set('ownerName', v)} maxLength={120} />
        <TextField label={t(m.admin.ownersPhone)} value={s.ownerPhone} onChangeText={(v) => set('ownerPhone', v)} keyboardType="phone-pad" maxLength={24} error={err('ownerPhone')} />
      </View>
    </>
  );
}

function DetailsStep({ s, set, err }: StepProps) {
  const t = useT();
  const priceLabel = s.category === 'rent' ? t(m.admin.rentPerMonthEgp) : s.category === 'stay' ? t(m.admin.pricePerNightEgp) : t(m.admin.priceEgp);
  const toggleFeature = (f: (typeof FEATURES)[number]) => set('features', s.features.includes(f) ? s.features.filter((x) => x !== f) : [...s.features, f]);
  return (
    <>
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField label={t(m.common.bedrooms)} value={s.beds} onChangeText={(v) => set('beds', v)} keyboardType="number-pad" error={err('beds')} />
        </View>
        <View style={styles.flex}>
          <TextField label={t(m.common.bathrooms)} value={s.baths} onChangeText={(v) => set('baths', v)} keyboardType="number-pad" error={err('baths')} />
        </View>
      </View>
      <TextField label={t(m.admin.sizeM)} value={s.sizeM2} onChangeText={(v) => set('sizeM2', v)} keyboardType="number-pad" error={err('sizeM2')} />
      <TextField label={priceLabel} value={s.price} onChangeText={(v) => set('price', v)} keyboardType="number-pad" error={err('price')} />
      <Group label={t(m.common.finishing)} error={err('finishing')}>
        {FINISHINGS.map((f) => (
          <ToggleChip key={f} role="radio" label={t(FINISHING_LABEL[f])} selected={s.finishing === f} onPress={() => set('finishing', f)} />
        ))}
      </Group>
      <Group label={t(m.admin.handover)}>
        <ToggleChip role="radio" label={t(m.admin.readyNow)} selected={s.delivery === 'ready'} onPress={() => set('delivery', 'ready')} />
        {YEARS.map((y) => (
          <ToggleChip key={y} role="radio" label={fmtNum(y, 'ar', 0).replace(/٬/g, '')} text={t(m.common.year(y))} selected={s.delivery === y} onPress={() => set('delivery', y)} />
        ))}
      </Group>
      <Group label={t(m.common.amenities)}>
        {FEATURES.map((f) => (
          <ToggleChip key={f} label={t(FEATURE_LABEL[f])} selected={s.features.includes(f)} onPress={() => toggleFeature(f)} />
        ))}
      </Group>
      {hasPaymentPlan(s.category) ? (
        <View style={styles.group}>
          <Txt size={13} weight="medium" color="ink2">
            {t(m.admin.paymentPlanOptional)}
          </Txt>
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField label={t(m.admin.downPayment)} value={s.downPct} onChangeText={(v) => set('downPct', v)} keyboardType="number-pad" error={err('downPct')} />
            </View>
            <View style={styles.flex}>
              <TextField label={t(m.admin.years)} value={s.planYears} onChangeText={(v) => set('planYears', v)} keyboardType="number-pad" error={err('planYears')} />
            </View>
          </View>
        </View>
      ) : null}
      <TextField label={t(m.admin.descriptionArabic)} value={s.descAr} onChangeText={(v) => set('descAr', v)} multiline maxLength={5000} />
      <TextField label={t(m.admin.descriptionEnglish)} value={s.descEn} onChangeText={(v) => set('descEn', v)} multiline maxLength={5000} />
    </>
  );
}

/** Photos are resized on the phone and uploaded one by one as soon as they are picked. */
function PhotosStep({
  s,
  setS,
  parts,
  setParts,
  err,
}: {
  s: ListingForm;
  setS: React.Dispatch<React.SetStateAction<ListingForm>>;
  parts: Record<string, PhotoPart>;
  setParts: React.Dispatch<React.SetStateAction<Record<string, PhotoPart>>>;
  err: StepProps['err'];
}) {
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
  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 1 });
    if (res.canceled || !res.assets.length) return;
    const assets = res.assets.slice(0, room);
    const prepared = await preparePhotos(assets).catch(() => null);
    if (!prepared) return toast.show({ title: t(m.common.weCouldntPrepareThePhotos), tone: 'danger' });
    const added = assets.map((a) => ({ key: `p${++photoKey}`, local: a.uri }));
    setS((cur) => ({ ...cur, photos: [...cur.photos, ...added] }));
    for (const [i, photo] of added.entries()) {
      setParts((cur) => ({ ...cur, [photo.key]: prepared[i]! }));
      await upload(photo.key, prepared[i]!);
    }
  };
  const remove = (key: string) => {
    setS((cur) => ({ ...cur, photos: cur.photos.filter((p) => p.key !== key) }));
    setParts((cur) => {
      if (!(key in cur)) return cur;
      const next = { ...cur };
      delete next[key];
      return next;
    });
  };
  const makeCover = (key: string) => setS((cur) => ({ ...cur, photos: [...cur.photos.filter((p) => p.key === key), ...cur.photos.filter((p) => p.key !== key)] }));

  return (
    <>
      <Txt size={13} color="ink2">
        {t(m.admin.theFirstPhotoIsThe)}
      </Txt>
      {room > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(m.admin.addPhotos)}
          onPress={() => void pick()}
          style={({ pressed }) => [styles.add, { borderColor: colors.accent, backgroundColor: colors.accentSoft, opacity: pressed ? 0.8 : 1 }]}
        >
          <ImagePlus size={22} color={colors.accentInk} />
          <Txt weight="medium" style={{ color: colors.accentInk }}>
            {t(m.admin.addPhotosUpTo(room))}
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
                      <IconButton label={t(m.common.retryTheUpload)} icon={<RotateCcw size={18} color={colors.ink} />} onPress={() => void upload(p.key, part)} />
                    ) : null
                  ) : (
                    <ActivityIndicator color="#fff" />
                  )}
                </View>
              ) : null}
              {i === 0 ? (
                <View style={[styles.coverTag, { backgroundColor: colors.accent }]}>
                  <Txt size={11} weight="semibold" style={{ color: colors.navy }}>
                    {t(m.common.cover)}
                  </Txt>
                </View>
              ) : null}
              <View style={styles.tileActions}>
                {i > 0 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t(m.admin.makeCover(i + 1))} onPress={() => makeCover(p.key)} style={[styles.mini, { backgroundColor: colors.surface }]}>
                    <Star size={14} color={colors.ink} />
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" accessibilityLabel={t(m.admin.removePhoto(i + 1))} onPress={() => remove(p.key)} style={[styles.mini, { backgroundColor: colors.surface }]}>
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

/**
 * Listing videos (phase 26): picked from the phone, sent from its disk, then converted on the
 * server, which can take a few minutes for a long one. Optional; shown after the photos.
 */
function VideosStep({ s, setS, err }: { s: ListingForm; setS: React.Dispatch<React.SetStateAction<ListingForm>>; err: StepProps['err'] }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const [sent, setSent] = useState<Record<string, number>>({});
  const room = LISTING_VIDEOS_MAX - s.videos.length;
  const patch = (key: string, p: Partial<ListingFormVideo>) => setS((cur) => ({ ...cur, videos: cur.videos.map((x) => (x.key === key ? { ...x, ...p } : x)) }));

  const upload = async (key: string, uri: string) => {
    patch(key, { failed: false });
    setSent((cur) => ({ ...cur, [key]: 0 }));
    try {
      const v = await uploadVideoRequest(uri, videoTypes.get(key) ?? 'video/mp4', (f) => setSent((cur) => ({ ...cur, [key]: f })));
      patch(key, { url: v.url, poster: v.poster, durationS: v.durationS });
    } catch (e) {
      patch(key, { failed: true });
      if (e instanceof ApiError && e.status === 400) toast.show({ title: e.message, tone: 'danger' });
    }
  };
  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      // iPhones film HEVC; this hands over H.264, which the server keeps as it is.
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (res.canceled || !res.assets.length) return;
    const ok: ImagePicker.ImagePickerAsset[] = [];
    for (const a of res.assets.slice(0, room)) {
      const problem = videoProblem({ type: typeOfVideo(a), bytes: a.fileSize ?? 0, durationS: a.duration ? a.duration / 1000 : undefined });
      if (!problem) ok.push(a);
      else
        toast.show({
          title:
            problem === 'long'
              ? t(m.admin.thatVideoIsLongerThan)
              : problem === 'size'
                ? t(m.admin.thatVideoIsOver150)
                : t(m.admin.aVideoMustBeAn),
          tone: 'danger',
        });
    }
    const added: ListingFormVideo[] = ok.map((a) => ({ key: `v${++photoKey}`, local: a.uri, durationS: a.duration ? Math.round(a.duration / 1000) : undefined }));
    ok.forEach((a, i) => videoTypes.set(added[i]!.key, typeOfVideo(a)));
    if (!added.length) return;
    setS((cur) => ({ ...cur, videos: [...cur.videos, ...added] }));
    // One at a time: the server converts them one at a time anyway.
    for (const v of added) await upload(v.key, v.local!);
  };
  const remove = (key: string) => setS((cur) => ({ ...cur, videos: cur.videos.filter((v) => v.key !== key) }));
  const move = (i: number, by: -1 | 1) =>
    setS((cur) => {
      const videos = [...cur.videos];
      const [v] = videos.splice(i, 1);
      videos.splice(i + by, 0, v!);
      return { ...cur, videos };
    });

  return (
    <>
      <Txt size={13} color="ink2">
        {t(
          m.admin.optionalUpTo5Videos,
        )}
      </Txt>
      {room > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(m.admin.addVideos)}
          onPress={() => void pick()}
          style={({ pressed }) => [styles.add, { borderColor: colors.accent, backgroundColor: colors.accentSoft, opacity: pressed ? 0.8 : 1 }]}
        >
          <Clapperboard size={22} color={colors.accentInk} />
          <Txt weight="medium" style={{ color: colors.accentInk }}>
            {t(m.admin.addVideosUpTo(room))}
          </Txt>
        </Pressable>
      ) : null}
      {err('videos') ? (
        <Txt size={12} color="danger">
          {err('videos')}
        </Txt>
      ) : null}
      <View style={styles.grid}>
        {s.videos.map((v, i) => {
          const n = i + 1;
          const progress = sent[v.key];
          return (
            <View key={v.key} testID="form-video" style={[styles.tile, styles.videoTile, { backgroundColor: colors.navy, borderColor: colors.line }]}>
              {v.poster ? <Image source={{ uri: mediaUrl(v.poster)! }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Film size={28} color="rgba(255,255,255,0.6)" />}
              {v.url ? (
                <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
                  <View style={styles.play}>
                    <Play size={16} color="#fff" fill="#fff" />
                  </View>
                </View>
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.veil, styles.videoState]}>
                  {v.failed ? (
                    v.local ? (
                      <IconButton label={t(m.admin.retryTheUpload)} icon={<RotateCcw size={18} color={colors.ink} />} onPress={() => void upload(v.key, v.local!)} />
                    ) : null
                  ) : (
                    <>
                      <ActivityIndicator color="#fff" />
                      <Txt size={11} weight="medium" style={styles.white}>
                        {progress !== undefined && progress < 1 ? `${fmtNum(Math.round(progress * 100), lang)}%` : t(m.admin.preparing)}
                      </Txt>
                    </>
                  )}
                </View>
              )}
              {v.durationS ? (
                <View style={styles.duration}>
                  <Txt size={11} weight="medium" style={styles.white}>
                    {fmtDuration(v.durationS, lang)}
                  </Txt>
                </View>
              ) : null}
              <View style={styles.tileActions}>
                {i > 0 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t(m.admin.moveVideoEarlier(n))} onPress={() => move(i, -1)} style={[styles.mini, { backgroundColor: colors.surface }]}>
                    <ArrowUp size={14} color={colors.ink} />
                  </Pressable>
                ) : null}
                {i < s.videos.length - 1 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t(m.admin.moveVideoLater(n))} onPress={() => move(i, 1)} style={[styles.mini, { backgroundColor: colors.surface }]}>
                    <ArrowDown size={14} color={colors.ink} />
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" accessibilityLabel={t(m.admin.removeVideo(n))} onPress={() => remove(v.key)} style={[styles.mini, { backgroundColor: colors.surface }]}>
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

/** The 360° tour (phase 21): one panorama per room, both names, in the order the tour opens them. Optional. */
function TourStep({
  s,
  setS,
  parts,
  setParts,
  err,
}: {
  s: ListingForm;
  setS: React.Dispatch<React.SetStateAction<ListingForm>>;
  parts: Record<string, PhotoPart>;
  setParts: React.Dispatch<React.SetStateAction<Record<string, PhotoPart>>>;
  err: StepProps['err'];
}) {
  const t = useT();
  const { colors } = useTheme();
  const patch = (key: string, p: Partial<ListingFormRoom>) => setS((cur) => ({ ...cur, tour: cur.tour.map((x) => (x.key === key ? { ...x, ...p } : x)) }));

  const upload = async (key: string, part: PhotoPart) => {
    patch(key, { failed: false });
    try {
      const { url } = await uploadPanoramaRequest(part);
      patch(key, { url });
    } catch {
      patch(key, { failed: true });
    }
  };
  const add = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 });
    const asset = res.canceled ? undefined : res.assets?.[0];
    if (!asset) return;
    const problem = panoramaProblem(asset.width, asset.height);
    if (problem) {
      return toast.show({
        title:
          problem === 'ratio'
            ? t(m.admin.thatIsNotA360)
            : t(m.admin.thatPhotoIsTooSmall),
        tone: 'danger',
      });
    }
    const part = await preparePanorama(asset).catch(() => null);
    if (!part) return toast.show({ title: t(m.admin.weCouldntPrepareThePhoto), tone: 'danger' });
    const room: ListingFormRoom = { key: `t${++photoKey}`, local: asset.uri, nameAr: '', nameEn: '' };
    setS((cur) => ({ ...cur, tour: [...cur.tour, room] }));
    setParts((cur) => ({ ...cur, [room.key]: part }));
    await upload(room.key, part);
  };
  const remove = (key: string) => {
    setS((cur) => ({ ...cur, tour: cur.tour.filter((r) => r.key !== key) }));
    setParts((cur) => {
      if (!(key in cur)) return cur;
      const next = { ...cur };
      delete next[key];
      return next;
    });
  };
  const move = (i: number, by: -1 | 1) =>
    setS((cur) => {
      const tour = [...cur.tour];
      const [r] = tour.splice(i, 1);
      tour.splice(i + by, 0, r!);
      return { ...cur, tour };
    });

  return (
    <>
      <Txt size={13} color="ink2">
        {t(
          m.admin.optionalOne360PhotoPer,
        )}
      </Txt>
      {s.tour.length < TOUR_ROOMS_MAX ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(m.admin.addARoom)}
          onPress={() => void add()}
          style={({ pressed }) => [styles.add, { borderColor: colors.accent, backgroundColor: colors.accentSoft, opacity: pressed ? 0.8 : 1 }]}
        >
          <Rotate3d size={22} color={colors.accentInk} />
          <Txt weight="medium" style={{ color: colors.accentInk }}>
            {t(m.admin.addRoomUpTo(TOUR_ROOMS_MAX))}
          </Txt>
        </Pressable>
      ) : null}
      {err('tour') ? (
        <Txt size={12} color="danger">
          {err('tour')}
        </Txt>
      ) : null}
      {s.tour.map((r, i) => {
        const uri = r.url ? mediaUrl(r.url)! : r.local!;
        const part = parts[r.key];
        const n = i + 1;
        return (
          <View key={r.key} testID="tour-room" style={[styles.roomCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={[styles.pano, { backgroundColor: colors.surface2 }]}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {!r.url ? (
                <View style={[StyleSheet.absoluteFill, styles.veil]}>
                  {r.failed ? (
                    part ? (
                      <IconButton label={t(m.common.retryTheUpload)} icon={<RotateCcw size={18} color={colors.ink} />} onPress={() => void upload(r.key, part)} />
                    ) : null
                  ) : (
                    <ActivityIndicator color="#fff" />
                  )}
                </View>
              ) : null}
              <View style={styles.tileActions}>
                {i > 0 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t(m.admin.moveRoomUp(n))} onPress={() => move(i, -1)} style={[styles.mini, { backgroundColor: colors.surface }]}>
                    <ArrowUp size={14} color={colors.ink} />
                  </Pressable>
                ) : null}
                {i < s.tour.length - 1 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t(m.admin.moveRoomDown(n))} onPress={() => move(i, 1)} style={[styles.mini, { backgroundColor: colors.surface }]}>
                    <ArrowDown size={14} color={colors.ink} />
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" accessibilityLabel={t(m.admin.removeRoom(n))} onPress={() => remove(r.key)} style={[styles.mini, { backgroundColor: colors.surface }]}>
                  <Trash2 size={14} color={colors.danger} />
                </Pressable>
              </View>
            </View>
            <TextField label={t(m.admin.roomNameAr(n))} value={r.nameAr} onChangeText={(v) => patch(r.key, { nameAr: v })} maxLength={80} />
            <TextField label={t(m.admin.roomNameEn(n))} value={r.nameEn} onChangeText={(v) => patch(r.key, { nameEn: v })} maxLength={80} />
          </View>
        );
      })}
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
    [0, t(m.common.type), `${t(CATEGORY_LABEL[s.category])} | ${s.type ? t(PROPERTY_TYPE_LABEL[s.type]) : '—'}`],
    [1, t(m.admin.location), `${area ? (pickField(area, 'name', lang)) : '—'}${(pickField(s, 'compound', lang)) ? ` | ${pickField(s, 'compound', lang)}` : ''}`],
    [1, t(m.admin.title), (pickField(s, 'title', lang)) || t(m.admin.theDefaultTitle)],
    [1, t(m.admin.owner), [s.ownerName, s.ownerPhone].filter(Boolean).join(' | ') || '—'],
    [2, t(m.common.price), price ? fmtMoney(price, lang, false) : '—'],
    [2, t(m.admin.details), t(m.admin.summaryFacts(s.beds || '—', s.baths || '—', s.sizeM2 || '—'))],
    [2, t(m.common.finishing), s.finishing ? t(FINISHING_LABEL[s.finishing]) : '—'],
    [2, t(m.common.amenities), joinParts(s.features.map((f) => t(FEATURE_LABEL[f])), lang) || '—'],
    [3, t(m.admin.photos), t(m.admin.photoCount(s.photos.filter((p) => p.url).length))],
    [4, t(m.admin.videos), s.videos.length ? t(m.common.videos(s.videos.length)) : t(m.common.none)],
    [5, t(m.common.n360Tour), s.tour.length ? t(m.admin.rooms(s.tour.length)) : t(m.common.none)],
  ];
  return (
    <>
      <Txt size={13} color="ink2">
        {t(m.admin.checkTheDetailsClientsSee)}
      </Txt>
      {errors.length ? (
        <View style={[styles.alert, { backgroundColor: colors.dangerSoft }]}>
          <Txt size={13} color="danger">
            {t(m.admin.someDetailsAreMissingTap)}
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
  veil: { backgroundColor: 'rgba(18, 28, 39, 0.45)', alignItems: 'center', justifyContent: 'center' },
  coverTag: { position: 'absolute', top: 6, start: 6, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  tileActions: { position: 'absolute', bottom: 6, end: 6, flexDirection: 'row', gap: 6 },
  mini: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  roomCard: { borderRadius: radius.lg, borderWidth: 1, padding: 12, gap: 10 },
  videoTile: { alignItems: 'center', justifyContent: 'center' },
  videoState: { gap: 6 },
  play: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  duration: { position: 'absolute', top: 6, start: 6, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.55)' },
  white: { color: '#fff' },
  pano: { width: '100%', aspectRatio: 2, borderRadius: radius.md, overflow: 'hidden' },
  alert: { borderRadius: radius.md, padding: 12 },
  card: { borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 4 },
  reviewRow: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  reviewLabel: { width: 84 },
});
