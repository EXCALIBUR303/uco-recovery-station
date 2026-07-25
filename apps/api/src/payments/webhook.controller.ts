import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PayoutService } from './payout.service';
import { TopupService } from './topup.service';
import { isValidRazorpaySignature } from './webhook-signature';

/**
 * Razorpay / RazorpayX settlement webhooks (the real payment path — the mock
 * settles through an internal event instead).
 *
 * Both endpoints verify the X-Razorpay-Signature HMAC before acting, so a forged
 * POST cannot mark a payout settled or credit a wallet. Set RAZORPAY_WEBHOOK_SECRET
 * to enable verification; without it the endpoints refuse to act on anything,
 * because an unverified money webhook is worse than a missing one.
 */
@Controller('webhooks')
export class WebhookController {
  private readonly log = new Logger(WebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payouts: PayoutService,
    private readonly topups: TopupService,
  ) {}

  /** RazorpayX payout settlement. */
  @Post('razorpayx')
  async razorpayx(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Body() body: { payload?: { payout?: { entity?: { id?: string; status?: string } } } },
  ) {
    this.verify(req, signature);

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
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Body()
    body: {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
    },
  ) {
    this.verify(req, signature);

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

  private verify(req: RawBodyRequest<Request>, signature?: string): void {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      // Fail closed: without a secret we cannot tell a real webhook from a
      // forged one, so we act on neither.
      this.log.error(
        'Webhook received but RAZORPAY_WEBHOOK_SECRET is not set — rejecting. ' +
          'Set it to the secret configured in the Razorpay dashboard.',
      );
      throw new UnauthorizedException('Webhook verification is not configured');
    }
    const raw = req.rawBody ?? Buffer.from('');
    if (!isValidRazorpaySignature(raw, signature, secret)) {
      this.log.warn('Rejected a webhook with an invalid signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
