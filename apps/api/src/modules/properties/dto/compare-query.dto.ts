import { ApiProperty } from '@nestjs/swagger';
import { COMPARE_MAX } from '@maqar/shared';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsInt, Min } from 'class-validator';
import { toList } from './properties-query.dto.js';

/** `GET /v1/properties/compare?ids=4,9`: one or two listing ids. */
export class CompareQueryDto {
  @ApiProperty({ type: String, example: '4,9' })
  @Transform((v) => toList(v)?.map(Number))
  @ArrayMinSize(1)
  @ArrayMaxSize(COMPARE_MAX)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}
