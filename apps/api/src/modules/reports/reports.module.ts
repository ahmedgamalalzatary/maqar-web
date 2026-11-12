import { Module } from '@nestjs/common';
import { AdminAnalyticsController } from './reports.controller.js';
import { ListingReports } from './reports.listings.js';
import { OpsReports } from './reports.ops.js';
import { PeopleReports } from './reports.people.js';
import { ReportsRepository } from './reports.repository.js';
import { SalesReports } from './reports.sales.js';
import { ReportsService } from './reports.service.js';

/** The admin's reports (phase 27). */
@Module({
  controllers: [AdminAnalyticsController],
  providers: [ReportsRepository, SalesReports, ListingReports, PeopleReports, OpsReports, ReportsService],
})
export class ReportsModule {}
