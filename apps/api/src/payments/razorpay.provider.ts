import { Logger, type Provider } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RAZORPAY_CLIENT } from './razorpay.client';
import { MockRazorpayClient } from './mock-razorpay.client';
import { RealRazorpayClient } from './real-razorpay.client';
import { HybridRazorpayClient } from './hybrid-razorpay.client';

/**
 * Three-way switch, since orders (Checkout) and payouts (RazorpayX) go live
 * independently:
 *  - no keys at all              → full mock, nothing real
 *  - key id + secret only        → hybrid: real orders/top-ups, mocked payouts
 *  - + RAZORPAYX_ACCOUNT_NUMBER  → fully real
 */
export const razorpayProvider: Provider = {
  provide: RAZORPAY_CLIENT,
  inject: [EventEmitter2],
  useFactory: (events: EventEmitter2) => {
    const log = new Logger('Razorpay');
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER;

    if (keyId && keySecret && accountNumber) {
      log.log('Full RazorpayX credentials found — orders and payouts are both real.');
      return new RealRazorpayClient({ keyId, keySecret, accountNumber });
    }

    if (keyId && keySecret) {
      log.warn(
        'RAZORPAY_KEY_ID/SECRET found but no RAZORPAYX_ACCOUNT_NUMBER — ' +
          'orders/top-ups are REAL, payouts are still MOCKED. Set RAZORPAYX_ACCOUNT_NUMBER to go fully live.',
      );
      return new HybridRazorpayClient({ keyId, keySecret }, events);
    }

    log.warn(
      'No Razorpay credentials — using the MOCK client for everything. No real money will move. ' +
        'Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAYX_ACCOUNT_NUMBER to go live.',
    );
    return new MockRazorpayClient(events);
  },
};
