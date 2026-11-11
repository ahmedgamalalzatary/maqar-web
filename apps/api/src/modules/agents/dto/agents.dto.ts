import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { type AgentBody, type DayHours, type DaysOffBody, type HoursBody, PASSWORD_MIN } from '@maqar/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const email = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const PHONE = /^\+?[0-9][0-9 ]{5,19}$/;
const COLOUR = /^#[0-9a-fA-F]{6}$/;

/** `POST /admin/agents`: a new agent account with a starting password the admin passes on. */
export class CreateAgentDto implements AgentBody {
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100)
  nameAr: string;

  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100)
  nameEn: string;

  @ApiProperty() @Transform(email) @IsEmail() @MaxLength(255)
  email: string;

  @ApiProperty({ minLength: PASSWORD_MIN, description: 'At least one letter and one digit' })
  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'password needs a letter and a digit' })
  password: string;

  @ApiProperty({ example: '+201000000001' }) @Transform(trim) @Matches(PHONE)
  phone: string;

  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100)
  roleTitleAr: string;

  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100)
  roleTitleEn: string;

  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100)
  languagesAr: string;

  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100)
  languagesEn: string;

  @ApiProperty({ example: '#b38959' }) @Matches(COLOUR, { message: 'colour must be like #b38959' })
  colour: string;

  @ApiProperty({ description: 'Deals a month' }) @IsInt() @Min(0) @Max(1000)
  monthlyTarget: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(60)
  years?: number;
}

/** `PATCH /admin/agents/:id`: any field; a new password ends the agent's sessions; `active: false` turns them off. */
export class UpdateAgentDto extends PartialType(OmitType(CreateAgentDto, ['password'] as const)) {
  @ApiPropertyOptional({ minLength: PASSWORD_MIN, description: 'A new password; their sessions end' })
  @IsOptional()
  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'password needs a letter and a digit' })
  password?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Move their upcoming viewings, open chats and open leads to this advisor when deactivating' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reassignTo?: number;
}

export class ReassignDto {
  @ApiProperty({ description: 'The advisor who takes over the work' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reassignTo!: number;
}

export class DayHoursDto implements DayHours {
  @ApiProperty({ description: '0 = Sunday' }) @IsInt() @Min(0) @Max(6)
  weekday: number;

  @ApiProperty({ description: 'The first hour a viewing can start' }) @IsInt() @Min(0) @Max(23)
  from: number;

  @ApiProperty({ description: 'The last hour a viewing can start' }) @IsInt() @Min(0) @Max(23)
  to: number;
}

const agentIds = () => (target: object, key: string) => {
  ApiProperty({ type: [Number] })(target, key);
  ArrayMinSize(1)(target, key);
  ArrayMaxSize(200)(target, key);
  ArrayUnique()(target, key);
  IsInt({ each: true })(target, key);
  Min(1, { each: true })(target, key);
};

/** `PUT /admin/agents/hours`. A weekday left out is a day off; at least one day is worked. */
export class HoursDto implements HoursBody {
  @agentIds()
  agentIds: number[];

  @ApiProperty({ type: [DayHoursDto] }) @ArrayMinSize(1) @ArrayMaxSize(7) @ValidateNested({ each: true }) @Type(() => DayHoursDto)
  hours: DayHoursDto[];
}

/** `POST /admin/agents/days-off`: `from` alone is one day. */
export class DaysOffDto implements DaysOffBody {
  @agentIds()
  agentIds: number[];

  @ApiProperty({ example: '2026-12-25' }) @Matches(DATE, { message: 'from must be YYYY-MM-DD' })
  from: string;

  @ApiPropertyOptional({ example: '2026-12-27' }) @IsOptional() @Matches(DATE, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  reason?: string;
}

export class AgentsQueryDto {
  @ApiPropertyOptional({ description: 'Only active agents (the advisor pickers)' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  active?: boolean;
}
