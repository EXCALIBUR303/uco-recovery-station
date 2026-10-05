import { Module } from '@nestjs/common';
import { MachineStatusService } from './machine-status.service';
import { StatusSweepService } from './status-sweep.service';
import { TelemetryController } from './telemetry.controller';
import { NotificationsController } from './notifications.controller';
import { CronController } from './cron.controller';
import { RentalsModule } from '../rentals/rentals.module';

@Module({
  imports: [RentalsModule],
  controllers: [TelemetryController, NotificationsController, CronController],
  providers: [MachineStatusService, StatusSweepService],
  exports: [MachineStatusService],
})
export class StatusModule {}
