import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import type { AdminAccount, AdminClientDetail, AdminClientsPage, ClientUpdateResult } from '@maqar/shared';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ClientsQueryDto, CreateAdminDto, UpdateAdminDto, UpdateClientDto } from './dto/people.dto.js';
import { PeopleService } from './people.service.js';

/** Router for `/v1/admin/clients` (phase 22, contract §11): client accounts. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/clients')
export class AdminClientsController {
  constructor(private readonly people: PeopleService) {}

  /** Newest first, searchable by name, email or phone, with a count per status. */
  @Get()
  list(@Query() q: ClientsQueryDto): Promise<AdminClientsPage> {
    return this.people.clients(q);
  }

  @Get(':id')
  @ApiNotFoundResponse({ description: 'No such client' })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminClientDetail> {
    return this.people.client(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateClientDto): Promise<ClientUpdateResult> {
    return this.people.updateClient(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Deleted as the client’s own delete would' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.people.removeClient(id);
  }
}

/** Router for `/v1/admin/admins` (phase 22, contract §11): admin accounts. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/admins')
export class AdminAdminsController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  list(@CurrentUser() me: AuthUser): Promise<AdminAccount[]> {
    return this.people.admins(me.id);
  }

  @Post()
  @ApiConflictResponse({ description: 'The email already has an account' })
  create(@Body() body: CreateAdminDto, @CurrentUser() me: AuthUser): Promise<AdminAccount> {
    return this.people.createAdmin(body, me.id);
  }

  @Patch(':id')
  @ApiConflictResponse({ description: 'Suspending yourself, or the email is taken' })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateAdminDto, @CurrentUser() me: AuthUser): Promise<AdminAccount> {
    return this.people.updateAdmin(id, body, me.id);
  }
}
