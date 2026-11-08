import type { HealthResponse } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';

/** `GET /v1/health` */
export const fetchHealth = () => apiFetch<HealthResponse>('/health');
