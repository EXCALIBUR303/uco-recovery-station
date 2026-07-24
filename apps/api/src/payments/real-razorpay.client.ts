import { Logger } from '@nestjs/common';
import type {
  CreatePayoutInput,
  CreatePayoutResult,
  RazorpayClient,
} from './razorpay.client';

export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  accountNumber: string;
  /** UPI payouts go out over IMPS/UPI; RazorpayX picks the rail */
  mode?: string;
};

/**
 * Real RazorpayX Payouts client. Selected automatically once RAZORPAY_KEY_ID,
 * RAZORPAY_KEY_SECRET and RAZORPAYX_ACCOUNT_NUMBER are set (razorpay.provider.ts).
 *
 * Settlement is asynchronous: this call returns once RazorpayX accepts the
 * payout; the final processed/failed/reversed state arrives on the webhook
 * handled by WebhookController. That is why the flow uses a hold that is only
 * captured on the webhook, never on this response.
 *
 * NOTE: fetch-based, no SDK dependency. Contact points to verify against the
 * live API before real use: the fund-account/VPA creation step (a UPI payout
 * needs a contact + fund_account), and the exact idempotency header name.
 */
export class RealRazorpayClient implements RazorpayClient {
  readonly isMock = false;
  private readonly log = new Logger(RealRazorpayClient.name);
  private readonly auth: string;

  constructor(private readonly cfg: RazorpayConfig) {
    this.auth = Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64');
  }

  async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
    // A real UPI payout first needs a contact + fund_account (VPA). That setup
    // is intentionally left as a marked integration point — it needs testing
    // against a live RazorpayX test account, which isn't available here.
    const res = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: {
        authorization: `Basic ${this.auth}`,
        'content-type': 'application/json',
        'X-Payout-Idempotency': input.idempotencyKey,
      },
      body: JSON.stringify({
        account_number: this.cfg.accountNumber,
        amount: Number(input.amountPaise),
        currency: 'INR',
        mode: this.cfg.mode ?? 'UPI',
        purpose: 'payout',
        reference_id: input.referenceId,
        // fund_account_id: <resolved from the depositor's UPI> — see note above
        queue_if_low_balance: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.log.error(`RazorpayX payout failed (${res.status}): ${body}`);
      throw new Error(`RazorpayX payout rejected: ${res.status}`);
    }

    const data = (await res.json()) as { id: string };
    return { providerId: data.id, status: 'processing' };
  }
}
