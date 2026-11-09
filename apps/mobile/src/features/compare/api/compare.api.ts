import type { PropertyDetail } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';

/** Both homes in one call, in the order asked. Unlike the property page, it counts no view. */
export const getCompare = (ids: number[], signal?: AbortSignal) =>
  apiFetch<PropertyDetail[]>(`/properties/compare?ids=${ids.join(',')}`, { signal });
