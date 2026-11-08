import type { Me, UpdateMeBody } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';

export const updateMeRequest = (body: UpdateMeBody) => apiFetch<Me>('/me', { method: 'PATCH', body });

export const deleteMeRequest = (password: string) =>
  apiFetch<void>('/me', { method: 'DELETE', body: { password } });
