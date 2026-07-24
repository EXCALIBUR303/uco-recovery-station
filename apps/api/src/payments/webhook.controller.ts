import { Body, Controller, Post } from '@nestjs/common';
import { PayoutService } from './payout.service';

/**
 * RazorpayX settlement webhook (real path). The mock settles via an internal
 * event instead, so this endpoint is exercised only against real credentials.
 *
 * NOTE: signature verification is TODO — before going live, verify the
 * X-Razorpay-Signature header against the webhook secret so a forged POST can't
 * mark a payout settled. Left as a marked integration point since it needs a
 * real webhook secret to test.
 */
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly payouts: PayoutService) {}

  @Post('razorpayx')
  async razorpayx(
    @Body() body: { payload?: { payout?: { entity?: { id?: string; status?: string } } } },
  ) {
    const entity = body?.payload?.payout?.entity;
    if (entity?.id && entity.status) {
      const outcome = entity.status === 'processed' ? 'processed' : 'failed';
      await this.payouts.settle(entity.id, outcome);
    }
    return { received: true };
  }
}
