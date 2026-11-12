import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { type AdminAccountBody, type AdminAccountUpdate, CLIENT_STATUSES, type ClientStatus, type ClientUpdateBody, PASSWORD_MIN } from '@maqar/shared';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const email = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const PHONE = /^\+?[0-9][0-9 ]{5,19}$/;
/** A PATCH key left out means "not provided": validation runs only when it is. An explicit null fails. */
const notProvided = (_target: unknown, value: unknown) => value !== undefined;

/** Same rule as sign-up and agents: at least 8 characters with a letter and a digit. */
function Password() {
  return (target: object, key: string) => {
    ApiProperty({ minLength: PASSWORD_MIN, description: 'At least one letter and one digit' })(target, key);
    IsString()(target, key);
    MinLength(PASSWORD_MIN)(target, key);
    MaxLength(128)(target, key);
    Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'password needs a letter and a digit' })(target, key);
  };
}

export class ClientsQueryDto {
  @ApiPropertyOptional({ description: 'Words in the name, email or phone' })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: CLIENT_STATUSES }) @IsOptional() @IsIn(CLIENT_STATUSES)
  status?: ClientStatus;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100_000)
  page = 1;

  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;
}

/** `PATCH /admin/clients/:id`. */
export class UpdateClientDto implements ClientUpdateBody {
  @ValidateIf(notProvided) @Password()
  password?: string;

  @ApiPropertyOptional({ description: 'Suspend (signed out at once, upcoming viewings cancelled) or restore' })
  @ValidateIf(notProvided) @IsBoolean()
  suspended?: boolean;
}

/** `POST /admin/admins`. */
export class CreateAdminDto implements AdminAccountBody {
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100)
  name: string;

  @ApiProperty() @Transform(email) @IsEmail() @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ nullable: true, example: '+201000000001' }) @IsOptional() @Transform(trim) @Matches(PHONE)
  phone?: string | null;

  @Password()
  password: string;
}

/** `PATCH /admin/admins/:id`. */
export class UpdateAdminDto implements AdminAccountUpdate {
  @ApiPropertyOptional() @ValidateIf(notProvided) @Transform(trim) @IsString() @Length(2, 100)
  name?: string;

  @ApiPropertyOptional() @ValidateIf(notProvided) @Transform(email) @IsEmail() @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(trim) @Matches(PHONE)
  phone?: string | null;

  @ValidateIf(notProvided) @Password()
  password?: string;

  @ApiPropertyOptional({ description: 'Not for your own account' }) @ValidateIf(notProvided) @IsBoolean()
  suspended?: boolean;
}
