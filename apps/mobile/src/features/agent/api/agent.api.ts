import type { AddLeadNoteBody, AgentToday, LeadCard, LeadDetail, LeadNote, UpdateLeadBody } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';

export const getToday = (signal?: AbortSignal) => apiFetch<AgentToday>('/agent/today', { signal });

export const getLeads = (signal?: AbortSignal) => apiFetch<LeadCard[]>('/agent/leads', { signal });

export const getLead = (id: number, signal?: AbortSignal) => apiFetch<LeadDetail>(`/agent/leads/${id}`, { signal });

export const updateLeadRequest = (id: number, body: UpdateLeadBody) => apiFetch<LeadCard>(`/agent/leads/${id}`, { method: 'PATCH', body });

export const addNoteRequest = (id: number, body: AddLeadNoteBody) => apiFetch<LeadNote>(`/agent/leads/${id}/notes`, { method: 'POST', body });
