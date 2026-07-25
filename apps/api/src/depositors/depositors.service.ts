import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** UPI IDs are personal data; show only the tail so the list stays readable
 *  without spilling full identifiers across the admin's screen. */
const maskUpi = (upi: string): string => {
  const [name, handle] = upi.split('@');
  const head = name.length <= 2 ? name : `${name.slice(0, 2)}${'•'.repeat(Math.max(1, name.length - 2))}`;
  return handle ? `${head}@${handle}` : head;
};

@Injectable()
export class DepositorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const depositors = await this.prisma.depositor.findMany({
      orderBy: [{ status: 'desc' }, { offenceCount: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        phone: true,
        upiId: true,
        status: true,
        offenceCount: true,
        ignoredCount: true,
        blacklistedAt: true,
        blacklistReason: true,
        createdAt: true,
      },
    });

    return depositors.map((d) => ({
      id: d.id,
      phone: d.phone,
      upiId: maskUpi(d.upiId),
      status: d.status,
      offenceCount: d.offenceCount,
      ignoredCount: d.ignoredCount,
      blacklistedAt: d.blacklistedAt,
      blacklistReason: d.blacklistReason,
      createdAt: d.createdAt,
    }));
  }

  async detail(id: string) {
    const d = await this.prisma.depositor.findUnique({
      where: { id },
      include: {
        deposits: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            outcome: true,
            rejectionReason: true,
            isOffence: true,
            weightDeltaG: true,
            amountPaise: true,
            createdAt: true,
            machine: { select: { serialNo: true } },
          },
        },
        statusEvents: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!d) throw new NotFoundException('Unknown depositor');

    return {
      id: d.id,
      phone: d.phone,
      upiId: maskUpi(d.upiId),
      status: d.status,
      offenceCount: d.offenceCount,
      ignoredCount: d.ignoredCount,
      blacklistedAt: d.blacklistedAt,
      blacklistReason: d.blacklistReason,
      createdAt: d.createdAt,
      recent: d.deposits,
      statusEvents: d.statusEvents,
    };
  }

  /**
   * Reinstate a blacklisted depositor (spec §6.2 "managing/reviewing blacklisted
   * accounts"; open question #1). Refused when the platform's blacklist policy
   * is 'permanent', so the configured policy is actually enforced rather than
   * quietly bypassed by an admin click.
   *
   * Lifts the UPI-level ban, resets the offence count so the user isn't
   * re-blacklisted by their next single mistake, and records who did it.
   */
  async reinstate(depositorId: string, adminId: string, reason?: string) {
    const [depositor, settings] = await Promise.all([
      this.prisma.depositor.findUnique({ where: { id: depositorId } }),
      this.prisma.platformSettings.findUniqueOrThrow({ where: { id: true } }),
    ]);
    if (!depositor) throw new NotFoundException('Unknown depositor');
    if (depositor.status !== 'blacklisted') return { alreadyActive: true };

    if (settings.blacklistMode === 'permanent') {
      throw new BadRequestException(
        'Blacklisting is set to permanent. Change the blacklist policy to allow appeals.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.depositor.update({
        where: { id: depositorId },
        data: {
          status: 'active',
          offenceCount: 0,
          blacklistedAt: null,
          blacklistReason: null,
        },
      });
      await tx.blacklistedUpi.updateMany({
        where: { upiId: depositor.upiId, liftedAt: null },
        data: { liftedAt: new Date(), liftedBy: adminId },
      });
      await tx.accountStatusEvent.create({
        data: {
          depositorId,
          fromStatus: 'blacklisted',
          toStatus: 'active',
          reason: reason?.trim() || 'Reinstated by admin',
          triggeredBy: `admin:${adminId}`,
        },
      });
      // clear the standing alert for this account
      await tx.notification.updateMany({
        where: { depositorId, type: 'blacklist', resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
    });

    return { reinstated: true };
  }
}
