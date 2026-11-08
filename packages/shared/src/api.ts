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
