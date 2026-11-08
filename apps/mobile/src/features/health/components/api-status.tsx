import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Txt } from '@/components/text';
import { useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { useHealth } from '../hooks/use-health';

/** Shows whether the app can reach the API and its database. */
export function ApiStatus() {
  const t = useT();
  const { colors } = useTheme();
  const health = useHealth();

  if (health.isPending) {
    return (
      <Card style={styles.row}>
        <ActivityIndicator color={colors.accent} />
        <Txt color="ink2">{t('بنتأكد من الاتصال…', 'Checking the connection…')}</Txt>
      </Card>
    );
  }

  if (health.isError) {
    return (
      <Card style={styles.gap}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: colors.danger }]} />
          <Txt weight="semibold">{t('مش قادرين نوصل للخادم', "Can't reach the server")}</Txt>
        </View>
        <Txt size={13} color="ink2">
          {t(
            'اتأكد إن الـ API شغال وإنك على نفس الشبكة.',
            'Check that the API is running and that you are on the same network.',
          )}
        </Txt>
        <Button
          label={t('حاول تاني', 'Try again')}
          variant="secondary"
          loading={health.isFetching}
          onPress={() => health.refetch()}
        />
      </Card>
    );
  }

  return (
    <Card style={styles.row}>
      <View style={[styles.dot, { backgroundColor: colors.success }]} />
      <Txt weight="semibold">{t('متصل بالخادم', 'Connected to the server')}</Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gap: { gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
