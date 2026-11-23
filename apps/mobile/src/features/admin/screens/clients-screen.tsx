import { pickField, joinParts, type AdminClientDetail, type AdminClientItem, CLIENT_STATUSES, type ClientStatus, fmtDate, fmtNum, LEAD_STAGE_LABEL, ltrPhone, VIEWING_STATUS_LABEL } from '@mqr/shared';
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
import { m, useDir, useLang, useT } from '@/core/i18n';
import { fonts, radius, useTheme } from '@/core/theme';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { useDebounced } from '@/features/listings/hooks/use-listings';
import { useClient, useClients, useDeleteClient, useUpdateClient } from '../hooks/use-people';

type Filter = ClientStatus | 'all';

const STATUS_LABEL: Record<ClientStatus, { ar: string; en: string }> = {
  active: m.admin.active,
  suspended: m.admin.suspended,
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
      <IconButton label={t(m.common.back)} icon={<BackIcon size={20} color={colors.ink} />} onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))} />
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
              {t(m.common.clientAccounts)}
            </Txt>
            <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <Search size={18} color={colors.ink3} />
              <TextInput
                accessibilityLabel={t(m.common.searchByNameEmailOr)}
                value={q}
                onChangeText={setQ}
                placeholder={t(m.common.searchByNameEmailOr)}
                placeholderTextColor={colors.ink3}
                autoCorrect={false}
                autoCapitalize="none"
                style={[styles.input, { color: colors.ink }]}
              />
              {q ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t(m.common.clearSearch)} onPress={() => setQ('')} hitSlop={8}>
                  <X size={16} color={colors.ink3} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {(['all', ...CLIENT_STATUSES] as Filter[]).map((s) => {
                const on = filter === s;
                const label = s === 'all' ? t(m.common.all) : t(STATUS_LABEL[s]);
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="radio"
                    accessibilityLabel={joinParts([label, fmtNum(count(s), lang)], lang)}
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
                {t(m.admin.noClientsHere)}
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
          {t(m.admin.clientStats(c.saved, c.viewings, c.chats, c.createdAt.slice(0, 10)))}
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
            <Txt align="center">{t(m.admin.thisClientDoesNotExist)}</Txt>
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
  const title = (h: { titleAr: string; titleEn: string }) => (pickField(h, 'title', lang));
  const agentName = (a: { nameAr: string; nameEn: string }) => (pickField(a, 'name', lang));
  const failed = () => toast.show({ title: t(m.common.somethingWentWrongTryAgain), tone: 'danger' });

  const suspend = () =>
    Alert.alert(
      t(m.admin.suspendTheAccount),
      t(m.admin.theClientIsSignedOut),
      [
        { text: t(m.common.no), style: 'cancel' },
        {
          text: t(m.common.suspend),
          style: 'destructive',
          onPress: () =>
            update.mutate(
              { suspended: true },
              {
                onSuccess: (r) =>
                  toast.show({
                    title: t(m.common.accountSuspended),
                    body: r.cancelledViewings ? t(m.admin.viewingsCancelled(r.cancelledViewings)) : undefined,
                    tone: 'sage',
                  }),
                onError: failed,
              },
            ),
        },
      ],
    );
  const restore = () => update.mutate({ suspended: false }, { onSuccess: () => toast.show({ title: t(m.common.accountRestored), tone: 'sage' }), onError: failed });
  const del = () =>
    Alert.alert(t(m.admin.deleteTheAccount), t(m.admin.asIfTheClientDeleted), [
      { text: t(m.common.no), style: 'cancel' },
      {
        text: t(m.common.delete),
        style: 'destructive',
        onPress: () =>
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.show({ title: t(m.admin.accountDeleted), tone: 'sage' });
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
          {c.phone ? <IconButton label={t(m.common.call)} icon={<Phone size={18} color={colors.ink} />} onPress={() => void Linking.openURL(`tel:${c.phone}`)} /> : null}
        </View>
        <Txt size={12} color="ink3">
          {t(m.admin.sinceLastSeen(c.createdAt.slice(0, 10), c.lastSeenAt?.slice(0, 10)))}
        </Txt>
        <Txt size={12} color="ink3">
          {t(m.admin.savedHomes(c.saved))}
        </Txt>
      </View>

      <Section title={t(m.common.viewings)} empty={t(m.admin.noViewings)}>
        {c.recentViewings.map((v) => (
          <View key={v.id} style={[styles.item, { borderColor: colors.line }]}>
            <Txt size={14}>{title(v.property)}</Txt>
            <Txt size={12} color="ink2">
              {`${fmtDate(v.startsAt.slice(0, 10), lang, 'weekday')} | ${agentName(v.agent)} | ${t(VIEWING_STATUS[v.status])}`}
            </Txt>
          </View>
        ))}
      </Section>
      <Section title={t(m.common.chats)} empty={t(m.admin.noChats2)}>
        {c.threads.map((th) => (
          <View key={th.id} style={[styles.item, { borderColor: colors.line }]}>
            <Txt size={14}>{title(th.property)}</Txt>
            <Txt size={12} color="ink2">
              {`${agentName(th.agent)} | ${t(m.common.messageCount(th.messages))}`}
            </Txt>
          </View>
        ))}
      </Section>
      <Section title={t(m.admin.withAdvisors)} empty={t(m.admin.none)}>
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
        <Button label={t(m.admin.setANewPassword)} variant="secondary" onPress={() => setResetting(true)} />
        {c.suspendedAt ? (
          <Button label={t(m.admin.restoreTheAccount)} loading={update.isPending} onPress={restore} />
        ) : (
          <Button label={t(m.admin.suspendTheAccount2)} variant="secondary" loading={update.isPending} onPress={suspend} />
        )}
        <Button label={t(m.admin.deleteTheAccount2)} variant="ghost" loading={remove.isPending} onPress={del} />
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
                toast.show({ title: t(m.common.passwordChanged), body: t(m.admin.passItOnToThe), tone: 'sage' });
              },
              onError: failed,
            },
          )
        }
      />
    </ScrollView>
  );
}

const VIEWING_STATUS = VIEWING_STATUS_LABEL;

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
    <Sheet open={open} onClose={onClose} title={t(m.admin.aNewPassword)}>
      <View style={styles.sheet}>
        <TextField
          label={t(m.common.password)}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          error={bad ? t(m.common.atLeast8CharactersWith) : undefined}
        />
        <Button
          label={t(m.common.save)}
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
