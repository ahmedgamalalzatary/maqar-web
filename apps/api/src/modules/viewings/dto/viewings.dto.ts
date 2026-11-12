import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { REMINDER_OFFSETS, type ReminderOffset, VIEWING_STATUSES, VIEWING_WHENS, type ViewingStatus, type ViewingWhen } from '@maqar/shared';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

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

/** `GET /admin/viewings` (phase 23). */
export class AdminViewingsQueryDto {
  @ApiPropertyOptional({ enum: VIEWING_WHENS, default: 'upcoming' }) @IsOptional() @IsIn(VIEWING_WHENS)
  when: ViewingWhen = 'upcoming';

  @ApiPropertyOptional({ enum: VIEWING_STATUSES }) @IsOptional() @IsIn(VIEWING_STATUSES)
  status?: ViewingStatus;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  agentId?: number;

  @ApiPropertyOptional({ description: 'First Cairo day, YYYY-MM-DD' }) @IsOptional() @Matches(DATE, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ description: 'Last Cairo day, YYYY-MM-DD' }) @IsOptional() @Matches(DATE, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional({ description: 'Words in the client’s name, phone or email, or the home’s title' })
  @IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100_000)
  page = 1;

  @ApiPropertyOptional({ default: 50 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 50;
}

/** `PATCH /admin/viewings/:id` (phase 23): a new time with the same advisor, or a cancellation, with an optional reason. */
export class AdminViewingUpdateDto {
  @ApiProperty({ enum: ['reschedule', 'cancel'] })
  @IsIn(['reschedule', 'cancel'])
  action: 'reschedule' | 'cancel';

  @ApiPropertyOptional({ example: '2026-11-16' })
  @ValidateIf((o: AdminViewingUpdateDto) => o.action === 'reschedule')
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({ example: '17:00' })
  @ValidateIf((o: AdminViewingUpdateDto) => o.action === 'reschedule')
  @Matches(HOUR, { message: 'time must be a whole hour, HH:00' })
  time?: string;

  @ApiPropertyOptional({ description: 'Told to the client and the advisor' })
  @IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(300)
  reason?: string;
}
