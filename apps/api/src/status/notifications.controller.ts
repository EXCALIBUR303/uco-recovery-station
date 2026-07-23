import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MachineStatusService } from './machine-status.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user';

@UseGuards(JwtGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly status: MachineStatusService,
  ) {}

  /** Open (unresolved) alerts this user should see. Renters see only their own. */
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const scope =
      user.role === 'admin'
        ? { targetRole: 'admin' as const }
        : { targetRole: 'renter' as const, targetUser: user.sub };

    const rows = await this.prisma.notification.findMany({
      where: { ...scope, resolvedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { machine: { select: { serialNo: true, label: true } } },
    });

    return rows.map((n) => ({
      id: n.id,
      type: n.type,
      machine: n.machine ? { serialNo: n.machine.serialNo, label: n.machine.label } : null,
      createdAt: n.createdAt,
    }));
  }

  /**
   * Force a fleet-wide status recompute. Admin-only, and only really needed for
   * testing — in normal operation the scheduled sweep does this. Lets us verify
   * the idle/offline logic without waiting for the cron or a real 7-day gap.
   */
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post('recompute')
  async recompute() {
    const count = await this.status.recomputeAll();
    return { recomputed: count };
  }
}
