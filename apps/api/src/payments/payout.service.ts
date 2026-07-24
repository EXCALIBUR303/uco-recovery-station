import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService, InsufficientFundsError } from './wallet.service';
import { RAZORPAY_CLIENT, type RazorpayClient } from './razorpay.client';
import { PAYOUT_SETTLED, type PayoutSettledEvent } from './mock-razorpay.client';

/**
 * Owns the money lifecycle of an accepted deposit (DESIGN.md §3.6):
 *
 *   reserve funds → create payout → call RazorpayX → return (kiosk shows paid)
 *                                        │
 *                        settlement webhook / mock event
 *                                        │
 *              success → capture hold          failure → release hold
 *
 * A failed payout is a money problem, retried or refunded — never an offence
 * against the depositor (that only comes from sensor rejections).
 */
@Injectable()
export class PayoutService {
  private readonly log = new Logger(PayoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    @Inject(RAZORPAY_CLIENT) private readonly razorpay: RazorpayClient,
  ) {}

  get usingMock(): boolean {
    return this.razorpay.isMock;
  }

  /**
   * Kick off payment for an accepted deposit. Returns the payout status the
   * kiosk should reflect. Safe to call once per deposit — the unique deposit_id
   * on payouts prevents a double payout.
   */
  async initiate(depositId: string): Promise<{
    status: 'processing' | 'failed';
    reason?: string;
    isMock: boolean;
  }> {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id: depositId },
      include: { depositor: true, machine: { select: { fundingWalletId: true } } },
    });
    if (!deposit || deposit.outcome !== 'accepted' || deposit.amountPaise == null) {
      throw new Error('Payout requested for a non-accepted deposit');
    }
    if (!deposit.machine.fundingWalletId) {
      throw new Error('Machine has no funding wallet');
    }

    const existing = await this.prisma.payout.findUnique({ where: { depositId } });
    if (existing) {
      return {
        status: existing.status === 'failed' ? 'failed' : 'processing',
        isMock: this.razorpay.isMock,
      };
    }

    const walletId = deposit.machine.fundingWalletId;
    const amount = deposit.amountPaise;
    const idempotencyKey = `dep_${deposit.id}`;

    // Reserve + create the payout row atomically. If the wallet can't cover it
    // (a race past the balance_zero gate), record a failed payout and alert —
    // the oil is already in the drum, so we never silently drop it.
    let payoutId: string;
    try {
      payoutId = await this.prisma.$transaction(async (tx) => {
        await this.wallet.reserve(tx, walletId, amount);
        const payout = await tx.payout.create({
          data: {
            depositId: deposit.id,
            depositorId: deposit.depositorId,
            walletId,
            upiId: deposit.depositor.upiId,
            amountPaise: amount,
            status: 'pending',
            idempotencyKey,
          },
        });
        return payout.id;
      });
    } catch (e) {
      if (e instanceof InsufficientFundsError) {
        await this.recordUnfundable(deposit.id, deposit.depositorId, walletId, amount, deposit.machine.fundingWalletId);
        return { status: 'failed', reason: 'insufficient_funds', isMock: this.razorpay.isMock };
      }
      throw e;
    }

    // Call the provider outside the DB transaction (network call).
    try {
      const res = await this.razorpay.createPayout({
        idempotencyKey,
        upiId: deposit.depositor.upiId,
        amountPaise: amount,
        referenceId: payoutId,
      });
      await this.prisma.payout.update({
        where: { id: payoutId },
        data: { status: 'processing', razorpayxPayoutId: res.providerId },
      });
      return { status: 'processing', isMock: this.razorpay.isMock };
    } catch (e) {
      // Provider rejected the request outright — release the hold, mark failed.
      this.log.error(`createPayout failed for ${payoutId}: ${String(e)}`);
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.release(tx, walletId, amount);
        await tx.payout.update({
          where: { id: payoutId },
          data: { status: 'failed', failureReason: 'provider_rejected' },
        });
      });
      await this.alertPayoutFailed(deposit.machine.fundingWalletId, payoutId);
      return { status: 'failed', reason: 'provider_rejected', isMock: this.razorpay.isMock };
    }
  }

  /** Real RazorpayX webhook path. */
  async settle(providerId: string, outcome: 'processed' | 'failed'): Promise<void> {
    const payout = await this.prisma.payout.findFirst({
      where: { razorpayxPayoutId: providerId },
    });
    if (!payout) {
      this.log.warn(`settlement for unknown provider payout ${providerId}`);
      return;
    }
    await this.finalize(payout.id, outcome);
  }

  /** Mock settlement path (same finalisation, different trigger). */
  @OnEvent(PAYOUT_SETTLED)
  async onMockSettled(e: PayoutSettledEvent): Promise<void> {
    await this.finalize(e.referenceId, e.outcome);
  }

  /**
   * Apply a terminal settlement exactly once. Idempotent: a duplicate webhook
   * for an already-settled payout is ignored.
   */
  private async finalize(payoutId: string, outcome: 'processed' | 'failed'): Promise<void> {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) return;
    if (payout.status === 'succeeded' || payout.status === 'failed' || payout.status === 'reversed') {
      return; // already terminal
    }

    if (outcome === 'processed') {
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.capture(tx, payout.walletId, payout.amountPaise, {
          reason: 'payout_capture',
          refType: 'payout',
          refId: payout.id,
        });
        await tx.payout.update({ where: { id: payout.id }, data: { status: 'succeeded' } });
        await tx.machine.update({
          where: { id: (await tx.deposit.findUniqueOrThrow({ where: { id: payout.depositId }, select: { machineId: true } })).machineId },
          data: { totalPaidOutPaise: { increment: payout.amountPaise } },
        });
      });
      this.log.log(`payout ${payout.id} succeeded (${payout.amountPaise} paise)`);
    } else {
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.release(tx, payout.walletId, payout.amountPaise);
        await tx.payout.update({
          where: { id: payout.id },
          data: { status: 'failed', failureReason: 'settlement_failed' },
        });
      });
      await this.alertPayoutFailed(payout.walletId, payout.id);
      this.log.warn(`payout ${payout.id} failed at settlement — hold released`);
    }
  }

  private async recordUnfundable(
    depositId: string,
    depositorId: string,
    walletId: string,
    amount: bigint,
    _fundingWalletId: string,
  ): Promise<void> {
    await this.prisma.payout.create({
      data: {
        depositId,
        depositorId,
        walletId,
        upiId: '',
        amountPaise: amount,
        status: 'failed',
        failureReason: 'insufficient_funds',
        idempotencyKey: `dep_${depositId}`,
      },
    });
    await this.alertPayoutFailed(walletId, depositId);
  }

  private async alertPayoutFailed(walletId: string, ref: string): Promise<void> {
    // Attach to the machine funded by this wallet so it surfaces on the fleet view.
    const machine = await this.prisma.machine.findFirst({
      where: { fundingWalletId: walletId },
      select: { id: true, renterId: true },
    });
    await this.prisma.notification.create({
      data: {
        type: 'payout_failed',
        machineId: machine?.id ?? null,
        targetRole: 'admin',
        payload: { ref },
      },
    });
  }
}
