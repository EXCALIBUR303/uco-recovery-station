import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';

@Injectable()
export class RentalsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Agreements with their latest invoice and outstanding balance. Scoped. */
  async list(user: AuthUser) {
    const agreements = await this.prisma.rentalAgreement.findMany({
      where: user.role === 'admin' ? {} : { renterId: user.sub },
      orderBy: { createdAt: 'asc' },
      include: {
        machine: { select: { serialNo: true, label: true } },
        renter: { select: { id: true, displayName: true } },
        invoices: { orderBy: { periodStart: 'desc' } },
      },
    });

    return agreements.map((a) => {
      const outstanding = a.invoices
        .filter((i) => i.status === 'due' || i.status === 'overdue')
        .reduce((s, i) => s + i.amountPaise, 0n);
      return {
        id: a.id,
        machine: a.machine,
        renter: a.renter,
        status: a.status,
        monthlyFeePaise: a.monthlyFeePaise,
        startDate: a.startDate,
        nextBillDate: a.nextBillDate,
        outstandingPaise: outstanding,
        invoices: a.invoices.map((i) => ({
          id: i.id,
          periodStart: i.periodStart,
          periodEnd: i.periodEnd,
          amountPaise: i.amountPaise,
          status: i.status,
          dueDate: i.dueDate,
          paidAt: i.paidAt,
        })),
      };
    });
  }
}
