import type {
  AdminAgentDetail,
  AdminAgentItem,
  AdminAgentOption,
  AdminArea,
  AdminLeadItem,
  AdminListing,
  AdminListingsPage,
  AgentBody,
  AreaBody,
  DaysOffBody,
  DaysOffResult,
  HoursBody,
  ListingBody,
  PropertyStatus,
  UploadResponse,
} from '@maqar/shared';
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

export const getAdminAgents = (signal?: AbortSignal) => apiFetch<AdminAgentOption[]>('/admin/agents?active=true', { signal });

/** One photo, resized on the phone, to the listing photos folder. */
export function uploadPhotoRequest(photo: PhotoPart) {
  const form = new FormData();
  // Expo's FormData keeps the part as given; its fetch reads the name, type and bytes.
  form.append('photo', photo as unknown as Blob);
  return apiFetch<UploadResponse>('/uploads', { method: 'POST', body: form });
}

// ---- Admin tools (phase 18) ----

export const getAgents = (signal?: AbortSignal) => apiFetch<AdminAgentItem[]>('/admin/agents', { signal });

export const getAgent = (id: number, signal?: AbortSignal) => apiFetch<AdminAgentDetail>(`/admin/agents/${id}`, { signal });

export const createAgentRequest = (body: AgentBody) => apiFetch<AdminAgentDetail>('/admin/agents', { method: 'POST', body });

export const updateAgentRequest = (id: number, body: Partial<AgentBody>) => apiFetch<AdminAgentDetail>(`/admin/agents/${id}`, { method: 'PATCH', body });

export const setHoursRequest = (body: HoursBody) => apiFetch<void>('/admin/agents/hours', { method: 'PUT', body });

export const addDaysOffRequest = (body: DaysOffBody) => apiFetch<DaysOffResult>('/admin/agents/days-off', { method: 'POST', body });

export const removeDayOffRequest = (id: number, date: string) => apiFetch<void>(`/admin/agents/${id}/days-off/${date}`, { method: 'DELETE' });

export function getAdminLeads(agentId: number | undefined, signal?: AbortSignal) {
  return apiFetch<AdminLeadItem[]>(`/admin/leads${agentId ? `?agentId=${agentId}` : ''}`, { signal });
}

export const assignLeadRequest = (id: number, agentId: number) => apiFetch<AdminLeadItem>(`/admin/leads/${id}/assign`, { method: 'PATCH', body: { agentId } });

export const getAdminAreas = (signal?: AbortSignal) => apiFetch<AdminArea[]>('/admin/areas', { signal });

export const createAreaRequest = (body: AreaBody) => apiFetch<AdminArea>('/admin/areas', { method: 'POST', body });

export const updateAreaRequest = (id: string, body: Partial<AreaBody>) => apiFetch<AdminArea>(`/admin/areas/${id}`, { method: 'PATCH', body });

export const deleteAreaRequest = (id: string) => apiFetch<void>(`/admin/areas/${id}`, { method: 'DELETE' });
