"use client";

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
  AreaItem,
  DaysOffBody,
  DaysOffResult,
  HoursBody,
  InsightRange,
  InterestedClient,
  ListingBody,
  ListingStats,
  PropertyStatus,
  UploadResponse,
} from "@maqar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, useSession } from "./client";

export type ListingsQuery = { status?: PropertyStatus; q?: string; page?: number };

/** Keys the cache by the signed-in admin, so another account never sees it. */
const useKey = () => ["admin", useSession()?.user.id ?? null] as const;

/** The id from the address, or undefined when it is not a positive whole number. */
export function readId(raw: string | null): number | undefined {
  const n = Number(raw);
  return raw !== null && String(n) === raw && Number.isInteger(n) && n > 0 ? n : undefined;
}

export function useListings({ status, q, page = 1 }: ListingsQuery) {
  const key = useKey();
  return useQuery({
    queryKey: [...key, "listings", status ?? "all", q?.trim() ?? "", page],
    queryFn: ({ signal }) => {
      const qs = new URLSearchParams({ limit: "50", page: String(page) });
      if (status) qs.set("status", status);
      if (q?.trim()) qs.set("q", q.trim());
      return api.request<AdminListingsPage>(`/admin/listings?${qs}`, { signal });
    },
    placeholderData: (prev) => prev,
  });
}

export function useListing(id: number | undefined) {
  const key = useKey();
  return useQuery({
    queryKey: [...key, "listing", id],
    queryFn: ({ signal }) => api.request<AdminListing>(`/admin/listings/${id}`, { signal }),
    enabled: id !== undefined && Number.isInteger(id),
  });
}

/** Phase 19: a listing's daily numbers for the last `days`, and its interested clients. */
export function useListingStats(id: number, days: InsightRange) {
  const key = useKey();
  return useQuery({
    queryKey: [...key, "listing", id, "stats", days],
    queryFn: ({ signal }) => api.request<ListingStats>(`/admin/listings/${id}/stats?days=${days}`, { signal }),
    placeholderData: (prev) => prev,
  });
}

export function useInterested(id: number) {
  const key = useKey();
  return useQuery({ queryKey: [...key, "listing", id, "interested"], queryFn: ({ signal }) => api.request<InterestedClient[]>(`/admin/listings/${id}/interested`, { signal }) });
}

export const useAreas = () => useQuery({ queryKey: ["areas"], queryFn: ({ signal }) => api.request<AreaItem[]>("/areas", { signal }), staleTime: 3_600_000 });

export function useAgents(enabled = true) {
  const key = useKey();
  return useQuery({ queryKey: [...key, "agents"], queryFn: ({ signal }) => api.request<AdminAgentOption[]>("/admin/agents?active=true", { signal }), enabled });
}

/** After any change: the listing shows its new state, and the lists catch up. */
function useSettle() {
  const key = useKey();
  const qc = useQueryClient();
  return (l: AdminListing) => {
    qc.setQueryData([...key, "listing", l.id], l);
    void qc.invalidateQueries({ queryKey: key, predicate: (q) => q.queryKey[2] !== "listing" });
  };
}

export function useSave(id?: number) {
  const settle = useSettle();
  return useMutation({
    mutationFn: (body: ListingBody) =>
      id ? api.request<AdminListing>(`/admin/listings/${id}`, { method: "PATCH", body }) : api.request<AdminListing>("/admin/listings", { method: "POST", body }),
    onSuccess: settle,
  });
}

export type Action = { kind: "publish"; id: number; agentId?: number } | { kind: "unpublish"; id: number } | { kind: "close"; id: number };

export function useAction() {
  const settle = useSettle();
  return useMutation({
    mutationFn: (a: Action) =>
      api.request<AdminListing>(`/admin/listings/${a.id}/${a.kind}`, { method: "POST", body: a.kind === "publish" && a.agentId ? { agentId: a.agentId } : {} }),
    onSuccess: settle,
  });
}

export function uploadPhoto(photo: Blob): Promise<UploadResponse> {
  const form = new FormData();
  form.append("photo", photo, "photo.jpg");
  return api.request<UploadResponse>("/uploads", { method: "POST", body: form });
}

// ---- Admin tools (phase 18) ----

/** After a change to agents, leads or areas, everything the admin sees refetches. */
function useRefresh() {
  const key = useKey();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["areas"] });
  };
}

export function useAllAgents() {
  const key = useKey();
  return useQuery({ queryKey: [...key, "agents-all"], queryFn: ({ signal }) => api.request<AdminAgentItem[]>("/admin/agents", { signal }) });
}

export function useAgent(id: number | undefined) {
  const key = useKey();
  return useQuery({
    queryKey: [...key, "agent", id],
    queryFn: ({ signal }) => api.request<AdminAgentDetail>(`/admin/agents/${id}`, { signal }),
    enabled: id !== undefined && Number.isInteger(id),
  });
}

export function useSaveAgent(id?: number) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: Partial<AgentBody>) =>
      id ? api.request<AdminAgentDetail>(`/admin/agents/${id}`, { method: "PATCH", body }) : api.request<AdminAgentDetail>("/admin/agents", { method: "POST", body }),
    onSuccess: refresh,
  });
}

export function useSetHours() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (body: HoursBody) => api.request<void>("/admin/agents/hours", { method: "PUT", body }), onSuccess: refresh });
}

export function useAddDaysOff() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (body: DaysOffBody) => api.request<DaysOffResult>("/admin/agents/days-off", { method: "POST", body }), onSuccess: refresh });
}

export function useRemoveDayOff(id: number) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (date: string) => api.request<void>(`/admin/agents/${id}/days-off/${date}`, { method: "DELETE" }), onSuccess: refresh });
}

export function useLeads(agentId: number | undefined) {
  const key = useKey();
  return useQuery({
    queryKey: [...key, "leads", agentId ?? "all"],
    queryFn: ({ signal }) => api.request<AdminLeadItem[]>(`/admin/leads${agentId ? `?agentId=${agentId}` : ""}`, { signal }),
  });
}

export function useAssignLead() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, agentId }: { id: number; agentId: number }) => api.request<AdminLeadItem>(`/admin/leads/${id}/assign`, { method: "PATCH", body: { agentId } }),
    onSuccess: refresh,
  });
}

export function useAdminAreas() {
  const key = useKey();
  return useQuery({ queryKey: [...key, "areas"], queryFn: ({ signal }) => api.request<AdminArea[]>("/admin/areas", { signal }) });
}

export function useSaveArea(id?: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: AreaBody) => (id ? api.request<AdminArea>(`/admin/areas/${id}`, { method: "PATCH", body }) : api.request<AdminArea>("/admin/areas", { method: "POST", body })),
    onSuccess: refresh,
  });
}

export function useDeleteArea() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (id: string) => api.request<void>(`/admin/areas/${id}`, { method: "DELETE" }), onSuccess: refresh });
}

/** Featured on Home, or a different advisor, from the listing page. */
export function usePatchListing(id: number) {
  const settle = useSettle();
  return useMutation({ mutationFn: (body: { featured?: boolean; agentId?: number }) => api.request<AdminListing>(`/admin/listings/${id}`, { method: "PATCH", body }), onSuccess: settle });
}
