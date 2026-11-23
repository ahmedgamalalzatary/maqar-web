import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  type ChangePasswordBody,
  type ForgotPasswordBody,
  LANGS,
  type Lang,
  PASSWORD_MIN,
  type RefreshBody,
  readResetCode,
  type ResetPasswordBody,
  SIGN_UP_ROLES,
  type SignInBody,
  type SignUpBody,
  type SignUpRole,
} from '@mqr/shared';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

/** A new password follows the sign-up rule: 8 to 128 characters, with a letter and a digit. */
const NewPassword = (): PropertyDecorator => (target, key) => {
  ApiProperty({ minLength: PASSWORD_MIN, description: 'At least one letter and one digit' })(target, key);
  IsString()(target, key);
  MinLength(PASSWORD_MIN)(target, key);
  MaxLength(128)(target, key);
  Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'password needs a letter and a digit' })(target, key);
};

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

  /** Optional at sign-up (App Store 5.1.1: browsing needs no number). */
  @ApiPropertyOptional({ example: '+201001234567' })
  @IsOptional()
  @Matches(/^\+?\d{8,15}$/, { message: 'phone must be 8–15 digits, optionally starting with +' })
  phone?: string;

  /** Optional: every sign-up is a client. Older apps still send it. */
  @ApiPropertyOptional({ enum: SIGN_UP_ROLES, default: 'client' }) @IsOptional() @IsIn(SIGN_UP_ROLES)
  role?: SignUpRole;

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

/** `PUT /me/password` (phase 31). */
export class ChangePasswordDto implements ChangePasswordBody {
  @ApiProperty() @IsString() @MaxLength(128)
  currentPassword: string;

  @NewPassword()
  newPassword: string;
}

/** `POST /auth/forgot-password` (phase 31). */
export class ForgotPasswordDto implements ForgotPasswordBody {
  @ApiProperty() @Transform(normaliseEmail) @IsEmail() @MaxLength(255)
  email: string;
}

/** `POST /auth/reset-password` (phase 31): the code is read from Arabic or Latin digits. */
export class ResetPasswordDto implements ResetPasswordBody {
  @ApiProperty() @Transform(normaliseEmail) @IsEmail() @MaxLength(255)
  email: string;

  @ApiProperty({ example: '123456' })
  @Transform(({ value }) => (typeof value === 'string' ? (readResetCode(value) ?? value) : value))
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;

  @NewPassword()
  newPassword: string;
}
