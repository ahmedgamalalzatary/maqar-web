import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** A YYYY-MM-DD path segment, or 400. */
@Injectable()
export class DatePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!DATE.test(value)) throw new BadRequestException('date must be YYYY-MM-DD');
    return value;
  }
}
