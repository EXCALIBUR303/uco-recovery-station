import { Module } from '@nestjs/common';
import { MachinesController } from './machines.controller';
import { MachinesService } from './machines.service';
import { StatusModule } from '../status/status.module';

@Module({
  imports: [StatusModule],
  controllers: [MachinesController],
  providers: [MachinesService],
})
export class MachinesModule {}
