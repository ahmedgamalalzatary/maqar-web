import { type AdminClientDetail, type AdminClientItem, CLIENT_STATUSES, type ClientStatus, fmtDate, fmtNum, LEAD_STAGE_LABEL, ltrPhone } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Phone, Search, UsersRound, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { ApiError } from '@/core/api/api';
import { useDir, useLang, useT } from '@/core/i18n';
import { fonts, radius, useTheme } from '@/core/theme';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { useDebounced } from '@/features/listings/hooks/use-listings';
import { useClient, useClients, useDeleteClient, useUpdateClient } from '../hooks/use-people';

type Filter = ClientStatus | 'all';

const STATUS_LABEL: Record<ClientStatus, { ar: string; en: string }> = {
  active: { ar: 'شغال', en: 'Active' },
  suspended: { ar: 'موقوف', en: 'Suspended' },
};

/** A password the server takes: 8 or more, with a letter and a digit. */
const passwordOk = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

/** The back arrow at the top of a page opened from More. */
export function BackBar({ fallback }: { fallback: '/admin/more' | '/admin/clients' | '/admin/chats' | '/admin/reports' }) {
  const t = useT();
  const dir = useDir();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  return (
    <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
      <IconButton label={t('رجوع', 'Back')} icon={<BackIcon size={20} color={colors.ink} />} onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))} />
    </View>
  );
}

/** `/admin/clients` (phase 22): every client account, newest first, with search and status chips. */
export function ClientsScreen() {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const words = useDebounced(q, 300);
  const clients = useClients({ status: filter === 'all' ? undefined : filter, q: words });
  const items = clients.data?.pages.flatMap((p) => p.items) ?? [];
  const counts = clients.data?.pages[0]?.counts;
  const count = (s: Filter) => (counts ? (s === 'all' ? counts.active + counts.suspended : counts[s]) : 0);

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <BackBar fallback="/admin/more" />
      <FlatList
        testID="admin-clients"
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => <ClientRow c={item} />}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Txt accessibilityRole="header" size={24} weight="semibold">
              {t('حسابات العملاء', 'Client accounts')}
            </Txt>
            <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <Search size={18} color={colors.ink3} />
              <TextInput
                accessibilityLabel={t('ابحث بالاسم أو الإيميل أو الموبايل', 'Search by name, email or phone')}
                value={q}
                onChangeText={setQ}
                placeholder={t('ابحث بالاسم أو الإيميل أو الموبايل', 'Search by name, email or phone')}
                placeholderTextColor={colors.ink3}
                autoCorrect={false}
                autoCapitalize="none"
                style={[styles.input, { color: colors.ink }]}
              />
              {q ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t('امسح البحث', 'Clear search')} onPress={() => setQ('')} hitSlop={8}>
                  <X size={16} color={colors.ink3} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {(['all', ...CLIENT_STATUSES] as Filter[]).map((s) => {
                const on = filter === s;
                const label = s === 'all' ? t('الكل', 'All') : t(STATUS_LABEL[s]);
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="radio"
                    accessibilityLabel={`${label}، ${fmtNum(count(s), lang)}`}
                    accessibilityState={{ checked: on }}
                    onPress={() => setFilter(s)}
                    style={[styles.chip, { backgroundColor: on ? colors.ink : colors.surface, borderColor: colors.line }]}
                  >
                    <Txt size={13} weight="medium" style={{ color: on ? colors.bg : colors.ink }}>
                      {`${label} | ${fmtNum(count(s), lang)}`}
                    </Txt>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          clients.isPending ? (
            <CardSkeleton />
          ) : clients.isError ? (
            <ListingsError onRetry={() => void clients.refetch()} />
          ) : (
            <View style={styles.empty}>
              <UsersRound size={32} color={colors.ink3} strokeWidth={1.6} />
              <Txt weight="medium" align="center">
                {t('مفيش عملاء هنا', 'No clients here')}
              </Txt>
            </View>
          )
        }
        ListFooterComponent={clients.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={styles.empty} /> : undefined}
        onEndReached={() => {
          if (clients.hasNextPage && !clients.isFetchingNextPage) void clients.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={clients.isRefetching} onRefresh={() => void clients.refetch()} tintColor={colors.accent} />}
      />
    </View>
  );
}

function ClientRow({ c }: { c: AdminClientItem }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={c.name}
      onPress={() => router.push(`/admin/client/${c.id}`)}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.flex}>
        <View style={styles.line}>
          <Txt weight="medium" style={styles.flex} numberOfLines={1}>
            {c.name}
          </Txt>
          {c.suspendedAt ? (
            <View style={[styles.tag, { backgroundColor: colors.dangerSoft }]}>
              <Txt size={11} weight="medium" color="danger">
                {t(STATUS_LABEL.suspended)}
              </Txt>
            </View>
          ) : null}
        </View>
        <Txt size={12} color="ink2" numberOfLines={1}>
          {[c.email, c.phone ? ltrPhone(c.phone) : null].filter(Boolean).join(' | ')}
        </Txt>
        <Txt size={12} color="ink3">
          {t(
            `${fmtNum(c.saved, 'ar')} محفوظ | ${fmtNum(c.viewings, 'ar')} معاينة | ${fmtNum(c.chats, 'ar')} شات | من ${fmtDate(c.createdAt.slice(0, 10), 'ar')}`,
            `${c.saved} saved | ${c.viewings} viewings | ${c.chats} chats | since ${fmtDate(c.createdAt.slice(0, 10), lang)}`,
          )}
        </Txt>
      </View>
    </Pressable>
  );
}

