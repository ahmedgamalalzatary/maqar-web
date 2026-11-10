import type { AdminAgentOption, AdminListing, AdminListingsPage, ListingBody, PropertyStatus, UploadResponse } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';
import type { PhotoPart } from '@/features/chat/photos';

export type ListingsQuery = { status?: PropertyStatus; q?: string };

export function getAdminListings({ status, q }: ListingsQuery, signal?: AbortSignal) {
  const qs = new URLSearchParams({ limit: '100' });
  if (status) qs.set('status', status);
  if (q?.trim()) qs.set('q', q.trim());
  return apiFetch<AdminListingsPage>(`/admin/listings?${qs}`, { signal });
}

export const getAdminListing = (id: number, signal?: AbortSignal) => apiFetch<AdminListing>(`/admin/listings/${id}`, { signal });

export const createListingRequest = (body: ListingBody) => apiFetch<AdminListing>('/admin/listings', { method: 'POST', body });

export const updateListingRequest = (id: number, body: Partial<ListingBody>) =>
  apiFetch<AdminListing>(`/admin/listings/${id}`, { method: 'PATCH', body });

export const publishRequest = (id: number, agentId?: number) =>
  apiFetch<AdminListing>(`/admin/listings/${id}/publish`, { method: 'POST', body: agentId ? { agentId } : {} });

export const unpublishRequest = (id: number) => apiFetch<AdminListing>(`/admin/listings/${id}/unpublish`, { method: 'POST', body: {} });

export const closeRequest = (id: number) => apiFetch<AdminListing>(`/admin/listings/${id}/close`, { method: 'POST', body: {} });

export const getAdminAgents = (signal?: AbortSignal) => apiFetch<AdminAgentOption[]>('/admin/agents', { signal });

/** One photo, resized on the phone, to the listing photos folder. */
export function uploadPhotoRequest(photo: PhotoPart) {
  const form = new FormData();
  // Expo's FormData keeps the part as given; its fetch reads the name, type and bytes.
  form.append('photo', photo as unknown as Blob);
  return apiFetch<UploadResponse>('/uploads', { method: 'POST', body: form });
}
