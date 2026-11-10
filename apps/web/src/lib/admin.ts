"use client";

import type { AdminAgentOption, AdminListing, AdminListingsPage, AreaItem, ListingBody, PropertyStatus, UploadResponse } from "@maqar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, useSession } from "./client";

export type ListingsQuery = { status?: PropertyStatus; q?: string; page?: number };

/** Keys the cache by the signed-in admin, so another account never sees it. */
const useKey = () => ["admin", useSession()?.user.id ?? null] as const;

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

export const useAreas = () => useQuery({ queryKey: ["areas"], queryFn: ({ signal }) => api.request<AreaItem[]>("/areas", { signal }), staleTime: 3_600_000 });

export function useAgents(enabled = true) {
  const key = useKey();
  return useQuery({ queryKey: [...key, "agents"], queryFn: ({ signal }) => api.request<AdminAgentOption[]>("/admin/agents", { signal }), enabled });
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
