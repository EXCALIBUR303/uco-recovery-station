import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MachineStatusService } from './machine-status.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user';

// A user only ever sees, and can only ever dismiss, alerts targeted to them.
function scopeFor(user: AuthUser): Prisma.NotificationWhereInput {
  return user.role === 'admin'
    ? { targetRole: 'admin' }
    : { targetRole: 'renter', targetUser: user.sub };
}

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
    const rows = await this.prisma.notification.findMany({
      where: { ...scopeFor(user), resolvedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        machine: { select: { serialNo: true, label: true } },
        depositor: { select: { id: true, phone: true } },
      },
    });

    return rows.map((n) => ({
      id: n.id,
      type: n.type,
      machine: n.machine ? { serialNo: n.machine.serialNo, label: n.machine.label } : null,
      depositor: n.depositor ? { id: n.depositor.id, phone: n.depositor.phone } : null,
      createdAt: n.createdAt,
    }));
  }

  /**
   * Dismiss alerts. Pass specific ids, or `all: true` to clear everything the
   * caller can see. Scoped, so one user can never resolve another's alerts.
   * Only clears alerts the system won't immediately re-raise — a machine that's
   * still offline keeps its alert; an acknowledged blacklist stays dismissed.
   */
  @Post('resolve')
  async resolve(
    @CurrentUser() user: AuthUser,
    @Body() body: { ids?: string[]; all?: boolean },
  ) {
    const where: Prisma.NotificationWhereInput = {
      ...scopeFor(user),
      resolvedAt: null,
      ...(body?.all ? {} : { id: { in: body?.ids ?? [] } }),
    };
    const { count } = await this.prisma.notification.updateMany({
      where,
      data: { resolvedAt: new Date() },
    });
    return { resolved: count };
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
