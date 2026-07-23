import { Module } from '@nestjs/common';
import { DepositorsController } from './depositors.controller';
import { DepositorsService } from './depositors.service';

@Module({
  controllers: [DepositorsController],
  providers: [DepositorsService],
})
export class DepositorsModule {}
