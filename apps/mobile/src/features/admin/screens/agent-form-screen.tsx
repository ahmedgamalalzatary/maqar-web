import { type AdminAgentDetail, type AgentBody, fmtNum, PROPERTY_STATUS_LABEL, readPhone, readWholeNumber } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, Search } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAvoiding } from '@/components/keyboard-avoiding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { ApiError } from '@/core/api/api';
import { useDir, useLang, useT } from '@/core/i18n';
import { fonts, radius, useTheme } from '@/core/theme';
import { useAgent, useAgentListingOptions, useAgents, useSaveAgent } from '../hooks/use-admin';

/** The colours an agent's avatar can take (the brand's, and the demo agents'). */
const COLOURS = ['#b38959', '#61766d', '#3d5a80', '#8c5e58', '#6b5b95', '#2f6f6a'];

type Draft = Record<'nameAr' | 'nameEn' | 'email' | 'password' | 'phone' | 'roleTitleAr' | 'roleTitleEn' | 'languagesAr' | 'languagesEn' | 'monthlyTarget', string> & { colour: string };
type Key = keyof Draft;

const draftOf = (a?: AdminAgentDetail): Draft => ({
  nameAr: a?.nameAr ?? '',
  nameEn: a?.nameEn ?? '',
  email: a?.email ?? '',
  password: '',
  phone: a?.phone ?? '',
  roleTitleAr: a?.roleTitleAr ?? 'مستشار مبيعات',
  roleTitleEn: a?.roleTitleEn ?? 'Sales advisor',
  languagesAr: a?.languagesAr ?? 'العربية، الإنجليزية',
  languagesEn: a?.languagesEn ?? 'Arabic, English',
  monthlyTarget: String(a?.monthlyTarget ?? 6),
  colour: a?.colour ?? COLOURS[0]!,
});

/** What is wrong with the form, field by field. A new agent needs a starting password. */
export function agentProblems(d: Draft, isNew: boolean): Key[] {
  const bad: Key[] = [];
  // The same bounds the API's DTO enforces, so local validation never passes what the server refuses.
  for (const k of ['nameAr', 'nameEn', 'roleTitleAr', 'roleTitleEn', 'languagesAr', 'languagesEn'] as const) {
    if (d[k].trim().length < 2 || d[k].trim().length > 100) bad.push(k);
  }
  if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) bad.push('email');
  if (isNew || d.password) {
    if (d.password.length < 8 || !/[A-Za-z]/.test(d.password) || !/\d/.test(d.password)) bad.push('password');
  }
  if (!readPhone(d.phone)) bad.push('phone');
  const target = readWholeNumber(d.monthlyTarget);
  if (target === undefined || target > 1000) bad.push('monthlyTarget');
  return bad;
}

/** `/admin/agent/new` and `/admin/agent/:id/edit`. */
export function AgentFormScreen({ id }: { id?: number }) {
  const t = useT();
  const agent = useAgent(id);
  const { colors } = useTheme();
  if (id !== undefined && !agent.data) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.bg }]}>
        {agent.isError ? (
          <Txt>{agent.error instanceof ApiError && agent.error.status === 404 ? t('المسؤول ده مش موجود.', 'This agent does not exist.') : t('مقدرناش نجيب المسؤول', 'We couldn’t load the agent')}</Txt>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  }
  return <Form key={id ?? 'new'} saved={agent.data} />;
}

