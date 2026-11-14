import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module.js';
import { AdminSettingsController, SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

/** The app's settings an admin controls (phase 29). */
@Module({
  imports: [UploadsModule],
  controllers: [SettingsController, AdminSettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
