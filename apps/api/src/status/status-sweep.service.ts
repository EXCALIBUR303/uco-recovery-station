import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MachineStatusService } from './machine-status.service';

/**
 * The scheduled checks behind spec §7.4 (idle) and the offline detection in the
 * §2 state machine. Both are just a fleet-wide recompute: `deriveStatus` already
 * decides offline (heartbeat gap) and idle (7-day activity gap) from timestamps,
 * so a periodic recompute is all that's needed to catch machines that have gone
 * quiet with no event to trigger them.
 */
@Injectable()
export class StatusSweepService {
  private readonly log = new Logger(StatusSweepService.name);

  constructor(private readonly status: MachineStatusService) {}

  // Offline is time-sensitive (default 5 min heartbeat), so sweep often.
  @Cron(CronExpression.EVERY_MINUTE)
  async offlineSweep(): Promise<void> {
    await this.status.recomputeAll();
  }

  // The idle check only needs to run daily (spec §7.4), but the minute sweep
  // above already covers it; this daily run is a belt-and-braces log marker.
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async dailyIdleCheck(): Promise<void> {
    const n = await this.status.recomputeAll();
    this.log.log(`daily idle check swept ${n} machines`);
  }
}
