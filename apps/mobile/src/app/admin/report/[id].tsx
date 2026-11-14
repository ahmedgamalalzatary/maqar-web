import { REPORT_IDS, type ReportId } from '@maqar/shared';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Txt } from '@/components/text';
import { useT } from '@/core/i18n';
import { ReportScreen } from '@/features/admin/screens/reports-screen';

export default function Route() {
  const t = useT();
  const { id, agentId } = useLocalSearchParams<{ id: string; agentId?: string }>();
  const agent = Number(agentId);
  if (!(REPORT_IDS as readonly string[]).includes(id)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Txt align="center">{t('التقرير ده مش موجود.', 'There is no such report.')}</Txt>
      </View>
    );
  }
  return <ReportScreen key={`${id}-${agentId ?? ''}`} id={id as ReportId} agentId={Number.isInteger(agent) && agent > 0 ? agent : undefined} />;
}
