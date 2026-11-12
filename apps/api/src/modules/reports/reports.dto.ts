import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CATEGORIES, type Category, REPORT_IDS, type ReportId, type ReportQuery } from '@maqar/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Min } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ReportParamDto {
  @ApiProperty({ enum: REPORT_IDS }) @IsIn(REPORT_IDS)
  id: ReportId;
}

/** `GET /admin/analytics/:id`: Cairo days, both included (left out: the last 30 days), and the filters the report takes. */
export class ReportQueryDto implements ReportQuery {
  @ApiPropertyOptional({ example: '2026-10-14' }) @IsOptional() @Matches(DAY, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-12' }) @IsOptional() @Matches(DAY, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  agentId?: number;

  @ApiPropertyOptional() @IsOptional() @Matches(/^[a-z0-9-]{1,40}$/)
  areaId?: string;

  @ApiPropertyOptional({ enum: CATEGORIES }) @IsOptional() @IsIn(CATEGORIES)
  category?: Category;
}
