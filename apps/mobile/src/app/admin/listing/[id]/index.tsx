import { useLocalSearchParams } from 'expo-router';
import { AdminListingScreen } from '@/features/admin/screens/admin-listing-screen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AdminListingScreen id={Number(id)} />;
}
