import { Module } from '@nestjs/common';
import { KioskController } from './kiosk.controller';
import { KioskService } from './kiosk.service';
import { StatusModule } from '../status/status.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [StatusModule, PaymentsModule],
  controllers: [KioskController],
  providers: [KioskService],
})
export class KioskModule {}
