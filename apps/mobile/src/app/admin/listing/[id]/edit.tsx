import { useLocalSearchParams } from 'expo-router';
import { ListingFormScreen } from '@/features/admin/screens/listing-form-screen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ListingFormScreen id={Number(id)} />;
}
