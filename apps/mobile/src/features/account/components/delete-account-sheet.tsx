import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { ApiError } from '@/core/api/api';
import { m, useT } from '@/core/i18n';
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
    <Sheet open={open} onClose={close} title={t(m.account.deleteYourAccount)}>
      <Txt color="ink2">
        {t(
          m.account.yourNameEmailAndDetails,
        )}
      </Txt>
      <TextField
        label={t(m.common.password)}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        error={wrong ? t(m.account.wrongPassword) : undefined}
      />
      {remove.isError && !wrong ? <Txt color="danger">{t(m.account.somethingWentWrongTryAgain)}</Txt> : null}
      <View style={styles.actions}>
        <Button
          label={t(m.account.deleteForGood)}
          variant="danger"
          disabled={!password}
          loading={remove.isPending}
          onPress={() => remove.mutate(password)}
        />
        <Button label={t(m.common.cancel)} variant="ghost" onPress={close} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({ actions: { gap: 8 } });
