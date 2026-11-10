import { useLocalSearchParams } from 'expo-router';
import { AreaFormScreen } from '@/features/admin/screens/areas-screen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AreaFormScreen id={id} />;
}
