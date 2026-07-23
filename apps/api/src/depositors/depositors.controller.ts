import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DepositorsService } from './depositors.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

// Depositor accounts are visible to the company admin only. Renters see their
// machines' transactions, never the depositor roster (spec §8 vs §9.2).
@UseGuards(JwtGuard, RolesGuard)
@Roles('admin')
@Controller('depositors')
export class DepositorsController {
  constructor(private readonly depositors: DepositorsService) {}

  @Get()
  list() {
    return this.depositors.list();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.depositors.detail(id);
  }
}