/** `/admin/client/:id` (phase 22): the client's account, what they did, and the admin's actions. */
export function ClientScreen({ id }: { id: number }) {
  const t = useT();
  const { colors } = useTheme();
  const client = useClient(id);
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <BackBar fallback="/admin/clients" />
      {client.isPending ? (
        <ActivityIndicator style={styles.empty} color={colors.accent} />
      ) : client.isError ? (
        <View style={styles.pad}>
          {client.error instanceof ApiError && client.error.status === 404 ? (
            <Txt align="center">{t('العميل ده مش موجود.', 'This client does not exist.')}</Txt>
          ) : (
            <ListingsError onRetry={() => void client.refetch()} />
          )}
        </View>
      ) : (
        <ClientBody c={client.data} />
      )}
    </View>
  );
}

function ClientBody({ c }: { c: AdminClientDetail }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const update = useUpdateClient(c.id);
  const remove = useDeleteClient(c.id);
  const [resetting, setResetting] = useState(false);
  const title = (h: { titleAr: string; titleEn: string }) => (lang === 'ar' ? h.titleAr : h.titleEn);
  const agentName = (a: { nameAr: string; nameEn: string }) => (lang === 'ar' ? a.nameAr : a.nameEn);
  const failed = () => toast.show({ title: t('حصلت مشكلة، حاول تاني', 'Something went wrong, try again'), tone: 'danger' });

  const suspend = () =>
    Alert.alert(
      t('توقف الحساب؟', 'Suspend the account?'),
      t('العميل هيتعمله خروج ومش هيقدر يدخل، ومعايناته الجاية هتتلغي.', 'The client is signed out and cannot sign in, and their upcoming viewings are cancelled.'),
      [
        { text: t('لأ', 'No'), style: 'cancel' },
        {
          text: t('وقّف', 'Suspend'),
          style: 'destructive',
          onPress: () =>
            update.mutate(
              { suspended: true },
              {
                onSuccess: (r) =>
                  toast.show({
                    title: t('الحساب اتوقف', 'Account suspended'),
                    body: r.cancelledViewings ? t(`اتلغت ${fmtNum(r.cancelledViewings, 'ar')} معاينة`, `${r.cancelledViewings} upcoming viewings cancelled`) : undefined,
                    tone: 'sage',
                  }),
                onError: failed,
              },
            ),
        },
      ],
    );
  const restore = () => update.mutate({ suspended: false }, { onSuccess: () => toast.show({ title: t('الحساب رجع يشتغل', 'Account restored'), tone: 'sage' }), onError: failed });
  const del = () =>
    Alert.alert(t('تمسح الحساب؟', 'Delete the account?'), t('زي ما العميل يمسحه بنفسه: الشاتات والمحفوظات بتتمسح، ومينفعش ترجعه.', 'As if the client deleted it: their chats and saved homes go, and it cannot be undone.'), [
      { text: t('لأ', 'No'), style: 'cancel' },
      {
        text: t('امسح', 'Delete'),
        style: 'destructive',
        onPress: () =>
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.show({ title: t('الحساب اتمسح', 'Account deleted'), tone: 'sage' });
              if (router.canGoBack()) router.back();
              else router.replace('/admin/clients');
            },
            onError: failed,
          }),
      },
    ]);

  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.line}>
        <Txt accessibilityRole="header" size={22} weight="semibold" style={styles.flex}>
          {c.name}
        </Txt>
        {c.suspendedAt ? (
          <View style={[styles.tag, { backgroundColor: colors.dangerSoft }]}>
            <Txt size={12} weight="medium" color="danger">
              {t(STATUS_LABEL.suspended)}
            </Txt>
          </View>
        ) : null}
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={styles.line}>
          <View style={styles.flex}>
            <Txt size={13}>{c.email}</Txt>
            {c.phone ? (
              <Txt size={13} color="ink2">
                {ltrPhone(c.phone)}
              </Txt>
            ) : null}
          </View>
          {c.phone ? <IconButton label={t('اتصال', 'Call')} icon={<Phone size={18} color={colors.ink} />} onPress={() => void Linking.openURL(`tel:${c.phone}`)} /> : null}
        </View>
        <Txt size={12} color="ink3">
          {t(
            `من ${fmtDate(c.createdAt.slice(0, 10), 'ar')}${c.lastSeenAt ? ` | آخر ظهور ${fmtDate(c.lastSeenAt.slice(0, 10), 'ar')}` : ''}`,
            `Since ${fmtDate(c.createdAt.slice(0, 10), 'en')}${c.lastSeenAt ? ` | last seen ${fmtDate(c.lastSeenAt.slice(0, 10), 'en')}` : ''}`,
          )}
        </Txt>
        <Txt size={12} color="ink3">
          {t(`${fmtNum(c.saved, 'ar')} بيت محفوظ`, `${c.saved} saved homes`)}
        </Txt>
      </View>

      <Section title={t('المعاينات', 'Viewings')} empty={t('مفيش معاينات.', 'No viewings.')}>
        {c.recentViewings.map((v) => (
          <View key={v.id} style={[styles.item, { borderColor: colors.line }]}>
            <Txt size={14}>{title(v.property)}</Txt>
            <Txt size={12} color="ink2">
              {`${fmtDate(v.startsAt.slice(0, 10), lang, 'weekday')} | ${agentName(v.agent)} | ${t(VIEWING_STATUS[v.status])}`}
            </Txt>
          </View>
        ))}
      </Section>
      <Section title={t('الشاتات', 'Chats')} empty={t('مفيش شاتات.', 'No chats.')}>
        {c.threads.map((th) => (
          <View key={th.id} style={[styles.item, { borderColor: colors.line }]}>
            <Txt size={14}>{title(th.property)}</Txt>
            <Txt size={12} color="ink2">
              {t(`${agentName(th.agent)} | ${fmtNum(th.messages, 'ar')} رسالة`, `${agentName(th.agent)} | ${th.messages} messages`)}
            </Txt>
          </View>
        ))}
      </Section>
      <Section title={t('مع المسؤولين', 'With advisors')} empty={t('مفيش.', 'None.')}>
        {c.leadsList.map((l) => (
          <View key={l.id} style={[styles.item, { borderColor: colors.line }]}>
            <Txt size={14}>{agentName(l.agent)}</Txt>
            <Txt size={12} color="ink2">
              {`${t(LEAD_STAGE_LABEL[l.stage])}${l.property ? ` | ${title(l.property)}` : ''}`}
            </Txt>
          </View>
        ))}
      </Section>

      <View style={styles.actions}>
        <Button label={t('كلمة سر جديدة', 'Set a new password')} variant="secondary" onPress={() => setResetting(true)} />
        {c.suspendedAt ? (
          <Button label={t('رجّع الحساب', 'Restore the account')} loading={update.isPending} onPress={restore} />
        ) : (
          <Button label={t('وقّف الحساب', 'Suspend the account')} variant="secondary" loading={update.isPending} onPress={suspend} />
        )}
        <Button label={t('امسح الحساب', 'Delete the account')} variant="ghost" loading={remove.isPending} onPress={del} />
      </View>
      <PasswordSheet
        open={resetting}
        onClose={() => setResetting(false)}
        saving={update.isPending}
        onSave={(password) =>
          update.mutate(
            { password },
            {
              onSuccess: () => {
                setResetting(false);
                toast.show({ title: t('كلمة السر اتغيرت', 'Password changed'), body: t('ابعتها للعميل. اتعمله خروج من كل الأجهزة.', 'Pass it on to the client. They were signed out everywhere.'), tone: 'sage' });
              },
              onError: failed,
            },
          )
        }
      />
    </ScrollView>
  );
}

