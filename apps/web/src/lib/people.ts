"use client";

import type {
  AdminAccount,
  AdminAccountBody,
  AdminAccountUpdate,
  AdminClientDetail,
  AdminClientsPage,
  AdminViewingItem,
  AdminViewingsPage,
  AdminViewingUpdate,
  ClientStatus,
  ClientUpdateBody,
  ClientUpdateResult,
  SlotsResponse,
  ViewingWhen,
} from "@maqar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useKey, useRefresh } from "./admin";
import { api } from "./client";

// Phase 22: client accounts and admin accounts.

export function useClients({ q, status, page = 1 }: { q?: string; status?: ClientStatus; page?: number }) {
  const key = useKey();
  return useQuery({
    queryKey: [...key, "clients", status ?? "all", q?.trim() ?? "", page],
    queryFn: ({ signal }) => {
      const qs = new URLSearchParams({ limit: "50", page: String(page) });
      if (status) qs.set("status", status);
      if (q?.trim()) qs.set("q", q.trim());
      return api.request<AdminClientsPage>(`/admin/clients?${qs}`, { signal });
    },
    placeholderData: (prev) => prev,
  });
}

export function useClient(id: number | undefined) {
  const key = useKey();
  return useQuery({ queryKey: [...key, "client", id], queryFn: ({ signal }) => api.request<AdminClientDetail>(`/admin/clients/${id}`, { signal }), enabled: id !== undefined });
}

export function useUpdateClient(id: number) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (body: ClientUpdateBody) => api.request<ClientUpdateResult>(`/admin/clients/${id}`, { method: "PATCH", body }), onSuccess: refresh });
}

export function useDeleteClient(id: number) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: () => api.request<void>(`/admin/clients/${id}`, { method: "DELETE" }), onSuccess: refresh });
}

export function useAdmins() {
  const key = useKey();
  return useQuery({ queryKey: [...key, "admins"], queryFn: ({ signal }) => api.request<AdminAccount[]>("/admin/admins", { signal }) });
}

export function useSaveAdmin(id?: number) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: AdminAccountUpdate) =>
      id ? api.request<AdminAccount>(`/admin/admins/${id}`, { method: "PATCH", body }) : api.request<AdminAccount>("/admin/admins", { method: "POST", body: body as AdminAccountBody }),
    onSuccess: refresh,
  });
}

/** A password the server takes: 8 or more, with a letter and a digit. */
export const passwordOk = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

// Phase 23: viewings.

export function useAdminViewings({ when, q, page = 1 }: { when: ViewingWhen; q?: string; page?: number }) {
  const key = useKey();
  return useQuery({
    queryKey: [...key, "viewings", when, q?.trim() ?? "", page],
    queryFn: ({ signal }) => {
      const qs = new URLSearchParams({ when, limit: "50", page: String(page) });
      if (q?.trim()) qs.set("q", q.trim());
      return api.request<AdminViewingsPage>(`/admin/viewings?${qs}`, { signal });
    },
    placeholderData: (prev) => prev,
  });
}

/** The advisor's free hours for moving this viewing (its own hour counts as free). */
export function useSlots(propertyId: number, viewingId: number) {
  return useQuery({
    queryKey: ["slots", propertyId, viewingId],
    queryFn: ({ signal }) => api.request<SlotsResponse>(`/properties/${propertyId}/slots?reschedule=${viewingId}`, { signal }),
    staleTime: 0,
  });
}

export function useUpdateAdminViewing(id: number) {
  const refresh = useRefresh();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminViewingUpdate) => api.request<AdminViewingItem>(`/admin/viewings/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      refresh();
      void qc.invalidateQueries({ queryKey: ["slots"] });
    },
  });
}
