import { LEAD_STAGES, type LeadStage } from '@maqar/shared';
import { useLocalSearchParams } from 'expo-router';
import { LeadsScreen } from '@/features/agent/screens/leads-screen';

export default function Route() {
  const { stage } = useLocalSearchParams<{ stage?: string }>();
  return <LeadsScreen stage={LEAD_STAGES.includes(stage as LeadStage) ? (stage as LeadStage) : undefined} />;
}
