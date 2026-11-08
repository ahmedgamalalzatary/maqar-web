import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { ApiError } from '@/core/api/api';
import { useT } from '@/core/i18n';
import { useDeleteAccount } from '../hooks/use-account';

/** Deleting the account needs the current password (contract §15 privacy). */
export function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const remove = useDeleteAccount();
  const [password, setPassword] = useState('');
  const wrong = remove.error instanceof ApiError && remove.error.status === 401;
  const close = () => {
    setPassword('');
    remove.reset();
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={t('تمسح حسابك؟', 'Delete your account?')}>
      <Txt color="ink2">
        {t(
          'هنمسح اسمك وإيميلك وبياناتك، ومش هتقدر ترجّع الحساب.',
          'Your name, email and details will be removed. This cannot be undone.',
        )}
      </Txt>
      <TextField
        label={t('كلمة السر', 'Password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        error={wrong ? t('كلمة السر غلط', 'Wrong password') : undefined}
      />
      {remove.isError && !wrong ? <Txt color="danger">{t('حصل خطأ، جرّب تاني', 'Something went wrong. Try again.')}</Txt> : null}
      <View style={styles.actions}>
        <Button
          label={t('امسح الحساب نهائيًا', 'Delete for good')}
          variant="danger"
          disabled={!password}
          loading={remove.isPending}
          onPress={() => remove.mutate(password)}
        />
        <Button label={t('إلغاء', 'Cancel')} variant="ghost" onPress={close} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({ actions: { gap: 8 } });
