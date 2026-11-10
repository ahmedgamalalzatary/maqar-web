import { useLocalSearchParams } from 'expo-router';
import { LeadScreen } from '@/features/agent/screens/lead-screen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LeadScreen id={Number(id)} />;
}
