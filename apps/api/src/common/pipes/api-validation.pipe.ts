import { type ArgumentMetadata, type PipeTransform, ValidationPipe } from '@nestjs/common';

/**
 * A date-only value is undefined when its key holds null: class-validator's IsOptional skips null,
 * so an explicit JSON null passed validation and reached non-nullable database columns as a 500.
 * Nulls are removed before validation (a missing key means "not provided" on a PATCH); intentional
 * clears keep using their own values, such as an empty-string phone.
 */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (value === null || !(value instanceof Date) && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null) continue;
      out[k] = withoutNulls(v);
    }
    return out;
  }
  return value;
}

/** The API's global validation pipe: strips JSON nulls from bodies, then validates as usual. */
export class ApiValidationPipe extends ValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    const stripped = metadata.type === 'body' && value && typeof value === 'object' ? withoutNulls(value) : value;
    return super.transform(stripped, metadata);
  }
}
