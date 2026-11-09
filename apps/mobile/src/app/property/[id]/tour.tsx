import { useLocalSearchParams } from 'expo-router';
import { TourScreen } from '@/features/tour/screens/tour-screen';

/** The 360° tour, full screen above the property page. */
export default function TourRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const n = Number(id);
  return <TourScreen key={id} id={Number.isInteger(n) && n > 0 ? n : 0} />;
}