function Form({ saved }: { saved?: AdminAgentDetail }) {
  const t = useT();
  const dir = useDir();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<Draft>(() => draftOf(saved));
  const [showErrors, setShowErrors] = useState(false);
  // Listings to give this agent on save (phase 29); the ones they already have stay ticked.
  const [picked, setPicked] = useState<number[]>([]);
  const save = useSaveAgent(saved?.id);
  const set = (k: Key, v: string) => setD((cur) => ({ ...cur, [k]: v }));
  const errors = showErrors ? agentProblems(d, !saved) : [];
  const err = (k: Key, msg: string) => (errors.includes(k) ? msg : undefined);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/admin/agents'));

  const submit = () => {
    if (agentProblems(d, !saved).length) return setShowErrors(true);
    const body: Partial<AgentBody> = {
      nameAr: d.nameAr.trim(),
      nameEn: d.nameEn.trim(),
      email: d.email.trim().toLowerCase(),
      phone: readPhone(d.phone)!,
      roleTitleAr: d.roleTitleAr.trim(),
      roleTitleEn: d.roleTitleEn.trim(),
      languagesAr: d.languagesAr.trim(),
      languagesEn: d.languagesEn.trim(),
      monthlyTarget: readWholeNumber(d.monthlyTarget)!,
      colour: d.colour,
      ...(d.password ? { password: d.password } : {}),
      ...(picked.length ? { listingIds: picked } : {}),
    };
    save.mutate(body, {
      onSuccess: (a) => {
        toast.show({ title: saved ? t('البيانات اتحفظت', 'Saved') : t('المسؤول اتضاف، ابعتله الإيميل وكلمة السر', 'Agent added: send them the email and password'), tone: 'sage' });
        if (saved) back();
        else router.replace(`/admin/agent/${a.id}`);
      },
      onError: (e) =>
        toast.show({
          title: e instanceof ApiError && e.status === 409 ? t('الإيميل ده عليه حساب', 'That email already has an account') : t('مقدرناش نحفظ، راجع البيانات', 'We couldn’t save; check the details'),
          tone: 'danger',
        }),
    });
  };

  return (
    <KeyboardAvoiding style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + 8, borderBottomColor: colors.line }]}>
        <IconButton label={t('رجوع', 'Back')} icon={<BackIcon size={20} color={colors.ink} />} onPress={back} />
        <Txt accessibilityRole="header" size={18} weight="semibold" style={styles.flex}>
          {saved ? t('عدّل المسؤول', 'Edit agent') : t('مسؤول جديد', 'New agent')}
        </Txt>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <TextField label={t('الاسم (عربي)', 'Name (Arabic)')} value={d.nameAr} onChangeText={(v) => set('nameAr', v)} error={err('nameAr', t('اكتب الاسم', 'Enter the name'))} />
        <TextField label={t('الاسم (إنجليزي)', 'Name (English)')} value={d.nameEn} onChangeText={(v) => set('nameEn', v)} error={err('nameEn', t('اكتب الاسم', 'Enter the name'))} />
        <TextField
          label={t('الإيميل (للدخول)', 'Email (to sign in)')}
          value={d.email}
          onChangeText={(v) => set('email', v)}
          keyboardType="email-address"
          autoCapitalize="none"
          error={err('email', t('إيميل مش صح', 'Not an email'))}
        />
        <TextField
          label={saved ? t('كلمة سر جديدة (اختياري)', 'New password (optional)') : t('كلمة سر البداية', 'Starting password')}
          value={d.password}
          onChangeText={(v) => set('password', v)}
          autoCapitalize="none"
          error={err('password', t('٨ حروف على الأقل، فيها حرف ورقم', 'At least 8 characters, with a letter and a digit'))}
        />
        {saved && d.password ? (
          <Txt size={12} color="ink3">
            {t('كلمة السر الجديدة بتعمل خروج للمسؤول من كل الأجهزة.', 'A new password signs the agent out everywhere.')}
          </Txt>
        ) : null}
        <TextField label={t('الموبايل', 'Phone')} value={d.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" error={err('phone', t('رقم موبايل بالأرقام', 'A phone number in digits'))} />
        <TextField label={t('المسمى (عربي)', 'Title (Arabic)')} value={d.roleTitleAr} onChangeText={(v) => set('roleTitleAr', v)} error={err('roleTitleAr', t('اكتب المسمى', 'Enter the title'))} />
        <TextField label={t('المسمى (إنجليزي)', 'Title (English)')} value={d.roleTitleEn} onChangeText={(v) => set('roleTitleEn', v)} error={err('roleTitleEn', t('اكتب المسمى', 'Enter the title'))} />
        <TextField label={t('اللغات (عربي)', 'Languages (Arabic)')} value={d.languagesAr} onChangeText={(v) => set('languagesAr', v)} error={err('languagesAr', t('اكتب اللغات', 'Enter the languages'))} />
        <TextField label={t('اللغات (إنجليزي)', 'Languages (English)')} value={d.languagesEn} onChangeText={(v) => set('languagesEn', v)} error={err('languagesEn', t('اكتب اللغات', 'Enter the languages'))} />
        <TextField
          label={t('الهدف في الشهر (صفقات)', 'Monthly target (deals)')}
          value={d.monthlyTarget}
          onChangeText={(v) => set('monthlyTarget', v)}
          keyboardType="number-pad"
          error={err('monthlyTarget', t('رقم', 'A number'))}
        />
        <View style={styles.group}>
          <Txt size={13} weight="medium" color="ink2">
            {t('اللون', 'Colour')}
          </Txt>
          <View style={styles.colours}>
            {COLOURS.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityState={{ checked: d.colour === c }}
                accessibilityLabel={t(`اللون ${c}`, `Colour ${c}`)}
                onPress={() => set('colour', c)}
                style={[styles.swatch, { backgroundColor: c, borderColor: d.colour === c ? colors.ink : 'transparent' }]}
              >
                {d.colour === c ? <Check size={16} color="#fff" /> : null}
              </Pressable>
            ))}
          </View>
        </View>
        <ListingsPicker agentId={saved?.id} off={saved ? !saved.active : false} picked={picked} onChange={setPicked} />
        <Button label={saved ? t('احفظ', 'Save') : t('أضف المسؤول', 'Add the agent')} loading={save.isPending} onPress={submit} />
      </ScrollView>
    </KeyboardAvoiding>
  );
}

