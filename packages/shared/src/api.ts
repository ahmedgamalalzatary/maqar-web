import type { Lang, Role, SignUpRole, ThemePref } from './enums.js';

// Request and response shapes shared by the API and the app.

/** `GET /v1/health` */
export type HealthResponse = {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  version: string;
  time: string;
};

/** The standard NestJS error body every endpoint returns on failure. */
export type ApiErrorBody = {
  statusCode: number;
  message: string | string[];
  error?: string;
};

// ---- Accounts (phase 1) ----

/** Passwords need at least this many characters, with a letter and a digit. */
export const PASSWORD_MIN = 8;

export type AgentProfile = {
  nameAr: string;
  nameEn: string;
  roleTitleAr: string;
  roleTitleEn: string;
  rating: number;
  dealsCount: number;
  years: number;
  phone: string;
  colour: string;
};

/** `GET /v1/me` and the `user` in every auth response. */
export type Me = {
  id: number;
  role: Role;
  name: string;
  email: string;
  phone: string | null;
  lang: Lang;
  theme: ThemePref;
  pushEnabled: boolean;
  createdAt: string;
  /** Present for sales agents only. */
  agent?: AgentProfile;
};

export type AuthResponse = {
  user: Me;
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
};

export type SignUpBody = { name: string; email: string; password: string; role: SignUpRole; lang?: Lang };
export type SignInBody = { email: string; password: string };
export type RefreshBody = { refreshToken: string };
export type UpdateMeBody = Partial<Pick<Me, 'name' | 'phone' | 'lang' | 'theme' | 'pushEnabled'>>;
/** Deleting an account needs the current password. */
export type DeleteMeBody = { password: string };
