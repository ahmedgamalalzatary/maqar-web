import { CATEGORIES, type Category } from '@maqar/shared';
import { useLocalSearchParams } from 'expo-router';
import { ExploreScreen } from '@/features/listings/screens/explore-screen';

export default function ExploreRoute() {
  const { category, area } = useLocalSearchParams<{ category?: string; area?: string }>();
  const cat = CATEGORIES.includes(category as Category) ? (category as Category) : undefined;
  // A new key when Home sends other filters, so Explore starts again from them.
  return <ExploreScreen key={`${cat ?? ''}|${area ?? ''}`} category={cat} area={area || undefined} />;
}
