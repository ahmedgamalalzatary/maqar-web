import { Module } from '@nestjs/common';
import { AdminAgentsController } from './agents.controller.js';
import { AgentsRepository } from './agents.repository.js';
import { AgentsService } from './agents.service.js';

/** Agents in the admin tools (phase 18). */
@Module({
  controllers: [AdminAgentsController],
  providers: [AgentsRepository, AgentsService],
})
export class AgentsModule {}
