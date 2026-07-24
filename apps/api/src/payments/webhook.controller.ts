import { Body, Controller, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PayoutService } from './payout.service';
import { TopupService } from './topup.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly payouts: PayoutService,
    private readonly topups: TopupService,
  ) {}

  /** RazorpayX payout settlement. */
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

  /** Razorpay Checkout payment captured — confirms a wallet top-up. */
  @Post('razorpay')
  async razorpay(
    @Body()
    body: {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
    },
  ) {
    if (body?.event === 'payment.captured') {
      const entity = body.payload?.payment?.entity;
      if (entity?.order_id) {
        const topup = await this.prisma.walletTopup.findFirst({
          where: { razorpayOrderId: entity.order_id },
        });
        if (topup) await this.topups.confirm(topup.id, entity.id);
      }
    }
    return { received: true };
  }
}
