import { Module } from '@nestjs/common';
import { KioskController } from './kiosk.controller';
import { KioskService } from './kiosk.service';
import { StatusModule } from '../status/status.module';

@Module({
  imports: [StatusModule],
  controllers: [KioskController],
  providers: [KioskService],
})
export class KioskModule {}
