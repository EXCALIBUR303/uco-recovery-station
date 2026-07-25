import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { DepositorsService } from './depositors.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user';

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

  /** Lift a blacklist after an appeal (spec §6.2, open question #1). */
  @Post(':id/reinstate')
  reinstate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { reason?: string },
  ) {
    return this.depositors.reinstate(id, user.sub, body?.reason);
  }
}
