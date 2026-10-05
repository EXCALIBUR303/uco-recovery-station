import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomBytes } from 'node:crypto';
import type {
  CreateOrderInput,
  CreateOrderResult,
  CreatePayoutInput,
  CreatePayoutResult,
  RazorpayClient,
} from './razorpay.client';

/** Emitted after the mock "captures" a top-up payment, so TopupService credits. */
export type TopupSettledEvent = { topupId: string; outcome: 'paid' | 'failed' };
export const TOPUP_SETTLED = 'topup.settled';

/**
 * Stand-in for RazorpayX used when no real credentials are configured.
 *
 * Payouts do NOT auto-settle: without a real RazorpayX account, nothing pays
 * the depositor automatically, so the payout is accepted ("processing", same
 * shape as the real API) and left there for an admin to pay by hand — via
 * their own UPI app — and confirm through PayoutService.confirmManual /
 * failManual (see the pending-payouts admin endpoints). This is honest about
 * the real state of the money rather than pretending it settled.
 */
@Injectable()
export class MockRazorpayClient implements RazorpayClient {
  readonly ordersAreMock = true;
  readonly payoutsAreMock = true;
  readonly keyId = null;
  private readonly log = new Logger(MockRazorpayClient.name);

  constructor(private readonly events: EventEmitter2) {}

  async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
    const providerId = `manual_${randomBytes(8).toString('hex')}`;

    this.log.warn(
      `MANUAL payout ${providerId} for ${input.upiId} (${input.amountPaise} paise) — ` +
        'no RazorpayX account configured; pay this by hand and confirm it from the admin dashboard.',
    );

    return {
      providerId,
      status: 'processing',
      razorpayContactId: input.razorpayContactId ?? `manual_contact_${randomBytes(6).toString('hex')}`,
      razorpayFundAccountId:
        input.razorpayFundAccountId ?? `manual_fa_${randomBytes(6).toString('hex')}`,
    };
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const orderId = `mock_order_${randomBytes(8).toString('hex')}`;
    this.log.warn(
      `MOCK top-up order ${orderId} for ${input.amountPaise} paise — no real payment; auto-capturing`,
    );
    // A real top-up needs the user to complete Checkout; the mock just captures.
    setTimeout(() => {
      this.events.emit(TOPUP_SETTLED, {
        topupId: input.receipt,
        outcome: 'paid',
      } satisfies TopupSettledEvent);
    }, 300);
    return { orderId };
  }
}
