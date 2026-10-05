/**
 * Boundary between our payout logic and RazorpayX. Coding against this
 * interface means the entire money path can be built and tested with a mock;
 * dropping in real credentials is a one-line swap (see razorpay.provider.ts).
 */

export type CreatePayoutInput = {
  /** dedupe key so a retry never double-pays (RazorpayX idempotency header) */
  idempotencyKey: string;
  upiId: string;
  amountPaise: bigint;
  /** our payout id, echoed back on the settlement webhook */
  referenceId: string;
  /** label only — shown in the RazorpayX dashboard's contact list, not to the depositor */
  depositorName: string;
  /** cached from a previous payout, if any — skips re-registering the contact/VPA */
  razorpayContactId?: string | null;
  razorpayFundAccountId?: string | null;
};

export type CreatePayoutResult = {
  /** RazorpayX's payout id */
  providerId: string;
  /** payout is accepted and in flight — not yet settled */
  status: 'processing';
  /** resolved (created or reused) this call — caller should cache these on the depositor */
  razorpayContactId: string;
  razorpayFundAccountId: string;
};

export type CreateOrderInput = {
  amountPaise: bigint;
  /** our wallet_topup id, echoed back on the payment webhook */
  receipt: string;
};

export type CreateOrderResult = {
  /** Razorpay order id, handed to Checkout on the frontend */
  orderId: string;
};

export interface RazorpayClient {
  /**
   * Orders (Checkout/top-ups) and payouts (RazorpayX) are separate Razorpay
   * products with separate readiness — a deployment can have real order
   * creation live while payouts are still mocked (no RazorpayX account yet).
   * Each is surfaced separately so neither UI nor logs ever call a mocked
   * payout "real" just because orders are.
   */
  readonly ordersAreMock: boolean;
  readonly payoutsAreMock: boolean;
  /** Public key id for Checkout.js on the frontend. Null when orders are mocked. */
  readonly keyId: string | null;
  /** RazorpayX payout to a depositor's UPI. */
  createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult>;
  /** Razorpay Checkout order for a renter wallet top-up. */
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
}

export const RAZORPAY_CLIENT = Symbol('RAZORPAY_CLIENT');
