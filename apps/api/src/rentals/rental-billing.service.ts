import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Rental billing — open-question Q5, stream (a).
 *
 * The flat monthly rental fee is deliberately SEPARATE from the payout wallet:
 * it is company revenue, billed on a fixed cadence regardless of how much (or
 * whether) the machine is used. This service generates the monthly invoices,
 * moves them to overdue after a configurable grace period, and suspends the
 * agreement once arrears exceed grace.
 *
 * A suspended agreement is a BILLING state only — it raises an alert and shows
 * on the dashboard, but does NOT stop the machine. Machine operation stays tied
 * to the payout wallet (spec §9.3). Whether unpaid rent should also disable the
 * machine is a policy decision left open (see README).
 *
 * No ledger entries: the ledger is for payout wallets; rental billing is its
 * own stream (DESIGN.md §1.4).
 */
@Injectable()
export class RentalBillingService {
  private readonly log = new Logger(RentalBillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Daily: generate any invoices now due, then age unpaid ones. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runDaily(): Promise<void> {
    const now = new Date();
    const generated = await this.generateDueInvoices(now);
    const aged = await this.ageUnpaidInvoices(now);
    this.log.log(`rental billing: generated ${generated}, aged ${aged}`);
  }

  /**
   * For each active agreement, emit an invoice for every billing period whose
   * bill date has arrived, catching up if several elapsed while the server was
   * down. Idempotent: an invoice already covering a period is never duplicated.
   */
  async generateDueInvoices(now = new Date()): Promise<number> {
    const agreements = await this.prisma.rentalAgreement.findMany({
      where: { status: 'active' },
    });

    let created = 0;
    for (const a of agreements) {
      let bill = a.nextBillDate;
      while (bill <= now && (a.endDate == null || bill < a.endDate)) {
        const periodEnd = addMonths(bill, 1);
        const existing = await this.prisma.rentalInvoice.findFirst({
          where: { agreementId: a.id, periodStart: bill },
          select: { id: true },
        });
        if (!existing) {
          await this.prisma.rentalInvoice.create({
            data: {
              agreementId: a.id,
              periodStart: bill,
              periodEnd,
              amountPaise: a.monthlyFeePaise,
              status: 'due',
              dueDate: bill, // payment expected on the bill date; grace applies after
            },
          });
          created++;
        }
        bill = periodEnd;
      }
      if (bill.getTime() !== a.nextBillDate.getTime()) {
        await this.prisma.rentalAgreement.update({
          where: { id: a.id },
          data: { nextBillDate: bill },
        });
      }
    }
    return created;
  }

  /**
   * Move due invoices to overdue once past the grace window, raise a
   * rental_overdue alert, and suspend the agreement.
   */
  async ageUnpaidInvoices(now = new Date()): Promise<number> {
    const settings = await this.prisma.platformSettings.findUniqueOrThrow({
      where: { id: true },
    });

    const candidates = await this.prisma.rentalInvoice.findMany({
      where: { status: 'due' },
      include: { agreement: true },
    });

    let aged = 0;
    for (const inv of candidates) {
      const overdueAt = addDays(inv.dueDate, settings.rentalGraceDays);
      if (now <= overdueAt) continue;

      await this.prisma.$transaction(async (tx) => {
        await tx.rentalInvoice.update({
          where: { id: inv.id },
          data: { status: 'overdue' },
        });
        if (inv.agreement.status === 'active') {
          await tx.rentalAgreement.update({
            where: { id: inv.agreement.id },
            data: { status: 'suspended' },
          });
        }
        await this.raiseOverdueIfAbsent(tx, inv.agreement.machineId, inv.agreement.renterId, now);
      });
      aged++;
    }
    return aged;
  }

  /**
   * Record a received payment (admin action). Online payment via Razorpay is a
   * later step; this lets a bank transfer or cash payment be reconciled now.
   */
  async markPaid(invoiceId: string, now = new Date()) {
    const inv = await this.prisma.rentalInvoice.findUnique({
      where: { id: invoiceId },
      include: { agreement: true },
    });
    if (!inv) throw new NotFoundException('Unknown invoice');
    if (inv.status === 'paid') return { alreadyPaid: true };

    await this.prisma.$transaction(async (tx) => {
      await tx.rentalInvoice.update({
        where: { id: inv.id },
        data: { status: 'paid', paidAt: now },
      });

      const stillOverdue = await tx.rentalInvoice.count({
        where: { agreementId: inv.agreementId, status: 'overdue', id: { not: inv.id } },
      });

      if (stillOverdue === 0) {
        // Clear the alert and lift the suspension — arrears are settled.
        await tx.notification.updateMany({
          where: { machineId: inv.agreement.machineId, type: 'rental_overdue', resolvedAt: null },
          data: { resolvedAt: now },
        });
        if (inv.agreement.status === 'suspended') {
          await tx.rentalAgreement.update({
            where: { id: inv.agreementId },
            data: { status: 'active' },
          });
        }
      }
    });
    return { paid: true };
  }

  private async raiseOverdueIfAbsent(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    machineId: string,
    renterId: string,
    now: Date,
  ): Promise<void> {
    const targets: { role: 'admin' | 'renter'; user: string | null }[] = [
      { role: 'admin', user: null },
      { role: 'renter', user: renterId },
    ];
    for (const t of targets) {
      const existing = await tx.notification.findFirst({
        where: {
          machineId,
          type: 'rental_overdue',
          resolvedAt: null,
          targetRole: t.role,
          targetUser: t.user,
        },
        select: { id: true },
      });
      if (!existing) {
        await tx.notification.create({
          data: {
            type: 'rental_overdue',
            machineId,
            targetRole: t.role,
            targetUser: t.user,
            createdAt: now,
          },
        });
      }
    }
  }
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
