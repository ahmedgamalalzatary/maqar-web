import type { LeadDetail, UpdateLeadBody } from '@maqar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth/store/session.store';
import { addNoteRequest, getLead, getLeads, getToday, updateLeadRequest } from '../api/agent.api';

/** The signed-in agent's id. Keys the cache, so no account ever sees another's leads. */
const useAgentId = () => useSession((s) => (s.status === 'signedIn' && s.user?.role === 'agent' ? s.user.id : null));
const agentKey = (agentId: number | null) => ['agent', agentId];

export function useToday() {
  const agentId = useAgentId();
  return useQuery({ queryKey: [...agentKey(agentId), 'today'], queryFn: ({ signal }) => getToday(signal), enabled: agentId !== null });
}

export function useLeads() {
  const agentId = useAgentId();
  return useQuery({ queryKey: [...agentKey(agentId), 'leads'], queryFn: ({ signal }) => getLeads(signal), enabled: agentId !== null });
}

const leadKey = (agentId: number | null, id: number) => [...agentKey(agentId), 'lead', id];

/** Opening the lead marks it as seen, so Today and the list are refreshed after. */
export function useLead(id: number) {
  const agentId = useAgentId();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: leadKey(agentId, id),
    queryFn: async ({ signal }) => {
      const lead = await getLead(id, signal);
      void queryClient.invalidateQueries({ queryKey: agentKey(agentId), predicate: (q) => q.queryKey[2] !== 'lead' });
      return lead;
    },
    enabled: agentId !== null,
  });
}

/** A stage or hot change shows at once; Today and the list catch up after. */
export function useUpdateLead(id: number) {
  const agentId = useAgentId();
  const queryClient = useQueryClient();
  const key = leadKey(agentId, id);
  return useMutation({
    mutationFn: (body: UpdateLeadBody) => updateLeadRequest(id, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<LeadDetail>(key);
      if (before) queryClient.setQueryData<LeadDetail>(key, { ...before, ...body });
      return { before };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.before) queryClient.setQueryData(key, ctx.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: agentKey(agentId), predicate: (q) => q.queryKey[2] !== 'lead' }),
  });
}

export function useAddNote(id: number) {
  const agentId = useAgentId();
  const queryClient = useQueryClient();
  const key = leadKey(agentId, id);
  return useMutation({
    mutationFn: (text: string) => addNoteRequest(id, { text }),
    onSuccess: (note) => {
      const before = queryClient.getQueryData<LeadDetail>(key);
      if (before) queryClient.setQueryData<LeadDetail>(key, { ...before, notes: [note, ...before.notes] });
      void queryClient.invalidateQueries({ queryKey: agentKey(agentId), predicate: (q) => q.queryKey[2] !== 'lead' });
    },
  });
}
