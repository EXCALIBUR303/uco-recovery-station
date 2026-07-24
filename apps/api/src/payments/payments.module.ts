import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { PayoutService } from './payout.service';
import { TopupService } from './topup.service';
import { WebhookController } from './webhook.controller';
import { WalletController } from './wallet.controller';
import { razorpayProvider } from './razorpay.provider';
import { StatusModule } from '../status/status.module';

/**
 * The money layer: wallet ledger, payout + top-up lifecycles, and the swappable
 * Razorpay client. Imports StatusModule so a top-up can recompute a machine out
 * of balance_zero.
 */
@Module({
  imports: [StatusModule],
  controllers: [WebhookController, WalletController],
  providers: [WalletService, PayoutService, TopupService, razorpayProvider],
  exports: [WalletService, PayoutService],
})
export class PaymentsModule {}
