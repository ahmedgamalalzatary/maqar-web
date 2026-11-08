import type { AuthResponse, SignInBody, SignUpBody } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';

export const signInRequest = (body: SignInBody) =>
  apiFetch<AuthResponse>('/auth/sign-in', { method: 'POST', body, anonymous: true });

export const signUpRequest = (body: SignUpBody) =>
  apiFetch<AuthResponse>('/auth/sign-up', { method: 'POST', body, anonymous: true });

export const refreshRequest = (refreshToken: string) =>
  apiFetch<AuthResponse>('/auth/refresh', { method: 'POST', body: { refreshToken }, anonymous: true });

export const signOutRequest = (refreshToken: string) =>
  apiFetch<void>('/auth/sign-out', { method: 'POST', body: { refreshToken }, anonymous: true });
