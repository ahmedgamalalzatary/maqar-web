import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  LANGS,
  type Lang,
  PASSWORD_MIN,
  type RefreshBody,
  SIGN_UP_ROLES,
  type SignInBody,
  type SignUpBody,
  type SignUpRole,
} from '@maqar/shared';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

const normaliseEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class SignUpDto implements SignUpBody {
  @ApiProperty({ example: 'Mona Adel' }) @IsString() @Length(2, 100)
  name: string;

  @ApiProperty({ example: 'mona@example.com' }) @Transform(normaliseEmail) @IsEmail() @MaxLength(255)
  email: string;

  @ApiProperty({ minLength: PASSWORD_MIN, description: 'At least one letter and one digit' })
  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'password needs a letter and a digit' })
  password: string;

  @ApiProperty({ enum: SIGN_UP_ROLES }) @IsIn(SIGN_UP_ROLES)
  role: SignUpRole;

  @ApiPropertyOptional({ enum: LANGS }) @IsOptional() @IsIn(LANGS)
  lang?: Lang;
}

export class SignInDto implements SignInBody {
  @ApiProperty() @Transform(normaliseEmail) @IsEmail()
  email: string;

  @ApiProperty() @IsString() @MaxLength(128)
  password: string;
}

export class RefreshDto implements RefreshBody {
  @ApiProperty() @IsString() @Length(20, 200)
  refreshToken: string;
}
