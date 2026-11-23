import { type Bi } from '@mqr/shared';
import { StyleSheet, View } from 'react-native';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { m, useT } from '@/core/i18n';

/** A tab whose feature is built in a later phase (docs/phases.md). */
export function Placeholder({ title, phase }: { title: Bi; phase: number }) {
  const t = useT();
  return (
    <Screen title={t(title)}>
      <Card>
        <View style={styles.body}>
          <Txt color="ink2" align="center">
            {t(m.common.placeholderPhase(phase))}
          </Txt>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { paddingVertical: 24 } });
