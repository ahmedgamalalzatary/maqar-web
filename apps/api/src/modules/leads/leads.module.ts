import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PropertiesModule } from '../properties/properties.module.js';
import { AdminLeadsController, AgentController } from './leads.controller.js';
import { LeadsRepository } from './leads.repository.js';
import { LeadsService } from './leads.service.js';

/** The sales agent app: Today, leads and notes (contract §10.1, §10.2). */
@Module({
  imports: [PropertiesModule, ChatModule, NotificationsModule],
  controllers: [AgentController, AdminLeadsController],
  providers: [LeadsRepository, LeadsService],
})
export class LeadsModule {}
