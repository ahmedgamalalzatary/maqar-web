import { Module } from '@nestjs/common';
import { AdminAreasController } from './areas.admin.controller.js';
import { AreasController } from './areas.controller.js';
import { AreasRepository } from './areas.repository.js';

@Module({
  controllers: [AreasController, AdminAreasController],
  providers: [AreasRepository],
})
export class AreasModule {}
