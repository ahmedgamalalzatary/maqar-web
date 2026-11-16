import { type AdminAccount, ltrPhone } from '@maqar/shared';
import { Plus, ShieldUser } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { ApiError } from '@/core/api/api';
import { m, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { ListingsError } from '@/features/listings/components/list-states';
import { useAdmins, useSaveAdmin } from '../hooks/use-people';
import { BackBar, PasswordSheet } from './clients-screen';

const passwordOk = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

/** `/admin/admins` (phase 22): the admin accounts. Add one, set a new password, suspend or restore. */
export function AdminsScreen() {
  const t = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const admins = useAdmins();
  const [adding, setAdding] = useState(false);
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <BackBar fallback="/admin/more" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.line}>
          <View style={styles.flex}>
            <Txt accessibilityRole="header" size={24} weight="semibold">
              {t(m.common.adminAccounts)}
            </Txt>
            <Txt size={13} color="ink2">
              {t(m.admin.youCannotSuspendYourOwn)}
            </Txt>
          </View>
          <IconButton icon={<Plus size={20} color={colors.ink} />} label={t(m.admin.addAnAdmin)} onPress={() => setAdding(true)} />
        </View>
        {admins.isPending ? (
          <ActivityIndicator color={colors.accent} />
        ) : admins.isError ? (
          <ListingsError onRetry={() => void admins.refetch()} />
        ) : (
          admins.data.map((a) => <AdminRow key={a.id} a={a} />)
        )}
      </ScrollView>
      <NewAdminSheet open={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

function AdminRow({ a }: { a: AdminAccount }) {
  const t = useT();
  const { colors } = useTheme();
  const save = useSaveAdmin(a.id);
  const [resetting, setResetting] = useState(false);
  const failed = () => toast.show({ title: t(m.common.somethingWentWrongTryAgain), tone: 'danger' });
  const suspend = () =>
    Alert.alert(t(m.admin.suspendThisAccount), t(m.admin.theyAreSignedOutAnd), [
      { text: t(m.common.no), style: 'cancel' },
      { text: t(m.common.suspend), style: 'destructive', onPress: () => save.mutate({ suspended: true }, { onSuccess: () => toast.show({ title: t(m.common.accountSuspended), tone: 'sage' }), onError: failed }) },
    ]);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.line}>
        <ShieldUser size={20} color={colors.accentInk} />
        <Txt weight="medium" style={styles.flex}>
          {a.you ? t(m.admin.nameYou(a.name)) : a.name}
        </Txt>
        {a.suspendedAt ? (
          <View style={[styles.tag, { backgroundColor: colors.dangerSoft }]}>
            <Txt size={11} weight="medium" color="danger">
              {t(m.admin.suspended)}
            </Txt>
          </View>
        ) : null}
      </View>
      <Txt size={13} color="ink2">
        {[a.email, a.phone ? ltrPhone(a.phone) : null].filter(Boolean).join(' | ')}
      </Txt>
      <Txt size={12} color="ink3">
        {a.lastSeenAt ? t(m.admin.lastSeen(a.lastSeenAt.slice(0, 10))) : t(m.admin.notSignedInYet)}
      </Txt>
      {a.you ? null : (
        <View style={styles.line}>
          <Button label={t(m.common.newPassword2)} variant="secondary" onPress={() => setResetting(true)} style={styles.flex} />
          {a.suspendedAt ? (
            <Button
              label={t(m.admin.restore)}
              loading={save.isPending}
              onPress={() => save.mutate({ suspended: false }, { onSuccess: () => toast.show({ title: t(m.common.accountRestored), tone: 'sage' }), onError: failed })}
              style={styles.flex}
            />
          ) : (
            <Button label={t(m.admin.suspend)} variant="secondary" loading={save.isPending} onPress={suspend} style={styles.flex} />
          )}
        </View>
      )}
      <PasswordSheet
        open={resetting}
        onClose={() => setResetting(false)}
        saving={save.isPending}
        onSave={(password) =>
          save.mutate(
            { password },
            {
              onSuccess: () => {
                setResetting(false);
                toast.show({ title: t(m.common.passwordChanged), tone: 'sage' });
              },
              onError: failed,
            },
          )
        }
      />
    </View>
  );
}

function NewAdminSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const save = useSaveAdmin();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const bad = {
    name: tried && name.trim().length < 2,
    email: tried && !/^\S+@\S+\.\S+$/.test(email.trim()),
    password: tried && !passwordOk(password),
  };
  const submit = () => {
    setTried(true);
    if (name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email.trim()) || !passwordOk(password)) return;
    save.mutate(
      { name: name.trim(), email: email.trim(), password },
      {
        onSuccess: () => {
          toast.show({ title: t(m.admin.adminAdded), body: t(m.admin.passOnTheEmailAnd), tone: 'sage' });
          setName('');
          setEmail('');
          setPassword('');
          setTried(false);
          onClose();
        },
        onError: (e) =>
          toast.show({
            title: e instanceof ApiError && e.status === 409 ? t(m.common.thatEmailAlreadyHasAn) : t(m.common.somethingWentWrongTryAgain),
            tone: 'danger',
          }),
      },
    );
  };
  return (
    <Sheet open={open} onClose={onClose} title={t(m.admin.aNewAdmin)}>
      <View style={styles.sheet}>
        <TextField label={t(m.common.name)} value={name} onChangeText={setName} error={bad.name ? t(m.common.enterTheName) : undefined} />
        <TextField
          label={t(m.common.email)}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          error={bad.email ? t(m.admin.aValidEmail) : undefined}
        />
        <TextField
          label={t(m.common.password)}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          error={bad.password ? t(m.common.atLeast8CharactersWith) : undefined}
        />
        <Button label={t(m.common.add)} loading={save.isPending} onPress={submit} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 8 },
  tag: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  sheet: { gap: 12 },
});
