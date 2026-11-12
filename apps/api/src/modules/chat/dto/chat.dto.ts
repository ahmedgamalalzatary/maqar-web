import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CHAT_REPORT_REASONS, CHAT_TEXT_MAX, type ChatReportBody, type ChatReportReason, REPORT_OUTCOMES, type ReportOutcome, type ReportResolveBody } from '@maqar/shared';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const HOUR = /^([01]\d|2[0-3]):00$/;
const KINDS = ['text', 'property', 'plan', 'tour', 'slots'] as const;

export class StartChatDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1)
  propertyId: number;
}

export class PageQueryDto {
  @ApiPropertyOptional({ description: 'Messages before this id (older ones)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  before?: number;
}

/** A text, or (agents) a card: home details, payment plan, 360° tour, or the free times of a day. */
export class SendMessageDto {
  @ApiProperty({ enum: KINDS })
  @IsIn(KINDS)
  kind: (typeof KINDS)[number];

  @ApiPropertyOptional({ maxLength: CHAT_TEXT_MAX })
  @ValidateIf((o: SendMessageDto) => o.kind === 'text')
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(CHAT_TEXT_MAX)
  text?: string;

  @ApiPropertyOptional({ example: '2026-11-15', description: 'For `slots`: a Cairo calendar day' })
  @ValidateIf((o: SendMessageDto) => o.kind === 'slots')
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}

export class BookSlotDto {
  @ApiProperty({ example: '16:00' })
  @Matches(HOUR, { message: 'time must be a whole hour, HH:00' })
  time: string;
}

/** `POST /chats/:id/report` (phase 24). */
export class ReportChatDto implements ChatReportBody {
  @ApiProperty({ enum: CHAT_REPORT_REASONS }) @IsIn(CHAT_REPORT_REASONS)
  reason: ChatReportReason;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(500)
  note?: string;
}

/** `GET /admin/chats` (phase 24). */
export class AdminChatsQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  agentId?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  clientId?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  propertyId?: number;

  @ApiPropertyOptional({ description: 'Only conversations with open reports' })
  @IsOptional() @Transform(({ value }: { value: unknown }) => value === true || value === 'true') @IsBoolean()
  reported?: boolean;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100_000)
  page = 1;

  @ApiPropertyOptional({ default: 50 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 50;
}

/** `GET /admin/reports` (phase 24). */
export class AdminReportsQueryDto {
  @ApiPropertyOptional({ description: 'Only the open ones' })
  @IsOptional() @Transform(({ value }: { value: unknown }) => value === true || value === 'true') @IsBoolean()
  open?: boolean;
}

/** `PATCH /admin/reports/:id` (phase 24). */
export class ResolveReportDto implements ReportResolveBody {
  @ApiProperty({ enum: REPORT_OUTCOMES }) @IsIn(REPORT_OUTCOMES)
  outcome: ReportOutcome;
}
