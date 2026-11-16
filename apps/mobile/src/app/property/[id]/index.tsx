import { useLocalSearchParams } from 'expo-router';
import { CardGrow } from '@/features/property/components/card-grow';
import { PropertyScreen } from '@/features/property/screens/property-screen';

/** Outside the tab group, so the tab bar is hidden on the property page. It grows out of the card tapped. */
export default function PropertyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const n = Number(id);
  const valid = Number.isInteger(n) && n > 0 ? n : 0;
  // A bad id gets the "not available" state from the API (400 or 404).
  return (
    <CardGrow key={id} id={valid}>
      <PropertyScreen id={valid} />
    </CardGrow>
  );
}
