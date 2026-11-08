import { plainToInstance, Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, Matches, Max, Min, validateSync } from 'class-validator';

const NODE_ENVS = ['development', 'test', 'production'] as const;

/** Every env var the API reads. Checked once at start-up (contract §5: one root .env). */
export class Env {
  @IsIn(NODE_ENVS)
  NODE_ENV: (typeof NODE_ENVS)[number] = 'development';

  @Transform(({ value }) => (value === undefined || value === '' ? 4010 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4010;

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
