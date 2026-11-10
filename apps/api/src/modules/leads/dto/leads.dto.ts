import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LEAD_NOTE_MAX, LEAD_STAGES, type LeadStage } from '@maqar/shared';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class LeadsQueryDto {
  @ApiPropertyOptional({ enum: LEAD_STAGES })
  @IsOptional()
  @IsIn(LEAD_STAGES)
  stage?: LeadStage;
}

export class UpdateLeadDto {
  @ApiPropertyOptional({ enum: LEAD_STAGES })
  @IsOptional()
  @IsIn(LEAD_STAGES)
  stage?: LeadStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hot?: boolean;
}

export class AddLeadNoteDto {
  @ApiProperty({ maxLength: LEAD_NOTE_MAX, example: 'Called: prefers a ground floor, back on Sunday.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(LEAD_NOTE_MAX)
  text: string;
}
