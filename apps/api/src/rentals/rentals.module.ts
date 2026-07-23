import { Module } from '@nestjs/common';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';
import { RentalBillingService } from './rental-billing.service';

@Module({
  controllers: [RentalsController],
  providers: [RentalsService, RentalBillingService],
})
export class RentalsModule {}
