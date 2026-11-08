import { type Bi, localDigits } from '@maqar/shared';
import { StyleSheet, View } from 'react-native';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { useT } from '@/core/i18n';

/** A tab whose feature is built in a later phase (docs/phases.md). */
export function Placeholder({ title, phase }: { title: Bi; phase: number }) {
  const t = useT();
  return (
    <Screen title={t(title)}>
      <Card>
        <View style={styles.body}>
          <Txt color="ink2" align="center">
            {t(`الجزء ده هيتبني في المرحلة ${localDigits(String(phase), 'ar')}.`, `This part is built in phase ${phase}.`)}
          </Txt>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { paddingVertical: 24 } });
