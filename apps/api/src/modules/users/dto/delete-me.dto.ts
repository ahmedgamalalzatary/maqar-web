import { ApiProperty } from '@nestjs/swagger';
import type { DeleteMeBody } from '@maqar/shared';
import { IsString } from 'class-validator';

export class DeleteMeDto implements DeleteMeBody {
  @ApiProperty() @IsString()
  password: string;
}
