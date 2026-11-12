import { useRouter } from 'expo-router';
import { useState } from 'react';
import { readMobile } from '@maqar/shared';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { errorText } from '@/core/api/error-text';
import { useT } from '@/core/i18n';
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
          toast.show({ title: t('اتحفظت بياناتك', 'Profile saved'), tone: 'sage' });
          router.back();
        },
      },
    );

  return (
    <Screen title={t('عدّل بياناتك', 'Edit profile')}>
      <TextField label={t('الاسم', 'Name')} value={name} onChangeText={setName} autoComplete="name" />
      <TextField
        label={t('رقم الموبايل', 'Mobile number')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="+20 100 000 0000"
      />
      {update.isError ? <Txt color="danger">{errorText(update.error, t)}</Txt> : null}
      {phone.trim() && !readMobile(phone) ? <Txt color="danger">{t('اكتب رقم موبايل صحيح', 'Enter a valid mobile number')}</Txt> : null}
      <Button
        label={t('احفظ', 'Save')}
        disabled={name.trim().length < 2 || (!!phone.trim() && !readMobile(phone))}
        loading={update.isPending}
        onPress={save}
      />
      <Button label={t('إلغاء', 'Cancel')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
