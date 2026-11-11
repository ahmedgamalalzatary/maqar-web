import { ApiPropertyOptional } from '@nestjs/swagger';
import { LANGS, type Lang, THEMES, type ThemePref, type UpdateMeBody } from '@maqar/shared';
import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';

/** A PATCH key left out means "not provided": validation runs only when it is. An explicit null fails. */
const notProvided = (_target: unknown, value: unknown) => value !== undefined;

export class UpdateMeDto implements UpdateMeBody {
  @ValidateIf(notProvided) @IsString() @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({ example: '+201001234567', nullable: true })
  @IsOptional()
  @Matches(/^\+?\d{8,15}$/, { message: 'phone must be 8–15 digits, optionally starting with +' })
  phone?: string | null;

  @ValidateIf(notProvided) @IsIn(LANGS)
  lang?: Lang;

  @ValidateIf(notProvided) @IsIn(THEMES)
  theme?: ThemePref;

  @ValidateIf(notProvided) @IsBoolean()
  pushEnabled?: boolean;
}
