import { useRouter } from 'expo-router';
import { useState } from 'react';
import { readMobile } from '@maqar/shared';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { errorText } from '@/core/api/error-text';
import { m, useT } from '@/core/i18n';
import { useSession } from '@/features/auth/store/session.store';
import { useUpdateMe } from '../hooks/use-account';

export function EditProfileScreen() {
  const t = useT();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const update = useUpdateMe();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  const save = () =>
    update.mutate(
      // Normalized the way the server takes phones (Arabic digits read, separators dropped), so a
      // formatted paste cannot pass the form and fail the API.
      { name: name.trim(), phone: phone.trim() ? (readMobile(phone) ?? null) : null },
      {
        onSuccess: () => {
          toast.show({ title: t(m.account.profileSaved), tone: 'sage' });
          router.back();
        },
      },
    );

  return (
    <Screen title={t(m.common.editProfile)}>
      <TextField label={t(m.common.name)} value={name} onChangeText={setName} autoComplete="name" />
      <TextField
        label={t(m.common.mobileNumber)}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="+20 100 000 0000"
      />
      {update.isError ? <Txt color="danger">{errorText(update.error, t)}</Txt> : null}
      {phone.trim() && !readMobile(phone) ? <Txt color="danger">{t(m.common.enterAValidMobileNumber)}</Txt> : null}
      <Button
        label={t(m.common.save)}
        disabled={name.trim().length < 2 || (!!phone.trim() && !readMobile(phone))}
        loading={update.isPending}
        onPress={save}
      />
      <Button label={t(m.common.cancel)} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
