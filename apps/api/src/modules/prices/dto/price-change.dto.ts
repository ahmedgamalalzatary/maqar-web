import { ApiProperty } from '@nestjs/swagger';
import type { PriceChangeBody } from '@maqar/shared';
import { IsInt, Max, Min } from 'class-validator';

export class PriceChangeDto implements PriceChangeBody {
  /** Whole EGP. */
  @ApiProperty({ example: 11_400_000 })
  @IsInt()
  @Min(1)
  @Max(10_000_000_000)
  price: number;
}
