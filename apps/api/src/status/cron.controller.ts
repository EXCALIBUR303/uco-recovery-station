import { Controller, Get, Headers, Logger, UnauthorizedException } from '@nestjs/common';
import { MachineStatusService } from './machine-status.service';
import { RentalBillingService } from '../rentals/rental-billing.service';

/**
 * Replaces the in-process @Cron sweeps (status-sweep.service.ts,
 * rental-billing.service.ts) when the API runs as a Vercel serverless
 * function — a stateless function has no persistent process for
 * @nestjs/schedule's timers to live in, so an external scheduler (Vercel
 * Cron) has to call in instead. Kept as a single combined endpoint since
 * Vercel Cron only invokes with GET and Hobby-tier crons cap out at once a
 * day, so there is no benefit to separate schedules right now.
 *
 * Not JWT-guarded — a cron trigger has no user session — but requires
 * CRON_SECRET so this can't be hit by anyone who finds the URL. Vercel sends
 * `Authorization: Bearer <CRON_SECRET>` automatically for cron-configured
 * routes once that env var is set on the project.
 */
@Controller('internal/cron')
export class CronController {
  private readonly log = new Logger(CronController.name);

  constructor(
    private readonly status: MachineStatusService,
    private readonly billing: RentalBillingService,
  ) {}

  @Get('sweep')
  async sweep(@Headers('authorization') auth?: string) {
    const secret = process.env.CRON_SECRET;
    if (!secret || auth !== `Bearer ${secret}`) {
      throw new UnauthorizedException();
    }

    const recomputed = await this.status.recomputeAll();
    const now = new Date();
    const generated = await this.billing.generateDueInvoices(now);
    const aged = await this.billing.ageUnpaidInvoices(now);

    this.log.log(
      `cron sweep: recomputed ${recomputed} machines, generated ${generated} invoices, aged ${aged}`,
    );
    return { recomputed, generated, aged };
  }
}
