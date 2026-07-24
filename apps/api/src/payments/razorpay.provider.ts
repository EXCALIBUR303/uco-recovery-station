import { Logger, type Provider } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RAZORPAY_CLIENT } from './razorpay.client';
import { MockRazorpayClient } from './mock-razorpay.client';
import { RealRazorpayClient } from './real-razorpay.client';

/**
 * Picks the real RazorpayX client when credentials are present, else the mock.
 * This is the single swap point: set the three env vars and real money moves.
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
      log.log('RazorpayX credentials found — using the real payout client.');
      return new RealRazorpayClient({ keyId, keySecret, accountNumber });
    }

    log.warn(
      'No RazorpayX credentials — using the MOCK payout client. No real money will move. ' +
        'Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAYX_ACCOUNT_NUMBER to go live.',
    );
    return new MockRazorpayClient(events);
  },
};
