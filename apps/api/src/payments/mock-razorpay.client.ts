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

/** Emitted after the mock "settles" a payout, so PayoutService can finalise it. */
export type PayoutSettledEvent = {
  providerId: string;
  referenceId: string;
  outcome: 'processed' | 'failed';
};
export const PAYOUT_SETTLED = 'payout.settled';

/** Emitted after the mock "captures" a top-up payment, so TopupService credits. */
export type TopupSettledEvent = { topupId: string; outcome: 'paid' | 'failed' };
export const TOPUP_SETTLED = 'topup.settled';

/**
 * Stand-in for RazorpayX used when no real credentials are configured. It
 * accepts the payout (returns "processing", exactly like the real API), then
 * asynchronously emits a settlement event a moment later — modelling RazorpayX's
 * out-of-band webhook, so the kiosk's "paid" screen (shown on acceptance, spec
 * §3.6) is never blocked on settlement.
 *
 * Deterministic failure hook for testing: any UPI on the `@fail` handle settles
 * as failed, so the release-hold path can be exercised without real money.
 */
@Injectable()
export class MockRazorpayClient implements RazorpayClient {
  readonly isMock = true;
  private readonly log = new Logger(MockRazorpayClient.name);

  constructor(private readonly events: EventEmitter2) {}

  async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
    const providerId = `mock_po_${randomBytes(8).toString('hex')}`;
    const outcome: PayoutSettledEvent['outcome'] = input.upiId.endsWith('@fail')
      ? 'failed'
      : 'processed';

    this.log.warn(
      `MOCK payout ${providerId} for ${input.upiId} (${input.amountPaise} paise) — no real money moves; will settle as ${outcome}`,
    );

    // Settle out-of-band, like a real webhook would arrive.
    setTimeout(() => {
      this.events.emit(PAYOUT_SETTLED, {
        providerId,
        referenceId: input.referenceId,
        outcome,
      } satisfies PayoutSettledEvent);
    }, 300);

    return { providerId, status: 'processing' };
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
