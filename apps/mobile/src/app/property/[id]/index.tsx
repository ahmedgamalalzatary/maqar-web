import { useLocalSearchParams } from 'expo-router';
import { PropertyScreen } from '@/features/property/screens/property-screen';

/** Outside the tab group, so the tab bar is hidden on the property page. */
export default function PropertyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const n = Number(id);
  // A bad id gets the "not available" state from the API (400 or 404).
  return <PropertyScreen key={id} id={Number.isInteger(n) && n > 0 ? n : 0} />;
}
