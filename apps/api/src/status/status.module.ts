import { Module } from '@nestjs/common';
import { MachineStatusService } from './machine-status.service';
import { StatusSweepService } from './status-sweep.service';
import { TelemetryController } from './telemetry.controller';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [TelemetryController, NotificationsController],
  providers: [MachineStatusService, StatusSweepService],
  exports: [MachineStatusService],
})
export class StatusModule {}
