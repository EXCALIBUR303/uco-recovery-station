import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { KioskModule } from './kiosk/kiosk.module';
import { AuthModule } from './auth/auth.module';
import { MachinesModule } from './machines/machines.module';
import { DepositorsModule } from './depositors/depositors.module';
import { StatusModule } from './status/status.module';
import { RentalsModule } from './rentals/rentals.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    KioskModule,
    MachinesModule,
    DepositorsModule,
    StatusModule,
    RentalsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
