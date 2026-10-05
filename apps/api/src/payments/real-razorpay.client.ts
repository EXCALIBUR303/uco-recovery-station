import { Logger } from '@nestjs/common';
import type {
  CreateOrderInput,
  CreateOrderResult,
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
 * A UPI payout needs a RazorpayX Contact + Fund Account (VPA) resolved first;
 * createPayout does that (reusing cached ids when the caller has them) before
 * calling /v1/payouts. This is written against Razorpay's documented Contacts
 * and Fund Accounts APIs but has NOT been exercised against a live account —
 * verify against a real RazorpayX test account before trusting it with money,
 * and check the exact idempotency header name against current docs.
 */
export class RealRazorpayClient implements RazorpayClient {
  readonly ordersAreMock = false;
  readonly payoutsAreMock = false;
  readonly keyId: string;
  private readonly log = new Logger(RealRazorpayClient.name);
  private readonly auth: string;

  constructor(private readonly cfg: RazorpayConfig) {
    this.keyId = cfg.keyId;
    this.auth = Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64');
  }

  async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
    const { contactId, fundAccountId } = await this.resolveFundAccount(input);

    const res = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: {
        authorization: `Basic ${this.auth}`,
        'content-type': 'application/json',
        'X-Payout-Idempotency': input.idempotencyKey,
      },
      body: JSON.stringify({
        account_number: this.cfg.accountNumber,
        fund_account_id: fundAccountId,
        amount: Number(input.amountPaise),
        currency: 'INR',
        mode: this.cfg.mode ?? 'UPI',
        purpose: 'payout',
        reference_id: input.referenceId,
        queue_if_low_balance: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.log.error(`RazorpayX payout failed (${res.status}): ${body}`);
      throw new Error(`RazorpayX payout rejected: ${res.status}`);
    }

    const data = (await res.json()) as { id: string };
    return {
      providerId: data.id,
      status: 'processing',
      razorpayContactId: contactId,
      razorpayFundAccountId: fundAccountId,
    };
  }

  /**
   * Reuses the depositor's cached contact/fund-account if the caller has one;
   * otherwise registers both with RazorpayX. A fund account is immutable once
   * created (a changed UPI ID needs a new one — never mutate in place, since
   * that could silently redirect an existing depositor's payouts).
   */
  private async resolveFundAccount(
    input: CreatePayoutInput,
  ): Promise<{ contactId: string; fundAccountId: string }> {
    if (input.razorpayFundAccountId && input.razorpayContactId) {
      return { contactId: input.razorpayContactId, fundAccountId: input.razorpayFundAccountId };
    }

    const contactId = input.razorpayContactId ?? (await this.createContact(input.depositorName));
    const fundAccountId = await this.createFundAccount(contactId, input.upiId);
    return { contactId, fundAccountId };
  }

  private async createContact(name: string): Promise<string> {
    const res = await fetch('https://api.razorpay.com/v1/contacts', {
      method: 'POST',
      headers: { authorization: `Basic ${this.auth}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name, type: 'vendor' }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.log.error(`RazorpayX contact creation failed (${res.status}): ${body}`);
      throw new Error(`RazorpayX contact rejected: ${res.status}`);
    }
    const data = (await res.json()) as { id: string };
    return data.id;
  }

  private async createFundAccount(contactId: string, upiId: string): Promise<string> {
    const res = await fetch('https://api.razorpay.com/v1/fund_accounts', {
      method: 'POST',
      headers: { authorization: `Basic ${this.auth}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        contact_id: contactId,
        account_type: 'vpa',
        vpa: { address: upiId },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.log.error(`RazorpayX fund account creation failed (${res.status}): ${body}`);
      throw new Error(`RazorpayX fund account rejected: ${res.status}`);
    }
    const data = (await res.json()) as { id: string };
    return data.id;
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    // Razorpay Checkout order (standard Razorpay, same key pair). The frontend
    // opens Checkout with this order id; on success a payment webhook confirms
    // the top-up. That webhook + its signature check are integration points
    // that need a live test account (see webhook.controller.ts).
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        authorization: `Basic ${this.auth}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        amount: Number(input.amountPaise),
        currency: 'INR',
        receipt: input.receipt,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.log.error(`Razorpay order failed (${res.status}): ${body}`);
      throw new Error(`Razorpay order rejected: ${res.status}`);
    }
    const data = (await res.json()) as { id: string };
    return { orderId: data.id };
  }
}
