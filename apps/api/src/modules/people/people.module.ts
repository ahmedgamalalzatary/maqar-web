import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { ViewingsModule } from '../viewings/viewings.module.js';
import { AdminAdminsController, AdminClientsController } from './people.controller.js';
import { PeopleRepository } from './people.repository.js';
import { PeopleService } from './people.service.js';

/** Client and admin accounts in the admin tools (phase 22). */
@Module({
  imports: [UsersModule, ViewingsModule],
  controllers: [AdminClientsController, AdminAdminsController],
  providers: [PeopleRepository, PeopleService],
})
export class PeopleModule {}
