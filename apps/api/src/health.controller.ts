import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

/**
 * Smoke test for the data model: proves the API can reach Postgres and read
 * the tables the rest of the build order depends on.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const [machines, depositors, deposits, wallets, settings] =
      await Promise.all([
        this.prisma.machine.count(),
        this.prisma.depositor.count(),
        this.prisma.deposit.count(),
        this.prisma.wallet.count(),
        this.prisma.platformSettings.findUnique({ where: { id: true } }),
      ]);

    return {
      status: 'ok',
      database: 'connected',
      counts: { machines, depositors, deposits, wallets },
      settings: settings && {
        minWeightDeltaG: settings.defaultMinWeightDeltaG,
        blacklistThreshold: settings.blacklistThreshold,
        blacklistMode: settings.blacklistMode,
        idleAlertDays: settings.idleAlertDays,
        offlineAfterSeconds: settings.offlineAfterSeconds,
      },
    };
  }
}
