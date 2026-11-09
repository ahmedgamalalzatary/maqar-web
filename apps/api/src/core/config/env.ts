import { plainToInstance, Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength, validateSync } from 'class-validator';

const NODE_ENVS = ['development', 'test', 'production'] as const;

/** Every env var the API reads. Checked once at start-up (contract §5: one root .env). */
export class Env {
  @IsIn(NODE_ENVS)
  NODE_ENV: (typeof NODE_ENVS)[number] = 'development';

  @Transform(({ value }) => (value === undefined || value === '' ? 4000 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000;

  @IsString()
  @Matches(/^mysql:\/\//, { message: 'DATABASE_URL must be a mysql:// URL' })
  DATABASE_URL: string;

  /** Comma-separated. Empty means any origin (development). */
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : (value ?? []),
  )
  @IsString({ each: true })
  CORS_ORIGINS: string[] = [];

  /** Signs access tokens. Long and random; never shared with the app. */
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  /** Access token lifetime, e.g. "15m" (contract §15: short-lived). */
  @IsString()
  @Matches(/^\d+[smhd]$/)
  JWT_ACCESS_TTL = '15m';

  @Transform(({ value }) => (value === undefined || value === '' ? 30 : Number(value)))
  @IsInt()
  @Min(1)
  REFRESH_TTL_DAYS = 30;

  /** Sign-in and sign-up attempts per minute per IP. */
  @Transform(({ value }) => (value === undefined || value === '' ? 10 : Number(value)))
  @IsInt()
  @Min(1)
  AUTH_RATE_LIMIT = 10;

  /**
   * Folder for uploaded photos, relative to apps/api. The API serves it at /uploads in
   * development; in production nginx serves the same folder (contract §16.1 #2).
   */
  @IsString()
  UPLOADS_DIR = 'uploads';

  /** Password for the seeded demo accounts. Only the seed script reads it. */
  @IsOptional()
  @IsString()
  SEED_PASSWORD?: string;
}

/** Used by ConfigModule's `validate`. Throws one error that lists every bad variable. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const env = plainToInstance(Env, raw, { exposeDefaultValues: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) {
    const lines = errors.map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`);
    throw new Error(`Invalid environment:\n  ${lines.join('\n  ')}`);
  }
  return env;
}
