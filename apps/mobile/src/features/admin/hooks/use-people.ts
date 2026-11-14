import type { AdminAccountBody, AdminAccountUpdate, AdminViewingUpdate, ClientStatus, ClientUpdateBody, OverviewRange, ReportId, ReportOutcome, ReportQuery, ViewingWhen } from '@maqar/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAdminRequest,
  deleteClientRequest,
  getAdminChat,
  getAdminChatMessages,
  getAdminChats,
  getAdmins,
  getOpenReports,
  resolveReportRequest,
  unblockChatRequest,
  getAdminViewings,
  getOverview,
  getClient,
  getClients,
  getReport,
  updateAdminRequest,
  updateAdminViewingRequest,
  updateClientRequest,
} from '../api/admin.api';
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

/** Phase 23: every viewing, upcoming soonest first or past latest first. */
export function useAdminViewings(q: { when: ViewingWhen; q?: string }) {
  const adminId = useAdminId();
  return useInfiniteQuery({
    queryKey: [...adminKey(adminId), 'viewings', q.when, q.q?.trim() ?? ''],
    queryFn: ({ pageParam, signal }) => getAdminViewings({ ...q, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _all, lastPage) => (lastPage * last.limit < last.total ? lastPage + 1 : undefined),
    enabled: adminId !== null,
    placeholderData: (prev) => prev,
  });
}

export function useUpdateAdminViewing(id: number) {
  const refresh = useRefresh();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminViewingUpdate) => updateAdminViewingRequest(id, body),
    onSuccess: () => {
      refresh();
      void qc.invalidateQueries({ queryKey: ['slots'] });
    },
  });
}

/** Phase 24: every conversation, or those with open reports. */
export function useAdminChats(reported: boolean) {
  const adminId = useAdminId();
  return useInfiniteQuery({
    queryKey: [...adminKey(adminId), 'chats', reported],
    queryFn: ({ pageParam, signal }) => getAdminChats({ reported, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _all, lastPage) => (lastPage * last.limit < last.total ? lastPage + 1 : undefined),
    enabled: adminId !== null,
  });
}

export function useAdminChat(id: number) {
  const adminId = useAdminId();
  return useQuery({ queryKey: [...adminKey(adminId), 'chat', id], queryFn: ({ signal }) => getAdminChat(id, signal), enabled: adminId !== null });
}

/** The conversation's messages, read-only: the latest page first, older ones on demand. */
export function useAdminChatMessages(id: number) {
  const adminId = useAdminId();
  return useInfiniteQuery({
    queryKey: [...adminKey(adminId), 'chat', id, 'messages'],
    queryFn: ({ pageParam, signal }) => getAdminChatMessages(id, pageParam, signal),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.items[0]?.id : undefined),
    enabled: adminId !== null,
  });
}

/** Open reports: the More tab's badge. */
export function useOpenReports(enabled = true) {
  const adminId = useAdminId();
  return useQuery({ queryKey: [...adminKey(adminId), 'reports', 'open'], queryFn: ({ signal }) => getOpenReports(signal), enabled: enabled && adminId !== null });
}

export function useResolveReport() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: ({ id, outcome }: { id: number; outcome: ReportOutcome }) => resolveReportRequest(id, outcome), onSuccess: refresh });
}

export function useUnblockChat(id: number) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: () => unblockChatRequest(id), onSuccess: refresh });
}

/** Phase 25: the business at a glance for the last 7, 30 or 90 days. */
export function useOverview(days: OverviewRange) {
  const adminId = useAdminId();
  return useQuery({ queryKey: [...adminKey(adminId), 'overview', days], queryFn: ({ signal }) => getOverview(days, signal), enabled: adminId !== null, placeholderData: (prev) => prev });
}

/** One report (phase 27); the previous answer stays up while the next range or filter loads. */
export function useReport(id: ReportId, q: ReportQuery, enabled = true) {
  const adminId = useAdminId();
  return useQuery({
    queryKey: [...adminKey(adminId), 'report', id, q.from ?? '', q.to ?? '', q.agentId ?? '', q.areaId ?? '', q.category ?? ''],
    queryFn: ({ signal }) => getReport(id, q, signal),
    enabled: adminId !== null && enabled,
    placeholderData: (prev) => (prev?.id === id ? prev : undefined),
  });
}
