import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { machineScopeFor, type AuthUser } from '../auth/auth-user';

@Injectable()
export class MachinesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Fleet list, scoped to what this user is allowed to see. */
  async list(user: AuthUser) {
    const machines = await this.prisma.machine.findMany({
      where: machineScopeFor(user),
      orderBy: { serialNo: 'asc' },
      include: {
        renter: { select: { id: true, displayName: true } },
        fundingWallet: { select: { balancePaise: true, heldPaise: true } },
      },
    });

    return machines.map((m) => ({
      id: m.id,
      serialNo: m.serialNo,
      label: m.label,
      locationText: m.locationText,
      ownership: m.ownership,
      renter: m.renter,
      effectiveStatus: m.effectiveStatus,
      isIdle: m.isIdle,
      drumFillPct: m.drumFillPct,
      rejectFillPct: m.rejectFillPct,
      totalWeightG: m.totalWeightG,
      totalPaidOutPaise: m.totalPaidOutPaise,
      ratePerKgPaise: m.ratePerKgPaise,
      walletBalancePaise: m.fundingWallet?.balancePaise ?? null,
      lastTelemetryAt: m.lastTelemetryAt,
      lastActivityAt: m.lastActivityAt,
    }));
  }

  /** Per-machine detail with recent transactions and a rejection breakdown. */
  async detail(user: AuthUser, id: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id },
      include: {
        renter: { select: { id: true, displayName: true } },
        fundingWallet: { select: { balancePaise: true, heldPaise: true } },
      },
    });
    if (!machine) throw new NotFoundException('Unknown machine');

    // Scope check enforced here too, not only in the list — a renter must not
    // reach another machine by guessing its id (spec §9.2).
    if (user.role !== 'admin' && machine.renterId !== user.sub) {
      throw new ForbiddenException('Not your machine');
    }

    const [recent, byOutcome] = await Promise.all([
      this.prisma.deposit.findMany({
        where: { machineId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          outcome: true,
          rejectionReason: true,
          weightDeltaG: true,
          amountPaise: true,
          createdAt: true,
        },
      }),
      this.prisma.deposit.groupBy({
        by: ['outcome'],
        where: { machineId: id },
        _count: { _all: true },
      }),
    ]);

    const counts = { accepted: 0, rejected: 0, ignored: 0 };
    for (const row of byOutcome) counts[row.outcome] = row._count._all;

    return {
      id: machine.id,
      serialNo: machine.serialNo,
      label: machine.label,
      locationText: machine.locationText,
      ownership: machine.ownership,
      renter: machine.renter,
      effectiveStatus: machine.effectiveStatus,
      isIdle: machine.isIdle,
      drumFillPct: machine.drumFillPct,
      rejectFillPct: machine.rejectFillPct,
      totalWeightG: machine.totalWeightG,
      totalPaidOutPaise: machine.totalPaidOutPaise,
      ratePerKgPaise: machine.ratePerKgPaise,
      walletBalancePaise: machine.fundingWallet?.balancePaise ?? null,
      lastTelemetryAt: machine.lastTelemetryAt,
      lastActivityAt: machine.lastActivityAt,
      counts,
      recent,
    };
  }
}
