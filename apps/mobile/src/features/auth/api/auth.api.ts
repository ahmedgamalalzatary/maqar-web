import type { AuthResponse, ResetPasswordBody, SignInBody, SignUpBody } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';

export const signInRequest = (body: SignInBody) =>
  apiFetch<AuthResponse>('/auth/sign-in', { method: 'POST', body, anonymous: true });

export const signUpRequest = (body: SignUpBody) =>
  apiFetch<AuthResponse>('/auth/sign-up', { method: 'POST', body, anonymous: true });

/** Phase 31: always 204, whether or not the email has an account. */
export const forgotPasswordRequest = (email: string) =>
  apiFetch<void>('/auth/forgot-password', { method: 'POST', body: { email }, anonymous: true });

export const resetPasswordRequest = (body: ResetPasswordBody) =>
  apiFetch<AuthResponse>('/auth/reset-password', { method: 'POST', body, anonymous: true });

export const refreshRequest = (refreshToken: string) =>
  apiFetch<AuthResponse>('/auth/refresh', { method: 'POST', body: { refreshToken }, anonymous: true });

export const signOutRequest = (refreshToken: string) =>
  apiFetch<void>('/auth/sign-out', { method: 'POST', body: { refreshToken }, anonymous: true });
