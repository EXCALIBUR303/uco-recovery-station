import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { MachineStatusService } from '../status/machine-status.service';
import { WalletService } from './wallet.service';
import { RAZORPAY_CLIENT, type RazorpayClient } from './razorpay.client';
import { TOPUP_SETTLED, type TopupSettledEvent } from './mock-razorpay.client';

const MIN_TOPUP_PAISE = 10_000n; // ₹100

/**
 * Renter wallet top-ups (spec §7.3). A renter adds funds that their machines
 * then draw on to pay depositors. Money in via Razorpay Checkout; the credit is
 * applied only once the payment is confirmed (mock event / real webhook), never
 * on order creation — an unpaid order must not inflate the balance.
 */
@Injectable()
export class TopupService {
  private readonly log = new Logger(TopupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly status: MachineStatusService,
    @Inject(RAZORPAY_CLIENT) private readonly razorpay: RazorpayClient,
  ) {}

  /** Begin a top-up: record it and open a Razorpay order. */
  async initiate(walletId: string, amountPaise: bigint) {
    if (amountPaise < MIN_TOPUP_PAISE) {
      throw new BadRequestException(`Minimum top-up is ₹${Number(MIN_TOPUP_PAISE) / 100}`);
    }

    const topup = await this.prisma.walletTopup.create({
      data: { walletId, amountPaise, status: 'created' },
    });

    const order = await this.razorpay.createOrder({
      amountPaise,
      receipt: topup.id,
    });
    await this.prisma.walletTopup.update({
      where: { id: topup.id },
      data: { razorpayOrderId: order.orderId },
    });

    return {
      topupId: topup.id,
      orderId: order.orderId,
      isMock: this.razorpay.ordersAreMock,
      keyId: this.razorpay.keyId,
    };
  }

  /** Mock capture path. */
  @OnEvent(TOPUP_SETTLED)
  async onMockSettled(e: TopupSettledEvent): Promise<void> {
    if (e.outcome === 'paid') await this.confirm(e.topupId);
    else await this.markFailed(e.topupId);
  }

  /**
   * Credit the wallet exactly once. Idempotent: a duplicate confirmation for an
   * already-succeeded top-up is ignored.
   */
  async confirm(topupId: string, razorpayPaymentId?: string): Promise<void> {
    const topup = await this.prisma.walletTopup.findUnique({ where: { id: topupId } });
    if (!topup || topup.status === 'succeeded') return;

    await this.prisma.$transaction(async (tx) => {
      await this.wallet.credit(tx, topup.walletId, topup.amountPaise, {
        reason: 'topup',
        refType: 'topup',
        refId: topup.id,
      });
      await tx.walletTopup.update({
        where: { id: topup.id },
        data: { status: 'succeeded', razorpayPaymentId },
      });
    });

    // A top-up may lift a rented machine out of balance_zero — recompute so the
    // status and its alert clear.
    const machines = await this.prisma.machine.findMany({
      where: { fundingWalletId: topup.walletId },
      select: { id: true },
    });
    for (const m of machines) await this.status.recompute(m.id);

    this.log.log(`top-up ${topup.id} credited ${topup.amountPaise} paise`);
  }

  private async markFailed(topupId: string): Promise<void> {
    await this.prisma.walletTopup.updateMany({
      where: { id: topupId, status: { not: 'succeeded' } },
      data: { status: 'failed' },
    });
  }
}
