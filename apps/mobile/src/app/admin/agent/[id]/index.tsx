import { useLocalSearchParams } from 'expo-router';
import { AgentScreen } from '@/features/admin/screens/agent-screen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AgentScreen id={Number(id)} />;
}
