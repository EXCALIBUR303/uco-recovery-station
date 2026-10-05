import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  CreateOrderInput,
  CreateOrderResult,
  CreatePayoutInput,
  CreatePayoutResult,
  RazorpayClient,
} from './razorpay.client';
import { MockRazorpayClient } from './mock-razorpay.client';
import { RealRazorpayClient, type RazorpayConfig } from './real-razorpay.client';

/**
 * Real Razorpay Checkout orders, mocked RazorpayX payouts. Selected when
 * RAZORPAY_KEY_ID/SECRET are set but RAZORPAYX_ACCOUNT_NUMBER isn't yet —
 * top-ups can go live (they only need the standard key pair) while payouts
 * to depositors stay safely fake until the account number and the UPI
 * fund-account resolution (see real-razorpay.client.ts) are both ready.
 */
@Injectable()
export class HybridRazorpayClient implements RazorpayClient {
  readonly ordersAreMock = false;
  readonly payoutsAreMock = true;
  readonly keyId: string;

  private readonly real: RealRazorpayClient;
  private readonly mock: MockRazorpayClient;

  constructor(cfg: Pick<RazorpayConfig, 'keyId' | 'keySecret'>, events: EventEmitter2) {
    this.keyId = cfg.keyId;
    this.real = new RealRazorpayClient({ ...cfg, accountNumber: '' });
    this.mock = new MockRazorpayClient(events);
  }

  createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    return this.real.createOrder(input);
  }

  createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
    return this.mock.createPayout(input);
  }
}
