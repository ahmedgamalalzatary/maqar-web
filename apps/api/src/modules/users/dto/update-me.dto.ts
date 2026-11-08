import { ApiPropertyOptional } from '@nestjs/swagger';
import { LANGS, type Lang, THEMES, type ThemePref, type UpdateMeBody } from '@maqar/shared';
import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateMeDto implements UpdateMeBody {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({ example: '+201001234567', nullable: true })
  @IsOptional()
  @Matches(/^\+?\d{8,15}$/, { message: 'phone must be 8–15 digits, optionally starting with +' })
  phone?: string | null;

  @ApiPropertyOptional({ enum: LANGS }) @IsOptional() @IsIn(LANGS)
  lang?: Lang;

  @ApiPropertyOptional({ enum: THEMES }) @IsOptional() @IsIn(THEMES)
  theme?: ThemePref;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  pushEnabled?: boolean;
}
