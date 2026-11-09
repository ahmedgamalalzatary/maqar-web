import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { REMINDER_OFFSETS, type ReminderOffset } from '@maqar/shared';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, Matches, Min, ValidateIf } from 'class-validator';

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
/** Viewings start on the hour. */
const HOUR = /^([01]\d|2[0-3]):00$/;

export class BookViewingDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1)
  propertyId: number;

  @ApiProperty({ example: '2026-11-15', description: 'A Cairo calendar day' })
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @ApiProperty({ example: '16:00', description: 'The hour, Cairo time' })
  @Matches(HOUR, { message: 'time must be a whole hour, HH:00' })
  time: string;

  @ApiProperty({ enum: REMINDER_OFFSETS, isArray: true, example: ['1d', '2h'] })
  @IsArray()
  @ArrayMaxSize(REMINDER_OFFSETS.length)
  @IsIn(REMINDER_OFFSETS, { each: true })
  reminders: ReminderOffset[];
}

export class UpdateViewingDto {
  @ApiProperty({ enum: ['reschedule', 'cancel'] })
  @IsIn(['reschedule', 'cancel'])
  action: 'reschedule' | 'cancel';

  @ApiPropertyOptional({ example: '2026-11-16' })
  @ValidateIf((o: UpdateViewingDto) => o.action === 'reschedule')
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({ example: '17:00' })
  @ValidateIf((o: UpdateViewingDto) => o.action === 'reschedule')
  @Matches(HOUR, { message: 'time must be a whole hour, HH:00' })
  time?: string;

  @ApiPropertyOptional({ enum: REMINDER_OFFSETS, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(REMINDER_OFFSETS.length)
  @IsIn(REMINDER_OFFSETS, { each: true })
  reminders?: ReminderOffset[];
}

export class SlotsQueryDto {
  /** The viewing being rescheduled: its own hour shows as free. */
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  reschedule?: number;
}
