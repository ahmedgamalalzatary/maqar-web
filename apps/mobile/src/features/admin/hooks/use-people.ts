import type { AdminAccountBody, AdminAccountUpdate, ClientStatus, ClientUpdateBody } from '@maqar/shared';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { createAdminRequest, deleteClientRequest, getAdmins, getClient, getClients, updateAdminRequest, updateClientRequest } from '../api/admin.api';
import { adminKey, useAdminId, useRefresh } from './use-admin';

/** Phase 22: client accounts, newest first, by status and search words. */
export function useClients(q: { q?: string; status?: ClientStatus }) {
  const adminId = useAdminId();
  return useInfiniteQuery({
    queryKey: [...adminKey(adminId), 'clients', q.status ?? 'all', q.q?.trim() ?? ''],
    queryFn: ({ pageParam, signal }) => getClients({ ...q, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _all, lastPage) => (lastPage * last.limit < last.total ? lastPage + 1 : undefined),
    enabled: adminId !== null,
    placeholderData: (prev) => prev,
  });
}

export function useClient(id: number | undefined) {
  const adminId = useAdminId();
  return useQuery({ queryKey: [...adminKey(adminId), 'client', id], queryFn: ({ signal }) => getClient(id!, signal), enabled: adminId !== null && id !== undefined });
}

export function useUpdateClient(id: number) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (body: ClientUpdateBody) => updateClientRequest(id, body), onSuccess: refresh });
}

export function useDeleteClient(id: number) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: () => deleteClientRequest(id), onSuccess: refresh });
}

export function useAdmins() {
  const adminId = useAdminId();
  return useQuery({ queryKey: [...adminKey(adminId), 'admins'], queryFn: ({ signal }) => getAdmins(signal), enabled: adminId !== null });
}

export function useSaveAdmin(id?: number) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: AdminAccountUpdate) => (id ? updateAdminRequest(id, body) : createAdminRequest(body as AdminAccountBody)),
    onSuccess: refresh,
  });
}
