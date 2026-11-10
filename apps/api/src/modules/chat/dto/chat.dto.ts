import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CHAT_TEXT_MAX } from '@maqar/shared';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf } from 'class-validator';

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
