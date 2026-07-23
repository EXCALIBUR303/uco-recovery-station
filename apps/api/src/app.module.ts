import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { KioskModule } from './kiosk/kiosk.module';
import { AuthModule } from './auth/auth.module';
import { MachinesModule } from './machines/machines.module';
import { DepositorsModule } from './depositors/depositors.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    KioskModule,
    MachinesModule,
    DepositorsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
