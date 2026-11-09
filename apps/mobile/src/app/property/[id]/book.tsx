import { useLocalSearchParams } from 'expo-router';
import { BookScreen } from '@/features/viewings/screens/book-screen';

export default function Route() {
  const { id, reschedule } = useLocalSearchParams<{ id: string; reschedule?: string }>();
  return <BookScreen id={Number(id)} reschedule={reschedule ? Number(reschedule) : undefined} />;
}