/**
 * The listings this agent is the advisor of (phase 29): tick more to give them on save. A listing
 * always has an advisor, so one is taken away by giving it to someone else.
 */
function ListingsPicker({ agentId, off, picked, onChange }: { agentId?: number; off: boolean; picked: number[]; onChange: (ids: number[]) => void }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const options = useAgentListingOptions();
  const agents = useAgents();
  const [q, setQ] = useState('');
  const nameOf = (id: number | null) => {
    const a = agents.data?.find((x) => x.id === id);
    return a ? t(`مع ${a.nameAr}`, `with ${a.nameEn}`) : t('من غير مسؤول', 'no advisor');
  };
  const words = q.trim().toLowerCase();
  const all = options.data ?? [];
  const shown = words ? all.filter((o) => `${o.titleAr} ${o.titleEn}`.toLowerCase().includes(words)) : all;
  const mine = all.filter((o) => agentId !== undefined && o.agentId === agentId).length;
  const toggle = (id: number) => onChange(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);

  return (
    <View style={styles.group}>
      <Txt accessibilityRole="header" size={15} weight="semibold">
        {`${t('العقارات اللي معاه', 'Their listings')} (${fmtNum(mine + picked.length, lang)})`}
      </Txt>
      <Txt size={12} color="ink2">
        {off
          ? t('المسؤول موقوف: شغّله الأول عشان تديله عقارات.', 'This agent is turned off: turn them on before giving them listings.')
          : t('علّم على العقارات اللي عايز تديها له. عشان تشيل عقار منه، اديه لمسؤول تاني.', 'Tick the listings to give them. To take one away, give it to another agent.')}
      </Txt>
      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Search size={16} color={colors.ink3} />
        <TextInput
          accessibilityLabel={t('ابحث باسم العقار', 'Search by listing title')}
          value={q}
          onChangeText={setQ}
          placeholder={t('ابحث باسم العقار', 'Search by listing title')}
          placeholderTextColor={colors.ink3}
          autoCorrect={false}
          autoCapitalize="none"
          style={[styles.input, { color: colors.ink }]}
        />
      </View>
      {options.isPending ? (
        <ActivityIndicator color={colors.accent} />
      ) : options.isError ? (
        <Txt size={12} color="danger">
          {t('مقدرناش نجيب العقارات', 'We couldn’t load the listings')}
        </Txt>
      ) : !shown.length ? (
        <Txt size={12} color="ink3">
          {t('مفيش عقارات هنا', 'No listings here')}
        </Txt>
      ) : (
        <View style={[styles.listings, { borderColor: colors.line }]}>
          {shown.map((o, i) => {
            const theirs = agentId !== undefined && o.agentId === agentId;
            const on = theirs || picked.includes(o.id);
            const title = lang === 'ar' ? o.titleAr : o.titleEn;
            const sub = `${t(PROPERTY_STATUS_LABEL[o.status])}${t('،', ',')} ${theirs ? t('معاه', 'theirs') : nameOf(o.agentId)}`;
            return (
              <Pressable
                key={o.id}
                accessibilityRole="checkbox"
                accessibilityLabel={`${title}${t('،', ',')} ${sub}`}
                accessibilityState={{ checked: on, disabled: theirs || off }}
                disabled={theirs || off}
                onPress={() => toggle(o.id)}
                style={[styles.listing, { borderTopColor: colors.line, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, opacity: off ? 0.5 : 1 }]}
              >
                <View style={[styles.box, { borderColor: on ? colors.accent : colors.line2, backgroundColor: on ? colors.accent : 'transparent', opacity: theirs ? 0.6 : 1 }]}>
                  {on ? <Check size={14} color="#fff" /> : null}
                </View>
                <View style={styles.flex}>
                  <Txt size={13.5} weight="medium" numberOfLines={1}>
                    {title}
                  </Txt>
                  <Txt size={11.5} color="ink3" numberOfLines={1}>
                    {sub}
                  </Txt>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 12 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 14, paddingVertical: 0 },
  listings: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  listing: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 12, paddingVertical: 8 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1 },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  content: { padding: 16, gap: 14 },
  group: { gap: 8 },
  colours: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
