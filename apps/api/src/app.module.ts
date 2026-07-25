import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { KioskModule } from './kiosk/kiosk.module';
import { AuthModule } from './auth/auth.module';
import { MachinesModule } from './machines/machines.module';
import { DepositorsModule } from './depositors/depositors.module';
import { StatusModule } from './status/status.module';
import { RentalsModule } from './rentals/rentals.module';
import { PaymentsModule } from './payments/payments.module';
import { RentersModule } from './renters/renters.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    KioskModule,
    MachinesModule,
    DepositorsModule,
    StatusModule,
    RentalsModule,
    PaymentsModule,
    RentersModule,
    SettingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
