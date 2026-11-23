import type { AuthResponse, ChangePasswordBody, Me, UpdateMeBody } from '@mqr/shared';
import { apiFetch } from '@/core/api/api';

export const updateMeRequest = (body: UpdateMeBody) => apiFetch<Me>('/me', { method: 'PATCH', body });

/** Phase 31: answered with a new session for this phone; other devices are signed out. */
export const changePasswordRequest = (body: ChangePasswordBody) => apiFetch<AuthResponse>('/me/password', { method: 'PUT', body });

export const deleteMeRequest = (password: string) =>
  apiFetch<void>('/me', { method: 'DELETE', body: { password } });
