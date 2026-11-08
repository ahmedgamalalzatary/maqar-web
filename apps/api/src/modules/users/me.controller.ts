import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { Me } from '@maqar/shared';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { DeleteMeDto } from './dto/delete-me.dto.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { UsersService } from './users.service.js';

/** Router for `/v1/me`: the signed-in account (contract §8.14). */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: AuthRepository,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<Me> {
    return this.users.getMe(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() body: UpdateMeDto): Promise<Me> {
    return this.users.updateMe(user.id, body);
  }

  @Delete()
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Account deleted and every session ended' })
  async remove(@CurrentUser() user: AuthUser, @Body() body: DeleteMeDto): Promise<void> {
    await this.users.deleteMe(user.id, body.password, () => this.sessions.revokeAllForUser(user.id));
  }
}
