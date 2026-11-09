import type { MatchCount, Prefs, PropertyCard } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';

export const savePrefsRequest = (prefs: Prefs) => apiFetch<Prefs>('/me/prefs', { method: 'PUT', body: prefs });

/** "Picked for you": the signed-in client's best matches, with reasons. */
export const getRecommended = (signal?: AbortSignal) => apiFetch<PropertyCard[]>('/properties/recommended', { signal });

/** The query for the onboarding count. Only what is set; lists are comma-separated. */
export function matchCountParams(p: Prefs): URLSearchParams {
  const q = new URLSearchParams({ purpose: p.purpose.join(','), budgetMax: String(p.budgetMax) });
  if (p.areas.length) q.set('area', p.areas.join(','));
  if (p.types.length) q.set('type', p.types.join(','));
  q.set('beds', String(p.beds));
  if (p.interests.length) q.set('interest', p.interests.join(','));
  return q;
}

/** How many homes fit these preferences 70% or more. */
export const getMatchCount = (p: Prefs, signal?: AbortSignal) =>
  apiFetch<MatchCount>(`/properties/match-count?${matchCountParams(p)}`, { signal });
