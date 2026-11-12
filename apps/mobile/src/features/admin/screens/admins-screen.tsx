import { type AdminAccount, fmtDate, ltrPhone } from '@maqar/shared';
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
import { useLang, useT } from '@/core/i18n';
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
              {t('حسابات الإدارة', 'Admin accounts')}
            </Txt>
            <Txt size={13} color="ink2">
              {t('مينفعش توقف حسابك انت، فدايمًا فيه أدمن شغال.', 'You cannot suspend your own account, so one admin always stays active.')}
            </Txt>
          </View>
          <IconButton icon={<Plus size={20} color={colors.ink} />} label={t('أضف أدمن', 'Add an admin')} onPress={() => setAdding(true)} />
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
  const lang = useLang();
  const { colors } = useTheme();
  const save = useSaveAdmin(a.id);
  const [resetting, setResetting] = useState(false);
  const failed = () => toast.show({ title: t('حصلت مشكلة، حاول تاني', 'Something went wrong, try again'), tone: 'danger' });
  const suspend = () =>
    Alert.alert(t('توقف الحساب ده؟', 'Suspend this account?'), t('هيتعمله خروج ومش هيقدر يدخل لحد ما ترجّعه.', 'They are signed out and cannot sign in until it is restored.'), [
      { text: t('لأ', 'No'), style: 'cancel' },
      { text: t('وقّف', 'Suspend'), style: 'destructive', onPress: () => save.mutate({ suspended: true }, { onSuccess: () => toast.show({ title: t('الحساب اتوقف', 'Account suspended'), tone: 'sage' }), onError: failed }) },
    ]);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.line}>
        <ShieldUser size={20} color={colors.accentInk} />
        <Txt weight="medium" style={styles.flex}>
          {a.you ? t(`${a.name} (انت)`, `${a.name} (you)`) : a.name}
        </Txt>
        {a.suspendedAt ? (
          <View style={[styles.tag, { backgroundColor: colors.dangerSoft }]}>
            <Txt size={11} weight="medium" color="danger">
              {t('موقوف', 'Suspended')}
            </Txt>
          </View>
        ) : null}
      </View>
      <Txt size={13} color="ink2">
        {[a.email, a.phone ? ltrPhone(a.phone) : null].filter(Boolean).join(' | ')}
      </Txt>
      <Txt size={12} color="ink3">
        {a.lastSeenAt ? t(`آخر ظهور ${fmtDate(a.lastSeenAt.slice(0, 10), 'ar')}`, `Last seen ${fmtDate(a.lastSeenAt.slice(0, 10), lang)}`) : t('لسه مدخلش', 'Not signed in yet')}
      </Txt>
      {a.you ? null : (
        <View style={styles.line}>
          <Button label={t('كلمة سر جديدة', 'New password')} variant="secondary" onPress={() => setResetting(true)} style={styles.flex} />
          {a.suspendedAt ? (
            <Button
              label={t('رجّعه', 'Restore')}
              loading={save.isPending}
              onPress={() => save.mutate({ suspended: false }, { onSuccess: () => toast.show({ title: t('الحساب رجع يشتغل', 'Account restored'), tone: 'sage' }), onError: failed })}
              style={styles.flex}
            />
          ) : (
            <Button label={t('وقّفه', 'Suspend')} variant="secondary" loading={save.isPending} onPress={suspend} style={styles.flex} />
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
                toast.show({ title: t('كلمة السر اتغيرت', 'Password changed'), tone: 'sage' });
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
          toast.show({ title: t('الأدمن اتضاف', 'Admin added'), body: t('ابعتله الإيميل وكلمة السر.', 'Pass on the email and password.'), tone: 'sage' });
          setName('');
          setEmail('');
          setPassword('');
          setTried(false);
          onClose();
        },
        onError: (e) =>
          toast.show({
            title: e instanceof ApiError && e.status === 409 ? t('الإيميل ده عليه حساب', 'That email already has an account') : t('حصلت مشكلة، حاول تاني', 'Something went wrong, try again'),
            tone: 'danger',
          }),
      },
    );
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('أدمن جديد', 'A new admin')}>
      <View style={styles.sheet}>
        <TextField label={t('الاسم', 'Name')} value={name} onChangeText={setName} error={bad.name ? t('اكتب الاسم', 'Enter the name') : undefined} />
        <TextField
          label={t('الإيميل', 'Email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          error={bad.email ? t('إيميل صحيح', 'A valid email') : undefined}
        />
        <TextField
          label={t('كلمة السر', 'Password')}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          error={bad.password ? t('٨ حروف على الأقل، فيها حرف ورقم', 'At least 8 characters, with a letter and a digit') : undefined}
        />
        <Button label={t('أضف', 'Add')} loading={save.isPending} onPress={submit} />
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
