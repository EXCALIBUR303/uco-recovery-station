import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { PayoutService } from './payout.service';
import { WebhookController } from './webhook.controller';
import { razorpayProvider } from './razorpay.provider';

/**
 * The money layer: wallet ledger, payout lifecycle, and the swappable Razorpay
 * client. Exports PayoutService + WalletService so the kiosk (payouts) and a
 * future top-up flow can use them.
 */
@Module({
  controllers: [WebhookController],
  providers: [WalletService, PayoutService, razorpayProvider],
  exports: [WalletService, PayoutService],
})
export class PaymentsModule {}
