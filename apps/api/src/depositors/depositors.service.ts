import { Injectable, NotFoundException } from '@nestjs/common';
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
}