const VIEWING_STATUS = {
  confirmed: { ar: 'مؤكدة', en: 'Confirmed' },
  rescheduled: { ar: 'اتغير ميعادها', en: 'Rescheduled' },
  cancelled: { ar: 'اتلغت', en: 'Cancelled' },
  completed: { ar: 'خلصت', en: 'Completed' },
} as const;

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Txt size={16} weight="semibold">
        {title}
      </Txt>
      {children.length ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>{children}</View>
      ) : (
        <Txt size={13} color="ink3">
          {empty}
        </Txt>
      )}
    </View>
  );
}

/** A new password for an account, to pass on by hand (no email is sent). */
export function PasswordSheet({ open, onClose, onSave, saving }: { open: boolean; onClose: () => void; onSave: (password: string) => void; saving: boolean }) {
  const t = useT();
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const bad = tried && !passwordOk(password);
  return (
    <Sheet open={open} onClose={onClose} title={t('كلمة سر جديدة', 'A new password')}>
      <View style={styles.sheet}>
        <TextField
          label={t('كلمة السر', 'Password')}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          error={bad ? t('٨ حروف على الأقل، فيها حرف ورقم', 'At least 8 characters, with a letter and a digit') : undefined}
        />
        <Button
          label={t('احفظ', 'Save')}
          loading={saving}
          onPress={() => {
            setTried(true);
            if (passwordOk(password)) onSave(password);
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  top: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row' },
  pad: { padding: 24 },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  body: { paddingHorizontal: 16, gap: 18 },
  header: { gap: 14, marginBottom: 16 },
  gap: { height: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 14, paddingVertical: 0 },
  chips: { gap: 8 },
  chip: { height: 36, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, borderWidth: 1, padding: 14 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tag: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 8 },
  section: { gap: 8 },
  item: { gap: 2, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  actions: { gap: 10 },
  sheet: { gap: 12 },
});
