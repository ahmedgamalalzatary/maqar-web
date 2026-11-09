import { CATEGORIES, type Category, SORTS, type Sort } from '@maqar/shared';
import { useLocalSearchParams } from 'expo-router';
import { ExploreScreen } from '@/features/listings/screens/explore-screen';

export default function ExploreRoute() {
  const { category, area, sort } = useLocalSearchParams<{ category?: string; area?: string; sort?: string }>();
  const cat = CATEGORIES.includes(category as Category) ? (category as Category) : undefined;
  const order = SORTS.includes(sort as Sort) ? (sort as Sort) : undefined;
  // A new key when Home sends other filters, so Explore starts again from them.
  return <ExploreScreen key={`${cat ?? ''}|${area ?? ''}|${order ?? ''}`} category={cat} area={area || undefined} sort={order} />;
}
