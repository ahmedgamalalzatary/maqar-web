import { Module } from '@nestjs/common';
import { AreasController } from './areas.controller.js';
import { AreasRepository } from './areas.repository.js';

@Module({
  controllers: [AreasController],
  providers: [AreasRepository],
})
export class AreasModule {}
