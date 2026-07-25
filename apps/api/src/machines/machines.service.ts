import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MachineStatusService } from '../status/machine-status.service';
import { machineScopeFor, type AuthUser } from '../auth/auth-user';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class MachinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly status: MachineStatusService,
  ) {}

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

  /**
   * Daily activity buckets for the traffic / rejection-rate charts (spec §5.1,
   * §6.1 "traffic volume over time"). Scoped like everything else.
   */
  async series(user: AuthUser, id: string, days = 30) {
    await this.detail(user, id); // reuses the existence + scope check

    const span = Math.min(Math.max(days, 7), 90);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (span - 1));
    since.setUTCHours(0, 0, 0, 0);

    const deposits = await this.prisma.deposit.findMany({
      where: { machineId: id, createdAt: { gte: since } },
      select: { outcome: true, createdAt: true, weightDeltaG: true },
    });

    // Pre-seed every day so gaps render as zero rather than vanishing.
    const buckets = new Map<
      string,
      { day: string; accepted: number; rejected: number; ignored: number; weightG: number }
    >();
    for (let i = 0; i < span; i++) {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { day: key, accepted: 0, rejected: 0, ignored: 0, weightG: 0 });
    }
    for (const dep of deposits) {
      const key = dep.createdAt.toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (!b) continue;
      b[dep.outcome] += 1;
      if (dep.outcome === 'accepted') b.weightG += dep.weightDeltaG;
    }

    return { days: span, points: [...buckets.values()] };
  }

  /**
   * Assign a machine to a renter, or hand it back to the company (spec §6.2 /
   * §7.1). Assigning repoints the machine's funding wallet at the renter's, so
   * payouts there draw on the renter's balance from that moment on, and opens a
   * rental agreement at the agreed monthly fee.
   */
  async assign(
    machineId: string,
    input: { renterId: string | null; monthlyFeePaise?: bigint },
  ) {
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) throw new NotFoundException('Unknown machine');

    // --- hand back to the company ---
    if (!input.renterId) {
      const companyWallet = await this.prisma.wallet.findFirst({
        where: { ownerType: 'company', ownerId: null },
      });
      if (!companyWallet) throw new BadRequestException('No company wallet exists');

      await this.prisma.$transaction(async (tx) => {
        await tx.rentalAgreement.updateMany({
          where: { machineId, status: { not: 'terminated' } },
          data: { status: 'terminated', endDate: new Date() },
        });
        await tx.machine.update({
          where: { id: machineId },
          data: {
            ownership: 'company',
            renterId: null,
            fundingWalletId: companyWallet.id,
          },
        });
      });
      await this.status.recompute(machineId);
      return { ownership: 'company' as const };
    }

    // --- assign to a renter ---
    const renter = await this.prisma.dashboardUser.findUnique({
      where: { id: input.renterId },
    });
    if (!renter || renter.role !== 'renter') throw new NotFoundException('Unknown renter');
    // Approval gate: the company vets a renter before trusting them with a unit.
    if (!renter.approvedAt) {
      throw new BadRequestException('Approve this renter before assigning a machine');
    }
    if (!input.monthlyFeePaise || input.monthlyFeePaise <= 0n) {
      throw new BadRequestException('Set a monthly rental fee');
    }

    const wallet = await this.prisma.wallet.findFirst({
      where: { ownerType: 'renter', ownerId: renter.id },
    });
    if (!wallet) throw new BadRequestException('This renter has no wallet');

    await this.prisma.$transaction(async (tx) => {
      // close any agreement from a previous renter
      await tx.rentalAgreement.updateMany({
        where: { machineId, status: { not: 'terminated' } },
        data: { status: 'terminated', endDate: new Date() },
      });

      const start = new Date();
      const nextBill = new Date(start);
      nextBill.setMonth(nextBill.getMonth() + 1);
      await tx.rentalAgreement.create({
        data: {
          renterId: renter.id,
          machineId,
          monthlyFeePaise: input.monthlyFeePaise!,
          startDate: start,
          nextBillDate: nextBill,
        },
      });

      await tx.machine.update({
        where: { id: machineId },
        data: {
          ownership: 'rented',
          renterId: renter.id,
          fundingWalletId: wallet.id,
        },
      });
    });

    // The funding wallet changed, so the machine may now be balance_zero.
    await this.status.recompute(machineId);
    return { ownership: 'rented' as const, renterId: renter.id };
  }

  /** Adjust commercial + calibration settings for one machine (spec §6.2). */
  async update(
    machineId: string,
    input: {
      label?: string | null;
      locationText?: string | null;
      ratePerKgPaise?: bigint;
      minWeightDeltaG?: number | null;
    },
  ) {
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) throw new NotFoundException('Unknown machine');

    if (input.ratePerKgPaise != null && input.ratePerKgPaise <= 0n) {
      throw new BadRequestException('Rate must be greater than zero');
    }
    if (input.minWeightDeltaG != null && input.minWeightDeltaG < 0) {
      throw new BadRequestException('Threshold cannot be negative');
    }

    const updated = await this.prisma.machine.update({
      where: { id: machineId },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.locationText !== undefined ? { locationText: input.locationText } : {}),
        ...(input.ratePerKgPaise != null ? { ratePerKgPaise: input.ratePerKgPaise } : {}),
        ...(input.minWeightDeltaG !== undefined
          ? { minWeightDeltaG: input.minWeightDeltaG }
          : {}),
      },
    });
    return {
      id: updated.id,
      label: updated.label,
      locationText: updated.locationText,
      ratePerKgPaise: updated.ratePerKgPaise,
      minWeightDeltaG: updated.minWeightDeltaG,
    };
  }

  /**
   * Issue a fresh telemetry credential for a machine. The raw secret is shown
   * once (it is only stored hashed) and must be flashed into that machine's
   * firmware; from then on telemetry without it is rejected.
   */
  async rotateDeviceSecret(machineId: string) {
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) throw new NotFoundException('Unknown machine');

    const secret = randomBytes(24).toString('hex');
    await this.prisma.machine.update({
      where: { id: machineId },
      data: { deviceSecretHash: sha256(secret) },
    });
    return { serialNo: machine.serialNo, deviceSecret: secret };
  }
}
