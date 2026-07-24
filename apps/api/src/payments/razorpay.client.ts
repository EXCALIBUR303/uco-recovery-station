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
};

export type CreatePayoutResult = {
  /** RazorpayX's payout id */
  providerId: string;
  /** payout is accepted and in flight — not yet settled */
  status: 'processing';
};

export interface RazorpayClient {
  /** Whether this is the mock (no real money moves). Surfaced to the UI. */
  readonly isMock: boolean;
  createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult>;
}

export const RAZORPAY_CLIENT = Symbol('RAZORPAY_CLIENT');
