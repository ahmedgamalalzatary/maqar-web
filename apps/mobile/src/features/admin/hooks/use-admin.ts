import type { AdminListing, ListingBody } from '@maqar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth/store/session.store';
import {
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
