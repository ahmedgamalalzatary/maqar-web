import { type ArgumentMetadata, type PipeTransform, ValidationPipe } from '@nestjs/common';

/**
 * The API's global validation pipe. JSON nulls are kept and validated per field: a nullable column's
 * field (phone, plan, location, …) accepts null as an intentional clear, while a NOT NULL column's
 * field uses `@ValidateIf(notProvided)` so an explicit null is refused (a missing key still means
 * "not provided" on a PATCH).
 */
export class ApiValidationPipe extends ValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    return super.transform(value, metadata);
  }
}
