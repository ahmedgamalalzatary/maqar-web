import { useLocalSearchParams } from 'expo-router';
import { ClientScreen } from '@/features/admin/screens/clients-screen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ClientScreen id={Number(id)} />;
}
