import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { KioskModule } from './kiosk/kiosk.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, KioskModule],
  controllers: [HealthController],
})
export class AppModule {}
