import { useRouter } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Txt } from '@/components/text';
import { useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { useSession } from '@/features/auth/store/session.store';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { PropertyCardView } from '@/features/listings/components/property-card';
import { useSaved } from '../hooks/use-saved';

/** The Saved tab (contract §8.9), phase 7. Price alerts join it in phase 12. */
export function SavedScreen() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const saved = useSaved();
  const cards = saved.data ?? [];

  const empty = !signedIn ? (
    <Message
      title={t('سجّل دخولك عشان تحفظ', 'Sign in to save homes')}
      body={t('وحداتك المحفوظة بتفضل معاك على أي موبايل.', 'Your saved homes stay with you on any phone.')}
      action={t('تسجيل الدخول', 'Sign in')}
      onAction={() => router.push('/sign-in')}
    />
  ) : saved.isPending ? (
    <CardSkeleton />
  ) : saved.isError ? (
    <ListingsError onRetry={() => void saved.refetch()} />
  ) : (
    <Message
      title={t('لسه محفظتش حاجة', 'Nothing saved yet')}
      body={t('دوس على القلب في أي وحدة عشان ترجعلها بسهولة.', 'Tap the heart on any home to come back to it easily.')}
      action={t('استكشف', 'Explore')}
      onAction={() => router.push('/explore')}
    />
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      data={cards}
      keyExtractor={(c) => String(c.id)}
      renderItem={({ item }) => <PropertyCardView card={item} />}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListHeaderComponent={
        <Txt accessibilityRole="header" size={24} weight="semibold" style={styles.title}>
          {t('المحفوظة', 'Saved')}
        </Txt>
      }
      ListEmptyComponent={empty}
      refreshControl={
        signedIn ? (
          <RefreshControl refreshing={saved.isRefetching} onRefresh={() => void saved.refetch()} tintColor={colors.accent} />
        ) : undefined
      }
    />
  );
}

function Message({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.message}>
      <Heart size={32} color={colors.ink3} strokeWidth={1.6} />
      <Txt weight="medium" align="center">
        {title}
      </Txt>
      <Txt size={13} color="ink2" align="center">
        {body}
      </Txt>
      <Button label={action} variant="secondary" onPress={onAction} style={styles.action} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  title: { marginBottom: 16 },
  gap: { height: 24 },
  message: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  action: { marginTop: 8, paddingHorizontal: 24 },
});
