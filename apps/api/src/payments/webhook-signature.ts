import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Razorpay signs every webhook with HMAC-SHA256 over the raw request body,
 * keyed by the webhook secret, and sends it in X-Razorpay-Signature. Verifying
 * it is what stops anyone from POSTing a forged "payout processed" and moving
 * money in our ledger.
 *
 * Comparison is constant-time so a wrong signature can't be brute-forced by
 * measuring how long the check takes.
 */
export function isValidRazorpaySignature(
  rawBody: Buffer | string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
