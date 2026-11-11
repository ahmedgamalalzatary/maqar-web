import type { AdminListing, AgentBody, AreaBody, DaysOffBody, HoursBody, InsightRange, ListingBody } from '@maqar/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth/store/session.store';
import {
  addDaysOffRequest,
  assignLeadRequest,
  createAgentRequest,
  createAreaRequest,
  deleteAreaRequest,
  getAdminAreas,
  getAdminLeads,
  getAgent,
  getAgents,
  getInterested,
  getListingStats,
  removeDayOffRequest,
  setHoursRequest,
  updateAgentRequest,
  updateAreaRequest,
  closeRequest,
  createListingRequest,
  getAdminAgents,
  getAdminListing,
  getAdminListings,
  type ListingsQuery,
  publishRequest,
  unpublishRequest,
  updateListingRequest,
} from '../api/admin.api';

/** The signed-in admin's id. Keys the cache, so another account never sees it. */
const useAdminId = () => useSession((s) => (s.status === 'signedIn' && s.user?.role === 'admin' ? s.user.id : null));
const adminKey = (adminId: number | null) => ['admin', adminId];

export function useAdminListings(q: ListingsQuery) {
  const adminId = useAdminId();
  return useQuery({
    queryKey: [...adminKey(adminId), 'listings', q.status ?? 'all', q.q?.trim() ?? ''],
    queryFn: ({ signal }) => getAdminListings(q, signal),
    enabled: adminId !== null,
    placeholderData: (prev) => prev,
  });
}

export function useAdminListing(id: number | undefined) {
  const adminId = useAdminId();
  return useQuery({
    queryKey: [...adminKey(adminId), 'listing', id],
    queryFn: ({ signal }) => getAdminListing(id!, signal),
    enabled: adminId !== null && id !== undefined,
  });
}

/** Phase 19: a listing's daily numbers for the last `days`, and its interested clients. */
export function useListingStats(id: number, days: InsightRange) {
  const adminId = useAdminId();
  return useQuery({
    queryKey: [...adminKey(adminId), 'listing', id, 'stats', days],
    queryFn: ({ signal }) => getListingStats(id, days, signal),
    enabled: adminId !== null,
    placeholderData: (prev) => prev,
  });
}

/** The interested clients, one page at a time, so a popular listing does not load every client. */
export function useInterested(id: number) {
  const adminId = useAdminId();
  return useInfiniteQuery({
    queryKey: [...adminKey(adminId), 'listing', id, 'interested'],
    queryFn: ({ signal, pageParam }) => getInterested(id, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.length < 20 ? undefined : all.length + 1),
    enabled: adminId !== null,
  });
}

export function useAdminAgents(enabled = true) {
  const adminId = useAdminId();
  return useQuery({ queryKey: [...adminKey(adminId), 'agents'], queryFn: ({ signal }) => getAdminAgents(signal), enabled: enabled && adminId !== null });
}

/** After any change: the listing shows its new state at once, and the lists and Explore catch up. */
function useSettle() {
  const adminId = useAdminId();
  const qc = useQueryClient();
  return (l: AdminListing) => {
    qc.setQueryData([...adminKey(adminId), 'listing', l.id], l);
    void qc.invalidateQueries({ queryKey: adminKey(adminId), predicate: (q) => q.queryKey[2] !== 'listing' });
    void qc.invalidateQueries({ queryKey: ['properties'] });
  };
}

export function useSaveListing(id?: number) {
  const settle = useSettle();
  return useMutation({
    mutationFn: (body: ListingBody) => (id ? updateListingRequest(id, body) : createListingRequest(body)),
    onSuccess: settle,
  });
}

export type ListingAction = { kind: 'publish'; agentId?: number } | { kind: 'unpublish' } | { kind: 'close' };

export function useListingAction(id: number) {
  const settle = useSettle();
  return useMutation({
    mutationFn: (a: ListingAction) => (a.kind === 'publish' ? publishRequest(id, a.agentId) : a.kind === 'unpublish' ? unpublishRequest(id) : closeRequest(id)),
    onSuccess: settle,
  });
}

/** Publishes a listing just saved by the form, with the least busy advisor. */
export function usePublishListing() {
  const settle = useSettle();
  return useMutation({ mutationFn: (id: number) => publishRequest(id), onSuccess: settle });
}

// ---- Admin tools (phase 18) ----

/** After a change to agents, leads or areas: everything the admin sees refetches. */
function useRefresh() {
  const adminId = useAdminId();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: adminKey(adminId) });
    void qc.invalidateQueries({ queryKey: ['areas'] });
    void qc.invalidateQueries({ queryKey: ['properties'] });
  };
}

export function useAgents() {
  const adminId = useAdminId();
  return useQuery({ queryKey: [...adminKey(adminId), 'agents-all'], queryFn: ({ signal }) => getAgents(signal), enabled: adminId !== null });
}

export function useAgent(id: number | undefined) {
  const adminId = useAdminId();
  return useQuery({ queryKey: [...adminKey(adminId), 'agent', id], queryFn: ({ signal }) => getAgent(id!, signal), enabled: adminId !== null && id !== undefined });
}

export function useSaveAgent(id?: number) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (body: Partial<AgentBody>) => (id ? updateAgentRequest(id, body) : createAgentRequest(body as AgentBody)), onSuccess: refresh });
}

export function useSetHours() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (body: HoursBody) => setHoursRequest(body), onSuccess: refresh });
}

export function useAddDaysOff() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (body: DaysOffBody) => addDaysOffRequest(body), onSuccess: refresh });
}

export function useRemoveDayOff(id: number) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (date: string) => removeDayOffRequest(id, date), onSuccess: refresh });
}

export function useAdminLeads(agentId: number | undefined) {
  const adminId = useAdminId();
  return useQuery({ queryKey: [...adminKey(adminId), 'leads', agentId ?? 'all'], queryFn: ({ signal }) => getAdminLeads(agentId, signal), enabled: adminId !== null });
}

export function useAssignLead() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: ({ id, agentId }: { id: number; agentId: number }) => assignLeadRequest(id, agentId), onSuccess: refresh });
}

export function useAdminAreas() {
  const adminId = useAdminId();
  return useQuery({ queryKey: [...adminKey(adminId), 'areas'], queryFn: ({ signal }) => getAdminAreas(signal), enabled: adminId !== null });
}

export function useSaveArea(id?: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (body: AreaBody) => (id ? updateAreaRequest(id, body) : createAreaRequest(body)), onSuccess: refresh });
}

export function useDeleteArea() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (id: string) => deleteAreaRequest(id), onSuccess: refresh });
}

/** Featured on Home, or a different advisor, from the listing page. */
export function usePatchListing(id: number) {
  const settle = useSettle();
  return useMutation({ mutationFn: (body: { featured?: boolean; agentId?: number }) => updateListingRequest(id, body), onSuccess: settle });
}
